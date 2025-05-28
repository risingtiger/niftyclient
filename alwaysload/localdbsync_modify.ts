import { num, str } from '../defs_server_symlink.js'
import { $NT, GenericRowT, LoggerSubjectE, LoggerTypeE } from '../defs.js'
import { PathSpecT } from "./localdbsync.ts"

declare var $N: $NT


type OperationTypeT = 'add' | 'patch' | 'delete';
type PendingSyncOperationT = {
	operation_type: OperationTypeT;
	target_store: str;
	docId: str;
	ts: num;
	oldts: num;
	payload: GenericRowT | null;
};

const sync_interval_minutes = 5
const sync_interval_ms = sync_interval_minutes * 60 * 1000
const storage_key = 'localdbsync_last_run'
	

const MAX_PENDING_COUNT = 10
const PENDING_SYNC_STORE_NAME = '__pending_sync_operations';
const INITIAL_SYNC_INTERVAL = 5000; 
const MAX_SYNC_INTERVAL = 1800000; // 30 minutes
const BACKOFF_FACTOR = 1.5; 

let _pending_sync_operations_count = -1; // -1 means not set yet -- initially in app pull from indexeddb to find out how many pending sync operations there are
let _current_sync_interval = INITIAL_SYNC_INTERVAL;


// keep in mind fetchlassie and service worker are handling a lot.
// - handling errors
// - handling if network is down and returning not ok immediately if so
// - so if user is offline this will immediately fail instead of hanging on sync writes to server



const Add = (objecstorepath: PathSpecT, data: GenericRowT) => new Promise<string>(async (main_res, main_rej) => {

	// at some point would like to add multiple docs at once

	let db:any


	try { db = await $N.IDB.GetDB(); }
	catch { main_rej("no db connection"); return; }


	let aye_errs = false
	const cname = objecstorepath.syncobjectstore.name
	const tx: IDBTransaction = db.transaction([cname], "readwrite", { durability: "relaxed" })
	const objectstore = tx.objectStore(cname)

	process_data(data, null)

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





const Patch = (path: PathSpecT, data: GenericRowT) => new Promise<num>(async (main_res, main_rej) => {

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

	process_data(olddata, data); 

	try   { await $N.IDB.PutOne_S(objectStore, data); }
	catch { main_rej(); return; }

	try { await $N.IDB.TXResult(tx); } catch { main_rej(); return; }

	main_res(1);


	const body = { cname: path.collection, data, oldts }
	const opts:  { method: 'POST', body: string } = {method: "POST", body: JSON.stringify(body)};

	const r = await $N.FetchLassie('/api/firestore_patch', opts, null)
	if (r.ok) { return; }

	await record_failed_sync_operation('patch', cname, data.id, oldts, data);
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
		const last_run_str = localStorage.getItem(storage_key)
		const last_run = last_run_str ? parseInt(last_run_str) : 0
		
		if (now - last_run >= sync_interval_ms) {
			localStorage.setItem(storage_key, now.toString())
			run_local_db_sync_periodic()
		}
	}
	
	// Check immediately on init
	setTimeout(run_sync_if_needed, 5000)
	
	// Set up periodic checking
	setInterval(run_sync_if_needed, sync_interval_ms)
}




const run_local_db_sync_periodic = async (is_retry_of_max_count_reached:boolean = false) => new Promise<boolean>(async (res, _rej) => {

	const exists = localStorage.getItem("pending_sync_operations_exists")
	if (!exists)   { res(true); return; }


	const count = await $N.IDB.Count(PENDING_SYNC_STORE_NAME).catch(() => 0)

	if (!is_retry_of_max_count_reached && count > MAX_PENDING_COUNT) {
		localStorage.setItem("pending_sync_operations_too_many", "true");
		$N.Unrecoverable("Sync Error", "App is Offline. Connect to WiFi or Cellular", "Retry Connection", LoggerSubjectE.localdbsync_error_toomany_pending, "localdbsync_pending_too_many", null)		
		res(false)
		return
	}


	if (count > 500) {

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
	const r = await RunLocalDBSyncPeriodic(true)
	cb(r)
}




const record_failed_sync_operation = (
	type: OperationTypeT,
	target_store: string,
	docId: string,
	oldts: num,
	payload: GenericRowT|null): Promise<void> => new Promise(async (res, rej) => {

	const pendingOp: PendingSyncOperationT = {
		operation_type: type,
		target_store: target_store,
		docId,
		ts: payload ? payload.ts : Math.floor(Date.now() / 1000),
		oldts: oldts,
		payload, 
	}

	let r:any

	try   { r = await $N.IDB.AddOne(PENDING_SYNC_STORE_NAME, pendingOp); }
	catch { rej(); return; }

	localStorage.setItem("pending_sync_operations_exists", "true");

	res()
})




const process_data = (data: GenericRowT, newpatchdata:GenericRowT|null) => {

	for (const key in data) {
		if (Object.prototype.hasOwnProperty.call(data, key)) {   

			if (newpatchdata && newpatchdata[key]) {
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
	}

	if (!data.id)   data["id"] = crypto.randomUUID();
	data["ts"] = Math.floor(Date.now() / 1000)
}





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




