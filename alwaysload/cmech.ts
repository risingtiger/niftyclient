

import { num, str } from "../defs_server_symlink.js"
import { $NT, LazyLoadFuncReturnT, LazyLoadFuncRefreshSpecT, GenericRowT, CMechViewT, CMechViewPartT, CMechLoadedDataT } from "../defs.js"
import { EnsureObjectStoresActive as LocalDBSyncEnsureObjectStoresActive } from "./localdbsync.js"

declare var $N: $NT;

type RefreshListenerSpecT = {
	type: "datasync" | "placeholder",
	event: Set<str>,
	paths: str[],
	func: str, // the function to call to refresh the data
}


// these are loaded on Init and stay loaded indefinitely
let _all_lazyload_data_funcs:Array<()=>Promise<Map<str, GenericRowT[]>>> = []

// these are set when a new view is added, and removed when that view is rmoved (or when load view failed) 
let _loadeddata:Map<str, CMechLoadedDataT> = new Map() // map by view name of Map by path name with data
let _searchparams:Map<str, GenericRowT> = new Map() // map by view name
let _pathparams:Map<str, GenericRowT> = new Map() // map by view name




const Init = (lazyload_data_funcs:Array<()=>Promise<Map<str, GenericRowT[]>>>) => {
	_all_lazyload_data_funcs = lazyload_data_funcs
}




const AddView = (
	componentname:str, 
	pathparams: GenericRowT, 
	searchparams_raw:URLSearchParams, 
	localdb_preload:str[]|null|undefined,
) => new Promise<num|null>(async (res, rej)=> {

	const searchparams_genericrowt:GenericRowT = {};
	for (const [key, value] of searchparams_raw.entries()) { 
		searchparams_genericrowt[key] = decodeURIComponent(value); 
	}

	_searchparams.set(componentname, searchparams_genericrowt)
	_pathparams.set(componentname, pathparams)

	let loadr:LazyLoadFuncReturnT;
	try   { loadr = await _all_lazyload_data_funcs[componentname+"_main"](pathparams, searchparams_raw, localdb_preload); }
	catch { rej(); return; }

	const loadeddata = new Map<str, GenericRowT[]>();
	for (const [datapath, generic_row_array] of loadr.d.entries())   loadeddata.set(datapath, generic_row_array)

	_loadeddata.set(componentname, loadeddata)

	const parentEl = document.querySelector("#views")!;
	parentEl.insertAdjacentHTML("beforeend", `<v-${componentname} class='view'></v-${componentname}>`);

	const el = parentEl.getElementsByTagName(`v-${componentname}`)[0] as HTMLElement & CMechViewT

	if (loadr.refreshspecs && loadr.refreshspecs.length > 0) {   handle_refresh_listeners(loadr.refreshspecs, el, componentname, "main");  }


	el.addEventListener("hydrated", ()=> { 
		res(1); 
	})
	el.addEventListener("failed",   ()=> { 
		_loadeddata.delete(componentname)
		_searchparams.delete(componentname)
		_pathparams.delete(componentname)
		el.remove()
		res(null); 
	})

	el.addEventListener("lateloaded", lateloaded)

	parentEl.addEventListener("visibled", visibled)

	let has_late_loaded = false
	let has_visibled    = false


	function visibled() {
		if (el.opts?.kdonvisibled) { 
			el.kd(
					_loadeddata.get(componentname)!, 
					'visibled',
					_pathparams.get(componentname)!,
					_searchparams.get(componentname)!
				)
			el.sc()
			has_visibled = true
			handle_visibled_and_late_loaded()
		}
		parentEl.removeEventListener("visibled", visibled)
	}

	function lateloaded() {
		if (el.opts?.kdonvisibled) { 
			has_late_loaded = true
			handle_visibled_and_late_loaded()
		}
		parentEl.removeEventListener("lateloaded", lateloaded)
	}

	function handle_visibled_and_late_loaded() {
		if (has_late_loaded && has_visibled && el.opts?.kdonlateloaded) {
			el.kd(
					_loadeddata.get(componentname)!, 
					'lateloaded',
					_pathparams.get(componentname)!,
					_searchparams.get(componentname)!
				)
			el.sc()
		}
	}
})




const ViewConnectedCallback = async (component:HTMLElement & CMechViewT, opts:any = {kdonvisibled:false, kdonlateloaded:false}) => new Promise<void>(async (res, _rej)=> {

	const tagname                            = component.tagName.toLowerCase()
	const tagname_split                      = tagname.split("-")
	const viewname                           = tagname_split[1]

	if (tagname_split[0] !== 'v') throw new Error("Not a view component")

	for(const prop in component.a) component.a[prop] = component.getAttribute(prop);

	if (!opts.kdonvisilbed)   opts.kdonvisilbed   = false
	if (!opts.kdonlateloaded) opts.kdonlateloaded = false

	component.opts = opts

	component.subelshldr = []

	const loadeddata = _loadeddata.get(viewname)!

	component.kd(loadeddata, 'initial', _pathparams.get(viewname)!, _searchparams.get(viewname)!)
	component.sc()

	$N.EngagementListen.Add_Listener(component, "component", "resize", null, async ()=> {   component.sc();   });

	// component.subelshldr array will be populated by the sub elements of the view if they exist after initial render -- keep in mind they will be EVEN AFTER the view is initially hydrated at any point later 

	component.subelshldr?.forEach((el:any)=>  {
		el.addEventListener("failed", ()=> { component.dispatchEvent(new CustomEvent("failed")); res(); return; })
		el.addEventListener("hydrated", ()=> {
			el.dataset.sub_is_hydrated = "1"
			if (component.subelshldr!.every((el:any)=> el.dataset.sub_is_hydrated === "1")) {
				res(); return;
			}
		})
	}) ?? res()
})




const ViewPartConnectedCallback = async (component:HTMLElement & CMechViewPartT) => new Promise<void>(async (res, _rej)=> {

	const tagname                     = component.tagName.toLowerCase()
	const tagname_split               = tagname.split("-")

	if (tagname_split[0] !== 'vp') throw new Error("Not a view part component")

	const rootnode                    = component.getRootNode()
	const host                        = ( rootnode as any ).host as HTMLElement & CMechViewT
	const ancestor_view_tagname       = host.tagName.toLowerCase()
	const ancestor_view_tagname_split = ancestor_view_tagname.split("-")
	const ancestor_viewname           = ancestor_view_tagname_split[1]

	for(const prop in component.a) component.a[prop] = component.getAttribute(prop)

	host.subelshldr!.push(component)
	component.hostview = host

	const loadeddata    = _loadeddata.get(ancestor_viewname)!

	component.kd(loadeddata, 'initial', _pathparams.get(ancestor_viewname)!, _searchparams.get(ancestor_viewname)!)
	component.sc()

	$N.EngagementListen.Add_Listener(component, "component", "resize", null, async ()=> {component.sc()})

	res()
})




const AttributeChangedCallback = (component:HTMLElement, name:string, oldval:str|boolean|number, newval:string|boolean|number, _opts?:object) => {

	if (oldval === null) return

	const a = (component as any).a as {[key:string]:any}

	a[name] = newval

	if (!a.updatescheduled) {
		a.updatescheduled = true
		Promise.resolve().then(()=> { 
			(component as any).sc()
			a.updatescheduled = false
		})
	}
}




const ViewDisconnectedCallback = (component:HTMLElement) => {

	if (!component.tagName.startsWith("V-")) throw new Error("Not a view component")

	const componentname           = component.tagName.toLowerCase().split("-")[1]

	_loadeddata.delete(componentname) 
	_searchparams.delete(componentname) 
	_pathparams.delete(componentname) 
}




const ViewPartDisconnectedCallback = (component:HTMLElement & CMechViewPartT) => {

	if (!component.tagName.startsWith("VP-")) throw new Error("Not a view part component")

	const index = component.hostview!.subelshldr!.indexOf(component)
	component.hostview!.subelshldr!.splice(index, 1)
}




const SearchParamsChanged = (newsearchparams:GenericRowT) => new Promise<void>(async (res, rej)=> {

	const activeviewel      = document.getElementById("views")!.lastElementChild as HTMLElement & CMechViewT

	const componentname     = activeviewel.tagName.toLowerCase().split("-")[1]
	const pathparams        = _pathparams.get(componentname)!

	const promises:Promise<any>[] = []
	let   promises_r:any[] = []

	promises.push( _all_lazyload_data_funcs[componentname+"_main"](pathparams, newsearchparams) )

	try   { promises_r = await Promise.all(promises); }
	catch { rej(); return; }

	_searchparams.set(componentname, newsearchparams)

	const loadeddata = new Map<str, GenericRowT[]>();
	for (const [datapath, generic_row_array] of promises_r[0].entries())   loadeddata.set(datapath, generic_row_array)

	// will comnpletely replace the old loaded data for this view from main load function

	_loadeddata.set(componentname, loadeddata) 

	activeviewel.kd(loadeddata, 'searchchanged', _pathparams.get(componentname)!, _searchparams.get(componentname)!)
	activeviewel.sc()

	for (const subel of ( activeviewel.subelshldr as ( HTMLElement & CMechViewPartT )[] )) {
		subel.kd(loadeddata, 'searchchanged', _pathparams.get(componentname)!, _searchparams.get(componentname)!)
		subel.sc()
	}

	res()
})




const DataChanged = (updated:Map<str, GenericRowT[]>) => {

	// right now, ONLY using type of 1 (localdb). 

	// updated is a map, key being a string like: '1:machines'. 1: localdb, 2: remotedb, 3:remoteapi	
	// if 1, it is always a collection like '1:machines' or '1:users'
	// if 1, the data is always an array, even if just one object. id of object is always present, and is the id of the object in the collection

	const viewsel                      = document.getElementById("views")!
	const update_types:number[]        = []
	const update_paths:str[]           = []
	const update_lists:GenericRowT[][] = []

	for (const [datapath, updatedlist] of updated) {
		update_types.push(Number( datapath.charAt(0) )) // 1: localdb, 2: remotedb, 3: remoteapi 
		update_paths.push(datapath.slice(2)) 
		update_lists.push(updatedlist)
	}

	for (const [view_component_name, loadeddata] of _loadeddata) { // right now, since we migrated to a multi page app, this loop will I believe only ever run once

		const viewel = viewsel.querySelector(`v-${view_component_name}`) as HTMLElement & CMechViewT

		const loadeddata_types:number[]         = []
		const loadeddata_paths:str[]            = []
		const loadeddata_arrays:GenericRowT[][] = []

		for (const [loadeddata_path_raw, loadeddata_array] of loadeddata) {
			loadeddata_types.push(Number( loadeddata_path_raw.charAt(0) )) // 1: localdb, 2: remotedb, 3: remoteapi
			loadeddata_paths.push(loadeddata_path_raw.slice(2))
			loadeddata_arrays.push(loadeddata_array)
		}

		for(let i = 0; i < update_types.length; i++) {

			let loadeddata_index = -1

			for (let j = 0; j < loadeddata_types.length; j++) {
				if (loadeddata_types[j] !== update_types[i]) continue;
				if( loadeddata_paths[j] === update_paths[i] ) {
					loadeddata_index = j; break;
				}
				if( update_types[i] === 1 && loadeddata_paths[j].includes('/') && loadeddata_paths[j].startsWith(update_paths[i] + '/') ) {
					loadeddata_index = j; break;
				}
			}

			if (loadeddata_index === -1) continue; // no match found

			const list_of_add_and_patches:GenericRowT[] = []
			const list_of_deletes:GenericRowT[]  = []
			for (const d of update_lists[i]) { if (d.isdeleted) list_of_deletes.push(d); else list_of_add_and_patches.push(d); }

			updateArrayIfPresent(loadeddata_arrays[loadeddata_index], list_of_add_and_patches, list_of_deletes)

			viewel.kd(loadeddata, 'datachanged', _pathparams.get(view_component_name)!, _searchparams.get(view_component_name)!)		
			viewel.sc()

			for (const subel of ( viewel.subelshldr as ( HTMLElement & CMechViewPartT )[] )) {
				subel.kd(loadeddata, 'datachanged', _pathparams.get(view_component_name)!, _searchparams.get(view_component_name)!)
				subel.sc()
			}
		}
	}
}




const RemoveActiveView = () => {
	const viewsel = document.getElementById("views")!
	const activeview = viewsel.lastElementChild as HTMLElement & CMechViewT
	const viewname = activeview.tagName.toLowerCase().split("-")[1];

	if (!activeview) return;

	_loadeddata.delete(viewname)
	_searchparams.delete(viewname)
	_pathparams.delete(viewname)

	activeview.remove();
}




const LoadUrlSubMatch = (componentname:str, subparams:GenericRowT, loadfunc_suffix?:str) => new Promise<void>(async (res, rej) => {

	const viewel       = document.querySelector(`#views > v-${componentname}`) as HTMLElement & CMechViewT
	const pathparams   = _pathparams.get(componentname)!
	const searchparams = _searchparams.get(componentname)!

	const merged_pathparams = { ...pathparams, ...subparams }
	_pathparams.set(componentname, merged_pathparams)

	if (loadfunc_suffix) {
		let loadr:LazyLoadFuncReturnT;
		try   { loadr = await _all_lazyload_data_funcs[componentname + "_" + loadfunc_suffix](merged_pathparams, searchparams); }
		catch { rej(); return; }

		const newloadeddata = new Map<str, GenericRowT[]>();
		for (const [datapath, generic_row_array] of loadr.d.entries())   newloadeddata.set(datapath, generic_row_array)

		const existing_loadeddata   = _loadeddata.get(componentname)!
		for (const [datapath, generic_row_array] of newloadeddata.entries()) {
			existing_loadeddata.set(datapath, generic_row_array)
		}
		_loadeddata.set(componentname, existing_loadeddata)

		if (loadr.refreshspecs && loadr.refreshspecs.length > 0) {   handle_refresh_listeners(loadr.refreshspecs, viewel, componentname, loadfunc_suffix);  }
	}

	const loadeddata = _loadeddata.get(componentname)!

	viewel.kd(loadeddata, 'subchanged', merged_pathparams, _searchparams.get(componentname)!)		
	viewel.sc()

	for (const subel of ( viewel.subelshldr as ( HTMLElement & CMechViewPartT )[] )) {
		subel.kd(loadeddata, 'subchanged', merged_pathparams, _searchparams.get(componentname)!)
		subel.sc()
	}


	res()
})



/*
const LoadUrlSubMatch = (
  componentname: str,
  submatch_pattern: str,
  submatch_matches: str[]
) => new Promise<void>(async (res, rej) => {

	const pathparams = GetPathParams([], submatch_matches);  // Extract params from submatch
	const current_searchparams = _searchparams.get(componentname) || {};

	// Get submatch-specific data function
	const submatch_func_name = `${componentname}_submatches_${submatch_pattern.replace(/[^a-zA-Z0-9]/g, '_')}`;
	const submatch_func = _lazyload_data_funcs[submatch_func_name];

	if (!submatch_func) {
	  rej(new Error(`No data function found for submatch: ${submatch_func_name}`));
	  return;
	}

	try {
	  // Load submatch data
	  const submatch_data = await submatch_func(pathparams, current_searchparams);

	  // Store submatch data
	  if (!_submatch_data.has(componentname)) {
		  _submatch_data.set(componentname, new Map());
	  }
	  _submatch_data.get(componentname)!.set(submatch_pattern, submatch_data);
	  _active_submatches.set(componentname, submatch_pattern);

	  // Get current view element
	  const viewel = document.querySelector(`v-${componentname}`) as HTMLElement & CMechViewT;

	  // Merge main view data with submatch data
	  const main_data = _loadeddata.get(componentname) || new Map();
	  const merged_data = new Map(main_data);

	  // Add submatch data with prefixed keys to avoid conflicts
	  for (const [key, value] of submatch_data.entries()) {
		  merged_data.set(`submatch_${key}`, value);
	  }

	  // Update view with merged data
	  viewel.kd(merged_data, 'submatch_loaded', _pathparams.get(componentname)!,
	_searchparams.get(componentname)!);
	  viewel.sc();

	  // Update all subels
	  for (const subel of (viewel.subelshldr as (HTMLElement & CMechViewPartT)[])) {
		  subel.kd(merged_data, 'submatch_loaded', _pathparams.get(componentname)!,
	_searchparams.get(componentname)!);
		  subel.sc();
	  }

	  res();
	} catch (error) {
	  rej(error);
	}
});
*/




const updateArrayIfPresent = (tolist:GenericRowT[], list_of_add_and_patches:GenericRowT[], list_of_deletes:GenericRowT[]) => { 

	// Even single items like a machine (e.g. 'machines/1234') will always be an array of one object

	// we create a map because we have to assume this could be a large array and we want to avoid O(n^2) complexity
	// thus why we createa a map of the ids
	const index_map = new Map();
	tolist.forEach((row:any, i:num) => index_map.set(row.id, i))

	for(const d of list_of_add_and_patches) {   
		const rowindex = index_map.get(d.id)
		if (rowindex === undefined) tolist.push(d); else tolist[rowindex] = d;
	}

	// Process deletions in reverse order to avoid index shifting issues
	const delete_indices = list_of_deletes
		.map(d => index_map.get(d.id))
		.filter(idx => idx !== undefined)
		.sort((a, b) => b - a); // Sort descending

	for (const rowindex of delete_indices) {
		tolist.splice(rowindex, 1);
	}
}




const handle_refresh_listeners = (
	refreshspecs:LazyLoadFuncRefreshSpecT[],
	viewel:HTMLElement & CMechViewT,
	componentname:str,
	func_name_suffix:str,
) => {

	// currently only support data sync refreshes
	if (!refreshspecs.every(spec => spec.type === "datasync")) {   return;   }

	// Currtnly path can only be a top level collection or a top level collection document, e.g. 'machines' or 'machines/1234'

	const eventnames:Set<str> = new Set();
	const paths:Set<str> = new Set();
	for(const spec of refreshspecs) {

		for (const path of spec.paths) {

			paths.add(path);

			// is a doc, e.g. 'machines/1234' so listen for its patch or all collection change
			if (path.includes("/")) {
				eventnames.add('firestore_doc_patch');
				eventnames.add('firestore_collection');

			// is a collection, e.g. 'machines' so listen for essentially all of it
			} else {
				eventnames.add('firestore_doc_add');
				eventnames.add('firestore_doc_delete');
				eventnames.add('firestore_doc_patch');
				eventnames.add('firestore_collection');
			}
		}
	}

	$N.SSEvents.Add_Listener(viewel, "v_" + componentname + "_" + func_name_suffix, Array.from(eventnames), Array.from(paths), null, async (_event_data:any) => {
		const pathparams = _pathparams.get(componentname)!;
		const searchparams = _searchparams.get(componentname)!;

		let loadr:LazyLoadFuncReturnT;
		try   { loadr = await _all_lazyload_data_funcs[componentname + "_" + func_name_suffix](pathparams, searchparams); }
		catch { return; }

		const newloadeddata = new Map<str, GenericRowT[]>();
		for (const [datapath, generic_row_array] of loadr.d.entries())   newloadeddata.set(datapath, generic_row_array)

		const existing_loadeddata = _loadeddata.get(componentname)!
		for (const [datapath, generic_row_array] of newloadeddata.entries()) {
			existing_loadeddata.set(datapath, generic_row_array)
		}
		_loadeddata.set(componentname, existing_loadeddata)

		viewel.kd(existing_loadeddata, 'datachanged', pathparams, searchparams)		
		viewel.sc()

		for (const subel of ( viewel.subelshldr as ( HTMLElement & CMechViewPartT )[] )) {
			subel.kd(existing_loadeddata, 'datachanged', pathparams, searchparams)
			subel.sc()
		}
	})


	$N.EngagementListen.Add_Listener(
		viewel,
		"v_" + componentname + "_" + func_name_suffix + "_focus",
		"visible",
		null,
		async () => {

			const pathparams   = _pathparams.get(componentname)!;
			const searchparams = _searchparams.get(componentname)!;

			let loadr: LazyLoadFuncReturnT;
			try   { loadr = await _all_lazyload_data_funcs[componentname + "_" + func_name_suffix](pathparams, searchparams, undefined, true /*refreshcache*/); }
			catch { return; }

			/* merge – do NOT overwrite */
			const existing_loadeddata = _loadeddata.get(componentname)!;

			for (const [datapath, newrows] of loadr.d.entries()) {

				const exists = existing_loadeddata.get(datapath) || [];
				/* reuse helper already declared below in file */
				updateArrayIfPresent(
					exists,
					newrows.filter(r => !r.isdeleted),
					newrows.filter(r =>  r.isdeleted)
				);
				existing_loadeddata.set(datapath, exists);
			}

			/* propagate to view + sub-els */
			viewel.kd(existing_loadeddata, 'datachanged', pathparams, searchparams);
			viewel.sc();
			for (const sub of (viewel.subelshldr as (HTMLElement & CMechViewPartT)[])) {
				sub.kd(existing_loadeddata, 'datachanged', pathparams, searchparams);
				sub.sc();
			}
		}
	);
	// -----------------------------------------------------------
}






export { Init, AddView, SearchParamsChanged, DataChanged, RemoveActiveView, LoadUrlSubMatch }

if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).CMech = { ViewConnectedCallback, ViewPartConnectedCallback, AttributeChangedCallback, ViewDisconnectedCallback, ViewPartDisconnectedCallback };



