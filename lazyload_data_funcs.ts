
import { $NT, GenericRowT } from  "./defs.js" 
import { str } from "./defs_server_symlink.js";

//declare var $N: $NT;




const LAZYLOAD_DATA_FUNCS = {

	appmsgs_indexeddb: (_pathparams:GenericRowT, _old_searchparams: URLSearchParams, _new_searchparams: URLSearchParams) => new Promise<Map<string, GenericRowT[]>>(async (res, _rej) => {
		res(new Map<str,GenericRowT[]>())
	}),

	appmsgs_other: (_pathparams:GenericRowT, _old_searchparams: URLSearchParams, _new_searchparams: URLSearchParams) => new Promise<Map<string, GenericRowT[]>>(async (res, _rej) => {
		res(new Map<str,GenericRowT[]>())
	}),

	login_indexeddb: (_pathparams:GenericRowT, _old_searchparams: URLSearchParams, _new_searchparams: URLSearchParams) => new Promise<Map<string, GenericRowT[]>>(async (res, _rej) => {
		res(new Map<str,GenericRowT[]>())
	}),

	login_other: (_pathparams:GenericRowT, _old_searchparams: URLSearchParams, _new_searchparams: URLSearchParams) => new Promise<Map<string, GenericRowT[]>>(async (res, _rej) => {
		res(new Map<str,GenericRowT[]>())
	}),

	setup_push_allowance_indexeddb: (_pathparams:GenericRowT, _old_searchparams: URLSearchParams, _new_searchparams: URLSearchParams) => new Promise<Map<string, GenericRowT[]>>(async (res, _rej) => {
		res(new Map<str,GenericRowT[]>())
	}),

	setup_push_allowance_other: (_pathparams:GenericRowT, _old_searchparams: URLSearchParams, _new_searchparams: URLSearchParams) => new Promise<Map<string, GenericRowT[]>>(async (res, _rej) => {
		res(new Map<str,GenericRowT[]>())
	}),
}



export default LAZYLOAD_DATA_FUNCS

