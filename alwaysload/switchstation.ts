

import { $NT, GenericRowT, LazyLoadT } from  "./../defs.js" 
import { str, num } from  "../defs_server_symlink.js" 
//import { Run as LazyLoadFilesRun } from './lazyload_files.js'
import { AddView as CMechAddView, SearchParamsChanged as CMechSearchParamsChanged, RemoveActiveView as CMechRemoveActiveView, PathParamsChanged as CMechPathParamsChanged } from "./cmech.js"
import { RegExParams, GetPathParams } from "./switchstation_uri.js"
import { Init as LazyLoadFilesInit, LoadView as LazyLoadLoadView } from "./lazyload_files.js"

declare var $N: $NT;

type Route = {
	lazyload_view: LazyLoadT
	path_regex: RegExp
	subpaths: {
		path_regex: RegExp,
		pathparams_propnames: Array<str>,
		loadfunc?: str
	}[],
	pathparams_propnames: Array<str>
}

type HistoryStateT = {
	path: str,
	type: "view" | "sub" | "search",
	routeindex: num
}

let _routes:Array<Route> = [];
let _history_states:Array<HistoryStateT> = [];




const Init = (lazyloads:LazyLoadT[])=> new Promise<str[][]>(async (res, _rej) => {

	LazyLoadFilesInit(lazyloads);

	const lazyload_view_urlpatterns = lazyloads.filter(l => l.type === "view").map(r => addroute(r)).map(l=> [l.viewname, l.pattern])

	// Sort routes by specificity - most specific routes first
	_routes.sort((a, b) => {
		const a_source = a.path_regex.source
		const b_source = b.path_regex.source
		
		// Count specific characters (non-regex metacharacters) to determine specificity
		const a_specificity = a_source.replace(/[.*+?^${}()|[\]\\]/g, '').length
		const b_specificity = b_source.replace(/[.*+?^${}()|[\]\\]/g, '').length
		
		// More specific routes (higher character count) come first
		return b_specificity - a_specificity
	})

	const parsedpath = parsepath(window.location.pathname);

	/*
	try   { await setuproute(window.location.pathname.slice(3)); } // remove /v/ prefix
	catch { handle_route_fail(_routes.find(r => r.lazyload_view.name === "appmsgs")!, true); return; }

	const p = window.location.pathname + window.location.search
	const historystate = { type: "view", path:p } as HistoryStateT
	_history_states.push(historystate);
	history.replaceState(historystate, '', p);
	*/

	window.addEventListener("popstate", async (e:PopStateEvent) => {

		const state = e.state as HistoryStateT;
		const laststate = structuredClone(_history_states[_history_states.length - 1]);
		_history_states.pop(); // remove last state

		if (state.type === "view" && laststate.type === "view") {
			CMechRemoveActiveView()
			if (document.getElementById("views")!.children.length === 0) {
				try   { await setuproute("home"); } 
				catch { handle_route_fail(_routes.find(r => r.lazyload_view.name === "appmsgs")!, true); return; }
			}
			else {
				const viewel = document.querySelector("#views > :last-child") as HTMLElement;
				viewel.style.display = "block";
				viewel.dataset.active = "true"
			}
		}

		else if (state.type === "sub") {
			try   { await setuproute_sub(state.path); }
			catch { handle_route_fail(_routes.find(r => r.lazyload_view.name === "appmsgs")!, true); return; }
		}

		else if (state.type === "search") {
			CMechSearchParamsChanged(new URLSearchParams(state.path.split('?')[1]))
		}

		else if (state.type === "view" && laststate.type === "sub") {
			try   { await setuproute_sub(state.path); }
			catch { handle_route_fail(_routes.find(r => r.lazyload_view.name === "appmsgs")!, true); return; }
		}
	})

	res(lazyload_view_urlpatterns)



	/*
	const pathname        = window.location.pathname.slice(3)
    const searchParams    = window.location.search ? window.location.search : '';
    const initialPath     = window.location.pathname + searchParams;
	*/

	/*
    if (!history.state || history.state.index === undefined) {
		await routeChanged(pathname, 'firstload');
        history.replaceState({ index: 0, path: initialPath  }, '', initialPath);
    } else {
		await routeChanged(pathname, 'firstload');
    }
	*/




	/*
	window.addEventListener("touchstart", (e: TouchEvent) => {
		const touch = e.touches[0];
		if (touch.clientX < 50 && touch.clientY > 60) {
			isSwipeBackGesture = true;
		}
	})


	window.addEventListener("touchmove", (_e: TouchEvent) => {
	})


	window.addEventListener("touchend", () => {
		setTimeout(() => isSwipeBackGesture = false, 600)
	})


	*/
})






async function NavigateTo(path: string) {

    const [urlmatches, routeindex] = get_view_route_uri(viewpath);
	if (routeindex === -1) { console.log('route not found for', viewpath); return; }


	const historystate:HistoryStateT = {path:viewpath, type:"view", routeindex};
	history.pushState({}, '', '/v/'+viewpath);
	_history_states.push(historystate);

	try   { await setuproute(newPath); }
	catch { return; }

}




async function NavigateBack(opts:{ default:str}) {

	const current_hstory_state = _history_states[_history_states.length - 1];

	if (current_hstory_state.type === 'view' && document.getElementById("views")!.children.length === 1) {
		const defaultpath = opts.default || "home";
		CMechRemoveActiveView()
		const historystate = {path: '/v/'+defaultpath, type:"view"} as HistoryStateT
		history.replaceState(historystate, '', '/v/'+defaultpath);
		try   { await setuproute(defaultpath); }
		catch { return; }

		return;
	}
	history.back()
}

async function NavigateToSub(subpath: string) {

	/*
	const p = "/v/" + newPath;
	const historystate = {path:p, type: "sub"} as HistoryStateT
	history.pushState(historystate, '', p);
	_history_states.push(historystate);
	*/

	try   { await setuproute_sub(subpath); }
	catch { return; }

}




async function NavigateToSearch(newsearchparams:GenericRowT) {

	const searchparams = new URLSearchParams(window.location.search);
	Object.entries(newsearchparams).forEach(([key, value]) => {
		searchparams.set(key, value);
	});

	const searchparams_str = searchparams.toString();
	const newhistoryurl = window.location.pathname + '?' + searchparams_str;
	const historystate = { path: newhistoryurl, type: "search" } as HistoryStateT
    history.pushState(historystate, '', newhistoryurl);

	CMechSearchParamsChanged(newsearchparams)
}




function HandleLocalDBSyncUpdateTooLarge() {
	$N.ToastShow("LocalDB Sync Too Large", 4, 5000000)
}




const addroute = (lazyload_view:LazyLoadT) => {

	const {regex, paramnames: pathparams_propnames, pattern} = RegExParams(lazyload_view.urlmatch!)

	const subpaths:{ path_regex:RegExp, pathparams_propnames:Array<str>, loadfunc?:str }[] = [];

	if (lazyload_view.subs && lazyload_view.subs.length) {
		lazyload_view.subs.forEach((sub) => {
			const {regex: submatch_regex, paramnames: submatch_pathparams_propnames} = RegExParams(sub.urlmatch);
			subpaths.push({
				path_regex: submatch_regex,
				pathparams_propnames: submatch_pathparams_propnames,
				loadfunc: sub.loadfunc
			});
		})
	}

	_routes.push({ lazyload_view, path_regex: regex, pathparams_propnames, subpaths });

	return { viewname: lazyload_view.name, pattern }
}




const setuproute = (path: string) => new Promise<num|null>(async (res, rej) => {

    const [urlmatches, routeindex] = get_view_route_uri(path);

	if (routeindex !== -1) { // view route found

		try   { await LazyLoadLoadView(_routes[routeindex].lazyload_view); }
		catch { handle_route_fail(_routes[routeindex], true); rej(null); return; }

		const viewsel    = document.getElementById("views") as HTMLElement;

		const loadresult = await routeload(routeindex, path, urlmatches);

		if (loadresult === 'failed') { handle_route_fail(_routes[routeindex], true); rej(null); return; }

		const allviews = Array.from(viewsel.children) as HTMLElement[];
		allviews.forEach((v) => {
			v.style.display = "none";
			v.dataset.active = "false";
		});

		allviews[allviews.length-1].style.display = "block";
		allviews[allviews.length-1].dataset.active = "true";

		document.querySelector("#views")!.dispatchEvent(new Event("visibled"));

		res(1);

	}
	else { 
		rej(null);
	}

});




const setuproute_sub = (subpath: string) => new Promise<num|null>(async (res, rej) => {

		const viewsel          = document.getElementById("views")!
		const viewel           = viewsel.lastElementChild!
		const active_view_name = viewel.tagName.toLowerCase().split("-")[1];
		const current_route    = _routes.find(r => r.lazyload_view.name === active_view_name)!;
		let   flag             = false;

		if (current_route.subpaths.length) {
			for (const submatch of current_route.subpaths) {
				const matches = path.match(submatch.path_regex);
				if (matches) {
					const subparams = matches.length > 1 ? GetPathParams(submatch.pathparams_propnames, matches.slice(1)) : {};
					try   { await CMechPathParamsChanged(current_route.lazyload_view.name, subparams, submatch.loadfunc); }
					catch { handle_route_fail(current_route, true); rej(null); return; }
					flag = true;
					break;
				}
			}
		}

		if (!flag) {  
			try		{ await CMechPathParamsChanged(current_route.lazyload_view.name, {}); }
			catch   { handle_route_fail(current_route, true); rej(null); return; }
			flag = true;
		}

		res(1);
})




const routeload = (routeindex:num, _uri:str, urlmatches:str[]) => new Promise<string>( async (res, _rej) => {
	 
	const route           = _routes[routeindex];

	const pathparams      = GetPathParams(route.pathparams_propnames, urlmatches);
	const searchparams    = new URLSearchParams(window.location.search);

	const localdb_preload = route.lazyload_view.localdb_preload

	const promises:Promise<any>[] = []

	promises.push( CMechAddView(route.lazyload_view.name, pathparams, searchparams, localdb_preload) )

	try   { await Promise.all(promises) }
	catch { res('failed'); return; }

	res('success')
})




function parsepath(pathfull:str) {

	const path = pathfull.slice(3); // remove /v/ prefix
	const historystate = _history_states[_history_states.length - 1];

    for (let i = 0; i < _routes.length; i++) {
		let pathmatchstr = path.match(_routes[i].path_regex)
		if (pathmatchstr) {   return [ pathmatchstr.slice(1), i ];   }
    }
    return [ [], -1 ]// catch all if not route

	/*
    const [urlmatches, routeindex] = get_view_route_uri(viewpath);
	if (routeindex === -1) { console.log('route not found for', viewpath); return; }


	//const historystate:HistoryStateT = {path:viewpath, type:"view", routeindex};
	history.pushState({}, '', '/v/'+viewpath);
	_history_states.push(historystate);
	*/
}




function get_view_route_uri(url: str) : [Array<str>, num] {

    for (let i = 0; i < _routes.length; i++) {
		let urlmatchstr = url.match(_routes[i].path_regex)
		if (urlmatchstr) {   return [ urlmatchstr.slice(1), i ];   }
    }
    return [ [], -1 ]// catch all if not route
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





