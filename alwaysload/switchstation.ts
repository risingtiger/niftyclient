


// TODO: Go to a popup like machine details. Refresh. It will automatically bring the popup back up. Thats cool. But then click away from the popup. A back is triggered, but it goes all the way back home




import { $NT, GenericRowT, LazyLoadT } from  "./../defs.js" 
import { str } from  "../defs_server_symlink.js" 
//import { Run as LazyLoadFilesRun } from './lazyload_files.js'
import { AddView as CMechAddView, ParamsChanged as CMechParamsChanged, BackToJustView as CMechBackToJustView } from "./cmech.js"
import { RegExParams, GetPathParams } from "./switchstation_uri.js"
import { Init as LazyLoadFilesInit, LoadView as LazyLoadLoadView } from "./lazyload_files.js"

declare var $N: $NT;

type Route = {
	lazyload_view: LazyLoadT
	path_regex: RegExp
	pathparams_propnames: Array<str>
}

type PathSubSpecT = {
	loadfunc?: str,
	pathparams: GenericRowT,
	searchparams: GenericRowT
}
type PathSpecT = {
	route:Route, 
	pathparams: GenericRowT, 
	searchparams: GenericRowT, 
	sub?: PathSubSpecT 
}

let _routes:Array<Route> = [];
let _history_states:Array<PathSpecT> = [];




const Init = (lazyloads:LazyLoadT[])=> new Promise<str[][]>(async (res, _rej) => {

	LazyLoadFilesInit(lazyloads);

	const lazyload_view_urlpatterns = lazyloads.filter(l => l.type === "view").map(r => addroute(r)).map(l=> [l.viewname, l.pattern])

	// Sort routes by specificity - most specific routes first. this is needed so that more specific views don't override less specific		
	_routes.sort((a, b) => {
		const a_source = a.path_regex.source
		const b_source = b.path_regex.source
		
		// Count specific characters (non-regex metacharacters) to determine specificity
		const a_specificity = a_source.replace(/[.*+?^${}()|[\]\\]/g, '').length
		const b_specificity = b_source.replace(/[.*+?^${}()|[\]\\]/g, '').length
		
		// More specific routes (higher character count) come first
		return b_specificity - a_specificity
	})

	let path:string;
	if (window.location.pathname === '/' || window.location.pathname === '' || window.location.pathname === '/index.html') {
		path = 'home'
	} else {
		path = window.location.pathname.slice(3); // remove /v/ prefix
	}

	const pathspec = parsepath(path + window.location.search);
	if (!pathspec) { handle_route_fail(_routes.find(r => r.lazyload_view.name === "appmsgs")!, true); return; }


	try   { await gotoview(pathspec); }
	catch { handle_route_fail(_routes.find(r => r.lazyload_view.name === "appmsgs")!, true); return; }

	const pathspecclone = structuredClone(pathspec) as PathSpecT;
	_history_states.push(pathspecclone);

	if (pathspec.sub) { // this allows a particular view to show up on initial load like, say, a popup of a machine details
		setTimeout(async ()=> {
			try   { await gotoviewsub(pathspec); }
			catch { handle_route_fail(_routes.find(r => r.lazyload_view.name === "appmsgs")!, true); return; }
		}, 200)
	}

	window.addEventListener("popstate", async (_e:PopStateEvent) => {

		const lastpathspec    = structuredClone(_history_states[_history_states.length - 2]) as PathSpecT;
		const currentpathspec = structuredClone(_history_states[_history_states.length - 1]) as PathSpecT;

		_history_states.pop(); // remove last state

		if (currentpathspec.sub && !lastpathspec.sub) {
			CMechBackToJustView(currentpathspec.route.lazyload_view.name, currentpathspec.pathparams, currentpathspec.searchparams);
		}

		else if (lastpathspec.sub) {
			try   { await gotoviewsub(lastpathspec); }
			catch { handle_route_fail(_routes.find(r => r.lazyload_view.name === "appmsgs")!, true); return; }
		}
		else {
			const viewsel = document.getElementById("views") as HTMLElement;
			const allviews = Array.from(viewsel.children) as HTMLElement[];
			const currentview = allviews[allviews.length - 1];
			const previousview = allviews[allviews.length - 2]; 
			viewsel.removeChild(currentview); // remove the last view

			previousview.style.display = "block";
			previousview.dataset.active = "true";
		}
	})

	res(lazyload_view_urlpatterns);
})






async function NavigateTo(path: string) {

	const pathspec = parsepath(path);
	if (!pathspec) { handle_route_fail(_routes.find(r => r.lazyload_view.name === "appmsgs")!, true); return; }

	const pathspecclone = structuredClone(pathspec) as PathSpecT;
	_history_states.push(pathspecclone);
	history.pushState({}, '', '/v/' + path);

	if (!pathspec.sub) {
		try   { await gotoview(pathspec); }
		catch { handle_route_fail(_routes.find(r => r.lazyload_view.name === "appmsgs")!, true); return; }
	}
	else {
		try   { await gotoviewsub(pathspec); }
		catch { handle_route_fail(_routes.find(r => r.lazyload_view.name === "appmsgs")!, true); return; }
	}
}




async function NavigateBack(opts:{ default:str}) {

	const previous_hstory_state = _history_states[_history_states.length - 2];

	if (!previous_hstory_state) {

		if (!opts) opts = { default: "home" };

		const defaultpath = opts.default || "home";
		const pathspec = parsepath(defaultpath);
		if (!pathspec) { handle_route_fail(_routes.find(r => r.lazyload_view.name === "appmsgs")!, true); return; }

		const viewsel = document.getElementById("views") as HTMLElement;
		viewsel.innerHTML = ""; // clear all views

		try   { await gotoview(pathspec); }
		catch { handle_route_fail(_routes.find(r => r.lazyload_view.name === "appmsgs")!, true); return; }

		history.replaceState({}, '', '/v/'+defaultpath);
		_history_states = []
		_history_states.push(pathspec);

		return;
	}
	history.back()
}




function HandleLocalDBSyncUpdateTooLarge() {
	$N.ToastShow("LocalDB Sync Too Large", 4, 5000000)
}




const addroute = (lazyload_view:LazyLoadT) => {

	const {regex, paramnames: pathparams_propnames, pattern} = RegExParams(lazyload_view.urlmatch!)
	_routes.push({ lazyload_view, path_regex: regex, pathparams_propnames });
	return { viewname: lazyload_view.name, pattern }
}




const gotoview = (pathspec: PathSpecT) => new Promise<void>(async (res, rej) => {

	const viewsel    = document.getElementById("views") as HTMLElement;

	try   { await LazyLoadLoadView(pathspec.route.lazyload_view); }
	catch { rej(); return; }

	try   { await CMechAddView(pathspec.route.lazyload_view.name, pathspec.pathparams, pathspec.searchparams, pathspec.route.lazyload_view.localdb_preload); }
	catch { rej(); return; }


	const allviews = Array.from(viewsel.children) as HTMLElement[];
	allviews.forEach((v) => {
		v.style.display = "none";
		v.dataset.active = "false";
	});

	allviews[allviews.length-1].style.display = "block";
	allviews[allviews.length-1].dataset.active = "true";

	document.querySelector("#views")!.dispatchEvent(new Event("visibled"));

	res();
});




const gotoviewsub = (pathspec: PathSpecT) => new Promise<void>(async (res, rej) => {

	const pathparams = { ...pathspec.pathparams, ...pathspec.sub!.pathparams };
	const searchparams = { ...pathspec.searchparams, ...pathspec.sub!.searchparams };

	try   { await CMechParamsChanged(pathspec.route.lazyload_view.name, pathparams, searchparams, pathspec.sub!.loadfunc); }
	catch { rej(); return; }

	res();
})




function parsepath(path:str) : PathSpecT | null {

	const split               = path.split('/s/');
	const qsplit              = path.split('?');
	const subsearchparams_str = qsplit.length > 1 ? qsplit[1] : ''; // the search params if it exists
	const viewpath            = split.length > 1 ? split[0] : qsplit[0]; // the view path without sub path params
	const subpathparams_str   = split.length > 1 ? split[1].slice(0, split[1].indexOf('?')) : ''; // the sub path params if it exists

	let   pathparammatch_values:string[] = []
	let   routematch_index = -1;

    for (let i = 0; i < _routes.length; i++) {
		let pathmatchstr = viewpath.match(_routes[i].path_regex)
		if (pathmatchstr) {   
			pathparammatch_values = pathmatchstr.slice(1);
			routematch_index = i;
			break;
		}
    }

	if (routematch_index === -1) {  return null; }

	const route           = _routes[routematch_index];
	const pathparams      = GetPathParams(route.pathparams_propnames, pathparammatch_values);
	const searchparamsraw = new URLSearchParams(subsearchparams_str);

	const searchparams: GenericRowT = {};
	for (const [key, value] of searchparamsraw.entries()) {
		searchparams[key] = value;
	}

	if (!route.lazyload_view.subs || ( !subpathparams_str && !subsearchparams_str ) ) {
		// no sub anything so just return what we got
		return { route, pathparams:{}, searchparams:{} };
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
		} else {
			if (Object.keys(sub.searchparams_propnames).every(( prop:any )=> searchparams.hasOwnProperty(prop))) {
				sub_details = {
					loadfunc: sub.loadfunc || null,
					pathparams: {},
					searchparams
				}
			}
		}
	}

	debugger
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




const handle_route_fail = (route:Route, redirect:boolean = false) => {

	if (redirect) {
		const routename = route.lazyload_view.name;
		$N.Unrecoverable("Unable to Load Page", "Arg.. Unable to load this page", "Back to Home", "srf", `route: ${routename}`, "/v/home") // switch_station_route_load_fail
	} else {
		$N.ToastShow("Unable to Load Page", 4)
	}

}




export { Init, HandleLocalDBSyncUpdateTooLarge }

if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).SwitchStation = { NavigateTo, NavigateBack };





