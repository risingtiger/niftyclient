

import { $NT, GenericRowT, LazyLoadT } from  "./../defs.js" 
import { str, num } from  "../defs_server_symlink.js" 
//import { Run as LazyLoadFilesRun } from './lazyload_files.js'
import { AddView as CMechAddView, SearchParamsChanged as CMechSearchParamsChanged } from "./cmech.js"
import { RegExParams, GetPathParams } from "./switchstation_uri.js"
import { Init as LazyLoadFilesInit, LoadView as LazyLoadLoadView } from "./lazyload_files.js"

declare var $N: $NT;

type Route = {
	lazyload_view: LazyLoadT
	path_regex: RegExp
	pathparams_propnames: Array<str>
}

let _routes:Array<Route> = [];




const Init = (lazyloads:LazyLoadT[])=> {

	LazyLoadFilesInit(lazyloads);

	const lazyload_view_urlpatterns = lazyloads.filter(l => l.type === "view").map(r => addroute(r)).map(l=> [l.viewname, l.pattern])

	const pathname        = window.location.pathname.slice(3)

	setuproute(pathname);

	return lazyload_view_urlpatterns



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


	window.addEventListener("popstate", async (e) => {
		if (e.state) routeChanged(e.state.path, 'back')
	})
	*/
}






async function NavigateTo(newPath: string) {
	//window.location.href = "/v/" + newPath;
	history.pushState({ }, '', newPath);
	setuproute(newPath)
}




async function NavigateBack(opts:{ default:str}) {
	if (history.state && history.state.index > 0) {
		// There is history to go back to
		window.location.href = document.referrer || ("/v/" + opts.default);
	}
	else {
		// No history, go to default
		window.location.href = "/v/" + opts.default;
	}


	/*
    const r = await routeChanged(newPath, 'forward');
	if (r === null) { 
		return; 
	}

	newPath = "/v/" + newPath

    history.pushState({ index: history.state.index+1, path: newPath }, '', newPath);
	*/
}




async function UpdateSearchParams(newsearchparams:GenericRowT) {

	const searchparams = new URLSearchParams(window.location.search);
	Object.entries(newsearchparams).forEach(([key, value]) => {
		searchparams.set(key, value);
	});

	window.location.search = searchparams.toString();

	//const searchparams_str = searchparams.toString();

	//const newhistoryurl = window.location.pathname + '?' + searchparams_str;

    //history.pushState({ index: history.state.index+1, path: newhistoryurl }, '', newhistoryurl);

	CMechSearchParamsChanged(newsearchparams)
}




function HandleLocalDBSyncUpdateTooLarge() {
	$N.ToastShow("LocalDB Sync Too Large", 4, 5000000)
}




const addroute = (lazyload_view:LazyLoadT) => {

	const {regex, paramnames: pathparams_propnames, pattern} = RegExParams(lazyload_view.urlmatch!)
	_routes.push({ lazyload_view, path_regex: regex, pathparams_propnames })

	return { viewname: lazyload_view.name, pattern }
}




const setuproute = (path: string) => new Promise<num|null>(async (res, _rej) => {

    const [urlmatches, routeindex] = get_route_uri(path);
	try   { await LazyLoadLoadView(_routes[routeindex].lazyload_view); }
	catch {
		handle_route_fail(_routes[routeindex], true)
		res(null);
		return;
	}

	const viewsel            = document.getElementById("views") as HTMLElement;



	const loadresult = await routeload(routeindex, path, urlmatches);

	if (loadresult === 'failed') {
		handle_route_fail(_routes[routeindex], true)
		res(null);
		return;
	}

	( viewsel.children[viewsel.children.length-1] as HTMLElement ).style.display = "block";
	( viewsel.children[viewsel.children.length-1] as HTMLElement ).dataset.active = "true"

	document.querySelector("#views")!.dispatchEvent(new Event("visibled"));

	res(1);
})



/*
const old__routeChanged = (path: string, direction:'firstload'|'back'|'forward' = 'firstload') => new Promise<num|null>(async (res, _rej) => {

	const viewsel            = document.getElementById("views") as HTMLElement;

    const [urlmatches, routeindex] = get_route_uri(path);

    if (direction === "firstload") {

		const loadresult = await routeload(routeindex, path, urlmatches, "beforeend");

		if (loadresult === 'failed') {
			handle_route_fail(_routes[routeindex], true)
			res(null);
			return;
		}

		( viewsel.children[0] as HTMLElement ).style.display = "block";
		( viewsel.children[0] as HTMLElement ).dataset.active = "true"

		document.querySelector("#views")!.dispatchEvent(new Event("visibled"));
    }

    else if (direction === "forward") {

		const loadresult = await routeload(routeindex, path, urlmatches, "beforeend");

		if (loadresult === 'failed') {
			handle_route_fail(_routes[routeindex])
			res(null);
			return;
		}

        const activeview = viewsel.children[viewsel.children.length - 1] as HTMLElement;
        activeview.classList.add("next_startstate");
        activeview.style.display = "block";
        activeview.offsetHeight; // force reflow
        activeview.classList.remove("next_startstate");

        const previousview = activeview.previousElementSibling as HTMLElement;
        if (previousview) {
            previousview.classList.add("previous_endstate");
        }

        activeview.addEventListener("transitionend", function activeTransitionEnd() {
            if (previousview) {
                previousview.style.display = "none";
                previousview.dataset.active = "false";
            }
            activeview.dataset.active = "true";
            activeview.removeEventListener("transitionend", activeTransitionEnd);

			document.querySelector("#views")!.dispatchEvent(new Event("visibled"));
        });
    }

    else if (direction === "back") {

        const activeview = viewsel.children[viewsel.children.length - 1] as HTMLElement;
        let previousview = activeview?.previousElementSibling as HTMLElement;
        
        activeview.dataset.active = "false";


        if (isSwipeBackGesture) {
            activeview.remove();
			previousview.classList.remove("previous_endstate");
			await new Promise((res, _rej) => setTimeout(res, 100));
			previousview.style.display = "block";
            previousview.dataset.active = "true";
            document.querySelector("#views")!.dispatchEvent(new Event("view_load_done"));
            res(1);
            return;
        }

        if (!previousview) {
			const loadresult = await routeload(routeindex, path, urlmatches, "afterbegin");

            if (loadresult === "failed") {
				handle_route_fail(_routes[routeindex])
				res(null);
				return;
            }
            previousview = activeview?.previousElementSibling as HTMLElement;
        }

		previousview.style.display = "block";
        activeview.offsetHeight; // force reflow
        activeview.classList.add("active_endstate");
        previousview.classList.remove("previous_endstate");

        activeview.addEventListener("transitionend", function activeTransitionEnd() {
            activeview.remove();
            const previous_previousview = previousview?.previousElementSibling as HTMLElement;
            if (previous_previousview) {
            }
            previousview.dataset.active = "true";
            activeview.removeEventListener("transitionend", activeTransitionEnd);

			document.querySelector("#views")!.dispatchEvent(new Event("visibled"));
        });
    }

	res(1);
})
*/





const routeload = (routeindex:num, _uri:str, urlmatches:str[]) => new Promise<string>( async (res, _rej) => {
	 
	const route           = _routes[routeindex];

	const pathparams      = GetPathParams(route.pathparams_propnames, urlmatches);
	const searchparams    = new URLSearchParams(window.location.search);

	const localdb_preload = route.lazyload_view.localdb_preload

	const promises:Promise<any>[] = []

	//promises.push( LazyLoadFilesRun([route.lazyload_view]) )
	promises.push( CMechAddView(route.lazyload_view.name, pathparams, searchparams, localdb_preload) )

	try   { await Promise.all(promises) }
	catch { res('failed'); return; }

	res('success')
})




const loadlazies = (lazyload_view:LazyLoadT) => new Promise<void>(async (res, _rej) => {
})




function get_route_uri(url: str) : [Array<str>, num] {

    for (let i = 0; i < _routes.length; i++) {

		let urlmatchstr = url.match(_routes[i].path_regex)

		if (urlmatchstr) { 
			return [ urlmatchstr.slice(1), i ]
		}
    }

    // catch all -- just route to home
    return [ [], _routes.findIndex(r=> r.lazyload_view.name==="home")! ]
}




const handle_route_fail = (route:Route, redirect:boolean = false) => {

	if (redirect) {
		const routename = route.lazyload_view.name;
		$N.Unrecoverable("App Load Error", "Unable to Load App Page", "Restart App", "srf", `route:${routename}`, null) // switch_station_route_load_fail
	} else {
		$N.ToastShow("Unable to Load View", 4)
	}

}




export { Init, HandleLocalDBSyncUpdateTooLarge }

if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).SwitchStation = { NavigateTo, NavigateBack, UpdateSearchParams };





