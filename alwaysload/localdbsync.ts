

import { num, str, bool } from '../defs_server_symlink.js'
import { $NT, GenericRowT  } from '../defs.js'
import { HandleLocalDBSyncUpdateTooLarge as SwitchStationHandleLocalDBSyncUpdateTooLarge } from './switchstation.js'
import { DataChanged as CMechDataChanged } from './cmech.js'


declare var $N:$NT

type OperationTypeT = 'add' | 'patch' | 'delete';
type PendingSyncOperationT = {
	id: str;
	docid: str,
	operation_type: OperationTypeT;
	target_store: str;
	oldts: num;
	payload: GenericRowT;
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

const PERIODIC_PAGELOAD_DELAY_MS             = 3 * 1000
const PERIODIC_INTERVAL_MS                   = 1 * 60 * 1000
const SYNC_PENDING_INTERVAL_MS               = 1 * 60 * 1000 // every 1 minute
const CHECK_LATEST_INTERVAL_MS               = 5 * 60 * 1000 
const WIPE_LOCAL_INTERVAL_MS                 = 72 * 60 * 60 * 1000 // 72 hours // 3 days
const SYNC_PENDING_INTERVAL_LOCALSTORAGE_KEY = 'localdbsync_sync_pending_interval_ts'
const CHECK_LATEST_INTERVAL_LOCALSTORAGE_KEY = 'localdbsync_check_latest_interval_ts'
const WIPE_LOCAL_INTERVAL_LOCALSTORAGE_KEY   = 'localdbsync_wipe_local_interval_ts'
const PENDING_SYNC_STORE_NAME                = 'localdbsync_pending_sync_operations';
const COLLECTION_TS							 = 'localdbsync_collections_ts'

let _syncobjectstores:SyncObjectStoresT[] = []
let _activepaths:PathSpecT[] = []
let _a_millis = 0




	
// notes to consider for coming back later to make this actually legit for real customers

// 1. If the local pending operation is out of date (a newer record exists at the server), its just gonna go away, silently and the browser is going to silently replace actual local collections data with latest from server (not here, but in datasetter on page focus etc)
// 2. If count is over, it just fucking deletes them all. Once again, silent data loss, pretty bad
// 3. When run_wipe_local is called, it instantly just fucking murders every bit of data, including any pending. Just, bleeeeeeeep, GONE!. So yeeah,, thats fucked too.
// 4. WAAAAY Too much silent shit going on. The user just silently loses data with zero warning. We need to surface these conflicts and give the user a chance to save or something. At the bare minimum give a chance to export before wiping the data out. 






const Init = (localdb_objectstores_tosync: {name:str,indexes?:str[]}[], db_name: str, db_version: num) => { 

	_a_millis = Math.floor(Date.now() / 1000)

	DBNAME    = db_name
	DBVERSION = db_version

	{ 
		const objectstores_tosync_names	    	   = localdb_objectstores_tosync.map(item => item.name)
		const localstorage_syncobjectstores        = JSON.parse(localStorage.getItem(COLLECTION_TS) || "[]") as {name:str, ts:num|null}[]
		const synccollections_not_in_localstorage  = objectstores_tosync_names.filter((name) => !localstorage_syncobjectstores.find(item => item.name === name))

		synccollections_not_in_localstorage.forEach((name) => {
			localstorage_syncobjectstores.push({ name, ts: null })
		})

		_syncobjectstores = localstorage_syncobjectstores.map((dc,_i)=> ({ name: dc.name, ts: dc.ts, lock: false, indexes: localdb_objectstores_tosync.find(l_ots => l_ots.name === dc.name)?.indexes || null }))

		localStorage.setItem(COLLECTION_TS, JSON.stringify(localstorage_syncobjectstores))

		_activepaths = _syncobjectstores
			.filter(so => so.ts !== null && so.ts > 0)
			.map(so => parse_into_pathspec(so.name));
	}


	setup_local_db_interval_periodic()


	$N.EngagementListen.Add_Listener(document.body, 'firestore', 'visible', 100, async ()=> {
		RunCheckLatest()
	})


	$N.SSEvents.Add_Listener(document.body, "firestore_doc_add", [1], 100, (event:{path:string,data:object})=> {
		handle_firestore_doc_add_or_patch(parse_into_pathspec(event.path), event.data)
	});


	$N.SSEvents.Add_Listener(document.body, "firestore_doc_patch", [2], 100, (event:{path:string,data:object, ispartial?:bool})=> {
		handle_firestore_doc_add_or_patch(parse_into_pathspec(event.path), event.data)
	});


	$N.SSEvents.Add_Listener(document.body, "firestore_doc_delete", [3], 100, async (event:{path:string,ts:number})=> {

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

		const datapath = "1:"+pathspec.collection
		CMechDataChanged(new Map<str, GenericRowT[]>([[datapath, [wholedata]]]))

		return;
	});


	$N.SSEvents.Add_Listener(document.body, "firestore_doc_collection", [4], 100, async (event:{paths:str[]})=> {

		// event.paths is only going to be collections, never a singe document. Single doc goes through FIRESTORE_DOC (3)

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
}




const RunCheckLatest = async () => {

	if (_activepaths.length === 0) return

	const r = await datasetter(_activepaths, {retries:2}, true, true)
	if (r === null || r === 1) return

	notify_of_datachange(r as Map<str, GenericRowT[]>)
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

	const pathspec = parse_into_pathspec(path)
	let   wholedata:GenericRowT = {}
	let   db:any


	try { db = await $N.IDB.GetDB(); }
	catch { record_failed(); return; }

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

	if (aye_errs) { record_failed(); return; }

	res(1);

	const datapath = "1:"+pathspec.collection
	const returnmap = new Map<str, GenericRowT[]>([[datapath, [wholedata as GenericRowT]]])
	CMechDataChanged(returnmap)


	{
		// handle the add operation on the server

		const body = { path:cname, data }
		const opts: { method: 'POST', body: string } = { method: 'POST', body: JSON.stringify(body), }

		const r = await $N.FetchLassie('/api/firestore_add', opts, null)
		if (!r.ok) { 
			//await record_failed_sync_operation('add', cname, data.ts, data)
			record_failed();
			return
		}
	}
})




const Patch = (pathstr:str, newdata:GenericRowT) => new Promise<num>(async (res,_rej)=> {  

	const pathspec = parse_into_pathspec(pathstr)

	let db:any

	try   { db = await $N.IDB.GetDB(); }
	catch { record_failed(); return; }

	const cname              = pathspec.syncobjectstore.name;
	const tx: IDBTransaction = db.transaction([cname], "readwrite", { durability: "relaxed" });
	const objectStore        = tx.objectStore(cname);
	let   wholedata: GenericRowT;

	try   { wholedata = await $N.IDB.GetOne_S(objectStore, pathspec.docid!); }
	catch { record_failed(); return; }

	update_record_with_new_data(wholedata, newdata)

	const oldts = wholedata.ts
	wholedata.ts = Math.floor(Date.now() / 1000)
	newdata.ts = wholedata.ts

	try   { await $N.IDB.PutOne_S(objectStore, wholedata); }
	catch { record_failed(); return; }

	try { await $N.IDB.TXResult(tx); } catch { record_failed(); return; }

	res(1);

	const datapath = "1:"+pathspec.collection
	CMechDataChanged(new Map<str, GenericRowT[]>([[datapath, [wholedata as GenericRowT]]]))


	{   
		// handle the patch operation on the server

		const body = { path:pathspec.path, oldts, newdata:change_newdata_for_firestore_update(newdata) }
		const opts:  { method: 'POST', body: string } = {method: "POST", body: JSON.stringify(body)};

		const r = await $N.FetchLassie('/api/firestore_patch', opts, null)

		if (!r.ok) {
			record_failed()
			//await record_failed_sync_operation('patch', cname, oldts, newdata);
			return;
		}
		else if (( r.data as any ).code === 10) { // has been deleted at the server
			await $N.IDB.DeleteOne(cname, pathspec.docid!);
			const data = { id: pathspec.docid, isdeleted: true }
			CMechDataChanged(new Map<str, GenericRowT[]>([[datapath, [data as GenericRowT]]]))
			return;
		}
		else if (( r.data as any ).code === 11) { // newer data at server
			await $N.IDB.PutOne(cname, ( r.data as any ).data);
			CMechDataChanged(new Map<str, GenericRowT[]>([[datapath, [( r.data as any ).data]]]))
			return;
		}
		else if (( r.data as any ).code === 1) { // all good
			return;
		} 
		else { 
			return;
		}
	}


	function change_newdata_for_firestore_update(newdata:GenericRowT) : GenericRowT {

		// firestore does not like nested objects, so we need to flatten them
		// this is a very simple implementation, but it should work for most cases

		const firestore_ready_data:GenericRowT = {}

		for (const key in newdata) {
			if (typeof newdata[key] === 'object' && newdata[key] !== null) {
				if (newdata[key].__path) {
					firestore_ready_data[key] = newdata[key];
				}
				else {
					for (const subkey in newdata[key]) {
						firestore_ready_data[`${key}.${subkey}`] = newdata[key][subkey]
					}
				}
			} else {
				firestore_ready_data[key] = newdata[key]
			}
		}

		return firestore_ready_data
	}
})




const Delete = (pathstr:str) => new Promise<num>(async (res,_rej)=> {  

	const pathspec = parse_into_pathspec(pathstr)

	const db                      = await $N.IDB.GetDB()

	const cname                   = pathspec.syncobjectstore.name;
	const tx: IDBTransaction      = db.transaction([cname], "readwrite", { durability: "relaxed" });
	const objectStore             = tx.objectStore(cname);
	let  existingdata:GenericRowT = {};

	try   { existingdata = await $N.IDB.GetOne_S(objectStore, pathspec.docid!); }
	catch { record_failed(); return; }

	const oldts = existingdata.ts
	existingdata.isdeleted = true
	existingdata.ts = Math.floor(Date.now() / 1000)

	try   { await $N.IDB.PutOne_S(objectStore, existingdata); }
	catch { record_failed(); return; }
	
	res(1);
	const datapath = "1:"+pathspec.collection
	CMechDataChanged(new Map<str, GenericRowT[]>([[datapath, [existingdata]]]))


	{
		const body = { path: pathspec.path, oldts, ts: existingdata.ts }
		const opts:  { method: 'POST', body: string } = {method: "POST", body: JSON.stringify(body)};

		const r = await $N.FetchLassie('/api/firestore_delete', opts, null)
		if (!r.ok) {
			record_failed()
			//await record_failed_sync_operation('delete', cname, oldts, { id: pathspec.docid!, ts: existingdata.ts });
			return;
		}
		else if (( r.data as any ).code === 10) { // record has been entirely removed at the server
			await $N.IDB.DeleteOne(cname, pathspec.docid!);
			const data = { id: pathspec.docid, isdeleted: true }
			CMechDataChanged(new Map<str, GenericRowT[]>([[datapath, [data as GenericRowT]]]))
			return;
		}
		else if (( r.data as any ).code === 11) { // newer data at server
			await $N.IDB.PutOne(cname, ( r.data as any ).data);
			CMechDataChanged(new Map<str, GenericRowT[]>([[datapath, [existingdata as GenericRowT]]]))
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




const RunSyncPending__not_doing_pending_operations_yet = async () => new Promise<boolean>(async (res, _rej) => {

	const exists = localStorage.getItem(PENDING_SYNC_STORE_NAME + "_exists") === "true" || false
	if (!exists)   { res(true); return; }


	const count = await $N.IDB.Count(PENDING_SYNC_STORE_NAME).catch(() => 0)

	if (count === 0) {
		localStorage.removeItem(PENDING_SYNC_STORE_NAME + "_exists");
		res(true)
		return
	}
	else if (count > 10) {
		$N.Unrecoverable("Error", "Too many pending sync operations", "Ok", "ldp", "count: " + count, null) //localdbsync_error_toomany_pending
		localStorage.removeItem(PENDING_SYNC_STORE_NAME + "_exists")
		await $N.IDB.ClearAll(PENDING_SYNC_STORE_NAME).catch(()=>null) // could theortically fail, but since we just previously connected to database I will assume we are ok
		res(true)
		return
	}
		

	const ping_r = await $N.FetchLassie('/api/ping')
	if (!ping_r.ok) {   res(false); return;  }
	

	const all_pending_r = await $N.IDB.GetAll([ PENDING_SYNC_STORE_NAME ]).catch(()=>null)
	if (!all_pending_r || !all_pending_r.get(PENDING_SYNC_STORE_NAME) || !all_pending_r.get(PENDING_SYNC_STORE_NAME)?.length) {   res(false); return;  }


	const all_pending = all_pending_r.get(PENDING_SYNC_STORE_NAME) as PendingSyncOperationT[]

	const pending_to_send:PendingSyncOperationT[] = []

	{ 
		// Pending operations can be duplicates (the user modded the same document multiple times while offline for example), so we group them by store and docid
		// We will merge patches and keep the latest operation for deletes or adds
		// This is to ensure we don't send multiple operations for the same document
		// We use the earliest timestamp for conflict detection, and the latest timestamp for the final state of the document

		// Group operations by store and docid to handle duplicates
		const operation_groups = new Map<string, PendingSyncOperationT[]>()
		
		for(const pending of all_pending) {
			const key = `${pending.target_store}:${pending.docid}`
			if (!operation_groups.has(key)) {
				operation_groups.set(key, [])
			}
			operation_groups.get(key)!.push(pending)
		}

		for(const [_key, operations] of operation_groups) {
			if (operations.length === 1) {
				pending_to_send.push(operations[0])
			} else {
				// Sort by timestamp (earliest first)
				operations.sort((a, b) => a.payload.ts - b.payload.ts)
				
				const earliest_operation = operations[0]
				const latest_operation = operations[operations.length - 1]
				
				if (latest_operation.operation_type === 'patch') {

					// Merge all patches into one
					const merged_payload: any = operations.reduce((acc, op) => ({ ...acc, ...op.payload }), {})
					merged_payload.ts         = latest_operation.payload.ts; // Use the latest timestamp for the final state
					
					pending_to_send.push({
						...latest_operation,
						payload: merged_payload,
						oldts: earliest_operation.oldts  // Earliest oldts for conflict detection
					})
				}
				else {
					// For delete or add operations, use the most recent one
					pending_to_send.push({
						...latest_operation,
						oldts: earliest_operation.oldts  // Still use earliest oldts for conflict detection
					})
				}
			}
		}
	}

	const opts = { method: 'POST', body: JSON.stringify(pending_to_send) }
	const r = await $N.FetchLassie('/api/firestore_sync_pending', opts)
	if (!r.ok) { res(false); return; }
	

	await $N.IDB.ClearAll(PENDING_SYNC_STORE_NAME).catch(()=>null) // could theortically fail, but since we just previously connected to database I will assume we are ok

	localStorage.removeItem(PENDING_SYNC_STORE_NAME + "_exists");

	res(true)
})




const RunWipeLocal = async () => {

	try {
		// Close any existing database connections
		const db = await $N.IDB.GetDB()
		db.close()
		
		// Wait for the database to actually close
		await new Promise<void>((resolve) => {
			// Check if database is closed by trying to start a transaction
			const check_closed = () => {
				try {
					// If database is closed, this will throw an error
					db.transaction([PENDING_SYNC_STORE_NAME], 'readonly')
					// If we get here, database is still open, wait a bit more
					setTimeout(check_closed, 10)
				} catch {
					// Database is closed, we can proceed
					resolve()
				}
			}
			check_closed()
		})
		
		// Delete the entire database
		const deleteRequest = indexedDB.deleteDatabase(DBNAME)
		
		await new Promise<void>((resolve, reject) => {
			deleteRequest.onsuccess = () => resolve()
			deleteRequest.onerror = () => reject(deleteRequest.error)
			deleteRequest.onblocked = () => {
				// Handle case where database deletion is blocked
				console.warn('Database deletion blocked, forcing close')
				setTimeout(() => resolve(), 1000)
			}
		})
		
		// Clear related localStorage items
		localStorage.removeItem( PENDING_SYNC_STORE_NAME + "_exists")
		localStorage.removeItem(COLLECTION_TS)
		localStorage.removeItem(SYNC_PENDING_INTERVAL_LOCALSTORAGE_KEY)
		localStorage.removeItem(CHECK_LATEST_INTERVAL_LOCALSTORAGE_KEY)
		localStorage.removeItem(WIPE_LOCAL_INTERVAL_LOCALSTORAGE_KEY)

		$N.Unrecoverable("Info", "App Data Refresh Needed", "Ok", "ldr", "", null) //localdbsync_third_day_reset
		
	} catch (error) {
		console.error('Error wiping local database:', error)
		// Even if there's an error, try to clean up localStorage
		localStorage.removeItem("pending_sync_operations_exists")
		localStorage.removeItem(COLLECTION_TS)
	}
}




const setup_local_db_interval_periodic = () => {

	const run_sync_if_needed = () => {

		// this is designed to store time in localStorage so that we can keep interval timing across multiple page loads

		const now                  = Date.now()

		const sync_pending_interval_ts_str     = localStorage.getItem(SYNC_PENDING_INTERVAL_LOCALSTORAGE_KEY)
		let   sync_pending_interval_ts         = sync_pending_interval_ts_str ? parseInt(sync_pending_interval_ts_str) : 0

		const check_latest_run_str             = localStorage.getItem(CHECK_LATEST_INTERVAL_LOCALSTORAGE_KEY)
		let   check_latest_run_ts              = check_latest_run_str ? parseInt(check_latest_run_str) : 0

		const wipe_local_run_str               = localStorage.getItem(WIPE_LOCAL_INTERVAL_LOCALSTORAGE_KEY)
		let   wipe_local_run_ts                = wipe_local_run_str ? parseInt(wipe_local_run_str) : 0

		// if any of these are not set, set them to now so our functions dont run immediately
		if (!sync_pending_interval_ts) { sync_pending_interval_ts = now; localStorage.setItem(SYNC_PENDING_INTERVAL_LOCALSTORAGE_KEY, now.toString()); }
		if (!check_latest_run_ts)  { check_latest_run_ts          = now; localStorage.setItem(CHECK_LATEST_INTERVAL_LOCALSTORAGE_KEY, now.toString()); }
		if (!wipe_local_run_ts)    { wipe_local_run_ts            = now; localStorage.setItem(WIPE_LOCAL_INTERVAL_LOCALSTORAGE_KEY, now.toString()); }
		

		// Run the tasks at their respective intervals
		if (now - sync_pending_interval_ts >= SYNC_PENDING_INTERVAL_MS) { localStorage.setItem(SYNC_PENDING_INTERVAL_LOCALSTORAGE_KEY, now.toString()); /*RunSyncPending();*/ }
		if (now - check_latest_run_ts >= CHECK_LATEST_INTERVAL_MS)		{ localStorage.setItem(CHECK_LATEST_INTERVAL_LOCALSTORAGE_KEY, now.toString()); RunCheckLatest(); }
		if (now - wipe_local_run_ts >= WIPE_LOCAL_INTERVAL_MS)			{ localStorage.setItem(WIPE_LOCAL_INTERVAL_LOCALSTORAGE_KEY, now.toString()); RunWipeLocal(); }
	}
	
	// Check immediately on init (which is every page load)
	setTimeout(run_sync_if_needed, PERIODIC_PAGELOAD_DELAY_MS)
	
	// Set up periodic checking in case the user stays on the page for a long time
	setInterval(run_sync_if_needed, PERIODIC_INTERVAL_MS)
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




const handle_firestore_doc_add_or_patch = (pathspec:PathSpecT, data:GenericRowT) => new Promise<num>(async (res,_rej)=> {

	if (pathspec.syncobjectstore) {   
		await write_to_indexeddb_store([ pathspec.syncobjectstore ], [ [data] ]);   
	}

	const datapathspec = "1:"+pathspec.collection
	CMechDataChanged(new Map<str, GenericRowT[]>([[datapathspec, [data as GenericRowT]]]))

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
	const returns           = new Map<str,GenericRowT[]>( paths.map(path=> ["1:"+path, []]) )
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
	localStorage.setItem(COLLECTION_TS, JSON.stringify(_syncobjectstores
		.map(dc => ({ name: dc.name, ts: dc.ts }))));

	cleanup();

	if (returnnewdata)	res(returns);
	else				res(1)


    function cleanup() {
        continue_calling = false;
        syncobjectstores.forEach(dc => dc.lock = false);
    }


	function pushtoreturns( path:string, docs:GenericRowT[] ) {
		const rp = returns.get("1:"+path)!
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











const record_failed = () => {
	RunWipeLocal()
}




const record_failed_sync_operation = (
	type: OperationTypeT,
	target_store: string,
	oldts: num,
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
		oldts,
		payload: newdata,  // payload is either whole or partial data -- more likely partial
	}

	let r:any
	try   { r = await $N.IDB.PutOne_S(s, pendingOp); }
	catch { rej(); return; }

	localStorage.setItem("pending_sync_operations_exists", "true");

	res()
})




async function redirect_from_error(errmsg:str) {
	$N.Unrecoverable("Error", "Error in LocalDBSync", "Reset App", "ixe", errmsg, null) //indexeddb_error
}




export { Init, RunCheckLatest, RunWipeLocal, EnsureObjectStoresActive } 
if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).LocalDBSync = { Add, Patch, Delete };




