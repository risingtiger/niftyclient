import { num, str } from '../defs_server_symlink.js'
import { $NT, GenericRowT  } from '../defs.js'
import { PathSpecT } from "./localdbsync.ts"

declare var $N:$NT


const PENDING_SYNC_STORE_NAME = 'pending_sync_operations';
type OperationTypeT = 'add' | 'patch' | 'delete';
type PendingSyncOperationT = {
    id: str; 
    operation_type: OperationTypeT;
    target_store: str;
    docId: str;
    ts: num; 
    oldts: num; 
    payload: any;   
};


// keep in mind fetchlassie and service worker are handling a lot.
// - handling errors
// - handling if network is down and returning not ok immediately if so
// - so if user is offline this will immediately fail instead of hanging on sync writes to server



const Add = (db:IDBDatabase, objecstorepath:PathSpecT, data:GenericRowT) => new Promise(async (main_res,main_rej)=> {  

	let   aye_errs          = false
	const cname             = objecstorepath.syncobjectstore.name
	const tx:IDBTransaction = db.transaction([cname], "readwrite", { durability: "relaxed" })
	const objectstore       = tx.objectStore(cname)
	const pdata             = process_data(data)

	try   { await $N.IDB.AddOne_S(objectstore, pdata ); } catch   { aye_errs = true; }
	try   { await $N.IDB.TXResult(tx); }				  catch   { aye_errs = true; }

	if (aye_errs) {   main_rej(new Error("LocalDB Add: Failed to add data or commit transaction.")); return;   }

	main_res(pdata.id)

	const body = { cname, data: pdata } 
	const opts:{method:'POST',body:string} = {method: 'POST', body: JSON.stringify(body),}

	const r = await $N.FetchLassie('/api/firestore_add', opts, null)
	if (r.ok) {   return;   }

	await record_failed_sync_operation(db, 'add', cname, pdata.id, pdata.ts, 0, pdata);
})





const Patch = (db:IDBDatabase, path:PathSpecT, data:GenericRowT) => new Promise<GenericRowT>(async (main_res, main_rej) => {  

	if (!path.docid) {main_rej(new Error('docid in path is required for Patch')); return; }

	const newts                 = Math.floor( Date.now() / 1000 )
	let oldts                   = 0
	const tx:IDBTransaction     = db.transaction([path.syncobjectstore.name], "readwrite", { durability: "relaxed" })
	const objectStore           = tx.objectStore(path.syncobjectstore.name)

	try {
		let workingdata = await get_one_promise(objectStore, path.docid);
		if (!workingdata) {
			throw new Error(`LocalDB Patch: Document with id ${path.docid} not found in ${path.syncobjectstore.name}.`);
		}

		oldts = workingdata.ts || 0;

		// Apply updates from input 'data' (the patch) to 'workingdata'
		for (const key in data) {
			if (Object.prototype.hasOwnProperty.call(data, key)) {
				if (key.includes(".")) { // Handle dot notation for nested updates
					const keys = key.split(".");
					let currentLevel = workingdata;
					for (let i = 0; i < keys.length - 1; i++) {
						if (!currentLevel[keys[i]] || typeof currentLevel[keys[i]] !== 'object') {
							currentLevel[keys[i]] = {}; // Create nested object if it doesn't exist
						}
						currentLevel = currentLevel[keys[i]];
					}
					currentLevel[keys[keys.length - 1]] = data[key];
				} else if (key.endsWith('__ref')) { // Handle __ref transformation
					const baseKey = key.split('__ref')[0];
					const pathValue = data[key] as str;
					const pathParts = pathValue.split('/');
					const collection = pathParts.slice(0, -1).join('/');
					const docIdRef = pathParts[pathParts.length - 1];
					workingdata[baseKey] = { __path: [collection, docIdRef] };
				} else {
					workingdata[key] = data[key];
				}
			}
		}
		workingdata.ts = newts; // Update timestamp

		// Promisify the put operation
		await new Promise<void>((resolve_put, reject_put) => {
			const putrequest = objectStore.put(workingdata);
			putrequest.onsuccess = () => resolve_put();
			putrequest.onerror = (event) => reject_put((event.target as IDBRequest).error || new Error("Put operation failed"));
		});
		
		await tx_promise(tx); // Wait for the transaction to complete

		main_res(workingdata); // Resolve with the updated data

		// Now, perform server-side operations
		// Send the original 'data' (patch payload) to the server
		const body = { path:path.path, data, oldts, newts} 
		const opts:{method:'POST',body:string} = {   
			method: "POST",  
			body: JSON.stringify(body),
		}

		const r = await $N.FetchLassie('/api/firestore_patch', opts, null)
		if (!r.ok) {   
			await record_failed_sync_operation(
				db,
				'patch',
				path.syncobjectstore.name,
				path.docid as string,
				newts,
				oldts,
				data // record the original patch payload
			)
		}
	} catch (error) {
        if (tx && tx.error) { 
             main_rej(tx.error);
        } else {
             main_rej(error);
        }
        // Ensure transaction is aborted if not already done
        if (tx && tx.readyState !== 'done' && tx.readyState !== 'aborted') {
            tx.abort();
        }
    }
})




const Delete = (db:IDBDatabase, path:PathSpecT) => new Promise<num|null>(async (main_res, main_rej) => {  

	if (!path.docid) {
		main_rej(new Error('docid in path is required for Delete'))
		return
	}

	let aye_errs = false
	const tx:IDBTransaction = db.transaction([path.syncobjectstore.name], "readwrite", { durability: "relaxed" })
	const pathos = tx.objectStore(path.syncobjectstore.name)
	const p_db_delete = pathos.delete(path.docid)
	p_db_delete.onerror = () => aye_errs = true

	const txr = await new Promise<num|null>((res)=> {
		tx.onerror    = () => { res(null) }
		tx.oncomplete = () => { 
			if (aye_errs) { res(null); return }    
			else          { res(1); return }
		}
	})

	if (!txr) {   main_rej(new Error("LocalDB Delete: Failed to delete data in IndexedDB.")); return   }

	main_res(1)

	// Now, perform server-side operations
	const body = { path:path.path } 
	const opts:{method:'POST',body:string} = {   
		method: "POST",  
		body: JSON.stringify(body),
	}

	const r = await $N.FetchLassie('/api/firestore_delete', opts, null)
	if (!r.ok) {   
		const deleteTimestamp = Math.floor(Date.now() / 1000)
		await record_failed_sync_operation(
			db,
			'delete',
			path.syncobjectstore.name,
			path.docid as string,
			deleteTimestamp,
			0 
            // No payload for delete
		)
	}
})



const record_failed_sync_operation = (
    db: IDBDatabase,
    type: OperationTypeT,
    target_store: string,
    docId: string,
    ts: number,
    previous_ts: num,
    payload?: GenericRowT 
): Promise<void> => new Promise((resolve, reject) => {
    try {
        const transaction = db.transaction(PENDING_SYNC_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(PENDING_SYNC_STORE_NAME);

        const pendingOp: PendingSyncOperationT = {
            id: crypto.randomUUID(),
            operation_type: type,
            target_store: target_store,
            docId,
            ts,
            oldts: previous_ts,
            payload, // This will now correctly store the payload for add/patch
        };

        const request = store.add(pendingOp);
        request.onsuccess = () => resolve();
        request.onerror = (event) => {
            console.error(`Failed to add to ${PENDING_SYNC_STORE_NAME}:`, (event.target as IDBRequest).error);
            reject((event.target as IDBRequest).error);
        };
        transaction.onerror = (event) => {
            console.error(`Transaction error on ${PENDING_SYNC_STORE_NAME}:`, (event.target as IDBTransaction).error);
            reject((event.target as IDBTransaction).error);
        };
    } catch (error) {
        console.error(`Error initiating transaction for ${PENDING_SYNC_STORE_NAME}:`, error);
        reject(error);
    }
});




const process_data = (data: GenericRowT): GenericRowT => {

	const processed_data: GenericRowT = {}

	for (const key in data) {
		if (key.endsWith('__ref')) {
			const baseKey = key.split('__ref')[0]
			const pathValue = data[key] as str
			const pathParts = pathValue.split('/')
			const collection = pathParts.slice(0, -1).join('/')
			const docId = pathParts[pathParts.length - 1]
			processed_data[baseKey] = { __path: [collection, docId] }
		} else {
			processed_data[key] = data[key]
		}
	}

	// Ensure 'id' is present, copying from input if available, else generating a new one.
    if (data.id) {
        processed_data["id"] = data.id;
    } else {
        processed_data["id"] = crypto.randomUUID();
    }

	processed_data["ts"] = Math.floor( Date.now() / 1000 )

	return processed_data
}













export { Add, Patch, Delete } 
/*
if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).LocalDBSync = { EnsureObjectStoresActive };
*/




