

import { str } from  "../../defs_server_symlink.js" 




const RegExParams = (original_matchstr:string) => {
	const pathparamnames: Array<str> = [];
	const pattern = original_matchstr.replace(/:([a-z][a-z_0-9]+)/g, (_match, pathparamname) => {
		pathparamnames.push(pathparamname);
		return '([a-zA-Z0-9_]+)';
	});

	const regex      = new RegExp(pattern);
	const paramnames = pathparamnames;

	return {regex, paramnames}
}




const GetPathParams = (pathparams_propnames:str[], pathparams_vals:str[]): { [key: string]: string } => {

	const pathparams:any = pathparams_propnames.map((_, i) => {
		return { [pathparams_propnames[i]]: pathparams_vals[i] }
	})

	return Object.assign({}, ...pathparams)	
}




export { RegExParams, GetPathParams }














