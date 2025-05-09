import { num, str } from '../defs_server_symlink.js'
import { $NT, GenericRowT } from '../defs.js'
import { PathSpecT } from "./localdbsync.ts"

declare var $N: $NT


const PENDING_SYNC_STORE_NAME = 'pending_sync_operations';
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


// keep in mind fetchlassie and service worker are handling a lot.
// - handling errors
// - handling if network is down and returning not ok immediately if so
// - so if user is offline this will immediately fail instead of hanging on sync writes to server



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
	if (!r) { rej(); return; }

	const pending_sync_operations_count = Number(localStorage.getItem('pending_sync_operations_count')) || 0
	localStorage.setItem('pending_sync_operations_count', (pending_sync_operations_count + 1).toString())

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













export { Add, Patch, Delete }
/*
if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).LocalDBSync = { EnsureObjectStoresActive };
*/




