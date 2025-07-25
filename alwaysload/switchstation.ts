


// TODO: Go to a popup like machine details. Refresh. It will automatically bring the popup back up. Thats cool. But then click away from the popup. A back is triggered, but it goes all the way back home




import { $NT, LazyLoadT } from  "./../defs.js" 
import { str } from  "../defs_server_symlink.js" 
//import { Run as LazyLoadFilesRun } from './lazyload_files.js'
import { AddView as CMechAddView, ParamsChanged as CMechParamsChanged, BackToJustView as CMechBackToJustView } from "./cmech.js"
import { RegExParams } from "./switchstation_uri.js"
import { Route, PathSpecT, ParsePath } from "./switchstation_parsepath.js"
import { Slide } from "./switchstation_animate.js"
import { Init as LazyLoadFilesInit, LoadView as LazyLoadLoadView } from "./lazyload_files.js"
import { back_swipe_handler } from "./switchstation_handlebackswipe.js"

declare var $N: $NT;


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

	const pathspec = ParsePath(path + window.location.search, _routes);
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

	// Set up callback for native swipe preparation
	back_swipe_handler.on_prepare_view(() => {
		const viewsel = document.getElementById("views") as HTMLElement;
		const allviews = Array.from(viewsel.children) as HTMLElement[];
		if (allviews.length >= 2) {
			const previousview = allviews[allviews.length - 2];
			// Prepare previous view for native swipe animation
			previousview.style.visibility = "visible";
			previousview.style.opacity = "1";
			previousview.style.transform = "translate3d(0, 0, 0)";
		}
	});

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
			
			// Check if this was a native iOS swipe
			const was_native_swipe = back_swipe_handler.was_native_swipe();
			
			viewsel.removeChild(currentview); // remove the last view

			if (!was_native_swipe) {
				// Only set styles if not a native swipe (native swipe already animated)
				previousview.style.visibility = "visible";
				previousview.style.opacity = "1";
				previousview.style.transform = "translate3d(0, 0, 0)";
			}
			previousview.dataset.active = "true";
		}
	})

	res(lazyload_view_urlpatterns);
})






async function NavigateTo(path: string) {

	const pathspec = ParsePath(path, _routes);
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
		const pathspec = ParsePath(defaultpath, _routes);
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

	const viewsel = document.getElementById("views") as HTMLElement;
	const old_view = viewsel.querySelector('[data-active="true"]') as HTMLElement | null;

	try   { await LazyLoadLoadView(pathspec.route.lazyload_view); }
	catch { rej(); return; }

	try   { await CMechAddView(pathspec.route.lazyload_view.name, pathspec.pathparams, pathspec.searchparams, pathspec.route.lazyload_view.localdb_preload); }
	catch { rej(); return; }

	const new_view = viewsel.lastElementChild as HTMLElement;

	if (old_view) {
		Slide(old_view, new_view);
		const animation_listener = () => {
			viewsel.dataset.active = "true";
			viewsel.removeEventListener("animationcomplete", animation_listener);
			viewsel.dispatchEvent(new Event("visibled"));
			res();
		};
		viewsel.addEventListener("animationcomplete", animation_listener);

	} else { // First view
		new_view.dataset.active = "true";
		new_view.style.opacity = "1";
		new_view.style.visibility = "visible";
		new_view.style.transform = "translate3d(0, 0, 0)";
		document.querySelector("#views")!.dispatchEvent(new Event("visibled"));
		res();
	}
});




const gotoviewsub = (pathspec: PathSpecT) => new Promise<void>(async (res, rej) => {

	const pathparams = { ...pathspec.pathparams, ...pathspec.sub!.pathparams };
	const searchparams = { ...pathspec.searchparams, ...pathspec.sub!.searchparams };

	try   { await CMechParamsChanged(pathspec.route.lazyload_view.name, pathparams, searchparams, pathspec.sub!.loadfunc); }
	catch { rej(); return; }

	res();
})




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





