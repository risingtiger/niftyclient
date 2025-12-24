

import { num, str, bool } from '../defs_server_symlink.js'
import { $NT, GenericRowT, DataHodlEvents  } from '../defs.js'


declare var $N:$NT

/*
type PendingSyncOperationT = {
	id: str;
	docid: str,
	operation_type: OperationTypeT;
	target_store: str;
	oldts: num;
	payload: GenericRowT;
};
*/

type SyncObjectStoresT = {
	name: string,
	ts: num|null,
	lock:boolean,
	indexes:string[]|null
}

type LocalDBSyncPathSpecT = {
	path:string,
	p: string[],
	collection: string,
	docid: string|null, // never will just be a document (always a collection). but could be a path like "machines/1234/statuses"
	subcollection: string|null,
	syncobjectstore: SyncObjectStoresT,
}


let DBNAME:str = ""
let DBVERSION:num = 0

/*
const PERIODIC_PAGELOAD_DELAY_MS             = 3 * 1000
const PERIODIC_INTERVAL_MS                   = 1 * 60 * 1000
const SYNC_PENDING_INTERVAL_MS               = 1 * 60 * 1000 // every 1 minute
const CHECK_LATEST_INTERVAL_MS               = 5 * 60 * 1000 
const WIPE_LOCAL_INTERVAL_MS                 = 72 * 60 * 60 * 1000 // 72 hours // 3 days
const SYNC_PENDING_INTERVAL_LOCALSTORAGE_KEY = 'localdbsync_sync_pending_interval_ts'
const CHECK_LATEST_INTERVAL_LOCALSTORAGE_KEY = 'localdbsync_check_latest_interval_ts'
const WIPE_LOCAL_INTERVAL_LOCALSTORAGE_KEY   = 'localdbsync_wipe_local_interval_ts'
const PENDING_SYNC_STORE_NAME                = 'localdbsync_pending_sync_operations';
*/
const COLLECTION_TS							 = 'localdbsync_collections_ts'

let _syncobjectstores:SyncObjectStoresT[] = []
let _activepaths:LocalDBSyncPathSpecT[] = []
let _a_millis = 0




	
// TODO: notes to consider for coming back later to make this actually legit for real customers

// .5 Probably want to start culling the _activepaths as user navigates app to avoid syncing too much data
// 1. I want to allow modifying local data while offline, but currently thats not supported. I have commented code out but will have to circle back to it maybe later maybe never
// 1. If the local pending operation is out of date (a newer record exists at the server), its just gonna go away, silently and the browser is going to silently replace actual local collections data with latest from server (not here, but in datasetter on page focus etc)
// 2. If count is over, it just fucking deletes them all. Once again, silent data loss, pretty bad






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

	return true
}




const RunSyncFromEvent = async (eventname: DataHodlEvents, event?: any) => new Promise<void>(async (res,rej)=> {

	if (eventname === "visible" || eventname === "15interval") { 
		if (_activepaths.length === 0) { res(); return; }

		const r = await datasetter(_activepaths, {  }, true).catch(()=>null)
		if (r === null) { rej(); return; }

		res()
		return; 
	}

	// datasync_doc_add is just wrapped up as a datasync_collection
	if (eventname === "datasync_doc_patch" || eventname === "datasync_doc_delete") {

		if (!event || !event.paths || !event.data) { res(); return; }

		const ps = parse_into_pathspec(event.paths[0]);
		if (!ps.syncobjectstore) { res(); return; }

		if (eventname === "datasync_doc_delete") {
			await $N.IDB.DeleteOne(ps.syncobjectstore.name, event.data.id)
		} else {
			await write_to_indexeddb_store([ ps.syncobjectstore ], [ [event.data] ]);   
		}

		res()
		return;
	}

	if (eventname === "datasync_collection") {
		if (!event || !event.paths || !event.paths.length) { console.error('RunSyncFromEvent: missing event, event.paths or event.paths.length'); return; }

		const ssepathspecs = event.paths.map((sp:str)=> parse_into_pathspec(sp));

		const pathspecs = _activepaths.filter(aps => 
			ssepathspecs.find(( sp:any ) => sp.collection === aps.collection && sp.docid === aps.docid && sp.subcollection === aps.subcollection)
		);
		if (pathspecs.length === 0) {   res(); return;  }

		const r = await datasetter(pathspecs, {}, true).catch(()=>null);
		if (r === null) { rej(); return; }

		res()
		return;
	}
})




const PreloadObjectStores = (names:str[]) => new Promise<num|null>(async (res,rej)=> {

	// currently is only main level firestore collections. will add subcollections soon

	const pathspecs:LocalDBSyncPathSpecT[] = names.map(name=> parse_into_pathspec(name))

	const newpathspecs = pathspecs.filter(pathspec => 
		!_activepaths.some(activePath => 
			activePath.collection === pathspec.collection && 
			activePath.docid === pathspec.docid && 
			activePath.subcollection === pathspec.subcollection
		)
	)

	if (newpathspecs.length === 0) { res(1); return; }

	const r = await datasetter(newpathspecs, {}, false).catch(()=>null)
	if (r === null) { rej(); return; }

	_activepaths = [..._activepaths, ...newpathspecs]

	res(1)
})




const Add = async (pathstr:str, data:GenericRowT) => { 

	const pathspec = parse_into_pathspec(pathstr)
	if (!pathspec || !pathspec.docid || !pathspec.syncobjectstore) { console.error('Add: invalid pathspec'); return; }

	data.ts = Math.floor(Date.now() / 1000)
	data.id = crypto.randomUUID();

	const cname = pathspec.syncobjectstore.name

	const body = { path:cname, data, suppress_sse: true }
	const opts: { method: 'POST', body: string } = { method: 'POST', body: JSON.stringify(body), }
	const r = await $N.FetchLassie('/api/firestore_add', opts, null)
	if (!r.ok) { 
		redirect_from_error("Add: FetchLassie Failed"); 
		return; 
	}

	// only persist locally on success
	await $N.IDB.PutOne(cname, data)

}




const Patch = async (pathstr:str, newpartialdata:GenericRowT) => {

	const pathspec     = parse_into_pathspec(pathstr)
	if (!pathspec || !pathspec.docid || !pathspec.syncobjectstore) { console.error('Patch: invalid pathspec'); return; }

	const cname        = pathspec.syncobjectstore.name;
	const ts           = Math.floor(Date.now() / 1000)
	const existingdata = await $N.IDB.GetOne(cname, pathspec.docid!);
	const oldts        = existingdata.ts;
	const newdata      = merge_new_to_existing(existingdata, { ...newpartialdata, ts });

	const body = { path:pathspec.path, oldts, newdata:change_newdata_for_firestore_update(newdata), suppress_sse: true }
	const opts:  { method: 'POST', body: string } = {method: "POST", body: JSON.stringify(body)};
	const r = await $N.FetchLassie('/api/firestore_patch', opts, null)
	if (!r.ok || (r.data as any).code !== 1) {
		redirect_from_error("Patch FetchLassie Failed. Server code: " + (r.data as any).code); 
		return;
	}

	await $N.IDB.PutOne(cname, newdata); 
}




const Delete = async (pathstr: str) => {

	const pathspec                  = parse_into_pathspec(pathstr)
	if (!pathspec || !pathspec.docid || !pathspec.syncobjectstore) { console.error('Delete: invalid pathspec'); return; }

	const cname                     = pathspec.syncobjectstore.name

	const existingdata: GenericRowT = await $N.IDB.GetOne(cname, pathspec.docid!)

	const oldts = existingdata.ts
	const newts = Math.floor(Date.now() / 1000)

	const body = { path: pathspec.path, oldts, ts: newts, suppress_sse: true }
	const opts: { method: 'POST', body: string } = { method: 'POST', body: JSON.stringify(body) }
	const r = await $N.FetchLassie('/api/firestore_delete', opts, null)
	if (!r.ok) { 
		redirect_from_error("Delete FetchLassie Failed"); 
		return; 
	}

	if ((r.data as any)?.code === 11) {
		await $N.IDB.PutOne(cname, (r.data as any).data)
		redirect_from_error("Delete sorta failed. Was newer at server"); 
		return;
	}

	// only if no errors
	await $N.IDB.DeleteOne(cname, pathspec.docid!)
}




const datasetter = (pathspecs:LocalDBSyncPathSpecT[], opts?:{}, force_refresh_syncobjectstores:bool = false) => new Promise<num|null>(async (res,rej)=> { 

	opts = opts || {}

	const paths_tosync                            = pathspecs.filter(p=> p.syncobjectstore.ts === null || force_refresh_syncobjectstores )

	// probably wont be duplicates, but when I start doing subcollections it could start being an issue

	const syncobjectstores_tosync_withduplicates  = paths_tosync.map(p=> p.syncobjectstore!)
	const syncobjectstores_tosync                 = syncobjectstores_tosync_withduplicates.filter((item, index) => syncobjectstores_tosync_withduplicates.indexOf(item) === index)
	const syncobjectstores_tosync_unlocked        = syncobjectstores_tosync.filter(dc=> !dc.lock)
	const syncobjectstores_tosync_locked          = syncobjectstores_tosync.filter(dc=> dc.lock)


	{
		if (syncobjectstores_tosync_unlocked.length) {
			const rs = await load_into_syncobjectstores(syncobjectstores_tosync_unlocked).catch(()=>null)
			if (rs === null) { rej(); return; }
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

	
	res(1)
})




function parse_into_pathspec(path:str) : LocalDBSyncPathSpecT {

	const p                    = path.split('/') as Array<string>
	const collection           = p[0]
	const docid                = p[1] || null // only ever have a docid because we'll be using a subcollection. ALL paths are collections
	const subcollection        = docid && p[2] ? p[2] : null 

	// syncollection currently is ONLY for main level collections. we'll be adding subcollections soon (so firestore machines/123/statuses for example can be accessed)
	const syncobjectstore      = _syncobjectstores.find((dc) => dc.name === collection) as SyncObjectStoresT

	return { path, p, collection, docid, subcollection, syncobjectstore }
}




const load_into_syncobjectstores = (syncobjectstores:SyncObjectStoresT[]) => new Promise<num|null|Map<str,GenericRowT[]>>(async (res,rej)=> {

    syncobjectstores.forEach(dc => dc.lock = true);

	const runidstring       = Math.random().toString(15).substring(2, 12)
	let   continue_calling  = true	
	const paths             = syncobjectstores.map(dc=> dc.name)
	const tses              = syncobjectstores.map(dc=> dc.ts || null)
	const body              = { runid:runidstring, paths, tses }

	while (continue_calling) {
		const r = await $N.FetchLassie('/api/firestore_get_batch', { method: "POST", body: JSON.stringify(body) }, {  })
		if (!r.ok) {
			cleanup(); 
			await remove_all_records_after_ts(syncobjectstores)
			rej();
			return;
		}

		for(let i = 0; i < paths.length; i++) {
			if (r.data![i].docs.length === 0) continue
			await write_to_indexeddb_store([syncobjectstores[i]], [r.data![i].docs])
		}

		continue_calling = (r.data as any[]).every((rr:any) => rr.isdone) ? false : true
	}

	const newts = Math.floor(Date.now()/1000);
	syncobjectstores.forEach(dc => dc.ts = newts);
	localStorage.setItem(COLLECTION_TS, JSON.stringify(_syncobjectstores
		.map(dc => ({ name: dc.name, ts: dc.ts }))));

	cleanup();

	res(1)


    function cleanup() {
        continue_calling = false;
        syncobjectstores.forEach(dc => dc.lock = false);
    }
})




const write_to_indexeddb_store = (syncobjectstores: SyncObjectStoresT[], datas:Array<object[]>) => new Promise<void>(async (resolve, _reject) => {

	const deleteobjectstoreindexes:num[] = []; 
	syncobjectstores.forEach((dc,i) => { if(dc.name === '__deleted_docs') deleteobjectstoreindexes.push(i);});

	const delete_syncobjectstores:SyncObjectStoresT[] = deleteobjectstoreindexes.map(i => syncobjectstores[i]);
	const delete_datas: Array<object[]>               = deleteobjectstoreindexes.map(i => datas[i]);

	const normal_syncobjectstores:SyncObjectStoresT[] = syncobjectstores.filter((_,i) => !deleteobjectstoreindexes.includes(i));
	const normal_datas: Array<object[]>               = datas.filter((_,i) => !deleteobjectstoreindexes.includes(i));

	const promises: Promise<any>[] = [];

	promises.push($N.IDB.PutMany(normal_syncobjectstores.map(dc=> dc.name), normal_datas));
	promises.push($N.IDB.DeleteMany(delete_syncobjectstores.map(dc=> dc.name), delete_datas as any[][]));

	await Promise.all(promises);

	resolve();
})




async function redirect_from_error(errmsg:str) {
	$N.Unrecoverable("Error", "Error in LocalDBSync", "Reset App", "lde", errmsg, null) //indexeddb_error
}




const remove_all_records_after_ts = async (syncobjectstores: SyncObjectStoresT[]): Promise<void> => {

	const db = await $N.IDB.GetDB()

	for (const so of syncobjectstores) {
		await new Promise<void>((resolve) => {
			const ts = so.ts || 0
			let tx = db.transaction(so.name, 'readwrite'); 
			const os = tx.objectStore(so.name);
			const idx   = os.index('ts');
			const range = IDBKeyRange.lowerBound(ts, true);
			const req   = idx.openCursor(range);
			req.onsuccess = () => {
				const cursor = req.result as IDBCursorWithValue | null;
				if (!cursor) return;
				try { cursor.delete(); } catch {}
				cursor.continue();
			};
			req.onerror = () => {};

			// TODO: Fucking fix this future self. properly revert or completely reset local data if this fails 
			tx.oncomplete = () => resolve();
			tx.onerror    = () => resolve();
			tx.onabort    = () => resolve();
		});
	}
};




function merge_new_to_existing(existing:GenericRowT, newpartial:GenericRowT) : GenericRowT {

	const merged: GenericRowT = { ...existing }

	for (const key in newpartial) {
		if (!Object.prototype.hasOwnProperty.call(newpartial, key)) { continue; }

		const newvalue = newpartial[key]

		if (newvalue === undefined) { continue; }
		if (newvalue === null)      { merged[key] = null; continue; }

		if (Array.isArray(newvalue)) {
			merged[key] = newvalue.slice()
			continue
		}

		if (typeof newvalue === 'object') {
			if ((newvalue as any).__path) {
				merged[key] = newvalue
				continue
			}

			const isplainobject = Object.prototype.toString.call(newvalue) === '[object Object]'
			if (isplainobject) {
				const existingvalue = merged[key]
				const base: GenericRowT = (existingvalue && typeof existingvalue === 'object' && !Array.isArray(existingvalue))
					? { ...(existingvalue as GenericRowT) }
					: {} as GenericRowT

				merged[key] = merge_new_to_existing(base, newvalue as GenericRowT)
				continue
			}

			merged[key] = newvalue
			continue
		}

		merged[key] = newvalue
	}

	return merged
}




function change_newdata_for_firestore_update(newdata:GenericRowT) : GenericRowT {

	const firestore_ready_data:GenericRowT = {}
	for (const key in newdata) {
		if (typeof newdata[key] === 'object' && newdata[key] !== null) {
			if (newdata[key].__path) { firestore_ready_data[key] = newdata[key]; }
			else if (Array.isArray(newdata[key])) { firestore_ready_data[key] = newdata[key]; }
			else { for (const subkey in newdata[key]) { firestore_ready_data[`${key}.${subkey}`] = newdata[key][subkey] } }
		} else { firestore_ready_data[key] = newdata[key] }
	}
	return firestore_ready_data
}




/*
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
*/




/*
const run_wipe_local = async () => {

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
*/




/*
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
		if (now - sync_pending_interval_ts >= SYNC_PENDING_INTERVAL_MS) { localStorage.setItem(SYNC_PENDING_INTERVAL_LOCALSTORAGE_KEY, now.toString()); RunSyncPending(); }
		if (now - check_latest_run_ts >= CHECK_LATEST_INTERVAL_MS)		{ localStorage.setItem(CHECK_LATEST_INTERVAL_LOCALSTORAGE_KEY, now.toString()); RunCheckLatest(); }
		if (now - wipe_local_run_ts >= WIPE_LOCAL_INTERVAL_MS)			{ localStorage.setItem(WIPE_LOCAL_INTERVAL_LOCALSTORAGE_KEY, now.toString()); run_wipe_local(); }
	}
	
	// Check immediately on init (which is every page load)
	setTimeout(run_sync_if_needed, PERIODIC_PAGELOAD_DELAY_MS)
	
	// Set up periodic checking in case the user stays on the page for a long time
	setInterval(run_sync_if_needed, PERIODIC_INTERVAL_MS)
}
*/



/*
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
*/








export { Init, PreloadObjectStores, RunSyncFromEvent, Add, Patch, Delete } 




