import { num, str } from '../defs_server_symlink.js'
import { $NT, GenericRowT, LoggerSubjectE, LoggerTypeE } from '../defs.js'
import { PathSpecT } from "./localdbsync.ts"

declare var $N: $NT


type OperationTypeT = 'add' | 'patch' | 'delete';
type PendingSyncOperationT = {
	id: str;
	operation_type: OperationTypeT;
	target_store: str;
	ts: num;
	oldts: num;
	payload: GenericRowT | null;
};

const SYNC_INTERVAL_MINUTES = 1
const SYNC_INTERVAL_MS = SYNC_INTERVAL_MINUTES * 60 * 1000
const STORAGE_KEY = 'localdbsync_last_run'
	

const MAX_PENDING_COUNT = 10
const PENDING_SYNC_STORE_NAME = '__pending_sync_operations';
const INITIAL_SYNC_INTERVAL = 5000; 
const MAX_SYNC_INTERVAL = 1800000; // 30 minutes
const BACKOFF_FACTOR = 1.5; 

const _patches_awaiting_fetchlassie = new Set<string>() 

let _pending_sync_operations_count = -1; // -1 means not set yet -- initially in app pull from indexeddb to find out how many pending sync operations there are
let _current_sync_interval = INITIAL_SYNC_INTERVAL;


const update_record_with_new_data = (record: GenericRowT, newdata: any): void => {
	for (const key in newdata) {
		const new_value = newdata[key]
		
		if (new_value !== null && typeof new_value === 'object' && !Array.isArray(new_value)) {
			// Handle nested object - ensure record has this property as object
			if (!record[key] || typeof record[key] !== 'object' || Array.isArray(record[key])) {
				record[key] = {}
			}
			// Recursively update nested properties
			update_record_with_new_data(record[key], new_value)
		} else {
			// Direct assignment for primitives, arrays, and null
			record[key] = new_value
		}
	}
}


// keep in mind fetchlassie and service worker are handling a lot.
// - handling errors
// - handling if network is down and returning not ok immediately if so
// - so if user is offline this will immediately fail instead of hanging on sync writes to server



const Add = (objecstorepath: PathSpecT, data: GenericRowT) => new Promise<string>(async (main_res, main_rej) => {

	// at some point would like to add multiple docs at once

	let db:any


	try { db = await $N.IDB.GetDB(); }
	catch { main_rej("no db connection"); return; }

	data.ts = Math.floor(Date.now() / 1000)
	data.id = crypto.randomUUID();

	let aye_errs = false
	const cname = objecstorepath.syncobjectstore.name
	const tx: IDBTransaction = db.transaction([cname], "readwrite", { durability: "relaxed" })
	const objectstore = tx.objectStore(cname)

	data.ts = Math.floor(Date.now() / 1000)

	try   { await $N.IDB.AddOne_S(objectstore, data); } 
	catch { aye_errs = true; }

	try   { await $N.IDB.TXResult(tx); } 
	catch { aye_errs = true; }

	if (aye_errs) { main_rej("db add failed"); return; }

	main_res(data.id)


	const body = { cname, data: data }
	const opts: { method: 'POST', body: string } = { method: 'POST', body: JSON.stringify(body), }

	const r = await $N.FetchLassie('/api/firestore_add', opts, null)
	if (r.ok) { return; }


	await record_failed_sync_operation('add', cname, data.id, 0, data)
})





const Patch = (path: PathSpecT, newdata: any) => new Promise<num>(async (main_res, main_rej) => {

	// at some point would like to patch multiple docs at once

	let db:any

	try { db = await $N.IDB.GetDB(); }
	catch { main_rej("no db connection"); return; }

	let   oldts              = 0
	const cname              = path.syncobjectstore.name;
	const tx: IDBTransaction = db.transaction([cname], "readwrite", { durability: "relaxed" });
	const objectStore        = tx.objectStore(cname);
	let   record: GenericRowT;

	try   { record = await $N.IDB.GetOne_S(objectStore, path.docid!); }
	catch { main_rej(); return; }


	// update the record with new data
	update_record_with_new_data(record, newdata)

	oldts = record.ts;
	record.ts = Math.floor(Date.now() / 1000)

	try   { await $N.IDB.PutOne_S(objectStore, record); }
	catch { main_rej(); return; }

	try { await $N.IDB.TXResult(tx); } catch { main_rej(); return; }

	main_res(1);


	if (_patches_awaiting_fetchlassie.has(path.path)) {
		// if we are already awaiting a fetchlassie call for this path, do not make another one
		// this is to prevent multiple calls to the server for the same patch operation

		await record_failed_sync_operation('patch', cname, path.docid!, oldts, newdata); // sending potentially partial data
		return;
	}

	_patches_awaiting_fetchlassie.add(path.path);

	const body = { path:path.path, data: newdata, oldts, newts: record.ts }
	const opts:  { method: 'POST', body: string } = {method: "POST", body: JSON.stringify(body)};

	const r = await $N.FetchLassie('/api/firestore_patch', opts, null)
	if (r.ok) { 
		_patches_awaiting_fetchlassie.delete(path.path);
		return; 
	}
	else {
		// we test here because while the first fetchlassie was happening another patch operation could have been added
		if (!_patches_awaiting_fetchlassie.has(path.path)) {
			await record_failed_sync_operation('patch', cname, newdata.id, oldts, newdata);
		}
		_patches_awaiting_fetchlassie.delete(path.path);
	}
});




const Delete = (path: PathSpecT) => new Promise<num | null>(async (main_res, main_rej) => {

	// at some point would like to patch multiple docs at once

	const db                 = await $N.IDB.GetDB()

	let   oldts              = 0
	const cname              = path.syncobjectstore.name;
	const tx: IDBTransaction = db.transaction([cname], "readwrite", { durability: "relaxed" });
	const objectStore        = tx.objectStore(cname);
	let   olddata: GenericRowT;

	try   { olddata = await $N.IDB.GetOne_S(objectStore, path.docid!); }
	catch { main_rej(); return; }

	oldts = olddata.ts;

	try   { await $N.IDB.DeleteOne_S(objectStore, path.docid!); }
	catch { main_rej(); return; }
	
	main_res(1);


	const body = { cname: path.collection, id: path.docid!, oldts }
	const opts:  { method: 'POST', body: string } = {method: "POST", body: JSON.stringify(body)};

	const r = await $N.FetchLassie('/api/firestore_delete', opts, null)
	if (r.ok) { return; }

	await record_failed_sync_operation('delete', cname, olddata.id, oldts, null);
});




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
	
	// Check immediately on init
	setTimeout(run_sync_if_needed, 3000)
	
	// Set up periodic checking
	setInterval(run_sync_if_needed, SYNC_INTERVAL_MS)
}




/*
const process_data = (data: GenericRowT, newpatchdata:GenericRowT|null) => {

	for (const key in data) {
		if (newpatchdata && newpatchdata[key]) { // only applicable if this is a patch operation
			data[key] = newpatchdata[key]
		}

		if (key.endsWith('__ref')) {
			const baseKey = key.split('__ref')[0]
			const pathValue = data[key] as str
			const pathParts = pathValue.split('/')
			const collection = pathParts.slice(0, -1).join('/')
			const docId = pathParts[pathParts.length - 1]
			data[baseKey] = { __path: [collection, docId] }
		}
	}

	if (!data.id)   data["id"] = crypto.randomUUID();
	data["ts"] = Math.floor(Date.now() / 1000)
}
*/



const run_local_db_sync_periodic = async (is_retry_of_max_count_reached:boolean = false) => new Promise<boolean>(async (res, _rej) => {

	const exists = localStorage.getItem("pending_sync_operations_exists")
	if (!exists)   { res(true); return; }


	const count = await $N.IDB.Count(PENDING_SYNC_STORE_NAME).catch(() => 0)

	if (count === 0) {
		localStorage.removeItem("pending_sync_operations_exists");
		localStorage.removeItem("pending_sync_operations_too_many");
		res(true)
		return

	}
	else if (!is_retry_of_max_count_reached && count > MAX_PENDING_COUNT) {
		localStorage.setItem("pending_sync_operations_too_many", "true");
		$N.Unrecoverable("Sync Error", "App is Offline. Connect to WiFi or Cellular", "Retry Connection", LoggerSubjectE.localdbsync_error_toomany_pending, "localdbsync_pending_too_many", null)		
		res(false)
		return

	}
	else if (count > 500) {

		// this is a safety net to prevent too many pending sync operations and clogging the database and/or server calls
		// but it is a loss of data, so hopefully this never happens. 
		// the app should be shut down if count is over limit and Unrecoverable called to redirect to a page that explains the issue
		// so, theoretically, this count should never be reached

		await $N.IDB.ClearAll(PENDING_SYNC_STORE_NAME).catch(()=>null) // could theortically fail, but since we just previously connected to database I will assume we are ok

		localStorage.removeItem("pending_sync_operations_exists");
		localStorage.removeItem("pending_sync_operations_too_many");

		res(true)
		return
	}
		

	const ping_r = await $N.FetchLassie('/api/ping')
	if (!ping_r.ok) {   res(false); return;  }
	

	const all_pending_r = await $N.IDB.GetAll([ PENDING_SYNC_STORE_NAME ]).catch(()=>null)
	if (!all_pending_r || !all_pending_r.get(PENDING_SYNC_STORE_NAME) || !all_pending_r.get(PENDING_SYNC_STORE_NAME)?.length) {   res(false); return;  }


	const all_pending = all_pending_r.get(PENDING_SYNC_STORE_NAME) as PendingSyncOperationT[]

	const opts = { method: 'POST', body: JSON.stringify(all_pending) }
	const r = await $N.FetchLassie('/api/firestore_sync_pending', opts)
	if (!r.ok) { res(false); return; }
	

	await $N.IDB.ClearAll(PENDING_SYNC_STORE_NAME).catch(()=>null) // could theortically fail, but since we just previously connected to database I will assume we are ok

	localStorage.removeItem("pending_sync_operations_exists");
	localStorage.removeItem("pending_sync_operations_too_many");

	res(true)
})




const Check_After_Too_Many_Pending_Operations = async (cb:(r:boolean)=>void) => {
	const r = await run_local_db_sync_periodic(true)
	cb(r)
}




const record_failed_sync_operation = (
	type: OperationTypeT,
	target_store: string,
	docid: string,
	oldts: num,
	payload: GenericRowT|null): Promise<void> => new Promise(async (res, rej) => {

	let db:IDBDatabase;
	try { db = await $N.IDB.GetDB(); }
	catch { rej(); return; }

	let original_oldts = oldts

	const tx = db.transaction(PENDING_SYNC_STORE_NAME, "readwrite")
	const s  = tx.objectStore(PENDING_SYNC_STORE_NAME)

	const pendingOp: PendingSyncOperationT = {
		id:docid,
		operation_type: type,
		target_store: target_store,
		ts: payload ? payload.ts : Math.floor(Date.now() / 1000), // if delete set a ts
		oldts: original_oldts,
		payload,  // payload is either whole or partial data -- more likely partial
	}

	const result = await $N.IDB.GetOne_S(s, docid)

	if (result && result.operation_type === 'add' && pendingOp.operation_type === 'delete') {
		await $N.IDB.DeleteOne_S(s, docid)
		res()
		return
	}
	else if (result && result.operation_type === 'add' && pendingOp.operation_type === 'patch') {
		pendingOp.operation_type = "add"; 
		pendingOp.oldts = result.oldts
	}
	else if (result && result.operation_type === 'patch' && pendingOp.operation_type === 'patch') {
		pendingOp.oldts = result.oldts
	}
	else {
		// nothing
	}


	let r:any

	// if record already is here it will be overwritten but should have retrieved original_oldts to keep that intact
	try   { r = await $N.IDB.PutOne_S(s, pendingOp); }
	catch { rej(); return; }

	localStorage.setItem("pending_sync_operations_exists", "true");

	res()
})




/*
const ticktock = async () => {
	if (_pending_sync_operations_count === 0) {
		// No pending sync operations, reset the sync interval
		_current_sync_interval = INITIAL_SYNC_INTERVAL;
		return;
	}

	const hpr = await handle_periodic()
	if (hpr === 0) {
		_current_sync_interval = Math.min(
			_current_sync_interval * BACKOFF_FACTOR,
			MAX_SYNC_INTERVAL
		);
		return;
	}
	_current_sync_interval = INITIAL_SYNC_INTERVAL;

	setTimeout(() => ticktock(), _current_sync_interval)
}
*/






export { Add, Patch, Delete, SetupLocalDBSyncPeriodic, Check_After_Too_Many_Pending_Operations }
/*
if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).LocalDBSync = { EnsureObjectStoresActive };
*/
