

import { str, GenericRowT } from  "../defs_server_symlink.js" 
import {PathSpecT } from "./switchstation_parsepath.js"




const RegExParams = (original_matchstr:string) => {
	const pathparamnames: Array<str> = [];
	const pattern = original_matchstr.replace(/:([a-zA-Z_0-9]+)/g, (_match, pathparamname) => {
		pathparamnames.push(pathparamname);
		return '([a-zA-Z0-9_]+)';
	});

	const regex      = new RegExp(pattern);
	const paramnames = pathparamnames;

	return {regex, paramnames, pattern}
}




const GetPathParams = (pathparams_propnames:str[], pathparams_vals:str[]): GenericRowT => {

	const pathparams:any = pathparams_propnames.map((_, i) => {
		return { [pathparams_propnames[i]]: pathparams_vals[i] }
	})

	return Object.assign({}, ...pathparams)	
}




/*
async function IsPathParamsSame(currentpathspec:PathSpecT, pathspec: PathSpecT) {

	const current_params = currentpathspec.pathparams || {} as Record<string, string>;
	const new_params = pathspec.pathparams || {} as Record<string, string>;
	const current_keys = Object.keys(current_params);
	const new_keys = Object.keys(new_params);
	let all_same = current_keys.length === new_keys.length;
	if (all_same) {
		for (const k of current_keys) { if (new_params[k] !== current_params[k]) { all_same = false; break; } }
	}

	return all_same
}
*/


export { RegExParams, GetPathParams }














