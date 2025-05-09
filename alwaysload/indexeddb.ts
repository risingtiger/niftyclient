

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
	if (!_db) _db = await openindexeddb()

	if (_db === null) { rej(); return; }

	const transaction = (_db as IDBDatabase).transaction(objectstore_name, 'readonly');
	const objectStore = transaction.objectStore(objectstore_name);
	let   result      = {}
	
	try   { result = await GetOne_S(objectStore, id) }
	catch { rej() }
	
	transaction.onerror    = () => rej();
	transaction.oncomplete = () => res(result);

})




const GetAll = (objectstore_names:str[]) => new Promise<Map<str,GenericRowT[]>>(async (res, rej) => {

	if (!_db) _db = await openindexeddb()
	if (_db === null) { rej(); return; }

	const returns:Map<str,GenericRowT[]> = new Map<str,GenericRowT[]>() // key being the objectstore name

	const transaction = ( _db as IDBDatabase ).transaction(objectstore_names, 'readonly');

	const promises:Promise<any>[] = []

	for (const objectstore_name of objectstore_names) {
		const objectstore = transaction.objectStore(objectstore_name)
		promises.push(GetAll_S(objectstore))
	}

	const r = await Promise.all(promises).catch(() => null);
	if (r === null) { rej(); return; }

	for (let i=0; i<r.length; i++) {
		returns.set(objectstore_names[i], r[i])
	}

	transaction.onerror    = () => rej();
	transaction.oncomplete = () => res(returns);
})




const AddOne = (objectstore_name:str, data:GenericRowT) => new Promise<string>(async (res, rej) => {

	if (!_db) _db = await openindexeddb()
	if (_db === null) { rej(); return; }

	const transaction = (_db as IDBDatabase).transaction(objectstore_name, 'readonly');
	const objectstore = transaction.objectStore(objectstore_name);
	let   keystring   = ""
	
	try   { keystring = await AddOne_S(objectstore, data.id) }
	catch { rej() }
	
	transaction.onerror    = () => rej();
	transaction.oncomplete = () => res(keystring); 
})




const GetAll_S = (objectstore:IDBObjectStore) => new Promise<GenericRowT[]>((res, rej) => {
	const request = objectstore.getAll();
	request.onsuccess = (ev:any) => res(ev.target.result);
	request.onerror   = (ev:any) => rej(ev.target.error);
})




const GetOne_S = (objectstore:IDBObjectStore, id:str) => new Promise<GenericRowT>((res, rej) => {
	const request = objectstore.get(id);
	request.onsuccess = (ev:any) => res(ev.target.result);
	request.onerror   = (ev:any) => rej(ev.target.error);
})




const AddOne_S = (objectstore:IDBObjectStore, data:GenericRowT) => new Promise<string>((res, rej) => {
	const request     = objectstore.add(data);

	request.onsuccess = (ev:any) => res(ev.target.result); // result of add is the key of the added item
	request.onerror   = (ev:any) => rej((ev.target as IDBRequest).error);
})




const PutOne_S = (objectstore:IDBObjectStore, data:GenericRowT) => new Promise<string>((res, rej) => {
	const request     = objectstore.put(data);

	request.onsuccess = (ev:any) => res(ev.target.result); // result of add is the key of the added item
	request.onerror   = (ev:any) => rej((ev.target as IDBRequest).error);
})




const DeleteOne_S = (objectstore:IDBObjectStore, id:string) => new Promise<string>((res, rej) => {
	const request     = objectstore.delete(id);

	request.onsuccess = (ev:any) => res(ev.target.result); // result of add is the key of the added item
	request.onerror   = (ev:any) => rej((ev.target as IDBRequest).error);
})




const TXResult = (tx:IDBTransaction) => new Promise<num>((res, rej) => {
	tx.onerror    = (event) => { rej((event.target as IDBTransaction).error) }
	tx.oncomplete = () => { 
		res(1);
	}
    tx.onabort = (event) => { 
        rej((event.target as IDBTransaction).error || new Error("Transaction aborted"));
    }
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








export { Init  }



if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).IDB = { GetOne, GetAll, AddOne, GetOne_S, GetAll_S, AddOne_S, PutOne_S, DeleteOne_S, TXResult };



