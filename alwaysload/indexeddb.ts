

import { GenericRowT } from  "./../defs.js" 
import { str, num } from  "../defs_server_symlink.js" 


let _db:IDBDatabase|null  = null;
let _localdb_objectstores:any[] = [] 
let _db_name = ""
let _db_version = 0




const Init = async (localdb_objectstores: {name:str,indexes?:str[]}[], db_name: str, db_version: num)=> {

	_localdb_objectstores = localdb_objectstores
	_db_name              = db_name
	_db_version           = db_version
}




const GetOne = (objectstore_name:str, id:str) => new Promise<GenericRowT>(async (res, rej) => {
})




const GetAll = (objectstore_names:str[]) => new Promise<Map<str,GenericRowT[]>>(async (res, rej) => {

	if (!_db) _db = await openindexeddb()

	const t1 = performance.now()

	if (_db === null) { rej(); return; }

	const returns:Map<str,GenericRowT[]> = new Map<str,GenericRowT[]>() // key being the objectstore name

	const transaction             = ( _db as IDBDatabase ).transaction(objectstore_names, 'readonly');

	const promises:Promise<any>[] = []

	for (const objectstore_name of objectstore_names) {
		const objectstore = transaction.objectStore(objectstore_name)
		promises.push(get_all_promise(objectstore))
	}

	const r = await Promise.all(promises).catch(_ => null);
	if (r === null) { rej(); return; }

	for (let i=0; i<r.length; i++) {
		returns.set(objectstore_names[i], r[i])
	}

	const t2 = performance.now()
	transaction.onerror = (_event:any) => rej();

	console.log("IndexedDB Grab All took " + (t2 - t1) + " milliseconds.")
	res(returns)
})




const openindexeddb = () => new Promise<IDBDatabase|null>(async (res,_rej)=> {

	let dbconnect = indexedDB.open(_db_name, _db_version)

	dbconnect.onerror = (event:any) => { 
		console.log("IndexedDB Error - " + event.target.errorCode)
	}

	dbconnect.onsuccess = async (event: any) => {
		event.target.result.onerror = (event:any) => {
			console.log("IndexedDB Error - " + event.target.errorCode)
		}
		const db = event.target.result
		res(db)
	}

	dbconnect.onupgradeneeded = (event: any) => {
		const db = event.target.result
		_localdb_objectstores.forEach((dc) => {
			if (!db.objectStoreNames.contains(dc.name)) {

				const objectStore = db.createObjectStore(dc.name, { keyPath: 'id' });
                
				(dc.indexes || []).forEach(( prop:any )=> { // could be empty and wont create index
					objectStore.createIndex(prop, prop, { unique: false });
				})
			}
		})
	}
})




const get_all_promise = (objectStore:IDBObjectStore) => new Promise((res, rej) => {
	const request = objectStore.getAll();
	request.onsuccess = (ev:any) => res(ev.target.result);
	request.onerror   = (ev:any) => rej(ev.target.error);
})




export { Init  }



if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).IDB = { GetOne, GetAll };



