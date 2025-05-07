

import { bool, num, str, SSETriggersE } from './defs_server_symlink.js'


export type GenericRowT = { [key:string]: any }


export type LazyLoadT = {
    type: "view" | "component" | "thirdparty" | "lib",
    urlmatch?: string,
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



export const enum EngagementListenerTypeT {
    visible = "visible",
    hidden = "hidden",
	resize = "resize",
}


export type EngagementListenerT = {
	el: HTMLElement,
    name: string,
    type: EngagementListenerTypeT,
	priority: number,
    callback:()=>void
}


export const enum CMechLoadStateE {
	INITIAL, SEARCHCHANGED, DATACHANGED, VISIBLED, LATELOADED
}
export type CMechViewT = {
	m: {[key:string]:any},
	a: {[key:string]:any},
	s: {[key:string]:any},
	subelshldr?:HTMLElement[]
	opts?: {kdonvisibled?:boolean, kdonlateloaded?:boolean}
	disconnectedCallback:()=>void,
	attributeChangedCallback:(name:string, oldval:str|boolean|number, newval:string|boolean|number)=>void,
	kd:(loadeddata:CMechLoadedDataT, loadstate:CMechLoadStateE)=>void,
	sc:(state_changes?:any)=>void,
}
export type CMechViewPartT = {
	disconnectedCallback:()=>void,
	attributeChangedCallback:(name:string, oldval:str|boolean|number, newval:string|boolean|number)=>void,
	hostview?:CMechViewT,
	m: {[key:string]:any},
	a: {[key:string]:any},
	s: {[key:string]:any},
	kd:(loadeddata:CMechLoadedDataT, loadstate:CMechLoadStateE)=>void,
	sc:(state_changes?:any)=>void,
}
export type CMechLoadedDataT = Map<string, GenericRowT[]>


export const enum LoggerTypeE {
	debug = 10,
    info = 20,
	info_engagement = 25,
	warning = 30,
	error = 40
}


export const enum LoggerSubjectE {
	switch_station_route_load_fail = "srf",
	indexeddb_error = "ixe",
	sse_listener_error = "sse",
	sw_fetch_not_authorized = "sw4",
	sw_fetch_error = "swe",
	app_update = "aup",
	engagement_pageview = "epv",
	engagement_overlayview = "eov",
}


export const enum DataSyncStoreMetaStateE  { 
	EMPTY, 
	STALE, 
	QUELOAD, 
	LOADING, 
	LOADED_AND_CHANGED, 
	LOADED_AND_UNCHANGED,
	OK 
}
export type DataSyncStoreMetaT = {
	n: string, // store name
	i: null|string, // item id or null if entire store
	l: DataSyncStoreMetaStateE, // 
	ts: number // timestamp
}










export type $NT = {
	SSEvents: {
		ForceStop: () => void,
		WaitTilConnectedOrTimeout: () => Promise<boolean>,
		Add_Listener: (el:HTMLElement, listener_name:string, eventname:SSETriggersE[], priority:number|null, callback_func:any) => void
		Remove_Listener: (el:HTMLElement, name:string)=>void
	},

	InfluxDB: {
		Retrieve_Series: (bucket:str, begins:number[], ends:number[], msrs:str[], fields:str[], tags:str[], intrv:number[], priors:str[]) => Promise<any>
	}

	EngagementListen: {
		Init: () => void,
		Add_Listener: (el:HTMLElement, name:string, type:EngagementListenerTypeT, priority:number|null, callback:()=>void) => void
		Remove_Listener: (name:string, type:EngagementListenerTypeT) => void
		LogEngagePoint: (logsubj:LoggerSubjectE, componentname:str) => void
	}

	LocalDBSync: {
		Add:   (path:string, newdocs:any[]) => Promise<any>,
		Patch: (path:string, data:GenericRowT) => Promise<any>,
		Delete:(path:string, id:string) => Promise<any>,
		ClearAllObjectStores: () => Promise<num>,
	}

	CMech: {
		ViewConnectedCallback: (component:HTMLElement & CMechViewT, opts?: {kdonvisibled?:boolean, kdonlateloaded?:boolean}) => Promise<void>
		ViewPartConnectedCallback: (component:HTMLElement & CMechViewPartT) => Promise<void>
		AttributeChangedCallback: (component:HTMLElement, name:string, oldval:str|boolean|number, newval:string|boolean|number, _opts?:object) => void
		ViewDisconnectedCallback: (component:HTMLElement) => void
		ViewPartDisconnectedCallback: (component:HTMLElement) => void,
		GetViewParams: (component:HTMLElement) => { path:GenericRowT, search:GenericRowT }
	}

	FetchLassie: (url:string, http_optsP?:FetchLassieHttpOptsT|undefined|null, opts?:FetchLassieOptsT|null|undefined) => Promise<FetchResultT>

	Logger: {
		Log: (type:LoggerTypeE, subject:LoggerSubjectE, message:str) => void,
		Save: () => void
		Get: () => void
	}

	Utils: {
		CSV_Download: (csvstr:string, filename:string) => void,
		resolve_object_references: (list: {[key: str]: any}[], object_stores: Map<string, {[key: str]: any}[]>) => {[key: str]: any}[]
	}

	ToastShow: (msg: str, level?: number|null, duration?: num|null) => void
	Unrecoverable: (subj: string, msg: string, btnmsg:string, logsubj:LoggerSubjectE, logerrmsg:string) => void

	SwitchStation: {
		NavigateTo: (newPath: string) => void,
		NavigateBack: (opts:{default:str}) => void,
		NavigateToSearchParams: (newsearchparams:GenericRowT) => void
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
}
