import { num, str } from '../defs_server_symlink.js'
import { $NT, GenericRowT, LoggerSubjectE, LoggerTypeE } from '../defs.js'
import { PathSpecT } from "./localdbsync.ts"

declare var $N: $NT


type OperationTypeT = 'add' | 'patch' | 'delete';
type PendingSyncOperationT = {
	id: str;
	operation_type: OperationTypeT;
	target_store: str;
	docId: str;
	ts: num;
	oldts: num;
	payload: GenericRowT | null;
};


const PENDING_SYNC_STORE_NAME = '__pending_sync_operations';
const INITIAL_SYNC_INTERVAL = 5000; 
const MAX_SYNC_INTERVAL = 1800000; // 30 minutes
const BACKOFF_FACTOR = 2; 

let _pending_sync_operations_count = -1; // -1 means not set yet -- initially in app pull from indexeddb to find out how many pending sync operations there are
let _current_sync_interval = INITIAL_SYNC_INTERVAL;


// keep in mind fetchlassie and service worker are handling a lot.
// - handling errors
// - handling if network is down and returning not ok immediately if so
// - so if user is offline this will immediately fail instead of hanging on sync writes to server


const StartTickTock = () => { setTimeout(()=> ticktock(), _current_sync_interval); }




const Add = (db: IDBDatabase, objecstorepath: PathSpecT, data: GenericRowT) => new Promise(async (main_res, main_rej) => {

	// at some point would like to add multiple docs at once

	let aye_errs = false
	const cname = objecstorepath.syncobjectstore.name
	const tx: IDBTransaction = db.transaction([cname], "readwrite", { durability: "relaxed" })
	const objectstore = tx.objectStore(cname)

	process_data(data, null)

	try { await $N.IDB.AddOne_S(objectstore, data); } catch { aye_errs = true; }
	try { await $N.IDB.TXResult(tx); } catch { aye_errs = true; }

	if (aye_errs) { main_rej(new Error("LocalDB Add: Failed to add data or commit transaction.")); return; }

	main_res(data.id)


	const body = { cname, data: data }
	const opts: { method: 'POST', body: string } = { method: 'POST', body: JSON.stringify(body), }

	const r = await $N.FetchLassie('/api/firestore_add', opts, null)
	if (r.ok) { return; }

	await record_failed_sync_operation('add', cname, data.id, 0, data)
})





const Patch = (db: IDBDatabase, path: PathSpecT, data: GenericRowT) => new Promise<num>(async (main_res, main_rej) => {

	// at some point would like to patch multiple docs at once

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




const Delete = (db: IDBDatabase, path: PathSpecT) => new Promise<num | null>(async (main_res, main_rej) => {

	// at some point would like to patch multiple docs at once

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



const record_failed_sync_operation = (
	type: OperationTypeT,
	target_store: string,
	docId: string,
	oldts: num,
	payload: GenericRowT|null
): Promise<void> => new Promise(async (res, rej) => {

	const pendingOp: PendingSyncOperationT = {
		id: crypto.randomUUID(),
		operation_type: type,
		target_store: target_store,
		docId,
		ts: payload ? payload.ts : Math.floor(Date.now() / 1000),
		oldts: oldts,
		payload, 
	}

	const r = await $N.IDB.AddOne(PENDING_SYNC_STORE_NAME, pendingOp).catch(()=>null)
	if (!r) { 
		$N.Logger.Log(LoggerTypeE.error, LoggerSubjectE.localdbsync_error, 'Failed to add pending sync operation to local database')
		rej(); 
		return; 
	}

	_pending_sync_operations_count++

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




const handle_periodic = async () => new Promise<num>(async (res, _rej) => {

	if (_pending_sync_operations_count === -1) {
		// if Count fails, default to 0, which will delay until the next sync which is no big deal
		_pending_sync_operations_count = await $N.IDB.Count(PENDING_SYNC_STORE_NAME).catch(()=>0)

		if (_pending_sync_operations_count === 0) { res(1); return; }
	}

	let dbmap: Map<str, GenericRowT[]>

	const capture_pending_sync_operations_count = _pending_sync_operations_count

	try   { dbmap = await $N.IDB.GetAll([ PENDING_SYNC_STORE_NAME ]); }
	catch { res(0); return; }

	const pending_sync_operations = dbmap.get(PENDING_SYNC_STORE_NAME) as PendingSyncOperationT[]

	if (pending_sync_operations.length === 0) { 
		_pending_sync_operations_count = 0
		res(1); 
		return; 
	} 


	const opts = { method: 'POST', body: JSON.stringify(pending_sync_operations) }
	const r = await $N.FetchLassie('/api/firestore_sync_pending', opts)

	if (capture_pending_sync_operations_count !== _pending_sync_operations_count) {
		// if the count changed, it means we added more pending sync operations while this was running
		// so we'll return and let the next ticktock handle it
		res(0);
		return;
	}

	if (r.ok) {
		// Sync was successful, clear the pending operations from local database
		try { await $N.IDB.ClearAll(PENDING_SYNC_STORE_NAME); } 
		catch { 
			$N.Logger.Log(LoggerTypeE.error, LoggerSubjectE.localdbsync_error, 'Failed to clear pending sync operations from local database')
			// server will receive same items on next sync but should reject them now
		}

		_pending_sync_operations_count = 0
		res(1)
	}

	else {
		res(0)
	}
})



export { Add, Patch, Delete, StartTickTock }
/*
if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).LocalDBSync = { EnsureObjectStoresActive };
*/




