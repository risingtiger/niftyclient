

import { str } from "../defs_server_symlink.js"
import { LazyLoadFuncReturnT, GenericRowT, SSEventListenerEvents, $NT, EngagementListenerEvents, DataHodlEvents } from "../defs.js"
import {UpdateView as CMechUpdateView } from './cmech.js'
import { PreloadObjectStores, RunSyncFromEvent as LocalDBSyncRunSyncFromEvent, Add as LocalDBSyncAdd, Patch as LocalDBSyncPatch, Delete as LocalDBSyncDelete } from './localdbsync.js'


declare var $N:$NT


type ViewPartDataT = {
	loadeddata: Map<string, GenericRowT[]>,
	refreshon: str[],
	attrs: NamedNodeMap
}

type ViewsDataT = Map<string, { // key is view name
	pathparams: GenericRowT,
	searchparams: GenericRowT,
	loadeddata: Map<string, GenericRowT[]>, 
	refreshon: str[],
	viewparts: Map<string, ViewPartDataT>,
}>


type DataHodlPathSpecT = {
	path:string,
	collection: string,
	docid: string|null
}


const _viewsdata:ViewsDataT             =     new Map()
//let   _last_engagement_sync_time:number =     0




const Init = () => {

	$N.EngagementListen.Add_Listener(document.body, 'datahodl_visible', ['visible', '15interval'], 100, handle_engagement_event);
	$N.SSEvents.Add_Listener(document.body, "datahodl", ["datasync_doc_delete", "datasync_doc_add", "datasync_doc_patch", "datasync_collection"], 100, handle_sse_event);
	document.querySelector("#views")!.addEventListener("revealed", handle_viewrevealed_event);
	document.addEventListener("backonline", handle_backonline_event); // custom event bubbled up from service worker through main.ts

	// document.querySelector("#views")!.addEventListener("hydrated", handle_viewhydrated_event);
	// document.querySelector("#views")!.addEventListener("initial_hydration", handle_initialhydration_event);
}




const LoadViewData = (viewname:str, pathparams: GenericRowT, searchparams: GenericRowT, localdb_preload?:str[],) => new Promise<void>(async (res, rej)=> {
	
	let loadr:LazyLoadFuncReturnT;

	const view_class = customElements.get(`v-${viewname}`) as any

	try   { 
		if (localdb_preload && localdb_preload.length) await PreloadObjectStores(localdb_preload);
		loadr = await view_class.load(pathparams, searchparams); 
	}
	catch { rej(); return; }

	const refreshon = loadr.refreshon || []

	_viewsdata.set(viewname, { pathparams, searchparams, loadeddata: loadr.d, refreshon, viewparts: new Map() } )

	res()
})




const LoadViewPartData = (viewname: str, viewpart_tagname: str, viewpart_attrs: NamedNodeMap) => new Promise<void>(async (res, rej) => {
	
	const viewdata = _viewsdata.get(viewname)!

	const viewpart_class = customElements.get("vp-"+viewpart_tagname) as any
	if (!viewpart_class?.load) {
		viewdata.viewparts.set(viewpart_tagname, { loadeddata: new Map(), refreshon: [], attrs: viewpart_attrs })
		res()
		return
	}
	
	let loadr: LazyLoadFuncReturnT
	
	try { loadr = await viewpart_class.load(viewdata.pathparams, viewdata.searchparams, viewpart_attrs) }
	catch { rej(); return; }
	
	viewdata.viewparts.set(viewpart_tagname, { loadeddata: loadr.d, refreshon: loadr.refreshon || [], attrs: viewpart_attrs })
	
	res()
})




const PostLoadViewData = (viewname:str) => new Promise<boolean>(async (res, rej)=> {

	const view_class = customElements.get(`v-${viewname}`) as any
	if (!view_class?.post_load) { res(false); return; }

	let loadr:LazyLoadFuncReturnT;
	const viewdata = _viewsdata.get(viewname)!

	try   { loadr  = await view_class.post_load(viewdata.pathparams, viewdata.searchparams); }
	catch { rej(); return; }

	for (const [key, value] of loadr.d) viewdata.loadeddata.set(key, value)
	if (loadr.refreshon) for (const r of loadr.refreshon) viewdata.refreshon.push(r)

	res(true)
})




const PostLoadViewPartData = (viewname: str, viewpartname: str, viewpart_attrs: NamedNodeMap) => new Promise<boolean>(async (res, rej) => {

	const viewpart_class = customElements.get('vp-'+viewpartname) as any
	if (!viewpart_class?.post_load) { res(false); return }

	let loadr: LazyLoadFuncReturnT
	const viewdata = _viewsdata.get(viewname)!
	const attrs:GenericRowT = {}
	for (let i = 0; i < viewpart_attrs.length; i++) {
		const attr = viewpart_attrs.item(i)!
		attrs[attr.name] = attr.value
	} 

	try {
		loadr = await viewpart_class.post_load(
			viewdata.pathparams,
			viewdata.searchparams,
			attrs,
		)
	}
	catch { rej(); return }

	const vp = viewdata.viewparts.get(viewpartname)
	for (const [key, value] of loadr.d) vp.loadeddata.set(key, value)
	if (loadr.refreshon) for (const r of loadr.refreshon) vp.refreshon.push(r)

	res(true)
})




const ReloadAllViewData = (viewname:str, pathparams: GenericRowT, searchparams: GenericRowT) => new Promise<void>(async (res, rej)=> {

	const promises:Promise<any>[] = []
	const existingViewData = _viewsdata.get(viewname)
	const existingViewparts = existingViewData.viewparts

	let r:any
	let has_view_post_load = false

	const view_class = customElements.get(`v-${viewname}`) as any

	// View load (index 0)
	promises.push(view_class.load(pathparams, searchparams))

	// View post load (index 1 if exists)
	if (view_class.post_load) {
		promises.push(view_class.post_load(pathparams, searchparams))
		has_view_post_load = true
	}

	// Track viewpart promise info for processing results
	type VPPromiseInfo = { vpname: str, attrs: NamedNodeMap, loadIndex: number, postLoadIndex: number | null }
	const vpPromiseInfos: VPPromiseInfo[] = []

	// Viewpart loads and post loads (all in parallel)
	for (const [vpname, vp_data] of existingViewparts) {
		const viewpart_class = customElements.get("vp-"+vpname) as any
		
		const info: VPPromiseInfo = { vpname, attrs: vp_data.attrs, loadIndex: -1, postLoadIndex: null }

		if (viewpart_class?.load) {
			info.loadIndex = promises.length
			promises.push(viewpart_class.load(pathparams, searchparams, vp_data.attrs))
		}

		if (viewpart_class?.post_load) {
			info.postLoadIndex = promises.length
			promises.push(viewpart_class.post_load(pathparams, searchparams, vp_data.attrs))
		}

		vpPromiseInfos.push(info)
	}

	try   { r = await Promise.all(promises) }
	catch { rej(); return }

	// Process view data (index 0)
	const refreshon: str[] = r[0].refreshon ? [...r[0].refreshon] : []
	const loadeddata = r[0].d as Map<string, GenericRowT[]>

	// Merge view post load data (index 1 if exists)
	if (has_view_post_load && r[1]) {
		if (r[1].refreshon) for (const ro of r[1].refreshon) refreshon.push(ro)
		if (r[1].d) for (const [key, value] of r[1].d) loadeddata.set(key, value)
	}

	// Process viewpart data and rebuild viewparts map
	const newViewparts: Map<string, ViewPartDataT> = new Map()

	for (const vpInfo of vpPromiseInfos) {
		const vpLoadeddata: Map<string, GenericRowT[]> = new Map()
		const vpRefreshon: str[] = []

		// Viewpart load data
		if (vpInfo.loadIndex !== -1 && r[vpInfo.loadIndex]) {
			const loadResult = r[vpInfo.loadIndex]
			if (loadResult.d) for (const [key, value] of loadResult.d) vpLoadeddata.set(key, value)
			if (loadResult.refreshon) for (const ro of loadResult.refreshon) vpRefreshon.push(ro)
		}

		// Viewpart post load data
		if (vpInfo.postLoadIndex !== null && r[vpInfo.postLoadIndex]) {
			const postResult = r[vpInfo.postLoadIndex]
			if (postResult.d) for (const [key, value] of postResult.d) vpLoadeddata.set(key, value)
			if (postResult.refreshon) for (const ro of postResult.refreshon) vpRefreshon.push(ro)
		}

		newViewparts.set(vpInfo.vpname, { loadeddata: vpLoadeddata, refreshon: vpRefreshon, attrs: vpInfo.attrs })
	}

	_viewsdata.set(viewname, { pathparams, searchparams, loadeddata, refreshon, viewparts: newViewparts })

	res()
})




const GetViewData    = (viewname:str) => {   return _viewsdata.get(viewname)!}




const GetViewPartData = (viewname: str, viewpartname: str): ViewPartDataT | null => {

	const viewdata = _viewsdata.get(viewname)!
	const viewpartdata = viewdata.viewparts.get(viewpartname)
	if (!viewpartdata) return null
	
	const merged_loadeddata = new Map(viewdata.loadeddata)
	for (const [key, value] of viewpartdata.loadeddata.entries()) {
		merged_loadeddata.set(key, value)
	}
	
	return { loadeddata: merged_loadeddata, refreshon: viewpartdata.refreshon, attrs: viewpartdata.attrs }
}




const RemoveViewData = (viewname:str) => {   _viewsdata.delete(viewname)!}




const RemoveViewPartData = (viewname: str, viewpart_tagname: str) => {
	if (_viewsdata.has(viewname)) _viewsdata.get(viewname).viewparts.delete(viewpart_tagname)
}




const AddLocalDB    = async (pathstr:str, data:GenericRowT)     => {  await LocalDBSyncAdd( pathstr, data );	   await run_update_from_local_db_addpatchdelete([ pathstr ]);   return;   }
const PatchLocalDB  = async (pathstr:str, newdata:GenericRowT)  => {  await LocalDBSyncPatch( pathstr, newdata );  await run_update_from_local_db_addpatchdelete([ pathstr ]);   return;   }
const DeleteLocalDB = async (pathstr:str)                       => {  await LocalDBSyncDelete( pathstr );		   await run_update_from_local_db_addpatchdelete([ pathstr ]);   return;   }









const run_update_from_local_db_addpatchdelete = async (paths:string[]) => {
	await update_affected_views(paths);
}




const update_general = async (eventname:DataHodlEvents) => {

	if ( eventname === 'visible' && !window.navigator.onLine) { return; } // if coming back on iphone from background, cell/wifi chip may not be ready yet. will be caught by backonline event 

	const paths = new Set<string>()
	let r:any   = null

	const promises = [ LocalDBSyncRunSyncFromEvent(eventname) ]
	try   { r = await Promise.all(promises); }
	catch { 
		// we keep the app running even if sync fails
		return; 
	}
	
	for (const [_vn, v] of _viewsdata) for (const p of v.refreshon) paths.add(p)

	if (paths.size)  update_affected_views([...paths])
}




const handle_engagement_event = async (eventname:EngagementListenerEvents) => {
	const connectedstate			 = await $N.GetConnectedState()
	if (connectedstate === 'online')   await update_general(eventname)
}




const handle_sse_event = async (event:{paths:any[], data:any}, eventname:SSEventListenerEvents) => {

	let   r:any = null
	event.paths = eventname === "datasync_collection" ? event.paths : [event.paths[0]]
	const promises:Promise<any>[] = []

	if (eventname === 'datasync_doc_add')    eventname = 'datasync_collection'; // we do this because an add doesn't affect any existing local doc. It just affects the local collection as a whole

	promises.push( LocalDBSyncRunSyncFromEvent(eventname, event) )

	try   { r = await Promise.all(promises); }
	catch { 
		// we keep the app running even if sync fails
		return; 
	}

	update_affected_views(event.paths)
}




const handle_viewrevealed_event = async (_ev:any) => {
}




const handle_backonline_event = async (_ev:any) => {
	await update_general('backonline');
}




const update_affected_views = async (paths:string[]) => {

	const promises:Promise<void>[] = []

	const pathspecs:DataHodlPathSpecT[] = paths.map(p => {
		const parts = p.split('/')
		return { path: p, collection: parts[0], docid: parts.length > 1 ? parts[1] : null }
	})

	const affected_views:Map<string, typeof _viewsdata extends Map<string, infer V> ? V : never> = new Map()
	for (const [k, v] of _viewsdata) {
		for (const pathspec of pathspecs) {
			if (v.refreshon.includes(pathspec.path)) { affected_views.set(k, v); break } // exact match, e.g. "machines" === "machines" or "machines/123" === "machines/123"
			else if (!pathspec.docid && v.refreshon.some(r => r.startsWith(pathspec.collection))) { affected_views.set(k, v); break } // ldsps is a collection (NOT a doc) and refreshon has an item that is that collection or doc of that collection
			else if (pathspec.docid && v.refreshon.some(r => r === pathspec.collection || r === `${pathspec.collection}/${pathspec.docid}`)) { affected_views.set(k, v); break } // ldsps is a doc and refreshon has an item that is that collection or that doc
		}
	}

	for (const [viewname, v] of affected_views) {
		promises.push(CMechUpdateView(viewname, v.pathparams, v.searchparams, "server_state_change"))
	}

	try   { await Promise.all(promises); }
	catch { return false; }

	return true;
}












export { Init, PostLoadViewData, LoadViewData, LoadViewPartData, PostLoadViewPartData, GetViewData, GetViewPartData, RemoveViewData, RemoveViewPartData, ReloadAllViewData }
if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).DataHodl = { AddLocalDB, PatchLocalDB, DeleteLocalDB };



