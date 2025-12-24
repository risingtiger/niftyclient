

import { bool, num, str } from './defs_server_symlink.js'


export type GenericRowT = { [key:string]: any }


export type LazyLoadFuncReturnT = {
	d:Map<str, GenericRowT[]>, refreshon:str[]
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
	is_fetchonbrowserfocus?: boolean,
	background?: boolean,
	animate?: boolean,
	cacheit?: boolean|string
}
export type FetchResultT = {
	headers: Headers,
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

export type SSEventListenerEvents = "datasync_doc_add" | "datasync_doc_delete" | "datasync_doc_patch" | "datasync_collection"

export type EngagementListenerEvents = "visible" | "hidden" | "resize" | "15interval"

export type DataHodlEvents = SSEventListenerEvents | EngagementListenerEvents | 'backonline'

export type EngagementListenerT = {
	el: HTMLElement,
    name: string,
    type: EngagementListenerEvents[],
	priority: number,
    callback:(s:EngagementListenerEvents)=>void
}

export type CMechViewLoadStateT = 'initial' | 'paramschanged' | 'postload' | 'server_state_change'

export type CMechViewT = {
	m: {[key:string]:any},
	a: {[key:string]:any},
	s: {[key:string]:any},
	subelshldr?:HTMLElement[]
	opts?: {}
	disconnectedCallback:()=>void,
	attributeChangedCallback:(name:string, oldval:str|boolean|number, newval:string|boolean|number)=>void,
	ingest:(loadeddata:CMechLoadedDataT, pathparams:GenericRowT, searchparams:GenericRowT, loadstate?:CMechViewLoadStateT)=>void, // loadstate: 'initial' | 'datachanged' | 'paramschanged' | 'searchchanged'
	render:(state_changes?:any)=>void,
	hydrated?:()=>void,
	revealed?:()=>void
}
export type CMechViewPartT = {
	disconnectedCallback:()=>void,
	attributeChangedCallback:(name:string, oldval:str|boolean|number, newval:string|boolean|number)=>void,
	m: {[key:string]:any},
	a: {[key:string]:any},
	s: {[key:string]:any},
	ingest:(loadeddata:CMechLoadedDataT, pathparams: GenericRowT, searchparams:GenericRowT, loadstate:CMechViewLoadStateT)=>void, // refer to CMechViewT for loadstate values
	render:(state_changes?:any)=>void,
	hydrated?:()=>void,
	revealed?:()=>void
}
export type CMechLoadedDataT = Map<string, GenericRowT[]>

export type ToastLevelT = 'info' | 'saved' | 'success' | 'warning' | 'error' 







export type $NT = {
	SSEvents: {
		Add_Listener: (el:HTMLElement, listener_name:string, eventnames:SSEventListenerEvents[], priority:number|null, cb:(e:any, n:SSEventListenerEvents)=>void) => void
		Remove_Listener: (el:HTMLElement, name:string)=>void
		HandleMessage: (data:any)=>void
	},

	InfluxDB: {
		Retrieve_Series: (bucket:str, begins:number[], ends:number[], msrs:str[], fields:str[], tags:str[], intrv:number[], priors:str[]) => Promise<any>
	}

	EngagementListen: {
		Init: () => void,
		Add_Listener: (el:HTMLElement, name:string, type:EngagementListenerEvents[], priority:number|null, callback:(s:EngagementListenerEvents)=>void) => void
		Remove_Listener: (el:HTMLElement, name:string, type:EngagementListenerEvents[]) => void
	}

	DataHodl: {
		AddLocalDB:   (path:string, newdocs:GenericRowT) => Promise<any>,
		PatchLocalDB: (path:string, data:GenericRowT) => Promise<any>,
		DeleteLocalDB:(path:string, id:string) => Promise<any>,
	}

	CMech: {
		RegisterView: (component:HTMLElement & CMechViewT) => void
		RegisterViewPart: (component:HTMLElement & CMechViewPartT) => Promise<void>
		PostLoadViewPart: (component:HTMLElement & CMechViewPartT) => Promise<boolean>
		AttributeChangedCallback: (component:HTMLElement, name:string, oldval:str|boolean|number, newval:string|boolean|number, _opts?:object) => Promise<void>
		ViewDisconnectedCallback: (component:HTMLElement) => void
		ViewPartDisconnectedCallback: (component:HTMLElement) => void,
	}

	FetchLassie: (url:string, http_optsP?:FetchLassieHttpOptsT|undefined|null, opts?:FetchLassieOptsT|null|undefined) => Promise<FetchResultT>

	Logger: {
		log: (type:number, subject:string, message:str) => void, // refer to logger.ts for type and subject comments
		get: () => void
	}

	Utils: {
		CSVDownload: (csvstr:string, filename:string) => void,
		resolve_object_references: (list: {[key: str]: any}[], object_stores: Map<string, {[key: str]: any}[]>) => {[key: str]: any}[]
	}

	ToastShow: (msg: str, level?: ToastLevelT, duration?: num|null) => void
	Unrecoverable: (subj: string, msg: string, btnmsg:string, logsubj:string, logerrmsg:string, redirectionurl:string|null) => void
	GetConnectedState: () => Promise<'online' | 'offline'>
	//GetSharedWorkerPort:() => MessagePort

	SwitchStation: {
		GoTo: (newPath: string, opts?:{replacestate?:boolean}) => void,
		GoBack: (opts:{default:str}) => void,
	}

	IDB: {
		GetDB:        () => Promise<IDBDatabase>,
		GetOne:       (objectstore_name:str, id:str, localdb_preload?:str[]|null) => Promise<GenericRowT>,
		GetAll:       (objectstore_names:str[], localdb_preload?:str[]|null) => Promise<Map<str,GenericRowT[]>>,
		GetRangeAll:  (objectstore_names:str[], key:str[], lower_bound:str[]|num[], upper_bound:str[]|num[], localdb_preload?:str[]|null) => Promise<Map<str,GenericRowT[]>>,
		ClearAll:     (objectstore_name:str) => Promise<num>,
		AddOne:       (objectstore_name:str, data:GenericRowT) => Promise<string>,
		PutOne:       (objectstore_name:str, data:GenericRowT) => Promise<string>,
		PutMany:      (store_names:str[], datas:GenericRowT[][]) => Promise<string>,
		DeleteMany:   (store_names:str[], datas:GenericRowT[][]) => Promise<string>,
		DeleteOne:    (objectstore_name:str, id:str) => Promise<string>,
		Count:        (objectstore_name:str) => Promise<number>,
		GetOne_S:     (objectstore:IDBObjectStore, id:str) => Promise<GenericRowT>,
		GetAll_S:     (objectstore:IDBObjectStore) => Promise<GenericRowT[]>,
		GetRangeAll_S:(objectstore:IDBObjectStore, key:str[], lower_bound:str[]|num[], upper_bound:str[]|num) => Promise<GenericRowT[]>,
		AddOne_S:     (objectstore:IDBObjectStore, data:GenericRowT) => Promise<string>,
		PutOne_S:     (objectstore:IDBObjectStore, data:GenericRowT) => Promise<string>,
		DeleteOne_S:  (objectstore:IDBObjectStore, id:string) => Promise<string>,
		TXResult:     (tx:IDBTransaction) => Promise<num>,
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
	// LAZYLOAD_DATA_FUNCS: { [key:string]: any }
}


export type PRELOAD_BASE_ASSETS_T = '/v/appmsgs' | '/v/login' | '/v/home' | '/';


