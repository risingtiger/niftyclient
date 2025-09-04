

import { GenericRowT, LazyLoadT } from  "./../defs.js" 
import { str  } from  "../defs_server_symlink.js" 
import { RegExParams, GetPathParams } from "./switchstation_uri.js"

export type Route = {
	lazyload_view: LazyLoadT
	path_regex: RegExp
	pathparams_propnames: Array<str>
}

export type PathSpecT = {
	route:Route, 
	pathparams: GenericRowT, 
	searchparams: GenericRowT, 
	sub?: { loadfunc:str|null } 
}




function ParsePath(path:str, allroutes:Array<Route>) : PathSpecT | null {

	const subsplit                       = path.split('/s/');
	const qsplit                         = path.split('?');
	const searchstr                      = qsplit.length > 1 ? qsplit[1] : ''; // the search params if it exists
	const viewpathstr                    = subsplit.length > 1 ? subsplit[0] : qsplit[0]; // the view path without sub path params
	const substr                         = subsplit.length > 1 ? subsplit[1].split('?')[0] : ''; // the sub path params if it exists

	let   pathparams:GenericRowT = {}
	let   route:Route
	let   searchparams:GenericRowT = {}

	{
		for (let i = 0; i < allroutes.length; i++) {
			let pathmatch = viewpathstr.match(allroutes[i].path_regex)
			if (!pathmatch) continue;

			route = allroutes[i]
			pathparams = GetPathParams(route.pathparams_propnames, pathmatch.slice(1));
			break;
		}

		if (!route) {  return null; }


		for(const [key, val] of ( new URLSearchParams(searchstr) ).entries()) {   searchparams[key] = val;   }
	}


	if (!substr) {   return { route, pathparams, searchparams };   }


	for(const s of route.lazyload_view.subs) {

		const {regex, paramnames} = RegExParams(s.urlmatch)

		const match = substr.match(regex);
		if (!match) { continue; }

		const subpathparams = GetPathParams(paramnames, match.slice(1));
		const loadfunc = s.loadfunc || null
		pathparams = { ...pathparams, ...subpathparams }
		return  { route, pathparams, searchparams, sub:{ loadfunc } }
	}
}




function _ParsePath(path:str, allroutes:Array<Route>) : PathSpecT | null {

	const split               = path.split('/s/');
	const qsplit              = path.split('?');
	const subsearchparams_str = qsplit.length > 1 ? qsplit[1] : ''; // the search params if it exists
	const viewpath            = split.length > 1 ? split[0] : qsplit[0]; // the view path without sub path params
	const subpathparams_str   = split.length > 1 ? split[1].split('?')[0] : ''; // the sub path params if it exists

	let   pathparammatch_values:string[] = []
	let   routematch_index = -1;

    for (let i = 0; i < allroutes.length; i++) {
		let pathmatchstr = viewpath.match(allroutes[i].path_regex)
		if (pathmatchstr) {   
			pathparammatch_values = pathmatchstr.slice(1);
			routematch_index = i;
			break;
		}
    }

	if (routematch_index === -1) {  return null; }

	const route           = allroutes[routematch_index];
	const pathparams      = GetPathParams(route.pathparams_propnames, pathparammatch_values);
	const searchparamsraw = new URLSearchParams(subsearchparams_str);

	const searchparams: GenericRowT = {};
	for (const [key, value] of searchparamsraw.entries()) {
		searchparams[key] = value;
	}

	if (!route.lazyload_view.subs || ( !subpathparams_str && !subsearchparams_str ) ) {
		// no sub anything so just return what we got
		return { route, pathparams, searchparams };
	}


	pathparammatch_values = []
	routematch_index = -1;
	const subs:any[] = []

	for(const s of route.lazyload_view.subs) {
		if (!s.urlmatch.startsWith("?")) {
			const {regex, paramnames: pathparams_propnames, pattern} = RegExParams(s.urlmatch)
			subs.push({ path_regex: regex, pathparams_propnames, searchparams_propnames:{}, loadfunc: s.loadfunc, pattern });
		} else {
			const searchpath = s.urlmatch.startsWith("?") ? s.urlmatch.slice(1) : ""
			const searchparams_urlsearchparams = new URLSearchParams(searchpath);
			const searchparams_propnames = Object.fromEntries(searchparams_urlsearchparams.entries());
			subs.push({ path_regex: null, pathparams_propnames:{}, searchparams_propnames, loadfunc: s.loadfunc, pattern:null });
		}
	}

	subs.sort((a, b) => {
		const a_source = a.path_regex.source
		const b_source = b.path_regex.source
		
		// Count specific characters (non-regex metacharacters) to determine specificity
		const a_specificity = a_source.replace(/[.*+?^${}()|[\]\\]/g, '').length
		const b_specificity = b_source.replace(/[.*+?^${}()|[\]\\]/g, '').length
		
		// More specific routes (higher character count) come first
		return b_specificity - a_specificity
	})

	
	let   sub_details:any
	
	// Try to match the remaining path against sub routes
	for (const sub of subs) {
		const sub_match = subpathparams_str.match(sub.path_regex);
		if (sub_match) {
			const sub_pathparams = GetPathParams(sub.pathparams_propnames, sub_match.slice(1));
			sub_details = {
				loadfunc: sub.loadfunc || null,
				pathparams: sub_pathparams,
				searchparams
			};
			break;

		} else {
			const issearchmatching = Object.keys(sub.searchparams_propnames).every(( prop:any )=> {
				const exists = searchparams.hasOwnProperty(prop);
				if (!exists) return false;
				
				const type = sub.searchparams_propnames[prop];
				if (type === "number") {
					searchparams[prop] = parseInt(searchparams[prop]);
				} else if (type === "boolean") {
					searchparams[prop] = searchparams[prop] === "true";
				} else if (type === "string") {
					searchparams[prop] = searchparams[prop].toString();
				}

				return true;
			})

			if (issearchmatching) {
				sub_details = {
					loadfunc: sub.loadfunc || null,
					pathparams: {},
					searchparams
				}
			}
		}
	}


	if (!sub_details) {
		return { route, pathparams, searchparams };
	}
	else {
		return { 
			route, 
			pathparams, 
			searchparams, 
			sub: sub_details 
		};
	}
}




export { ParsePath }














