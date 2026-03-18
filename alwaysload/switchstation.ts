import { $NT, LazyLoadT, CMechViewT } from  "./../defs.js" 
import { str } from  "../defs_server_symlink.js" 
import { AddView as CMechAddView, UpdateView as CMechUpdateView } from "./cmech.js"
import { RegExParams } from "./switchstation_uri.js"
import { Route, PathSpecT, ParsePath } from "./switchstation_parsepath.js"
import { SlideBack, SlidePhase1, SlidePhase2 } from "./switchstation_animate.js"
import { LoadView as LazyLoadLoadView } from "./lazyload_files.js"
import { WasNativeSwipe, HandleBackSwipeInitListeners } from "./switchstation_handlebackswipe.js"


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

	HandleBackSwipeInitListeners(
		()=>{ /* backswipe_detected - no action needed, previous view is already rendered */ }
	);

	history.scrollRestoration = 'manual';

	GoTo(path)

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
	let   phase1promise:Promise<void>|null = null;

	if (old_view) {
		// Hide all already-inactive views so they don't bleed through when old_view fades in opacity.
		// old_view itself must stay visible for Safari swipe-back.
		const inactive_views = viewsel.querySelectorAll('.view[data-active="false"]');
		for (const v of inactive_views) (v as HTMLElement).style.visibility = 'hidden';

		phase1promise = SlidePhase1(old_view);
	}

	try { 
		await LazyLoadLoadView(pathspec.route.lazyload_view); 
		await CMechAddView(pathspec.route.lazyload_view.name, pathspec.pathparams, pathspec.searchparams, pathspec.route.lazyload_view.localdb_preload||[]); 
		await phase1promise;
	}
	catch { 
		if (old_view) {
			old_view.classList.remove('transition-phase1');
			old_view.style.transformOrigin = '';
		}
		rej(); 
		return; 
	}

	const new_view = viewsel.lastElementChild as HTMLElement & CMechViewT;

	if (old_view) {

		_navstack[_navstack.length - 2].scrollY = window.scrollY;
		$N.Header.set({ ...new_view.header, preserve_title: true });
		await SlidePhase2(old_view, new_view, new_view.header?.title);

		old_view.classList.remove('transition-phase1');
		old_view.style.transformOrigin     = '';

		viewsel.dispatchEvent(new CustomEvent("revealed", {detail: { viewname : pathspec.route.lazyload_view.name }}));

		res();

	} else { // First view - no spinner, just show directly
		$N.Header.set(new_view.header);
		new_view.dataset.active = "true";
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

		const viewsel          = document.getElementById("views")	as HTMLElement;
		const allviews         = Array.from(viewsel.children)		as HTMLElement[];
		const currentview      = allviews[allviews.length - 1]		as HTMLElement;
		const previousview     = allviews[allviews.length - 2]		as HTMLElement & CMechViewT;
		
		const prev_title       = previousview.header?.title;
		
		const viewel   = document.querySelector(`#views > v-${lastpathspec.route.lazyload_view.name}`) as HTMLElement & CMechViewT
		const headerel = document.querySelector('header#viewheader') as HTMLElement;
		$N.Header.set({ ...viewel.header, preserve_title: true });

		headerel.style = ""; // because ol2 (overlay) could have an overlay open which subdues or invisibles the header while open

		if (WasNativeSwipe()) {
			viewsel.removeChild(currentview);
			previousview.dataset.active   = "true";
			const h1 = document.querySelector('#viewheader .middle h1') as HTMLElement | null;
			if (h1) h1.textContent = prev_title;
		} else {
			previousview.classList.remove('readyforswipeback');
			await SlideBack(currentview, previousview, prev_title, lastpathspec.scrollY);
			viewsel.removeChild(currentview);
		}

		// Un-hide the view behind the now-active view so it's ready for swipe-back
		const remaining_views = Array.from(viewsel.children) as HTMLElement[];
		if (remaining_views.length >= 2) {
			remaining_views[remaining_views.length - 2].style.visibility = '';
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
