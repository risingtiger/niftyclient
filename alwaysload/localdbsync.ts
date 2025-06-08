

import { num, str, bool } from '../defs_server_symlink.js'
import { SSETriggersE } from '../defs_server_symlink.js'
import { $NT, LoggerSubjectE, EngagementListenerTypeT, GenericRowT  } from '../defs.js'
import { HandleLocalDBSyncUpdateTooLarge as SwitchStationHandleLocalDBSyncUpdateTooLarge } from './switchstation.js'
import { DataChanged as CMechDataChanged } from './cmech.js'


declare var $N:$NT

type OperationTypeT = 'add' | 'patch' | 'delete';
type PendingSyncOperationT = {
	id: str;
	docid: str,
	operation_type: OperationTypeT;
	target_store: str;
	ts: num;
	payload: GenericRowT | null;
};

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

const SYNC_INTERVAL_MINUTES   = 1
const SYNC_INTERVAL_MS        = SYNC_INTERVAL_MINUTES * 60 * 1000
const STORAGE_KEY             = 'localdbsync_last_run'
const PENDING_SYNC_STORE_NAME = '__pending_sync_operations';

let _syncobjectstores:SyncObjectStoresT[] = []
let _activepaths:PathSpecT[] = []
let _a_millis = 0


//let _listens: FirestoreLoadSpecT = new Map()
//let _nonsync_tses: Map<str,num> = new Map()


const Init = (localdb_objectstores_tosync: {name:str,indexes?:str[]}[], db_name: str, db_version: num) => { 

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

		_syncobjectstores = localstorage_syncobjectstores.map((dc,_i)=> ({ name: dc.name, ts: dc.ts, lock: false, indexes: localdb_objectstores_tosync.find(l_ots => l_ots.name === dc.name)?.indexes || null }))

		localStorage.setItem("synccollections", JSON.stringify(localstorage_syncobjectstores))

		_activepaths = _syncobjectstores
			.filter(so => so.ts !== null && so.ts > 0)
			.map(so => parse_into_pathspec(so.name));
	}


	SetupLocalDBSyncPeriodic()


	console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!1")

	console.log(`I also need to put in something where on page refresh or navigation, if last time in app has been more than X seconds ago, wait a bit then go fetch latest changes

	Also, If have an interval. Say every 5 minutes, if the app is active, just go grab latest. I know its a lot of traffic, but I dont trust the data to not go stale if I don't do something like that`)

	console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!1")




	$N.EngagementListen.Add_Listener(document.body, 'firestore', EngagementListenerTypeT.visible, 100, async ()=> {

		if (_activepaths.length === 0) return

		const r = await datasetter(_activepaths, {retries:2}, true, true)
		if (r === null || r === 1) return

		notify_of_datachange(r as Map<str, GenericRowT[]>)

	})


	$N.SSEvents.Add_Listener(document.body, "firestore_doc_add", [SSETriggersE.FIRESTORE_DOC_ADD], 100, (event:{path:string,data:object})=> {
		handle_firestore_doc_add_or_patch(parse_into_pathspec(event.path), event.data)
	});


	$N.SSEvents.Add_Listener(document.body, "firestore_doc_patch", [SSETriggersE.FIRESTORE_DOC_PATCH], 100, (event:{path:string,data:object, ispartial?:bool})=> {
		handle_firestore_doc_add_or_patch(parse_into_pathspec(event.path), event.data)
	});


	$N.SSEvents.Add_Listener(document.body, "firestore_doc_delete", [SSETriggersE.FIRESTORE_DOC_DELETE], 100, async (event:{path:string,ts:number})=> {

		const pathspec = parse_into_pathspec(event.path)

		let db:any

		try { db = await $N.IDB.GetDB(); }
		catch { return; }

		const cname              = pathspec.syncobjectstore.name;
		const tx: IDBTransaction = db.transaction(cname, "readwrite", { durability: "relaxed" });
		const objectStore        = tx.objectStore(cname);
		let   wholedata: GenericRowT;

		try   { wholedata = await $N.IDB.GetOne_S(objectStore, pathspec.docid!); }
		catch { return; }

		wholedata.ts = event.ts
		wholedata.isdeleted = true

		try   { await $N.IDB.PutOne_S(objectStore, wholedata); }
		catch { return; }

		try { await $N.IDB.TXResult(tx); } catch { return; }

		CMechDataChanged(new Map<str, GenericRowT[]>([[pathspec.syncobjectstore.name, [wholedata as GenericRowT]]]))

		return;
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




const Add = (path:str, data:GenericRowT) => new Promise<num>(async (res,rej)=> {  

	const pathspec = parse_into_pathspec(path)
	let   wholedata:GenericRowT = {}
	let   db:any


	try { db = await $N.IDB.GetDB(); }
	catch { rej(); return; }

	data.ts = Math.floor(Date.now() / 1000)
	data.id = crypto.randomUUID();

	let aye_errs = false
	const cname = pathspec.syncobjectstore.name
	const tx: IDBTransaction = db.transaction([cname], "readwrite", { durability: "relaxed" })
	const objectstore = tx.objectStore(cname)

	try   { await $N.IDB.AddOne_S(objectstore, data); } 
	catch { aye_errs = true; }

	try   { await $N.IDB.TXResult(tx); } 
	catch { aye_errs = true; }

	if (aye_errs) { rej(); return; }

	res(1);

	const returnmap = new Map<str, GenericRowT[]>([[pathspec.syncobjectstore.name, [wholedata as GenericRowT]]])
	CMechDataChanged(returnmap)


	{
		// handle the add operation on the server

		const body = { path:cname, data }
		const opts: { method: 'POST', body: string } = { method: 'POST', body: JSON.stringify(body), }

		const r = await $N.FetchLassie('/api/firestore_add', opts, null)
		if (!r.ok) { 
			await record_failed_sync_operation('add', cname, data)
			return
		}
	}
})




const Patch = (pathstr:str, newdata:GenericRowT) => new Promise<num>(async (res,rej)=> {  

	const pathspec = parse_into_pathspec(pathstr)

	let db:any

	try   { db = await $N.IDB.GetDB(); }
	catch { rej(); return; }

	const cname              = pathspec.syncobjectstore.name;
	const tx: IDBTransaction = db.transaction([cname], "readwrite", { durability: "relaxed" });
	const objectStore        = tx.objectStore(cname);
	let   wholedata: GenericRowT;

	try   { wholedata = await $N.IDB.GetOne_S(objectStore, pathspec.docid!); }
	catch { rej(); return; }

	update_record_with_new_data(wholedata, newdata)

	wholedata.ts = Math.floor(Date.now() / 1000)

	try   { await $N.IDB.PutOne_S(objectStore, wholedata); }
	catch { rej(); return; }

	try { await $N.IDB.TXResult(tx); } catch { rej(); return; }

	res(1);

	CMechDataChanged(new Map<str, GenericRowT[]>([[pathspec.syncobjectstore.name, [wholedata as GenericRowT]]]))


	{   
		// handle the patch operation on the server

		const body = { path:pathspec.path, newdata }
		const opts:  { method: 'POST', body: string } = {method: "POST", body: JSON.stringify(body)};

		const r = await $N.FetchLassie('/api/firestore_patch', opts, null)

		if (!r.ok) {
			await record_failed_sync_operation('patch', cname, newdata);
			return;
		}
		else if (( r.data as any ).code === 10) { // has been deleted at the server
			await $N.IDB.DeleteOne(cname, pathspec.docid!);
			const data = { id: pathspec.docid, isdeleted: true }
			CMechDataChanged(new Map<str, GenericRowT[]>([[pathspec.syncobjectstore.name, [data as GenericRowT]]]))
			return;
		}
		else if (( r.data as any ).code === 11) { // newer data at server
			await $N.IDB.PutOne(cname, ( r.data as any ).data);
			CMechDataChanged(new Map<str, GenericRowT[]>([[pathspec.syncobjectstore.name, [( r.data as any ).data]]]))
			return;
		}
		else if (( r.data as any ).code === 1) { // all good
			return;
		} 
		else { 
			return;
		}
	}
})




const Delete = (pathstr:str) => new Promise<num>(async (res,rej)=> {  

	const pathspec = parse_into_pathspec(pathstr)

	const db                      = await $N.IDB.GetDB()

	const cname                   = pathspec.syncobjectstore.name;
	const tx: IDBTransaction      = db.transaction([cname], "readwrite", { durability: "relaxed" });
	const objectStore             = tx.objectStore(cname);
	let  existingdata:GenericRowT = {};

	try   { existingdata = await $N.IDB.GetOne_S(objectStore, pathspec.docid!); }
	catch { rej(); return; }

	existingdata.isdeleted = true
	existingdata.ts = Math.floor(Date.now() / 1000)

	try   { await $N.IDB.PutOne_S(objectStore, existingdata); }
	catch { rej(); return; }
	
	res(1);
	CMechDataChanged(new Map<str, GenericRowT[]>([[pathspec.syncobjectstore.name, [existingdata as GenericRowT]]]))



	{
		const body = { path: pathspec.path, ts:existingdata.ts }
		const opts:  { method: 'POST', body: string } = {method: "POST", body: JSON.stringify(body)};

		const r = await $N.FetchLassie('/api/firestore_delete', opts, null)
		if (!r.ok) {
			await record_failed_sync_operation('delete', cname, { id: pathspec.docid!, ts: existingdata.ts });
			return;
		}
		else if (( r.data as any ).code === 10) { // record has been entirely removed at the server
			await $N.IDB.DeleteOne(cname, pathspec.docid!);
			const data = { id: pathspec.docid, isdeleted: true }
			CMechDataChanged(new Map<str, GenericRowT[]>([[pathspec.syncobjectstore.name, [data as GenericRowT]]]))
			return;
		}
		else if (( r.data as any ).code === 11) { // newer data at server
			await $N.IDB.PutOne(cname, ( r.data as any ).data);
			CMechDataChanged(new Map<str, GenericRowT[]>([[pathspec.syncobjectstore.name, [existingdata as GenericRowT]]]))
			return;
		}
		else if (( r.data as any ).code === 1) { // all good
			return;
		} 
		else { 
			return;
		}
	}
})




const SetupLocalDBSyncPeriodic = () => {

	const run_sync_if_needed = () => {
		const now = Date.now()
		const last_run_str = localStorage.getItem(STORAGE_KEY)
		const last_run = last_run_str ? parseInt(last_run_str) : 0
		
		if (now - last_run >= SYNC_INTERVAL_MS) {
			localStorage.setItem(STORAGE_KEY, now.toString())
			run_local_db_sync_periodic()
		}
	}
	
	// Check immediately on init (which is every page load)
	setTimeout(run_sync_if_needed, 3000)
	
	// Set up periodic checking
	setInterval(run_sync_if_needed, SYNC_INTERVAL_MS)
}



const handle_firestore_doc_add_or_patch = (pathspec:PathSpecT, data:object) => new Promise<num>(async (res,_rej)=> {

	if (pathspec.syncobjectstore) {   
		await write_to_indexeddb_store([ pathspec.syncobjectstore ], [ [data] ]);   
	}

	//CMechDataChanged(new Map<str, GenericRowT[]>([[pathspec.syncobjectstore.name, [data as GenericRowT]]]))

	res(1)
})




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
		if (are_there_any_put_errors) redirect_from_error("write_to_indexeddb_store")  
		resolve()
	}

	tx.onerror = (_event:any) => {
		redirect_from_error("write_to_indexeddb_store")
	}
})




const update_record_with_new_data = (record: GenericRowT, newdata: any): void => {
	for (const key in newdata) {
		if (typeof record[key] == 'object') 
			update_record_with_new_data(record[key], newdata[key])
		else 
			record[key] = newdata[key]
	}
}




const run_local_db_sync_periodic = async () => new Promise<boolean>(async (res, _rej) => {

	const exists = localStorage.getItem("pending_sync_operations_exists")
	if (!exists)   { res(true); return; }


	const count = await $N.IDB.Count(PENDING_SYNC_STORE_NAME).catch(() => 0)

	if (count === 0) {
		localStorage.removeItem("pending_sync_operations_exists");
		res(true)
		return
	}
		

	const ping_r = await $N.FetchLassie('/api/ping')
	if (!ping_r.ok) {   res(false); return;  }
	

	const all_pending_r = await $N.IDB.GetAll([ PENDING_SYNC_STORE_NAME ]).catch(()=>null)
	if (!all_pending_r || !all_pending_r.get(PENDING_SYNC_STORE_NAME) || !all_pending_r.get(PENDING_SYNC_STORE_NAME)?.length) {   res(false); return;  }


	const all_pending = all_pending_r.get(PENDING_SYNC_STORE_NAME) as PendingSyncOperationT[]

	const pending_to_send:PendingSyncOperationT[] = []

	for(const pending of all_pending) {
		// check if there exists more than one operation for the same doc in the same store AI!
	}

	const opts = { method: 'POST', body: JSON.stringify(all_pending) }
	const r = await $N.FetchLassie('/api/firestore_sync_pending', opts)
	if (!r.ok) { res(false); return; }
	

	await $N.IDB.ClearAll(PENDING_SYNC_STORE_NAME).catch(()=>null) // could theortically fail, but since we just previously connected to database I will assume we are ok

	localStorage.removeItem("pending_sync_operations_exists");

	res(true)
})



const record_failed_sync_operation = (
	type: OperationTypeT,
	target_store: string,
	newdata: GenericRowT): Promise<void> => new Promise(async (res, rej) => {

	let db:IDBDatabase;
	try { db = await $N.IDB.GetDB(); }
	catch { rej(); return; }

	const tx = db.transaction(PENDING_SYNC_STORE_NAME, "readwrite")
	const s  = tx.objectStore(PENDING_SYNC_STORE_NAME)

	const pendingOp: PendingSyncOperationT = {
		id: crypto.randomUUID(),  
		docid:newdata.id,
		operation_type: type,
		target_store: target_store,
		ts: newdata.ts,
		payload: newdata,  // payload is either whole or partial data -- more likely partial
	}

	let r:any
	try   { r = await $N.IDB.PutOne_S(s, pendingOp); }
	catch { rej(); return; }

	localStorage.setItem("pending_sync_operations_exists", "true");

	res()
})




async function redirect_from_error(errmsg:str) {
	$N.Unrecoverable("Error", "Error in LocalDBSync", "Reset App", LoggerSubjectE.indexeddb_error, errmsg, null)
}




export { Init, EnsureObjectStoresActive } 
if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).LocalDBSync = { Add, Patch, Delete };




