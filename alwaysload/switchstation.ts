

import { $NT, GenericRowT, LazyLoadT } from  "./../defs.js" 
import { str, num } from  "../defs_server_symlink.js" 
//import { Run as LazyLoadFilesRun } from './lazyload_files.js'
import { AddView as CMechAddView, SearchParamsChanged as CMechSearchParamsChanged, RemoveActiveView as CMechRemoveActiveView, LoadUrlSubMatch as CMechLoadUrlSubMatch } from "./cmech.js"
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

let _routes:Array<Route> = [];




const Init = async (lazyloads:LazyLoadT[])=> {

	LazyLoadFilesInit(lazyloads);

	const lazyload_view_urlpatterns = lazyloads.filter(l => l.type === "view").map(r => addroute(r)).map(l=> [l.viewname, l.pattern])

	try   { await setuproute(window.location.pathname.slice(3)); } // remove /v/ prefix
	catch { handle_route_fail(_routes.find(r => r.lazyload_view.name === "appmsgs")!, true); return; }

	history.replaceState({}, '', window.location.pathname);

	window.addEventListener("popstate", async (_e:PopStateEvent) => {
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
	})

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


	*/
}






async function NavigateTo(newPath: string) {

	const p = "/v/" + newPath;
	try   { await setuproute(newPath); }
	catch { return; }

	history.pushState({path:p}, '', p);
}




async function NavigateBack(opts:{ default:str}) {

	if (document.getElementById("views")!.children.length === 1) {
		const defaultpath = opts.default || "home";
		CMechRemoveActiveView()
		history.replaceState({path: '/v/'+defaultpath}, '', '/v/'+defaultpath);
		try   { await setuproute(defaultpath); }
		catch { return; }

		return;
	}
	history.back()
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
		allviews[allviews.length-1].dataset.active = "true"

		// this event should fire after the animation is done and the view is visible and still
		document.querySelector("#views")!.dispatchEvent(new Event("visibled"));

		res(1);

	}
	else { 
		// no view route found, check urlsubmatches of current view
		const viewsel          = document.getElementById("views")!
		const viewel           = viewsel.lastElementChild!
		const active_view_name = viewel.tagName.toLowerCase().split("-")[1];
		const current_route    = _routes.find(r => r.lazyload_view.name === active_view_name)!;
		let   flag             = false;

		if (current_route.subpaths.length) {
			for (const submatch of current_route.subpaths) {
				const matches = path.match(submatch.path_regex);
				if (matches) {
					const subparams = matches.length > 1 ? GetPathParams(submatch.pathparams_propnames, matches.slice(1)) : {}; // if there are params in sub url match such as "machines/:machineid" then get the params otherwise empty object 
					try   { await CMechLoadUrlSubMatch(current_route.lazyload_view.name, subparams, submatch.loadfunc); }
					catch { handle_route_fail(current_route, true); rej(null); return; }
					flag = true;
					break;
				}
			}
		}

		if (!flag) { handle_route_fail(current_route, true); rej(null); return; }

		res(1)
	}

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

	promises.push( CMechAddView(route.lazyload_view.name, pathparams, searchparams, localdb_preload) )

	try   { await Promise.all(promises) }
	catch { res('failed'); return; }

	res('success')
})





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
		$N.Unrecoverable("App Load Error", "Unable to Load App Page", "Restart App", "srf", `route:${routename}`, null) // switch_station_route_load_fail
	} else {
		$N.ToastShow("Unable to Load View", 4)
	}

}




export { Init, HandleLocalDBSyncUpdateTooLarge }

if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).SwitchStation = { NavigateTo, NavigateBack, UpdateSearchParams };





