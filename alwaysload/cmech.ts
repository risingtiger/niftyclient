

import { num, str, bool } from "../defs_server_symlink.js"
import { $NT, GenericRowT, CMechLoadStateE, CMechViewT, CMechViewPartT, CMechLoadedDataT, EngagementListenerTypeT } from "../defs.js"
import { EnsureObjectStoresActive as LocalDBSyncEnsureObjectStoresActive } from "./localdbsync.js"

declare var $N: $NT;

type LoadAFuncT = (pathparams:GenericRowT, searchparams:URLSearchParams)=>Promise<Map<str,GenericRowT[]>|null>
type LoadBFuncT = (pathparams:GenericRowT, old_searchparams:URLSearchParams, new_searchparams:URLSearchParams)=>Promise<Map<str,GenericRowT[]>|null>



//const _viewloadspecs:Map<string, FirestoreLoadSpecT> = new Map() // key is view tagname sans 'v-'
//const _viewloadeddata:Map<string, FirestoreFetchResultT> = new Map() // key is view tagname sans 'v-'

// these are set when a new view is added, and removed when that view is rmoved (or when load view failed) 

let _loadeddata:Map<str, CMechLoadedDataT> = new Map() // map by view name of Map by path name with data
let _searchparams:Map<str, GenericRowT> = new Map() // map by view name
let _pathparams:Map<str, GenericRowT> = new Map() // map by view name
let _load_b_funcs:Map<str, LoadBFuncT> = new Map() // map by view name




const Init = () => {
}




const AddView = (
	componentname:str, 
	pathparams: GenericRowT, 
	searchparams_raw:URLSearchParams, 
	localdb_preload:str[]|null|undefined,
	views_attach_point:"beforeend"|"afterbegin", 
	load_a:LoadAFuncT,
	load_b:LoadBFuncT,
) => new Promise<num|null>(async (res, _rej)=> {

	const searchparams_genericrowt:GenericRowT = {};
	for (const [key, value] of searchparams_raw.entries()) { searchparams_genericrowt[key] = value; }

	{
		const promises:Promise<any>[] = []
		
		const localdbsync_promise = localdb_preload ? LocalDBSyncEnsureObjectStoresActive(localdb_preload) : Promise.resolve(1)


		promises.push( localdbsync_promise )
		promises.push( load_a(pathparams, searchparams_raw) )

		promises.push( new Promise<Map<str,GenericRowT[]>|null>(async (res, _rej)=> {
			await localdbsync_promise
			const r = await load_b(pathparams, new URLSearchParams, searchparams_raw)
			res(r);
		}));

		const r = await Promise.all(promises)

		if (r[0] === null || r[1] === null || r[2] === null) { res(null); return; }

		const loadeddata = new Map<str, GenericRowT[]>();
		for (const [path, val] of r[1].entries())   loadeddata.set(path, val)
		for (const [path, val] of r[2].entries())   loadeddata.set(path, val)

		_loadeddata.set(componentname, loadeddata)
	}
	
	
	_searchparams.set(componentname, searchparams_genericrowt)
	_pathparams.set(componentname, pathparams)
	_load_b_funcs.set(componentname, load_b)

	const parentEl = document.querySelector("#views")!;
	parentEl.insertAdjacentHTML(views_attach_point, `<v-${componentname} class='view'></v-${componentname}>`);

	const el = parentEl.getElementsByTagName(`v-${componentname}`)[0] as HTMLElement & CMechViewT

	el.addEventListener("hydrated", ()=> { 
		res(1); 
	})
	el.addEventListener("failed",   ()=> { 
		_loadeddata.delete(componentname)
		_searchparams.delete(componentname)
		_pathparams.delete(componentname)
		_load_b_funcs.delete(componentname)
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
					CMechLoadStateE.VISIBLED,
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
					CMechLoadStateE.LATELOADED
				)
			el.sc()
		}
	}
})








const ViewConnectedCallback = async (component:HTMLElement & CMechViewT, opts:GenericRowT = {kdonvisibled:false, kdonlateloaded:false}) => new Promise<void>(async (res, _rej)=> {

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

	component.kd(loadeddata, CMechLoadStateE.INITIAL)
	component.sc()

	$N.EngagementListen.Add_Listener(component, "component", EngagementListenerTypeT.resize, null, async ()=> {   component.sc();   });

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

	component.kd(loadeddata, CMechLoadStateE.INITIAL)
	component.sc()

	$N.EngagementListen.Add_Listener(component, "component", EngagementListenerTypeT.resize, null, async ()=> {
		component.sc()
	})

	res()
})




const AttributeChangedCallback = (component:HTMLElement, name:string, oldval:str|boolean|number, newval:string|boolean|number, _opts?:object) => {

	//TODO: Need to somehow wrap in logic where if data is changed or searchparams that (for subels) it allows the attributes to be changed first, then wait for the load and kd calls to transpire before calling sc
	console.log("Need to somehow wrap in logic where if data is changed or searchparams that (for subels) it allows the attributes to be changed first, then wait for the load and kd calls to transpire before calling sc")

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
	_load_b_funcs.delete(componentname)
}




const ViewPartDisconnectedCallback = (component:HTMLElement & CMechViewPartT) => {

	if (!component.tagName.startsWith("VP-")) throw new Error("Not a view part component")


	const index = component.hostview!.subelshldr!.indexOf(component)
	component.hostview!.subelshldr!.splice(index, 1)
}




const SearchParamsChanged = (newsearchparams_raw:URLSearchParams) => new Promise<void>(async (res, _rej)=> {

	//TODO: Need to somehow wrap in logic where if data is changed or searchparams that (for subels) it allows the attributes to be changed first, then wait for the load and kd calls to transpire before calling sc
	console.log("Need to somehow wrap in logic where if data is changed or searchparams that (for subels) it allows the attributes to be changed first, then wait for the load and kd calls to transpire before calling sc")

	const activeviewel      = document.getElementById("views")!.lastElementChild as HTMLElement & CMechViewT

	const componentname     = activeviewel.tagName.toLowerCase().split("-")[1]
	const loadeddata        = _loadeddata.get(componentname)!
	const pathparams        = _pathparams.get(componentname)!
	const oldsearchparams   = _searchparams.get(componentname)!
	const load_b_func       = _load_b_funcs.get(componentname)!

	const newsearchparams:GenericRowT = {}
	for (const [key, value] of newsearchparams_raw.entries()) newsearchparams[key] = value

	//TODO: Either put in load_a_func or figure out why I didn't put it in already 

	const oldsearchparams_urlparams:URLSearchParams = new URLSearchParams()
	for (const [key, value] of Object.entries(oldsearchparams)) { oldsearchparams_urlparams.append(key, value); }

	const r = await load_b_func(pathparams, oldsearchparams_urlparams, newsearchparams_raw)
	if (r === null) { res(); return; }

	for (const [path, val] of r.entries())   loadeddata.set(path, val)   

	activeviewel.kd(loadeddata, CMechLoadStateE.SEARCHCHANGED)
	activeviewel.sc()

	_searchparams.set(componentname, newsearchparams)

	res()
})




const DataChanged = (updated:Map<str, GenericRowT[]>) => new Promise<void>(async (res, _rej)=> {

	// map key is path e.g. 'machines/1234' or 'machines/1234/parts/5678' or just 'machines'
	// map value is always an array -- even if of just one object

	const viewsel = document.getElementById("views")!


	for (const [view_component_name, loadeddata] of _loadeddata) { 

		const viewel = viewsel.querySelector(`v-${view_component_name}`) as HTMLElement & CMechViewT
		let   matching_loadeddata:GenericRowT[]|null = null
		
		for (const [path, updatedlist] of updated) {
			matching_loadeddata = loadeddata.get(path) || null
			if (!matching_loadeddata) continue

			updateArrayIfPresent(matching_loadeddata, updatedlist)
		}

		if (!matching_loadeddata) continue


		viewel.kd(loadeddata, CMechLoadStateE.DATACHANGED)		
		viewel.sc()
	}

	//TODO: Need to somehow wrap in logic where if data is changed or searchparams that (for subels) it allows the attributes to be changed first, then wait for the load and kd calls to transpire before calling sc
	console.log("Need to somehow wrap in logic where if data is changed or searchparams that (for subels) it allows the attributes to be changed first, then wait for the load and kd calls to transpire before calling sc")

	res()
})




const GetViewParams = (component:HTMLElement) => { 

	let viewname = ""
	let tagname  = component.tagName.toLowerCase()

	if (tagname.startsWith("v-")) {
		viewname = tagname.split("-")[1]
	
	} else if (tagname.startsWith("vp-")) {

		const rootnode                    = component.getRootNode()
		const host                        = ( rootnode as any ).host as HTMLElement
		const ancestor_view_tagname       = host.tagName.toLowerCase()
		const ancestor_view_tagname_split = ancestor_view_tagname.split("-")
		const ancestor_viewname           = ancestor_view_tagname_split[1]

		viewname = ancestor_viewname

	} else { 
		throw new Error("Not a component sent to GetPathParams")
	}

	const path   = _pathparams.get(viewname)!
	const search = _searchparams.get(viewname)!

	return { path, search }
}




const updateArrayIfPresent = (tolist:GenericRowT[], updatedlist:GenericRowT[]) => { // Even single items like a machine (e.g. 'machines/1234') will always be an array of one object

	// we create a map because we have to assume this could be a large array and we want to avoid O(n^2) complexity
	// thus why we createa a map of the ids

	const index_map = new Map();
	tolist.forEach((row:any, i:num) => index_map.set(row.id, i))

	for(const d of updatedlist) {
		const rowindex = index_map.get(d.id)
		if (rowindex === undefined)   tolist.push(d);   else   tolist[rowindex] = d;
	}
}




/*
const HandleFirestoreDataUpdated = async (updateddata:FirestoreFetchResultT) => {

	if (updateddata === null) return // updateddata is always an array of objects, never null. This line here is to shut up typescript linting

	const keys = [...updateddata.keys()]

	console.log("DONE WEIRD . CHROME CRAPS LIKE A SF 'RESIDENT' ON THE STREET OF MY IMMACULATE CODE.")

	const updateddata_path_dets = keys.map(p=> { const pd = pathdets(p); return pd; })

	console.log("ALL FUCKED. updateddata CAN include something like 'machines/somejackedid' while user is viewing 'machines/unjackedid' and 'somejacked' will just jack right into 'unjacked'. ALL fucked and jacked")

	for(const [viewname, viewloadeddata] of _viewloadeddata) {
		if (!viewloadeddata || viewloadeddata.size === 0)    continue

		let is_view_affected_flag = false
		let viewloadspecs_affected_paths:FirestoreLoadSpecT = new Map()

		viewloadeddata.forEach((viewloadeddata_list, loadeddata_path)=> {
			const lnd = pathdets(loadeddata_path)

			updateddata_path_dets.forEach(und=> {
				
				if (lnd.collection === und.collection && lnd.subcollection === und.subcollection) {
					is_view_affected_flag = true
					viewloadspecs_affected_paths.set(loadeddata_path, _viewloadspecs.get(viewname)!.get(loadeddata_path)!)


					// all FirestoreFetchResultT objects are arrays of objects -- so always dealing with arrays even if just array of one object

					const updateddata_list    = updateddata.get(und.path) as any[]

					const index_map = new Map();
					viewloadeddata_list.forEach((row:any, i:num) => index_map.set(row.id, i))

					for(let i = 0; i < updateddata_list.length; i++) {
						const rowindex = index_map.get(updateddata_list[i].id)
						if (rowindex === undefined) 
							viewloadeddata_list.push(updateddata_list[i])
						else
							viewloadeddata_list[rowindex] = updateddata_list[i]
					}

				}
			})
		})


		if (is_view_affected_flag && viewloadspecs_affected_paths.size > 0) {

			const viewel = document.querySelector(`v-${viewname}`) as HTMLElement & CMechT

			set_component_m_data(true, viewel, "", viewloadspecs_affected_paths, viewloadeddata)

			if (viewel.mdlchngd) await viewel.mdlchngd( [...viewloadspecs_affected_paths.keys()] )
			if (viewel.kd) viewel.kd()
			viewel.sc();

			for(const subel of ( viewel.subelshldr as ( HTMLElement & CMechT )[] )) {
				set_component_m_data(false, subel, subel.tagName.toLowerCase(), viewloadspecs_affected_paths, viewloadeddata)
				if (subel.mdlchngd) await subel.mdlchngd( [...viewloadspecs_affected_paths.keys()] )
				if (subel.kd) subel.kd()
				subel.sc()
			}
		}



	}


	function pathdets(p:str) {
		const sp = p.split('/')
		const collection = sp[0]
		const subcollection = sp[2] || null
		const doc = sp[1] || null
		const subdoc = sp[3] || null
		const isdoc = doc || subdoc ? true : false
		return { path:p, collection, subcollection, doc, subdoc, isdoc }
	}
}
*/








/*
const handle_view_initial_data_load = (viewname:str, loadother:()=>{}|null) => new Promise<null|num>(async (res, _rej)=> {

	const loadspecs = _viewloadspecs.get(viewname)!

	const promises:any[] = []

	promises.push(loadspecs.size ? FirestoreDataGrab(loadspecs) : 0) 
	promises.push(loadother ? loadother() : 0)

	const r = await Promise.all(promises)

	if (r[0] === null || r[1] === null) { res(null); return; }

	if (r[0] !== 0) {
		FirestoreAddToListens(loadspecs)
		_viewloadeddata.set(viewname, r[0])
	}

	res(1)
})
*/




/*
function set_component_m_data(is_view:bool, component:HTMLElement & CMechT, componenttagname:str, loadspecs:FirestoreLoadSpecT, loaddata:FirestoreFetchResultT) {

	if (!loaddata || !loaddata.size || !loadspecs.size) return

	const filtered_loadspecs:FirestoreLoadSpecT = new Map()

	loadspecs.forEach((ls, path)=> {
		if (is_view && ( !ls.els || ls.els.includes('this') ))           filtered_loadspecs.set(path,ls)
		if (!is_view && ( ls.els && ls.els.includes(componenttagname) )) filtered_loadspecs.set(path,ls) 
	}); 

	filtered_loadspecs.forEach((ls, path)=> {
		const d              = loaddata.get(path)!
		component.m[ls.name] = Array.isArray(component.m[ls.name]) ? d : d[0]
	});
}
*/




export { Init, AddView, SearchParamsChanged, DataChanged }

if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).CMech = { ViewConnectedCallback, ViewPartConnectedCallback, AttributeChangedCallback, ViewDisconnectedCallback, ViewPartDisconnectedCallback, GetViewParams };



