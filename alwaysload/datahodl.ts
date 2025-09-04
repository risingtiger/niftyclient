

import { str } from "../defs_server_symlink.js"
import { LazyLoadFuncReturnT, GenericRowT } from "../defs.js"
import {} from './cmech.js'
import { LocalDBSyncPathSpecT, PreloadObjectStores } from './localdbsync.js'




type ViewsDataT = Map<string, { // key is view name
	pathparams: GenericRowT,
	searchparams: GenericRowT,
	loadeddata: Map<string, GenericRowT[]>, 
	refreshon: str[],
}>



const _viewsdata:ViewsDataT =     new Map()
let _all_lazyload_data_funcs:Array  <()=> Promise<Map<str, GenericRowT[]>>> = []




const Init = (lazyload_data_funcs:Array<()=>Promise<Map<str, GenericRowT[]>>>) => {
	_all_lazyload_data_funcs = lazyload_data_funcs
}




const LoadViewData = (
	viewname:str, 
	pathparams: GenericRowT, 
	searchparams: GenericRowT, 
	localdb_preload?:str[],
) => new Promise<void>(async (res, rej)=> {

	let loadr:LazyLoadFuncReturnT;

	try   { 
		if (localdb_preload) await PreloadObjectStores(localdb_preload);
		loadr = await _all_lazyload_data_funcs[viewname](pathparams, searchparams, {}); 
	}
	catch { rej(); return; }

	const refreshon = loadr.refreshon || []

	_viewsdata.set(viewname, { pathparams, searchparams, loadeddata: loadr.d, refreshon })

	res()
})




const RunUpdateFromLocalDBUpdate = (localdbsyncpathspecs:LocalDBSyncPathSpecT[]) => {

	const affected_views = new Map([..._viewsdata].filter(([_k, v]) => {
		for(const ldsps of localdbsyncpathspecs)   if(v.refreshon.includes(ldsps.path)) return true
		return false
	}))
	const promises:Promise<void>[] = []
	for(const [viewname, v] of [...affected_views]) {
		promises.push(LoadViewData(viewname, v.pathparams, v.searchparams))
	}
	try   { Promise.all(promises); }
	catch {  
		console.warn("RunUpdateFromLocalDBUpdate: unable to refresh all affected views")
		return;
	}
}




const GetViewData = (viewname:str) => {
	return _viewsdata.get(viewname)!
}




const RemoveViewData = (viewname:str) => {
	_viewsdata.delete(viewname)!
}




export { Init, LoadViewData, RunUpdateFromLocalDBUpdate, GetViewData, RemoveViewData }




