import { $NT, LazyLoadT } from  "./../defs.js" 
import { str } from  "../defs_server_symlink.js" 
import { AddView as CMechAddView, UpdateView as CMechUpdateView } from "./cmech.js"
import { RegExParams } from "./switchstation_uri.js"
import { Route, PathSpecT, ParsePath } from "./switchstation_parsepath.js"
import { Slide, SlideBack } from "./switchstation_animate.js"
import { LoadView as LazyLoadLoadView } from "./lazyload_files.js"
import { back_swipe_handler } from "./switchstation_handlebackswipe.js"

declare var $N: $NT;


let _routes:Array<Route> = [];
let _navstack:Array<PathSpecT> = [];




const Init = ()=> new Promise<void>(async (res, _rej) => {

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
		path = window.location.pathname.slice(3) + window.location.search // remove /v/ prefix and combine in search
	}


	GoTo(path)


	// Set up callback for native swipe preparation
	back_swipe_handler.on_prepare_view(() => {
		const viewsel = document.getElementById("views") as HTMLElement;
		const allviews = Array.from(viewsel.children) as HTMLElement[];
		if (allviews.length >= 2) {
			const previousview = allviews[allviews.length - 2] as HTMLElement;
			// Prepare previous view for native swipe animation
			previousview.getAnimations().forEach(anim => anim.cancel());
			previousview.style.visibility = "visible";
			previousview.style.opacity = "1";
			previousview.style.transform = "none";
		}
	});



	window.addEventListener("popstate", on_popstate)

	res();
})




async function GoTo(path: string, opts?:{replacestate?:boolean}) {

	const pathspec = ParsePath(path, _routes);
	if (!pathspec) { route_failed(_routes.find(r => r.lazyload_view.name === "appmsgs")!, "unable to parse path", true); return; }

	let currentpathspec:PathSpecT|null;

	if (!_navstack.length) {   
		currentpathspec = null;
		history.replaceState({}, '', '/v/' + path);   
	} else {   
		currentpathspec = _navstack[_navstack.length-1];
		if (opts?.replacestate) {
			history.replaceState({}, '', '/v/' + path);
			_navstack.pop();
		} else {
			history.pushState({}, '', '/v/' + path);
		}
	}

	const pathspecclone = structuredClone(pathspec) as PathSpecT;
	_navstack.push(pathspecclone);
	

	if (!currentpathspec || currentpathspec.route.lazyload_view.name !== pathspec.route.lazyload_view.name) { // going to different view (or initial view)
		try   { await activate_view(pathspec); }
		catch { route_failed(_routes.find(r => r.lazyload_view.name === "appmsgs")!, "unable to activate view", true); return; }
	}
	else {
		try   { await paramschanged(pathspec); }
		catch { route_failed(_routes.find(r => r.lazyload_view.name === "appmsgs")!, "unable to activate subview", true); return; }
	}

	$N.Logger.log(20, 'srg', `${path}`)

	return;
}




async function GoBack(opts?:{ default?:str}) {

	const previous_pathspec = _navstack[_navstack.length - 2];

	if (!previous_pathspec) { await fallback(opts?.default || "home"); return; }

	history.back()
}




function Get_Lazyload_View_Url_Patterns (lazyloads:LazyLoadT[]) : str[][] {
	return lazyloads.filter(l => l.type === "view").map(r => register_route(r)).map(l=> [l.viewname, l.pattern])
}




const register_route = (lazyload_view:LazyLoadT) => {

	const {regex, paramnames: pathparams_propnames, pattern} = RegExParams(lazyload_view.urlmatch!)
	_routes.push({ lazyload_view, path_regex: regex, pathparams_propnames });
	return { viewname: lazyload_view.name, pattern }
}




const activate_view = (pathspec: PathSpecT) => new Promise<void>(async (res, rej) => {

	const viewsel = document.getElementById("views") as HTMLElement;
	const old_view = viewsel.querySelector('[data-active="true"]') as HTMLElement | null;

	try { 
		await LazyLoadLoadView(pathspec.route.lazyload_view); 
		await CMechAddView(pathspec.route.lazyload_view.name, pathspec.pathparams, pathspec.searchparams, pathspec.route.lazyload_view.localdb_preload||[]); 
	}
	catch { rej(); return; }

	const new_view = viewsel.lastElementChild as HTMLElement;

	if (old_view) {
		Slide(old_view, new_view);
		const animation_listener = () => {
			viewsel.dataset.active = "true";
			viewsel.removeEventListener("animationcomplete", animation_listener);
			viewsel.dispatchEvent(new CustomEvent("revealed", {detail: { viewname : pathspec.route.lazyload_view.name }}));
			res();
		};
		viewsel.addEventListener("animationcomplete", animation_listener);

	} else { // First view
		new_view.dataset.active = "true";
		new_view.style.opacity = "1";
		new_view.style.visibility = "visible";
		new_view.style.transform = "translate3d(0, 0, 0)";
		document.querySelector("#views")!.dispatchEvent(new CustomEvent("revealed", {detail: { viewname : pathspec.route.lazyload_view.name }}));
		res();
	}
});




const paramschanged = (pathspec: PathSpecT) => new Promise<void>(async (res, rej) => {
	try   { await CMechUpdateView(pathspec.route.lazyload_view.name, pathspec.pathparams, pathspec.searchparams, 'paramschanged'); }
	catch { rej(); return; }
	res();
})




const fallback = async (defaultpath: string = "home") => {

	const pathspec = ParsePath(defaultpath, _routes);
	if (!pathspec) { route_failed(_routes.find(r => r.lazyload_view.name === "appmsgs")!, "unable to navigate to default. ParsePath method failed", true); return; }

	const viewsel = document.getElementById("views") as HTMLElement;
	viewsel.innerHTML = ""; // clear all views

	try   { await activate_view(pathspec); }
	catch { route_failed(_routes.find(r => r.lazyload_view.name === "appmsgs")!, "unable to activate default view", true); return; }

	history.replaceState({}, '', '/v/' + defaultpath);
	_navstack = [];
	_navstack.push(pathspec);
}




const on_popstate = async (_event: PopStateEvent) => {
	
	if (_navstack.length < 2) { await fallback(); return; }

	const lastpathspec    = structuredClone(_navstack[_navstack.length - 2]) as PathSpecT;
	const currentpathspec = structuredClone(_navstack[_navstack.length - 1]) as PathSpecT;

	_navstack.pop(); // remove last state

	if (currentpathspec.route.lazyload_view.name !== lastpathspec.route.lazyload_view.name) { // going back to different view

		const viewsel = document.getElementById("views") as HTMLElement;
		const allviews = Array.from(viewsel.children) as HTMLElement[];
		const currentview = allviews[allviews.length - 1] as HTMLElement;
		const previousview = allviews[allviews.length - 2] as HTMLElement;
		
		const was_native_swipe = back_swipe_handler.was_native_swipe();
		
		if (was_native_swipe) {
			viewsel.removeChild(currentview);
			previousview.dataset.active = "true";
			previousview.getAnimations().forEach(anim => anim.cancel());
			previousview.style.transform = "none";
			previousview.style.opacity = "1";
			previousview.style.visibility = "visible";
		} else {
			await SlideBack(currentview, previousview);
			viewsel.removeChild(currentview);
		}
		
		return
	}


	// same view, but different path params

	try   { await paramschanged(lastpathspec); }
	catch { route_failed(_routes.find(r => r.lazyload_view.name === "appmsgs")!, "unable to navigate back to sub", true); return; }
	return
}




const route_failed = (route:Route, msg:string, redirect:boolean = false) => {

	if (redirect) {
		const routename = route.lazyload_view.name;
		$N.Unrecoverable("Unable to Load Page", msg, "Back to Home", "srf", `route: ${routename}`, "/v/home") // switch_station_route_load_fail
	} else {
		$N.ToastShow(msg, 'error')
	}

}




export { Init, Get_Lazyload_View_Url_Patterns }

if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).SwitchStation = { GoTo, GoBack };
