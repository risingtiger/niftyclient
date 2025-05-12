

import { num, str, bool } from '../defs_server_symlink.js'
import { SSETriggersE } from '../defs_server_symlink.js'
import { $NT, LoggerSubjectE, EngagementListenerTypeT, GenericRowT  } from '../defs.js'
import { HandleLocalDBSyncUpdateTooLarge as SwitchStationHandleLocalDBSyncUpdateTooLarge } from './switchstation.js'
import { DataChanged as CMechDataChanged } from './cmech.js'
import { Add as M_Add, Patch as M_Patch, Delete as M_Delete, StartTickTock as M_StartTickTock } from './localdbsync_modify.js'


declare var $N:$NT


type SyncObjectStoresT = { name: string, ts: num|null, lock:boolean, indexes:string[]|null }

export type PathSpecT = {
	path:string,
	p: string[],
	collection: string,
	docid: string|null, // never will just be a document (always a collection). but could be a path like "machines/1234/statuses"
	subcollection: string|null,
	syncobjectstore: SyncObjectStoresT,
}


let DBNAME:str = ""
let DBVERSION:num = 0

let _syncobjectstores:SyncObjectStoresT[] = []
let _activepaths:PathSpecT[] = []
let _a_millis = 0


//let _listens: FirestoreLoadSpecT = new Map()
//let _nonsync_tses: Map<str,num> = new Map()




const Init = (localdb_objectstores_tosync: {name:str,indexes?:str[]}[], db_name: str, db_version: num) => { 

	M_StartTickTock()

	_a_millis = Math.floor(Date.now() / 1000)

	DBNAME    = db_name
	DBVERSION = db_version

	{ 
		const objectstores_tosync_names	    	   = localdb_objectstores_tosync.map(item => item.name)
		const localstorage_syncobjectstores        = JSON.parse(localStorage.getItem("synccollections") || "[]") as {name:str, ts:num|null}[]
		const synccollections_not_in_localstorage  = objectstores_tosync_names.filter((name) => !localstorage_syncobjectstores.find(item => item.name === name))

		synccollections_not_in_localstorage.forEach((name) => {
			localstorage_syncobjectstores.push({ name, ts: null })
		})

		_syncobjectstores = localstorage_syncobjectstores.map((dc,i)=> ({ name: dc.name, ts: dc.ts, lock: false, indexes: localdb_objectstores_tosync[i].indexes || null }))

		localStorage.setItem("synccollections", JSON.stringify(localstorage_syncobjectstores))

		_activepaths = []
	}


	$N.EngagementListen.Add_Listener(document.body, 'firestore', EngagementListenerTypeT.visible, 100, async ()=> {

		if (_activepaths.length === 0) return

		const nowsecs = Math.floor(Date.now() / 1000)
		if (nowsecs - _a_millis > 28800) { // 8 hours
			await ClearAllSyncObjectStores()
			$N.Unrecoverable("Data Needs Synced", "", "Sync Data", LoggerSubjectE.indexeddb_error, "just regular 8 hour interval refresh")
			return
		}

		const r = await datasetter(_activepaths, {retries:2}, true, true)
		if (r === null || r === 1) return

		notify_of_datachange(r as Map<str, GenericRowT[]>)
	})


	$N.SSEvents.Add_Listener(document.body, "firestore_doc_add", [SSETriggersE.FIRESTORE_DOC_ADD], 100, (event:{path:string,data:object})=> {
		handle_firestore_doc_add_or_patch(event.path, event.data)
	});


	$N.SSEvents.Add_Listener(document.body, "firestore_doc_patch", [SSETriggersE.FIRESTORE_DOC_PATCH], 100, (event:{path:string,data:object, ispartial?:bool})=> {
		handle_firestore_doc_add_or_patch(event.path, event.data, event.ispartial || false)
	});


	$N.SSEvents.Add_Listener(document.body, "firestore_doc_delete", [SSETriggersE.FIRESTORE_DOC_DELETE], 100, (_event:{path:string,data:object})=> {
		//TODO: not handling delete yet. REALLY NEED TO. Not too hard to remove from local database and pass to cmech. But, when about when user has been offline and missed delete calls. Need a server side list to send of delete history since ts
	});


	$N.SSEvents.Add_Listener(document.body, "firestore_doc_collection", [SSETriggersE.FIRESTORE_COLLECTION], 100, async (event:{paths:str[]})=> {

		// event.paths is only going to be collections, never a singe document. Single doc goes through SSETriggersE.FIRESTORE_DOC

		const pathspecs = findrelevantpathspecs_from_ssepaths(event.paths)
		if (!pathspecs) return

		const r = await datasetter(pathspecs, {}, true, true)
		if (r === null || r === 1) return

		notify_of_datachange(r as Map<str, GenericRowT[]>)
	});

	return true



	function findrelevantpathspecs_from_ssepaths(ssepaths?:str[]) : PathSpecT[]|null {

		const ssepathspecs         = ssepaths?.map(sp=> parse_into_pathspec(sp)) || []

		const pathspecs = _activepaths.filter(aps=> {
			return ssepathspecs.find(sp=> sp.collection === aps.collection && sp.docid === aps.docid && sp.subcollection === aps.subcollection)
		})

		if (pathspecs.length === 0) return null

		return pathspecs
	}


	function notify_of_datachange(returns:Map<str, GenericRowT[]>) {

		if (returns.size === 0) return

		let is_too_large_to_update = false

		if ([...returns].some(rr=> rr[1].length === 300)) is_too_large_to_update = true

		if (is_too_large_to_update) {
			SwitchStationHandleLocalDBSyncUpdateTooLarge()
			return
		}	

		if ([...returns].some(rr => rr[1].length >= 1)) {
			CMechDataChanged(returns)
		}
	}
}




const EnsureObjectStoresActive = (names:str[]) => new Promise<num|null>(async (res,rej)=> {

	// currently is only main level firestore collections. will add subcollections soon

	const pathspecs:PathSpecT[] = names.map(name=> parse_into_pathspec(name))

	const newpathspecs = pathspecs.filter(pathspec => 
		!_activepaths.some(activePath => 
			activePath.collection === pathspec.collection && 
			activePath.docid === pathspec.docid && 
			activePath.subcollection === pathspec.subcollection
		)
	)

	if (newpathspecs.length === 0) { res(1); return; }

	const r = await datasetter(newpathspecs, {}, false, false)
	if (r === null) { rej(); return; }

	_activepaths = [..._activepaths, ...newpathspecs]

	res(1)
})




const Add = (path:str, data:GenericRowT) => new Promise<num>(async (res,_rej)=> {  
	const p = parse_into_pathspec(path)
	await M_Add(p, data)

	handle_firestore_doc_add_or_patch(path, data, false, false)
	res(1)
})




const Patch = (path:str, data:GenericRowT) => new Promise<num|null>(async (res,_rej)=> {  
	const p = parse_into_pathspec(path)
	await M_Patch(p, data)

	handle_firestore_doc_add_or_patch(path, data, true, false)
	res(1)
})




const Delete = (path:str) => new Promise<num|null>(async (res,_rej)=> {  
	const p = parse_into_pathspec(path)
	await M_Delete(p)

	// I don't yet have the code in place to handle delete across localdbsync and cmech

	res(1)
})




const ClearAllSyncObjectStores = () => new Promise<num>(async (res, rej) => {

	const db           = await $N.IDB.GetDB()

	const storenames   = _syncobjectstores.map(s => s.name)
	const tx           = db.transaction(storenames, "readwrite");

	let clearcount     = 0;
	let error_occurred = false;

	for(const name of storenames) {
		const stores   = tx.objectStore(name)
		const storereq = stores.clear()

		storereq.onsuccess = ()  => {   clearcount++;            }
		storereq.onerror   = ()  => {   error_occurred = true;   }
	}

	tx.onerror = (event) => {   console.error("Transaction error:", event); }

	tx.oncomplete = () => {
		if (error_occurred) {   console.error("Error in clearing object stores"); rej(); return;   }

		for(const syncobjectstore of _syncobjectstores)   syncobjectstore.ts = null

		localStorage.setItem("synccollections", JSON.stringify(_syncobjectstores.map(dc => ({ name: dc.name, ts: null }))));

		res(1)
	}
})




async function handle_firestore_doc_add_or_patch(path:str, data:object, ispartial:bool = false, save_to_indexeddb:bool = true) {

	const pathspec = parse_into_pathspec(path)!

	if (pathspec.syncobjectstore && save_to_indexeddb && !ispartial) {   
		if (!ispartial) 
			await write_to_indexeddb_store([ pathspec.syncobjectstore ], [ [data] ]);   
		else 
			await write_a_partial_record_to_indexeddb_store(pathspec.syncobjectstore, data as GenericRowT)
	}

	const returnmap = new Map<str, GenericRowT[]>([[pathspec.syncobjectstore.name, [data]]])

	CMechDataChanged(returnmap)
}




const datasetter = (pathspecs:PathSpecT[], opts?:{retries?:num}, force_refresh_syncobjectstores:bool = false, returnnewdata=false) => new Promise<num|null|Map<str,GenericRowT[]>>(async (res,_rej)=> { 

	opts = opts || {retries:0}
	opts.retries = opts.retries || 0

	let returns:Map<str,GenericRowT[]> = new Map()

	const paths_tosync                            = pathspecs.filter(p=> p.syncobjectstore.ts === null || force_refresh_syncobjectstores )

	// probably wont be duplicates, but when I start doing subcollections it could start being an issue

	const syncobjectstores_tosync_withduplicates  = paths_tosync.map(p=> p.syncobjectstore!)
	const syncobjectstores_tosync                 = syncobjectstores_tosync_withduplicates.filter((item, index) => syncobjectstores_tosync_withduplicates.indexOf(item) === index)
	const syncobjectstores_tosync_unlocked        = syncobjectstores_tosync.filter(dc=> !dc.lock)
	const syncobjectstores_tosync_locked          = syncobjectstores_tosync.filter(dc=> dc.lock)


	{
		if (syncobjectstores_tosync_unlocked.length) {
			const rs = await load_into_syncobjectstores(syncobjectstores_tosync_unlocked, opts.retries, returnnewdata)
			if (rs === null) { res(null); return; }

			if (returnnewdata) returns = rs as Map<str,GenericRowT[]>
		}

		if (syncobjectstores_tosync_locked.length) {
			await new Promise((resolve_inner) => {
				const intrvl = setInterval(() => {
					if (syncobjectstores_tosync_locked.every(dc=> !dc.lock)) {
						clearInterval(intrvl)
						resolve_inner(1)
					}
				}, 10)
			})
		}
	}

	
	if (returnnewdata) res(returns)
	else               res(1)
})




function parse_into_pathspec(path:str) : PathSpecT {

	const p                    = path.split('/') as Array<string>
	const collection           = p[0]
	const docid                = p[1] || null // only ever have a docid because we'll be using a subcollection. ALL paths are collections
	const subcollection        = docid && p[2] ? p[2] : null 

	// syncollection currently is ONLY for main level collections. we'll be adding subcollections soon (so firestore machines/123/statuses for example can be accessed)
	const syncobjectstore      = _syncobjectstores.find((dc) => dc.name === collection) as SyncObjectStoresT

	return { path, p, collection, docid, subcollection, syncobjectstore }
}




const load_into_syncobjectstores = (syncobjectstores:SyncObjectStoresT[], retries:num = 0, returnnewdata:bool, returnnewdata_limit:num = 300) => new Promise<num|null|Map<str,GenericRowT[]>>(async (res,_rej)=> {

    syncobjectstores.forEach(dc => dc.lock = true);

	const runidstring       = Math.random().toString(15).substring(2, 12)
	let   continue_calling  = true	
	const paths             = syncobjectstores.map(dc=> dc.name)
	const tses              = syncobjectstores.map(dc=> dc.ts || null)
	const returns           = new Map<str,GenericRowT[]>( paths.map(path=> [path, []]) )
	const body              = { runid:runidstring, paths, tses }

	while (continue_calling) {
		const r = await $N.FetchLassie('/api/firestore_get_batch', { method: "POST", body: JSON.stringify(body) }, { retries })
		if (!r.ok) { cleanup(); res(null); return; }

		for(let i = 0; i < paths.length; i++) {
			if (r.data![i].docs.length === 0) continue
			await write_to_indexeddb_store([syncobjectstores[i]], [r.data![i].docs])
			if (returnnewdata) pushtoreturns(paths[i], r.data![i].docs)
		}

		continue_calling = (r.data as any[]).every((rr:any) => rr.isdone) ? false : true
	}

	const newts = Math.floor(Date.now()/1000);
	syncobjectstores.forEach(dc => dc.ts = newts);
	localStorage.setItem("synccollections", JSON.stringify(_syncobjectstores
		.map(dc => ({ name: dc.name, ts: dc.ts }))));

	cleanup();

	if (returnnewdata)	res(returns);
	else				res(1)


    function cleanup() {
        continue_calling = false;
        syncobjectstores.forEach(dc => dc.lock = false);
    }


	function pushtoreturns( path:string, docs:GenericRowT[] ) {
		const rp = returns.get(path)!
		const available_space = returnnewdata_limit - rp.length
		rp.push(...docs.slice(0, available_space))
	}
})




const write_to_indexeddb_store = (syncobjectstores: SyncObjectStoresT[], datas:Array<object[]>) => new Promise<void>(async (resolve, _reject) => {

	if (!datas.some((d:any) => d.length > 0)) { resolve(); return; }

	const db = await $N.IDB.GetDB()

	const tx:IDBTransaction = db.transaction(syncobjectstores.map(ds => ds.name), "readwrite", { durability: "relaxed" })

	let are_there_any_put_errors = false

	for(let i = 0; i < syncobjectstores.length; i++) {
		const ds = syncobjectstores[i]

		if (datas[i].length === 0) continue

		const os = tx.objectStore(ds.name)

		for(let ii = 0; ii < datas[i].length; ii++) {
			const db_put = os.put(datas[i][ii])
			db_put.onerror = (_event:any) => are_there_any_put_errors = true
		}
	}

	tx.oncomplete = (_event:any) => {
		if (are_there_any_put_errors) redirect_from_error("Firestorelive Error putting data into IndexedDB")  
		resolve()
	}

	tx.onerror = (_event:any) => {
		redirect_from_error("Firestorelive Error putting data from IndexedDB")
	}
})




const write_a_partial_record_to_indexeddb_store = (syncobjectstore: SyncObjectStoresT, data:GenericRowT) => new Promise<void>(async (resolve, _reject) => {

	const db = await $N.IDB.GetDB()

	const tx:IDBTransaction = db.transaction(syncobjectstore.name, "readwrite", { durability: "relaxed" })

	let are_there_any_put_errors = false

	const os = tx.objectStore(syncobjectstore.name)

	const request = os.get(data.id)
	request.onsuccess = (event:any) => {
		const db_put       = os.put( { ...event.target.result, ...data } )
		db_put.onerror     = (_event:any) => are_there_any_put_errors = true
	}
	request.onerror = (_event:any) => are_there_any_put_errors = true

	tx.oncomplete = (_event:any) => {
		if (are_there_any_put_errors) redirect_from_error("Firestorelive Error putting data into IndexedDB")  
		resolve()
	}

	tx.onerror = (_event:any) => {
		redirect_from_error("Firestorelive Error putting data from IndexedDB")
	}
})




async function redirect_from_error(errmsg:str) {
	await ClearAllSyncObjectStores()
	$N.Unrecoverable("Error", "Error in LocalDBSync", "Reset App", LoggerSubjectE.indexeddb_error, errmsg)
}




export { Init, EnsureObjectStoresActive } 
if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).LocalDBSync = { Add, Patch, Delete, ClearAllSyncObjectStores };




