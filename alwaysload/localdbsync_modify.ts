

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

	if (!objecstorepath.docid) throw new Error('docid in path is required for Patch')

	const newid                  = crypto.randomUUID()
	const newts                  = Math.floor( Date.now() / 1000 )
	let   aye_errs               = false
	const tx:IDBTransaction      = db.transaction([objecstorepath.syncobjectstore.name], "readwrite", { durability: "relaxed" })
	const pathos                 = tx.objectStore(objecstorepath.syncobjectstore.name)

	const processedData = process_data(data)

	const p_db_put    = pathos.add( { ...processedData, ts:newts, id:newid } )
	p_db_put.onerror  = () => aye_errs = true

	const txr = await new Promise<num|null>((res)=> {
		tx.onerror    = () => { res(null);   }
		tx.oncomplete = () => { 
			if (aye_errs) { res(null); return; }    
			else		  { res(1);    return; }
		}
	})

	if (!txr) {   main_rej(); return;   }

	main_res(1)

	const body = { path:objecstorepath.path, data, ts:newts, id:newid } 
	const opts:{method:'POST',body:string} = {method: 'POST', body: JSON.stringify(body),}

	const r = await $N.FetchLassie('/api/firestore_add', opts, null)
	if (!r.ok) {   
		await record_failed_sync_operation(db, 'add', objecstorepath.syncobjectstore.name, newid, newts, 0)
	}

})





const Patch = (db:IDBDatabase, path:PathSpecT, data:GenericRowT) => new Promise<GenericRowT>(async (res,_rej)=> {  

	if (!path.docid) throw new Error('docid in path is required for Patch')


	let workingdata:GenericRowT = {}
	let newts = Math.floor( Date.now() / 1000 )
	let oldts = 0;
	let are_there_any_put_errors = false
	let objectstores = [path.syncobjectstore.name]

	const tx:IDBTransaction = db.transaction(objectstores, "readwrite", { durability: "relaxed" })
	const pathos = tx.objectStore(path.syncobjectstore.name)
	

	const getrequest = pathos.get(path.docid)
	
	getrequest.onsuccess = (event: any) => {
		workingdata = event.target.result || {}
		oldts = workingdata.ts || 0

		// Process data with special handling for dot notation
		const processedData = process_data(data)
		
		for (const key in processedData) {
			if (key.includes(".")) {
				const keys = key.split(".")
				workingdata[keys[0]][keys[1]] = processedData[key]
			} else {
				workingdata[key] = processedData[key]
			}
		}
		workingdata.ts = newts
		
		const putrequest = pathos.put(workingdata)
		putrequest.onerror = (_event: any) => are_there_any_put_errors = true
	}
	
	getrequest.onerror = (_event: any) => {
		are_there_any_put_errors = true
	}

	tx.onerror = (event: any) => {
		console.error("LocalDB Patch: Transaction error.", event);
		_rej(new Error("LocalDB Patch: Transaction failed."));
	}

	tx.oncomplete = async (_event: any) => { 
		if (are_there_any_put_errors) {
			// If get or put failed locally, reject the promise
			_rej(new Error("LocalDB Patch: Failed to get or put data in IndexedDB."));
			return;
		}

		// Resolve the promise immediately after local success
		res(workingdata);

		// Now, perform server-side operations
		const body = { path:path.path, data, oldts, newts} 
		const opts:any = {   
			method: "POST",  
			body: JSON.stringify(body),
		}

		try {
			const r = await $N.FetchLassie('/api/firestore_patch', opts, null)
			if (!r.ok) {   
				// Log the failure for retry
				try {
					await record_failed_sync_operation(
						db,
						'patch',
						path.syncobjectstore.name,
						path.docid as string, // path.docid is checked not null at the start
						newts,
						oldts, // previousDataTimestamp - the timestamp before the patch
						data // This is the original 'data' (changeset) argument to Patch
					);
					console.warn(`LocalDB Patch: Server sync failed for ${path.path}. Recorded for retry.`);
				} catch (logError) {
					console.error('LocalDB Patch: Failed to record sync operation for retry:', logError);
				}
			}
		} catch (serverError) {
			console.error(`LocalDB Patch: Error during server sync for ${path.path}:`, serverError);
			// Record a failed sync operation if FetchLassie itself throws
			try {
				await record_failed_sync_operation(
					db,
					'patch',
					path.syncobjectstore.name,
					path.docid as string,
					newts,
					oldts,
					data
				);
				console.warn(`LocalDB Patch: Server sync critically failed (exception) for ${path.path}. Recorded for retry.`);
			} catch (logError) {
				console.error('LocalDB Patch: Failed to record critical sync operation for retry:', logError);
			}
		}
	}
})




const Delete = (db:IDBDatabase, path:PathSpecT) => new Promise<num|null>(async (res,_rej)=> {  

	if (!path.docid) throw new Error('docid in path is required for Patch')


	let are_there_any_put_errors = false
	let objectstores             = [path.syncobjectstore.name]

	const tx:IDBTransaction      = db.transaction(objectstores, "readwrite", { durability: "relaxed" })

	const pathos                 = tx.objectStore(path.syncobjectstore.name)
	const p_db_put               = pathos.delete(path.docid)
	p_db_put.onerror             = (_event:any) => are_there_any_put_errors = true

	tx.onerror = (event: any) => {
		console.error("LocalDB Delete: Transaction error.", event);
		_rej(new Error("LocalDB Delete: Transaction failed."));
	}

	tx.oncomplete = async (_event:any) => { 
		if (are_there_any_put_errors) {
			// If local delete failed, reject the promise
			_rej(new Error("LocalDB Delete: Failed to delete data in IndexedDB."));
			return;
		}

		// Resolve the promise immediately after local success
		res(1);

		// Now, perform server-side operations
		const body = { path } 
		const opts:any = {   
			method: "POST",  
			body: JSON.stringify(body),
		}

		try {
			const r = await $N.FetchLassie('/api/firestore_delete', opts, null)
			if (!r.ok) {   
				// Log the failure for retry
				try {
					const deleteTimestamp = Math.floor(Date.now() / 1000);
					await record_failed_sync_operation(
						db,
						'delete',
						path.syncobjectstore.name,
						path.docid as string, // path.docid is checked not null at the start
						deleteTimestamp,
						0 // previousDataTimestamp not applicable for delete
						// No payload for delete
					);
					console.warn(`LocalDB Delete: Server sync failed for ${path.path}. Recorded for retry.`);
				} catch (logError) {
					console.error('LocalDB Delete: Failed to record sync operation for retry:', logError);
				}
			}
		} catch (serverError) {
			console.error(`LocalDB Delete: Error during server sync for ${path.path}:`, serverError);
			// Record a failed sync operation if FetchLassie itself throws
			try {
				const deleteTimestamp = Math.floor(Date.now() / 1000);
				await record_failed_sync_operation(
					db,
					'delete',
					path.syncobjectstore.name,
					path.docid as string,
					deleteTimestamp,
					0
				);
				console.warn(`LocalDB Delete: Server sync critically failed (exception) for ${path.path}. Recorded for retry.`);
			} catch (logError) {
				console.error('LocalDB Delete: Failed to record critical sync operation for retry:', logError);
			}
		}
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
            payload,
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
	const processedData: GenericRowT = {}
	for (const key in data) {
		if (key.endsWith('__ref')) {
			const baseKey = key.split('__ref')[0]
			const pathValue = data[key] as str
			const pathParts = pathValue.split('/')
			const collection = pathParts.slice(0, -1).join('/')
			const docId = pathParts[pathParts.length - 1]
			processedData[baseKey] = { __path: [collection, docId] }
		} else {
			processedData[key] = data[key]
		}
	}
	return processedData
}

export { Add, Patch, Delete } 
/*
if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).LocalDBSync = { EnsureObjectStoresActive };
*/




