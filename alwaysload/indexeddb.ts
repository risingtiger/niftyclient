

import { GenericRowT } from  "./../defs.js" 
import { str, num } from  "../defs_server_symlink.js" 
import { $NT } from "./../defs.js"


declare var $N: $NT;

let _db:IDBDatabase|null  = null;
let _localdb_objectstores:any[] = [] 
let _db_name = ""
let _db_version = 0




const Init = async (localdb_objectstores: {name:str,indexes?:str[]}[], db_name: str, db_version: num)=> {

	_localdb_objectstores = localdb_objectstores
	_db_name              = db_name
	_db_version           = db_version
}



const GetDB = () => new Promise<IDBDatabase>(async (res, _rej) => {
	_db = await openindexeddb() 
	res(_db as IDBDatabase)
})



const GetOne = (objectstore_name:str, id:str) => new Promise<GenericRowT>(async (res, _rej) => {
	if (_db === null) { await GetDB(); }
	const transaction = (_db as IDBDatabase).transaction(objectstore_name, 'readonly');
	const objectStore = transaction.objectStore(objectstore_name);
	const result      = await GetOne_S(objectStore, id)
	res(result)
})



const GetAll = (objectstore_names:str[]) => new Promise<Map<str,GenericRowT[]>>(async (res, _rej) => {
	if (_db === null) { await GetDB(); }
	const returns:Map<str,GenericRowT[]> = new Map<str,GenericRowT[]>()
	const transaction = ( _db as IDBDatabase ).transaction(objectstore_names, 'readonly');
	const promises:Promise<any>[] = []
	for (const objectstore_name of objectstore_names) {
		const objectstore = transaction.objectStore(objectstore_name)
		promises.push(GetAll_S(objectstore))
	}
	const r = await Promise.all(promises)
	if (r === null) { res(new Map()); return; }
	for (let i=0; i<r.length; i++) { returns.set(objectstore_names[i], r[i]) }
	res(returns)
})



const GetRangeAll = (objectstore_names:str[], keys:str[], lower_bounds:str[]|num[], upper_bounds:str[]|num[]) => new Promise<Map<str,GenericRowT[]>>(async (res, _rej) => {
	if (_db === null) { await GetDB(); }
	const returns:Map<str,GenericRowT[]> = new Map<str,GenericRowT[]>()
	const transaction = ( _db as IDBDatabase ).transaction(objectstore_names, 'readonly');
	const promises:Promise<any>[] = []
	let   i = 0;
	for (const objectstore_name of objectstore_names) {
		const objectstore = transaction.objectStore(objectstore_name)
		promises.push(GetRangeAll_S(objectstore, keys[i], lower_bounds[i], upper_bounds[i]))
		i++
	}
	const r = await Promise.all(promises)
	if (r === null) { res(new Map()); return; }
	for (let i=0; i<r.length; i++) { returns.set(objectstore_names[i], r[i]) }
	res(returns)
})



const ClearAll = (objectstore_name:str) => new Promise(async (res, _rej) => {
	if (_db === null) { await GetDB(); }
	const tx = ( _db as IDBDatabase ).transaction(objectstore_name, 'readwrite');
	const objstore = tx.objectStore(objectstore_name)
	const request = objstore.clear();
	request.onerror = async () => { redirect_from_error("ClearAll: clear failed"); }
	tx.onerror    = async () => { redirect_from_error("ClearAll: tx error"); }
	tx.oncomplete = () => { res(1); }
})



const AddOne = (objectstore_name:str, data:GenericRowT) => new Promise<string>(async (res, _rej) => {
	if (_db === null) { await GetDB(); }
	const transaction = (_db as IDBDatabase).transaction(objectstore_name, 'readwrite');
	const objectstore = transaction.objectStore(objectstore_name);
	const keystring   = await AddOne_S(objectstore, data)
	res(keystring)
})




const PutOne = (objectstore_name:str, data:GenericRowT) => new Promise<string>(async (res, _rej) => {
	if (_db === null) { await GetDB(); }
	const transaction = (_db as IDBDatabase).transaction(objectstore_name, 'readwrite');
	const objectstore = transaction.objectStore(objectstore_name);
	const keystring   = await PutOne_S(objectstore, data)
	res(keystring)
})




const DeleteOne = (objectstore_name:str, id:string) => new Promise<string>(async (res, _rej) => {
	if (_db === null) { await GetDB(); }
	const transaction = (_db as IDBDatabase).transaction(objectstore_name, 'readwrite');
	const objectstore = transaction.objectStore(objectstore_name);
	const r = await DeleteOne_S(objectstore, id)
	res(r)
})




const PutMany = (store_names:string[], datas:GenericRowT[][]) => new Promise<void>(async (resolve, _reject) => {

	if (_db === null) { await GetDB(); }

	if (!datas.some((d:any) => d.length > 0)) { resolve(); return; }

	const tx:IDBTransaction = ( _db as IDBDatabase ).transaction(store_names, "readwrite", { durability: "relaxed" })

	let are_there_any_put_errors = false

	for(let i = 0; i < datas.length; i++) {
		if (datas[i].length === 0) continue

		const os = tx.objectStore(store_names[i])

		for(let ii = 0; ii < datas[i].length; ii++) {
			const db_put = os.put(datas[i][ii])
			db_put.onerror = (_event:any) => are_there_any_put_errors = true
		}
	}

	tx.oncomplete = (_event:any) => {
		if (are_there_any_put_errors) redirect_from_error("PutMany error")
		resolve()
	}

	tx.onerror = (_event:any) => {
		redirect_from_error("PutMany error")
	}
})






const DeleteMany = (store_names:string[], datas:string[][]) => new Promise<void>(async (resolve, _reject) => {

	if (_db === null) { await GetDB(); }

	if (!datas.some((d) => d.length > 0)) { resolve(); return; }

	const tx:IDBTransaction = ( _db as IDBDatabase ).transaction(store_names, "readwrite", { durability: "relaxed" })

	let are_there_any_delete_errors = false

	for(let i = 0; i < datas.length; i++) {
		if (datas[i].length === 0) continue

		const os = tx.objectStore(store_names[i])

		for(let ii = 0; ii < datas[i].length; ii++) {
			const db_delete = os.delete(datas[i][ii])
			db_delete.onerror = (_event:any) => are_there_any_delete_errors = true
		}
	}

	tx.oncomplete = (_event:any) => {
		if (are_there_any_delete_errors) redirect_from_error("DeleteMany error")
		resolve()
	}

	tx.onerror = (_event:any) => {
		redirect_from_error("DeleteMany error")
	}
})



const Count = (objectstore_name:str) => new Promise<number>(async (res, _rej) => {
	if (_db === null) { await GetDB(); }
	const transaction = (_db as IDBDatabase).transaction(objectstore_name, 'readonly');
	const objectstore = transaction.objectStore(objectstore_name);
	let   count       = 0
	const request = objectstore.count();
	request.onsuccess = (ev:any)  => count = Number( ev.target.result );
	request.onerror   = async (_ev:any) => { await redirect_from_error("Count: request error"); };
	transaction.onerror    = async () => { await redirect_from_error("Count: tx error"); }
	transaction.oncomplete = () => { res(count); }
})



const GetAll_S = (objectstore:IDBObjectStore) => new Promise<GenericRowT[]>((res, _rej) => {
	const request = objectstore.getAll();
	request.onsuccess = (ev:any) => { const records = ev.target.result; res(records); }
	request.onerror   = async (_ev:any) => { redirect_from_error("GetAll_S: request error"); }
})



const GetRangeAll_S = (objectstore:IDBObjectStore, key:str, lower_bound:str|num, upper_bound:str|num) => new Promise<GenericRowT[]>((res, _rej) => {
	const key_range = IDBKeyRange.bound(lower_bound, upper_bound);
	const index     = objectstore.index(key);
	const request   = index.getAll(key_range);
	request.onsuccess = (ev:any) => { const records = ev.target.result; res(records); }
	request.onerror   = async (_ev:any) => { redirect_from_error("GetRangeAll_S: request error"); }
})



const GetOne_S = (objectstore:IDBObjectStore, id:str) => new Promise<GenericRowT>((res, _rej) => {
	const request = objectstore.get(id);
	request.onsuccess = (ev:any) => res(ev.target.result);
	request.onerror   = async (_ev:any) => { redirect_from_error("GetOne_S: request error"); }
})



const AddOne_S = (objectstore:IDBObjectStore, data:GenericRowT) => new Promise<string>((res, _rej) => {
	const request     = objectstore.add(data);
	request.onsuccess = (ev:any) => res(ev.target.result); // key of the added item
	request.onerror   = async (_ev:any) => { redirect_from_error("AddOne_S: request error"); }
})



const PutOne_S = (objectstore:IDBObjectStore, data:GenericRowT) => new Promise<string>((res, _rej) => {
	const request     = objectstore.put(data);
	request.onsuccess = (ev:any) => res(ev.target.result);
	request.onerror   = async (_ev:any) => { redirect_from_error("PutOne_S: request error"); }
})



const DeleteOne_S = (objectstore:IDBObjectStore, id:string) => new Promise<string>((res, _rej) => {
	const request     = objectstore.delete(id);
	request.onsuccess = (ev:any) => res(ev.target.result); // if record doesn't exist, browser still triggers success
	request.onerror   = async (ev:any) => { 
		redirect_from_error("DeleteOne_S: request error"); 
	}
})



const TXResult = (tx:IDBTransaction) => new Promise<num>((res, _rej) => {
	tx.onerror    = async () => { redirect_from_error("TXResult: tx error"); }
	tx.oncomplete = () => { res(1); }
	tx.onabort    = async () => { redirect_from_error("TXResult: tx aborted"); }
})



const openindexeddb = () => new Promise<IDBDatabase>(async (res,rej)=> {
	let dbconnect = indexedDB.open(_db_name, _db_version)
	dbconnect.onerror = async (_event:any) => { await redirect_from_error("openindexeddb: connection error"); rej(); }
	dbconnect.onsuccess = async (event: any) => { const db = event.target.result; res(db) }
	dbconnect.onupgradeneeded = (event: any) => {
		const db = event.target.result
		_localdb_objectstores.forEach((dc) => {
			if (!db.objectStoreNames.contains(dc.name)) {
				const opts = { keyPath: 'id' }
				if (dc.auto_increment === true) { (opts as any).autoIncrement = true; }
				const objectStore = db.createObjectStore(dc.name, opts);
				(dc.indexes || []).forEach(( prop:any )=> { objectStore.createIndex(prop, prop, { unique: false }); })
			}
		})
	}
})





async function redirect_from_error(errmsg:str) {
	$N.Unrecoverable("Error", "Error in IndexedDB", "Reset App", "ixe", errmsg, null)
}





export { Init  }



if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).IDB = { GetDB, GetOne, GetAll, GetRangeAll, ClearAll, AddOne, PutOne, PutMany, DeleteMany, DeleteOne, Count, GetOne_S, GetAll_S, GetRangeAll_S, AddOne_S, PutOne_S, DeleteOne_S, TXResult };




