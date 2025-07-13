

import { num, str } from "../defs_server_symlink.js"
import { $NT, LazyLoadRefreshT, GenericRowT, CMechViewT, CMechViewPartT, CMechLoadedDataT } from "../defs.js"
import { EnsureObjectStoresActive as LocalDBSyncEnsureObjectStoresActive } from "./localdbsync.js"

declare var $N: $NT;


// these are loaded on Init and stay loaded indefinitely
let _lazyload_data_funcs:Array<()=>Promise<Map<str, GenericRowT[]>>> = []

// these are set when a new view is added, and removed when that view is rmoved (or when load view failed) 
let _loadeddata:Map<str, CMechLoadedDataT> = new Map() // map by view name of Map by path name with data
let _searchparams:Map<str, GenericRowT> = new Map() // map by view name
let _pathparams:Map<str, GenericRowT> = new Map() // map by view name




const Init = (lazyload_data_funcs:Array<()=>Promise<Map<str, GenericRowT[]>>>) => {
	_lazyload_data_funcs = lazyload_data_funcs
}




const AddView = (
	componentname:str, 
	pathparams: GenericRowT, 
	searchparams_raw:URLSearchParams, 
	localdb_preload:str[]|null|undefined,
	refreshspecs:LazyLoadRefreshT[]|null = null,
) => new Promise<num|null>(async (res, rej)=> {

	const searchparams_genericrowt:GenericRowT = {};
	for (const [key, value] of searchparams_raw.entries()) { 
		searchparams_genericrowt[key] = decodeURIComponent(value); 
	}

	{
		const promises:Promise<any>[] = []
		let   promises_r:any[] = []
		
		const localdbsync_promise = localdb_preload ? LocalDBSyncEnsureObjectStoresActive(localdb_preload) : Promise.resolve(1)


		promises.push( localdbsync_promise )
		promises.push( _lazyload_data_funcs[componentname+"_a"](pathparams, new URLSearchParams, searchparams_raw) )

		promises.push( new Promise<Map<str,GenericRowT[]>>(async (res, rej)=> {
			let r:any = {}; let _:any = {}

			try   { 
				_ = await localdbsync_promise; 
				r = await _lazyload_data_funcs[componentname+"_indexeddb"](pathparams, new URLSearchParams, searchparams_raw)
			}
			catch { rej(); return; }
			
			res(r);
		}));

		try   { promises_r = await Promise.all(promises); }
		catch { rej(); return; }


		const loadeddata = new Map<str, GenericRowT[]>();
		for (const [datapath, generic_row_array] of promises_r[1].entries())   loadeddata.set(datapath, generic_row_array)
		for (const [datapath, generic_row_array] of promises_r[2].entries())   loadeddata.set(datapath, generic_row_array)

		_loadeddata.set(componentname, loadeddata)
	}

	if (refreshspecs && refreshspecs.length > 0) { 
		handle_refresh_listeners(refreshspecs, componentname, pathparams);
	}
	
	_searchparams.set(componentname, searchparams_genericrowt)
	_pathparams.set(componentname, pathparams)

	const parentEl = document.querySelector("#views")!;
	parentEl.insertAdjacentHTML("beforeend", `<v-${componentname} class='view'></v-${componentname}>`);

	const el = parentEl.getElementsByTagName(`v-${componentname}`)[0] as HTMLElement & CMechViewT

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

	console.log("I THINK THIS IS FIXED. JUST DONT PASS DATA TO ATTRIBUTE FUNCTION DUMB ASS. .... need to somehow wrap in logic where if data is changed or searchparams that (for subels) it allows the attributes to be changed first, then wait for the load and kd calls to transpire before calling sc")

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
	const oldsearchparams   = _searchparams.get(componentname)!

	const promises:Promise<any>[] = []
	let   promises_r:any[] = []

	promises.push( _lazyload_data_funcs[componentname+"_a"](pathparams, oldsearchparams, newsearchparams) )
	promises.push( _lazyload_data_funcs[componentname+"_indexeddb"](pathparams, oldsearchparams, newsearchparams) )

	try   { promises_r = await Promise.all(promises); }
	catch { rej(); return; }

	_searchparams.set(componentname, newsearchparams)

	const loadeddata = new Map<str, GenericRowT[]>();
	for (const [datapath, generic_row_array] of promises_r[1].entries())   loadeddata.set(datapath, generic_row_array)
	for (const [datapath, generic_row_array] of promises_r[2].entries())   loadeddata.set(datapath, generic_row_array)

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




const handle_refresh_listeners = (refreshspecs:LazyLoadRefreshT[], componentname:str, pathparams:GenericRowT) => {

	// currently only support data sync refreshes
	if (!refreshspecs.every(spec => spec.event === "datasync")) {   return;   }


	const sse_listeners:Set<string> = new Set();

	for (const spec of refreshspecs) {
		for (const what_item of spec.what) {
			
			// Expand path parameters (e.g., 'machines/:id' -> 'machines/1234')
			let expanded_path = what_item;
			if (what_item.includes(':')) {
				const segments = what_item.split('/');
				const expanded_segments = segments.map(segment => {
					if (segment.startsWith(':')) {
						const param_name = segment.slice(1); // Remove the ':'
						return pathparams[param_name] || segment; // Use actual value or keep original if not found
					}
					return segment;
				});
				expanded_path = expanded_segments.join('/');
			}
			
			if (expanded_path.includes('/')) { // Check if it's a document reference (contains '/')
				sse_listeners.add('firestore_collection');
				sse_listeners.add('firestore_doc_patch');

			} else {
				// Collection reference: listen for all events
				sse_listeners.add('firestore_doc_add');
				sse_listeners.add('firestore_doc_delete');
				sse_listeners.add('firestore_doc_patch');
				sse_listeners.add('firestore_collection');
			}
		}
	}


	/*
	const searchparams_genericrowt:GenericRowT = {};
	for (const [key, value] of searchparams_raw.entries()) { 
		searchparams_genericrowt[key] = decodeURIComponent(value); 
	}

	{
		const promises:Promise<any>[] = []
		let   promises_r:any[] = []
		
		const localdbsync_promise = localdb_preload ? LocalDBSyncEnsureObjectStoresActive(localdb_preload) : Promise.resolve(1)


		promises.push( localdbsync_promise )
		promises.push( _lazyload_data_funcs[componentname+"_a"](pathparams, new URLSearchParams, searchparams_raw) )

		promises.push( new Promise<Map<str,GenericRowT[]>>(async (res, rej)=> {
			let r:any = {}; let _:any = {}

			try   { 
				_ = await localdbsync_promise; 
				r = await _lazyload_data_funcs[componentname+"_indexeddb"](pathparams, new URLSearchParams, searchparams_raw)
			}
			catch { rej(); return; }
			
			res(r);
		}));

		try   { promises_r = await Promise.all(promises); }
		catch { rej(); return; }


		const loadeddata = new Map<str, GenericRowT[]>();
		for (const [datapath, generic_row_array] of promises_r[1].entries())   loadeddata.set(datapath, generic_row_array)
		for (const [datapath, generic_row_array] of promises_r[2].entries())   loadeddata.set(datapath, generic_row_array)

		_loadeddata.set(componentname, loadeddata)
	}
	*/
}






export { Init, AddView, SearchParamsChanged, DataChanged, RemoveActiveView }

if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).CMech = { ViewConnectedCallback, ViewPartConnectedCallback, AttributeChangedCallback, ViewDisconnectedCallback, ViewPartDisconnectedCallback };



