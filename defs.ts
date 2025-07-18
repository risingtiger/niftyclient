

import { bool, num, str } from './defs_server_symlink.js'


export type GenericRowT = { [key:string]: any }


export type LazyLoadFuncRefreshSpecT = {
	type: "datasync" | "placeholder", paths: str[] 
}
export type LazyLoadFuncReturnT = {
	d:Map<str, GenericRowT[]>, refreshspecs:LazyLoadFuncRefreshSpecT[]
}
export type LazyLoadT = {
    type: "view" | "component" | "thirdparty" | "lib",
    urlmatch?: string,
	subs?: { urlmatch: string, localdb_preload?: str[], loadfunc?: str }[],
    name: string,
    is_instance: bool,
    dependencies: { type: string, name: string, is_instance?: bool|null }[],
    auth: string[],
	localdb_preload?: str[]
}


export type FetchLassieHttpOptsT = {
	method?: string,
	headers?: any,
	body?: string | null,
}
export type FetchLassieOptsT = {
	retries?: num,
	background?: boolean,
	animate?: boolean,
	refreshcache?: boolean,
	cacheit?: boolean
}
export type FetchResultT = {
	status: number,
	statusText: string,
	ok: boolean,
	data?: number | string | boolean | GenericRowT | Array<GenericRowT|number|string|boolean>
}


/*
export type FirestoreOptsT = {
    limit?: number
    order_by?: string,
	ts?: number|null
}
export type FirestoreLoadSpecT    = Map<string, { name:string, opts?:FirestoreOptsT, els?:str[] }>
export type FirestoreFetchResultT = Map<string, Array<object>>|null
*/



export type EngagementListenerT = {
	el: HTMLElement,
    name: string,
    type: "visible" | "hidden" | "resize",
	priority: number,
    callback:()=>void
}


export type CMechViewT = {
	m: {[key:string]:any},
	a: {[key:string]:any},
	s: {[key:string]:any},
	subelshldr?:HTMLElement[]
	opts?: {kdonvisibled:boolean, kdonlateloaded:boolean}
	disconnectedCallback:()=>void,
	attributeChangedCallback:(name:string, oldval:str|boolean|number, newval:string|boolean|number)=>void,
	kd:(loadeddata:CMechLoadedDataT, loadstate:string, pathparams:GenericRowT, searchparams:GenericRowT)=>void, // loadstate: 'initial' | 'subchanged' | 'searchchanged' | 'datachanged' | 'visibled' | 'lateloaded'
	pathparamschngd:(loadeddata:CMechLoadedDataT, pathparams:GenericRowT, searchparams:GenericRowT)=>void,
	searchparamschngd:(loadeddata:CMechLoadedDataT, pathparams:GenericRowT, searchparams:GenericRowT)=>void,
	sc:(state_changes?:any)=>void,
}
export type CMechViewPartT = {
	disconnectedCallback:()=>void,
	attributeChangedCallback:(name:string, oldval:str|boolean|number, newval:string|boolean|number)=>void,
	hostview?:CMechViewT,
	m: {[key:string]:any},
	a: {[key:string]:any},
	s: {[key:string]:any},
	kd:(loadeddata:CMechLoadedDataT, loadstate:string, pathparams: GenericRowT, searchparams:GenericRowT)=>void, // refer to CMechViewT for loadstate values
	sc:(state_changes?:any)=>void,
}
export type CMechLoadedDataT = Map<string, GenericRowT[]>












export type $NT = {
	SSEvents: {
		Add_Listener: (el:HTMLElement, listener_name:string, eventnames:string[], priority:number|null, callback_func:any) => void
		Remove_Listener: (el:HTMLElement, name:string)=>void
		HandleMessage: (data:any)=>void
	},

	InfluxDB: {
		Retrieve_Series: (bucket:str, begins:number[], ends:number[], msrs:str[], fields:str[], tags:str[], intrv:number[], priors:str[]) => Promise<any>
	}

	EngagementListen: {
		Init: () => void,
		Add_Listener: (el:HTMLElement, name:string, type:"visible" | "hidden" | "resize", priority:number|null, callback:()=>void) => void
		Remove_Listener: (name:string, type:"visible" | "hidden" | "resize") => void
	}

	LocalDBSync: {
		Add:   (path:string, newdocs:any[]) => Promise<any>,
		Patch: (path:string, data:GenericRowT) => Promise<any>,
		Delete:(path:string, id:string) => Promise<any>,
	}

	CMech: {
		ViewConnectedCallback: (component:HTMLElement & CMechViewT, opts?: {kdonvisibled?:boolean, kdonlateloaded?:boolean}) => Promise<void>
		ViewPartConnectedCallback: (component:HTMLElement & CMechViewPartT) => Promise<void>
		AttributeChangedCallback: (component:HTMLElement, name:string, oldval:str|boolean|number, newval:string|boolean|number, _opts?:object) => void
		ViewDisconnectedCallback: (component:HTMLElement) => void
		ViewPartDisconnectedCallback: (component:HTMLElement) => void,
	}

	FetchLassie: (url:string, http_optsP?:FetchLassieHttpOptsT|undefined|null, opts?:FetchLassieOptsT|null|undefined) => Promise<FetchResultT>
	FetchLassie_IsOffline: () => boolean

	Logger: {
		Log: (type:number, subject:string, message:str) => void, // refer to logger.ts for type and subject comments
		Save: () => void
		Get: () => void
	}

	Utils: {
		CSV_Download: (csvstr:string, filename:string) => void,
		resolve_object_references: (list: {[key: str]: any}[], object_stores: Map<string, {[key: str]: any}[]>) => {[key: str]: any}[]
	}

	ToastShow: (msg: str, level?: number|null, duration?: num|null) => void
	Unrecoverable: (subj: string, msg: string, btnmsg:string, logsubj:string, logerrmsg:string, redirectionurl:string|null) => void
	//GetSharedWorkerPort:() => MessagePort

	SwitchStation: {
		NavigateToView: (newPath: string) => void,
		NavigateToSub: (newPath: string) => void,
		NavigateBack: (opts:{default:str}) => void,
		NavigateToSearch: (newsearchparams:GenericRowT) => void
	}

	IDB: {
		GetDB:   () => Promise<IDBDatabase>,
		GetOne:  (objectstore_name:str, id:str, localdb_preload?:str[]) => Promise<GenericRowT>,
		GetAll:  (objectstore_names:str[], localdb_preload?:str[]) => Promise<Map<str,GenericRowT[]>>,
		ClearAll:(objectstore_name:str) => Promise<num>,
		AddOne: (objectstore_name:str, data:GenericRowT) => Promise<string>,
		PutOne: (objectstore_name:str, data:GenericRowT) => Promise<string>,
		DeleteOne: (objectstore_name:str, id:str) => Promise<string>,
		Count:  (objectstore_name:str) => Promise<number>,
		GetOne_S: (objectstore:IDBObjectStore, id:str) => Promise<GenericRowT>,
		GetAll_S: (objectstore:IDBObjectStore) => Promise<GenericRowT[]>,
		AddOne_S: (objectstore:IDBObjectStore, data:GenericRowT) => Promise<string>,
		PutOne_S: (objectstore:IDBObjectStore, data:GenericRowT) => Promise<string>,
		DeleteOne_S: (objectstore:IDBObjectStore, id:string) => Promise<string>,
		TXResult: (tx:IDBTransaction) => Promise<num>,
	}
}
 

export type INSTANCE_T = {
	INFO: {
		name: string,
		firebase: {
			project: string,
			identity_platform_key: string,
			dbversion: number,
		},
		localdb_objectstores: {name:str,indexes?:str[]}[],
	},
	LAZYLOADS: LazyLoadT[],
	LAZYLOAD_DATA_FUNCS: { [key:string]: any }
}
