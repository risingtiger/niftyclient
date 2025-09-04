

import { num, str } from "../defs_server_symlink.js"
import { $NT, GenericRowT, CMechViewT, CMechViewPartT } from "../defs.js"
import { LoadViewData as DataHodlLoadViewData, GetViewData as DataHodlGetViewData, RemoveViewData as DataHodlRemoveViewData } from './datahodl.js'


declare var $N: $NT;


type ViewT = {
	pathparams: GenericRowT,
	searchparams: GenericRowT
}


const _views:Map<string, ViewT> = new Map() // key is view name


const Init = () => {
}







const AddView = (
	viewname:str, 
	pathparams: GenericRowT, 
	searchparams: GenericRowT, 
	localdb_preload: str[]
) => new Promise<num|null>(async (res, rej)=> {

	_views.set(viewname, { pathparams, searchparams }) // replaces if already exists

	try   { await DataHodlLoadViewData(viewname, pathparams, searchparams, localdb_preload); }
	catch { remove_view_aux(viewname); rej(); return; }

	const parentEl = document.querySelector("#views")!;
	parentEl.insertAdjacentHTML("beforeend", `<v-${viewname} class='view'></v-${viewname}>`);
	const el = parentEl.getElementsByTagName(`v-${viewname}`)[0] as HTMLElement & CMechViewT

	el.addEventListener("hydrated", ()=> { 
		res(1); 
	})
	el.addEventListener("failed",   ()=> { 
		remove_view_aux(viewname)
		el.remove()
		rej(); 
	})

	el.addEventListener("lateloaded", lateloaded)

	parentEl.addEventListener("visibled", visibled)

	let has_late_loaded = false
	let has_visibled    = false


	function visibled() {
		if (el.opts?.kdonvisibled) { 
			const d = DataHodlGetViewData(viewname)
			el.kd(d.loadeddata, 'visibled', d.pathparams, d.searchparams)
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
			const d = DataHodlGetViewData(viewname)
			el.kd(d.loadeddata, 'lateloaded', d.pathparams, d.searchparams)
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

	const d = DataHodlGetViewData(viewname)
	component.kd(d.loadeddata, 'initial', d.pathparams, d.searchparams)
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

	const d = DataHodlGetViewData(ancestor_viewname)
	component.kd(d.loadeddata, 'initial', d.pathparams, d.searchparams)
	component.sc()

	$N.EngagementListen.Add_Listener(component, "component", "resize", null, async ()=> {component.sc()})

	res()
})




const AttributeChangedCallback = (component:HTMLElement, name:string, oldval:str|boolean|number, newval:string|boolean|number, _opts?:object) => new Promise<void>((res)=> {

	if (oldval === null) return

	const a = (component as any).a as {[key:string]:any}

	a[name] = newval

	if (!a.updatescheduled) {
		a.updatescheduled = true
		Promise.resolve().then(()=> { 
			a.updatescheduled = false
			res()
		})
	}
})




const ViewDisconnectedCallback = (component:HTMLElement) => {
	const viewname = component.tagName.toLowerCase().split("-")[1]
	remove_view_aux(viewname)
}




const ViewPartDisconnectedCallback = (component:HTMLElement & CMechViewPartT) => {

	if (!component.tagName.startsWith("VP-")) throw new Error("Not a view part component")

	const index = component.hostview!.subelshldr!.indexOf(component)
	component.hostview!.subelshldr!.splice(index, 1)
}




const PathOrSearchParamsChanged = (viewname:str, pathparams:GenericRowT, searchparams:GenericRowT) => new Promise<void>(async (res, rej) => {

	const viewel       = document.querySelector(`#views > v-${viewname}`) as HTMLElement & CMechViewT

	_views.set(viewname, { pathparams, searchparams }) // just replace existing one

	try   { await DataHodlLoadViewData(viewname, pathparams, searchparams); }
	catch { remove_view_aux(viewname); rej(); return; }

	const loadeddata = DataHodlGetViewData(viewname).loadeddata

	for (const subel of ( viewel.subelshldr as ( HTMLElement & CMechViewPartT )[] )) {
		subel.kd(loadeddata, 'paramschanged', pathparams, searchparams)
		subel.sc()
	}

	viewel.kd(loadeddata, 'paramschanged', pathparams, searchparams)
	viewel.sc()

	res()
})



/*
const RunDataUpdateOnViews = (updated:Map<str, GenericRowT[]>) => {

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
			for (const d of update_lists[i]) { list_of_add_and_patches.push(d); }

			updateArrayIfPresent(loadeddata_arrays[loadeddata_index], list_of_add_and_patches)

			for (const subel of ( viewel.subelshldr as ( HTMLElement & CMechViewPartT )[] )) {
				subel.kd(loadeddata, 'datachanged', _pathparams.get(view_component_name)!, _searchparams.get(view_component_name)!)
				subel.sc()
			}

			viewel.kd(loadeddata, 'datachanged', _pathparams.get(view_component_name)!, _searchparams.get(view_component_name)!)		
			viewel.sc()
		}
	}
}
*/



/*
const __old_DataChanged = (updated:Map<str, GenericRowT[]>) => {

	// TODO: This is called by localdbsync, partly because the data has changed LOCALLY.
	// when localdatasync changes data locally, it disables the server's SSE call back,
	// therefore cmech will NOT be notified by server of changes to data.
	// in cases where a view is NOT pulling from local data, but from remote data, but that 
	//   data can be affected by standard localdbsync Patch/Add/Delete 
	//   calls (because it DOES push changes to server as well), in that case cmech needs to be aware of change 
	//   so that NONlocal data pulling views can still be notified to go pull new data

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
			for (const d of update_lists[i]) { list_of_add_and_patches.push(d); }

			updateArrayIfPresent(loadeddata_arrays[loadeddata_index], list_of_add_and_patches)

			for (const subel of ( viewel.subelshldr as ( HTMLElement & CMechViewPartT )[] )) {
				subel.kd(loadeddata, 'datachanged', _pathparams.get(view_component_name)!, _searchparams.get(view_component_name)!)
				subel.sc()
			}

			viewel.kd(loadeddata, 'datachanged', _pathparams.get(view_component_name)!, _searchparams.get(view_component_name)!)		
			viewel.sc()
		}
	}
}
*/




const remove_view_aux = (viewname:str) => {
	_views.delete(viewname)
	DataHodlRemoveViewData(viewname)
}




/*
const update_views_from_listeners = (listeners: Listening[]) => {
	const componentnames:Set<str> = new Set()
	for(const l of listeners) {   
		componentnames.add(l.componentname)   
	}
	
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
}
*/





/*
const updateArrayIfPresent = (tolist:GenericRowT[], list_of_add_and_patches:GenericRowT[]) => { 

	// Even single items like a machine (e.g. 'machines/1234') will always be an array of one object

	// we create a map because we have to assume this could be a large array and we want to avoid O(n^2) complexity
	// thus why we createa a map of the ids
	const index_map = new Map();
	tolist.forEach((row:any, i:num) => index_map.set(row.id, i))

	for(const d of list_of_add_and_patches) {   
		const rowindex = index_map.get(d.id)
		if (rowindex === undefined) tolist.push(d); else tolist[rowindex] = d;
	}
}
*/




/*
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
*/





export { Init, AddView, PathOrSearchParamsChanged }

if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).CMech = { ViewConnectedCallback, ViewPartConnectedCallback, AttributeChangedCallback, ViewDisconnectedCallback, ViewPartDisconnectedCallback };



