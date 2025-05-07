

import { DataSyncStoreMetaT, DataSyncStoreMetaStateE } from "../../defs.js"
import { num } from '../../defs_server_symlink.js'


type IndexedDBStoreMetaT = {
	name: string,
	url: string
}




self.onmessage = async (e:any) => {

	switch (e.data.cmd) {
		case "init":
			Updater_Init(e.data.dbname, e.data.dbversion, e.data.indexeddb_stores)	
		break;
		case "run_loop":
			EventLoopen_Run(e.data.store_metas);
		break;
	}
}


























// EventLoopenWorker
/* ************ */

// is only used in memory as needed. Continually written to localStorage and then memory flushed
let   store_metas_que:DataSyncStoreMetaT[] = []




function EventLoopen_Run(store_metas_from_mainthread:DataSyncStoreMetaT[]) {

	// this function will be called recursively until all store_metas are loaded and the que is empty

	console.log("datasync_worker EventLoopen_Run")

	// make sure store_metas_que is always reflective of store_metas_from_localstorage

	if (store_metas_que.length === 0 && (store_metas_from_mainthread && store_metas_from_mainthread.length)) {

		store_metas_que = store_metas_from_mainthread

	} else if (store_metas_from_mainthread && store_metas_from_mainthread.length) {

		// merge store_metas_from_localstorage into store_metas_que and always reflect store_metas_que l (state) to reflect store_metas_from_localstorage regardless of where que is at

		for(const sm of store_metas_from_mainthread) {
			let store = store_metas_que.find((s) => s.n === sm.n)

			if (!store) {
				store_metas_que.push(sm)
				store = store_metas_que[store_metas_que.length-1]
			}

			// if state goes back to stale, empty etc, then it will force a reload even if this que is currently in the process
			store.l = sm.l
			store.i = sm.i
			store.ts = sm.ts
		}

	} else {
		// just re-run the loop. store_metas_from_localstorage has already been dealt with at this point
	}

	for(const sm of store_metas_que) {
		if (sm.l === DataSyncStoreMetaStateE.EMPTY || sm.l === DataSyncStoreMetaStateE.STALE) {
			sm.l = DataSyncStoreMetaStateE.QUELOAD
		}
	}

	const queload_store_metas = store_metas_que.filter((sm) => sm.l === DataSyncStoreMetaStateE.QUELOAD)
	const loaded_store_metas  = store_metas_que.filter((sm) => sm.l === DataSyncStoreMetaStateE.LOADED_AND_CHANGED || sm.l === DataSyncStoreMetaStateE.LOADED_AND_UNCHANGED)

	if (loaded_store_metas.length) {
		self.postMessage({ cmd: "notify_subscribers", loaded_store_metas: loaded_store_metas })
	}

	if (queload_store_metas.length) {
		Updater_StoresToIndexeddb(queload_store_metas)
		queload_store_metas.forEach((sm) => sm.l = DataSyncStoreMetaStateE.LOADING)
		self.postMessage({ cmd: "save_changed_store_metas_state", changed_store_metas: queload_store_metas })
	}

	const pending = store_metas_que.filter((sm) => sm.l === DataSyncStoreMetaStateE.LOADING)

	if (pending.length) {
		setTimeout(EventLoopen_Run, 100)
	} else {
		store_metas_que = []
	}
}



















































// UPDATE WORKER
/* ********** */

let DBNAME:string = "";
let DBVERSION:num = 0
let INDEXEDDB_STORES:IndexedDBStoreMetaT[] = []




async function Updater_Init(dbname:string,dbversion:num,indexeddb_stores:IndexedDBStoreMetaT[]) {
	DBNAME = dbname
	DBVERSION = dbversion
	INDEXEDDB_STORES = indexeddb_stores
}



async function Updater_StoresToIndexeddb(store_metas:DataSyncStoreMetaT[]) {

	const url = "/api/firestore_retrieve"

	const paths:string[] = []
	const opts:{limit:num, order_by:string, ts:num}[] = []

	for(const sm of store_metas) {
		const store_url = INDEXEDDB_STORES.find((s) => s.name === sm.n)!.url
		paths.push(store_url)
		opts.push({ limit: 10000, order_by: "ts,desc", ts: sm.ts })
	}

	const body = { paths, opts }

	const fetchopts = {   
		method: "POST",
		headers: { 
			"Content-Type": "application/json"
		},
		body: JSON.stringify(body),
	}


	const fr = await fetch(url, (fetchopts as any))

	if (fr.status === 401) {
		redirect_from_error("datasync_fetch_not_authorized","DataSync Fetch Not Authorized - " + fr.url + ": " + fr.statusText)
		return false;
	}

	else if (fr.status === 410) {
		redirect_from_error("datasync_fetch_out_of_date","DataSync Fetch Out of Date - " + fr.url)
		return false;
	}

	else if (!fr.ok) {
		redirect_from_error("datasync_fetch_error","DataSync Server Error - " + fr.url + ": " + fr.statusText)
		return false;
	}

	const data = await fr.json()

	await write_to_indexeddb(data, store_metas, DBNAME, DBVERSION)

	store_metas.forEach((sm, i) => { 
		sm.l = data[i].length ? DataSyncStoreMetaStateE.LOADED_AND_CHANGED : DataSyncStoreMetaStateE.LOADED_AND_UNCHANGED; 
		sm.ts = Math.floor(Date.now() / 1000) 
	})
}




function write_to_indexeddb(
	data:any, 
	store_metas:DataSyncStoreMetaT[],
	db_name:string,
	db_version:num
) {

	return new Promise<boolean>(async (resolve, _reject) => {

		if (!data.some((d:any) => d.length > 0)) {
			resolve(true)
			return
		}


		const request = indexedDB.open(db_name, db_version)

		request.onerror = (event:any) => {
			redirect_from_error("datasync_worker_db_open_error","datasync_worker_db_open_error: " + event.target.errorCode)
		}

		request.onsuccess = async (e:any) => {

			e.target.result.onerror = (event:any) => {
				redirect_from_error("datasync_worker_db_operation_error","IndexedDB Error - " + event.target.errorCode)
			}

			const db = e.target.result

			const tx:IDBTransaction = db.transaction(store_metas.map((s:any) => s.n), "readwrite", { durability: "relaxed" })

			let are_there_any_put_errors = false

			for (const [i, sm] of store_metas.entries()) {

				if (data[i].length === 0) continue

				const os = tx.objectStore(sm.n)

				for(let ii = 0; ii < data[i].length; ii++) {
					const db_put = os.put(data[i][ii])
					db_put.onerror = (_event:any) => are_there_any_put_errors = true
				}
			}

			tx.oncomplete = (_event:any) => {

				db.close()

				if (are_there_any_put_errors) {   
					redirect_from_error("firestorelive_indexeddb_put","Firestorelive Error putting data into IndexedDB")  
					return   
				}

				resolve(true)
			}

			tx.onerror = (_event:any) => {
				db.close()
				redirect_from_error("firestorelive_indexeddb_put","Firestorelive Error putting data from IndexedDB")
			}
		}
	})
}




function redirect_from_error(errmsg:string, errmsg_long:string) {
	self.postMessage({ cmd: "error", errmsg, errmsg_long })
}




