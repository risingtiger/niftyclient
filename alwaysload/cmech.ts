

import { num, str, bool } from "../defs_server_symlink.js"
import { $NT, LazyLoadFuncReturnT, LazyLoadFuncRefreshSpecT, GenericRowT, CMechViewT, CMechViewPartT, CMechLoadedDataT, FetchLassieOptsT } from "../defs.js"


declare var $N: $NT;

type Listening = {
    paths: str[],
	componentname:str,
	issub:bool,
	func_name_suffix: str,
    cb:(reason:'visible'|'sse')=>Promise<void>
}


// these are loaded on Init and stay loaded indefinitely
let _all_lazyload_data_funcs:Array<()=>Promise<Map<str, GenericRowT[]>>> = []

// these are set when a new view is added, and removed when that view is rmoved (or when load view failed) 
let _loadeddata:Map<str, CMechLoadedDataT> = new Map() // map by view name of Map by path name with data
let _searchparams:Map<str, GenericRowT> = new Map() // map by view name
let _pathparams:Map<str, GenericRowT> = new Map() // map by view name
let _listening:Listening[] = []


const Init = (lazyload_data_funcs:Array<()=>Promise<Map<str, GenericRowT[]>>>) => {
	_all_lazyload_data_funcs = lazyload_data_funcs




	// TODO: Put SSEvents and Engagement Events back in


	$N.EngagementListen.Add_Listener(document.body, 'cmech', 'visible', null, async ()=> {
		for(const l of _listening) {l.cb('visible')}
	})


	$N.SSEvents.Add_Listener(document.body, "cmech", ["datasync_doc_add","datasync_doc_patch","datasync_doc_delete", "datasync_collection"], null, async (event:{path?:string, paths?:str[],_data:object}, _eventname:str)=> {

		const event_paths = event.paths || (event.path ? [event.path] : []);
		const event_paths_specs = event_paths.map(ep=> {
			const spli = ep.split("/");
			return {
				collection: spli[0],
				document: spli.length > 1 ? spli[1] : null	
			}
		})


		const ls = _listening.filter(l=> {
			for(const listener_path of l.paths) {
				let runitflag = false;
				const listener_path_psplit = listener_path.split("/");

				if (
					listener_path_psplit.length === 2 &&  // e.g. 'machines/1234', 'users/5678'
					( 
						event_paths_specs.find(ep=> !ep.document && ep.collection === listener_path_psplit[0]) || // e.g. event is: 'machines' and listener is 'machines/1234'
						event_paths_specs.find(ep=> ep.document === listener_path_psplit[1] && ep.collection === listener_path_psplit[0]) // e.g. event is: 'machines/1234' and listener is 'machines/1234'
					)
				) { 
					runitflag = true;	
				}

				else if (
					listener_path_psplit.length === 1 &&  // e.g. 'machines', 'users'
					( 
						event_paths_specs.find(ep=> !ep.document && ep.collection === listener_path_psplit[0]) || // e.g. event is: 'machines' and listener is 'machines'
						event_paths_specs.find(ep=> ep.document && ep.collection === listener_path_psplit[0]) // e.g. event is: 'machines/1234' and listener is 'machines'
					)
				) { 
					runitflag = true;	
				}

				return runitflag;
			}
		})

		if (ls.length === 0) { return; }


		const promises:Promise<void>[] = []
		ls.forEach(l=> promises.push(l.cb('sse')))

		try   { await Promise.all(promises); }
		catch { return; }


		const componentnames:Set<str> = new Set();
		for(const l of ls) {   componentnames.add(l.componentname);   }

		for(const componentname of componentnames) {
			const viewel       = document.querySelector(`#views > v-${componentname}`) as HTMLElement & CMechViewT
			const loadeddata   = _loadeddata.get(componentname)!
			const pathparams   = _pathparams.get(componentname)!
			const searchparams = _searchparams.get(componentname)!

			for (const subel of ( viewel.subelshldr as ( HTMLElement & CMechViewPartT )[] )) {
				subel.kd(loadeddata, 'datachanged', pathparams, searchparams)
				subel.sc()
			}

			viewel.kd(loadeddata, 'datachanged', pathparams, searchparams)		
			viewel.sc()
		}
	});
}




const AddView = (
	componentname:str, 
	pathparams: GenericRowT, 
	searchparams: GenericRowT, 
	localdb_preload:str[]|null|undefined,
) => new Promise<num|null>(async (res, rej)=> {

	_searchparams.set(componentname, searchparams)
	_pathparams.set(componentname, pathparams)

	let loadr:LazyLoadFuncReturnT;
	try   { loadr = await _all_lazyload_data_funcs[componentname+"_main"](pathparams, searchparams, localdb_preload, {}); }
	catch { rej(); return; }

	const loadeddata = new Map<str, GenericRowT[]>();
	for (const [datapath, generic_row_array] of loadr.d.entries())   loadeddata.set(datapath, generic_row_array)

	_loadeddata.set(componentname, loadeddata)

	const parentEl = document.querySelector("#views")!;
	parentEl.insertAdjacentHTML("beforeend", `<v-${componentname} class='view'></v-${componentname}>`);

	const el = parentEl.getElementsByTagName(`v-${componentname}`)[0] as HTMLElement & CMechViewT

	if (loadr.refreshspecs && loadr.refreshspecs.length > 0) {   handle_refresh_listeners(loadr.refreshspecs, componentname, false, "main");  }

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

	const componentname           = component.tagName.toLowerCase().split("-")[1]

	_loadeddata.delete(componentname) 
	_searchparams.delete(componentname) 
	_pathparams.delete(componentname) 

	for (let i = _listening.length - 1; i >= 0; i--) {
		if (_listening[i].componentname === componentname) {   _listening.splice(i, 1);   }
	}
}




const ViewPartDisconnectedCallback = (component:HTMLElement & CMechViewPartT) => {

	if (!component.tagName.startsWith("VP-")) throw new Error("Not a view part component")

	const index = component.hostview!.subelshldr!.indexOf(component)
	component.hostview!.subelshldr!.splice(index, 1)
}




const BackToJustView = (componentname:str, pathparams:GenericRowT, searchparams:GenericRowT) => {

	for (let i = _listening.length - 1; i >= 0; i--) {
		const l = _listening[i]
		if (l.componentname === componentname && l.issub) {
			_listening.splice(i, 1);
		}
	}

	const loadeddata = _loadeddata.get(componentname)!
	const viewel       = document.querySelector(`#views > v-${componentname}`) as HTMLElement & CMechViewT

	for (const subel of ( viewel.subelshldr as ( HTMLElement & CMechViewPartT )[] )) {
		subel.kd(loadeddata, 'pathchngd', pathparams, searchparams)
		subel.sc()
	}

	viewel.kd(loadeddata, 'pathchngd', pathparams, searchparams)
	viewel.sc()
}




const ParamsChanged = (componentname:str, pathparams:GenericRowT, searchparams:GenericRowT, loadfunc_suffix?:str) => new Promise<void>(async (res, rej) => {

	const viewel       = document.querySelector(`#views > v-${componentname}`) as HTMLElement & CMechViewT

	for (let i = _listening.length - 1; i >= 0; i--) {
		const l = _listening[i]
		if (l.componentname === componentname && l.issub) {
			_listening.splice(i, 1);
		}
	}

	_pathparams.set(componentname, pathparams) // already merged view and sub params from switchstation
	_searchparams.set(componentname, searchparams) // already merged view and sub params from switchstation

	if (loadfunc_suffix) {
		let loadr:LazyLoadFuncReturnT;
		try   { loadr = await _all_lazyload_data_funcs[componentname + "_" + loadfunc_suffix](pathparams, searchparams, null, {}); }
		catch { rej(); return; }

		const newloadeddata = new Map<str, GenericRowT[]>();
		for (const [datapath, generic_row_array] of loadr.d.entries())   newloadeddata.set(datapath, generic_row_array)

		const existing_loadeddata   = _loadeddata.get(componentname)!

		for (const [datapath, generic_row_array] of newloadeddata.entries()) {
			existing_loadeddata.set(datapath, generic_row_array)
		}
		_loadeddata.set(componentname, existing_loadeddata)

		if (loadr.refreshspecs && loadr.refreshspecs.length > 0) {   handle_refresh_listeners(loadr.refreshspecs, componentname, true, loadfunc_suffix);  }
	}

	const loadeddata = _loadeddata.get(componentname)!

	for (const subel of ( viewel.subelshldr as ( HTMLElement & CMechViewPartT )[] )) {
		subel.kd(loadeddata, 'pathchngd', pathparams, searchparams)
		subel.sc()
	}

	viewel.kd(loadeddata, 'pathchngd', pathparams, _searchparams.get(componentname)!)
	viewel.sc()

	res()
})




/*
const SearchParamsChanged = (newsearchparams:GenericRowT) => new Promise<void>(async (res, rej)=> {

	// consider merging PathParamsChanged and SearchParamsChanged into one function. will still keep search and path params separate in dataset etc, but otherwise essentially the same

	const activeviewel      = document.getElementById("views")!.lastElementChild as HTMLElement & CMechViewT

	const componentname     = activeviewel.tagName.toLowerCase().split("-")[1]
	const pathparams        = _pathparams.get(componentname)!
	const searchparams      = _searchparams.get(componentname)!

	// delete any existing search params that are referenced in the viewel dataset
	const searchparams_ref = JSON.parse(activeviewel.dataset.searchparams || "[]") as str[]
	for (const name of searchparams_ref) {
		if (searchparams[name] === undefined) continue; // if it doesn't exist, skip
		delete searchparams[name]; // delete it from the searchparams
	}

	const promises:Promise<any>[] = []
	let   promises_r:any[] = []

	promises.push( _all_lazyload_data_funcs[componentname+"_main"](pathparams, newsearchparams) )

	try   { promises_r = await Promise.all(promises); }
	catch { rej(); return; }

	// stash the search params keys in the dataset of viewel
	activeviewel.dataset.searchparams = JSON.stringify(Object.keys(newsearchparams))

	_searchparams.set(componentname, newsearchparams)

	const loadeddata = new Map<str, GenericRowT[]>();
	for (const [datapath, generic_row_array] of promises_r[0].entries())   loadeddata.set(datapath, generic_row_array)

	// will comnpletely replace the old loaded data for this view from main load function

	_loadeddata.set(componentname, loadeddata) 

	for (const subel of ( activeviewel.subelshldr as ( HTMLElement & CMechViewPartT )[] )) {
		subel.kd(loadeddata, 'searchchngd', _pathparams.get(componentname)!, _searchparams.get(componentname)!)
		subel.sc()
	}

	activeviewel.kd(loadeddata, 'searchchngd', _pathparams.get(componentname)!, _searchparams.get(componentname)!)
	activeviewel.sc()

	res()
})
*/




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

			for (const subel of ( viewel.subelshldr as ( HTMLElement & CMechViewPartT )[] )) {
				subel.kd(loadeddata, 'datachanged', _pathparams.get(view_component_name)!, _searchparams.get(view_component_name)!)
				subel.sc()
			}

			viewel.kd(loadeddata, 'datachanged', _pathparams.get(view_component_name)!, _searchparams.get(view_component_name)!)		
			viewel.sc()
		}
	}
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




const handle_refresh_listeners = (
	refreshspecs:LazyLoadFuncRefreshSpecT[],
	componentname:str,
	issub: boolean,
	func_name_suffix:str,
) => {

	// remove any existing listeners for this component and function name suffix
	for (let i = _listening.length - 1; i >= 0; i--) {
		if (_listening[i].componentname === componentname && _listening[i].func_name_suffix === func_name_suffix) {   _listening.splice(i, 1);   }
	}

	// currently only support data sync refreshes
	if (!refreshspecs.every(spec => spec.type === "datasync")) {   return;   }

	// Currtnly path can only be a top level collection or a top level collection document, e.g. 'machines' or 'machines/1234'

	const paths:Set<str> = new Set();
	for(const spec of refreshspecs) {
		for (const path of spec.paths) {   paths.add(path);   }
	}


	const l = { componentname, func_name_suffix, issub, paths: Array.from(paths), cb:(reason:'visible'|'sse')=> new Promise<void>(async (res, rej)=> {
		const pathparams   = _pathparams.get(componentname)!;
		const searchparams = _searchparams.get(componentname)!;

		let loadr:LazyLoadFuncReturnT;
		const fetchlassieopts:FetchLassieOptsT = { refreshcache:true }
		if (reason === 'visible') fetchlassieopts.retries = 2;
		try   { loadr = await _all_lazyload_data_funcs[componentname + "_" + func_name_suffix](pathparams, searchparams, null, fetchlassieopts); }
		catch { rej(); return; }

		const newloadeddata = new Map<str, GenericRowT[]>();
		for (const [datapath, generic_row_array] of loadr.d.entries())   newloadeddata.set(datapath, generic_row_array)

		const existing_loadeddata = _loadeddata.get(componentname)!
		for (const [datapath, generic_row_array] of newloadeddata.entries()) {
			existing_loadeddata.set(datapath, generic_row_array)
		}
		_loadeddata.set(componentname, existing_loadeddata)

		res()
	})}
	_listening.push( l );
}






export { Init, AddView, DataChanged, ParamsChanged, BackToJustView }

if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).CMech = { ViewConnectedCallback, ViewPartConnectedCallback, AttributeChangedCallback, ViewDisconnectedCallback, ViewPartDisconnectedCallback };



