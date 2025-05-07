

import { $NT, GenericRowT, LazyLoadT, LoggerSubjectE } from  "./../defs.js" 
import { str, num } from  "../../defs_server_symlink.js" 
import { Run as LazyLoadRun } from './lazyload.js'
import { AddView as CMechAddView, SearchParamsChanged as CMechSearchParamsChanged } from "./cmech.js"
import { RegExParams, GetPathParams } from "./switchstation_uri.js"

declare var $N: $NT;

type Route = {
	lazyload_view: LazyLoadT
	path_regex: RegExp
	pathparams_propnames: Array<str>
}

let isSwipeBackGesture   = false;
let _routes:Array<Route> = [];
let db:IDBDatabase|null  = null;

let _localdb_objectstores:any[] = [] 
let _db_name = ""
let _db_version = 0



const Init = async (localdb_objectstores: {name:str,indexes?:str[]}[], db_name: str, db_version: num)=> {

	// will probably completely remove this from switchstation
	_localdb_objectstores = localdb_objectstores
	_db_name              = db_name
	_db_version           = db_version

	const pathname        = window.location.pathname.slice(3)
    const searchParams    = window.location.search ? window.location.search : '';
    const initialPath     = window.location.pathname + searchParams;

    if (!history.state || history.state.index === undefined) {
		await routeChanged(pathname, 'firstload');
        history.replaceState({ index: 0, path: initialPath  }, '', initialPath);
    } else {
		await routeChanged(pathname, 'firstload');
    }




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
}



const AddRoute = (lazyload_view:LazyLoadT)=> {
	const {regex, paramnames: pathparams_propnames} = RegExParams(lazyload_view.urlmatch!)
	_routes.push({ lazyload_view, path_regex: regex, pathparams_propnames })
}




async function NavigateTo(newPath: string) {

    const r = await routeChanged(newPath, 'forward');
	if (r === null) { 
		$N.ToastShow("Network down. Could not navigate to page", 4, 5000000)
		return; 
	}

	newPath = "/v/" + newPath

    history.pushState({ index: history.state.index+1, path: newPath }, '', newPath);
}




async function NavigateBack(opts:{ default:str}) {


	console.log(`
	NEED TO HANDLE THIS SO THAT IF NAVIGATING BACK, BUT BACK IS JUST A SEARCHPARAMS CHANGE, THEN DONT CALL routeChanged
	just call CMechUpdateFromSearchParams
	`)

	if (history.state && history.state.index > 0) {
		await routeChanged(opts.default, 'back');
		history.back();
	}
	else {
		await routeChanged(opts.default, 'back');
		history.replaceState({ index: 0, path: opts.default }, '', opts.default);
	}
}




async function NavigateToSearchParams(newsearchparams:GenericRowT) {

	//TODO: There be a problem. Navigating forward soley on searchparams works great. But the moment the user hits back in the browser all be cotton drenched tar

	const searchparams = new URLSearchParams(window.location.search);
	Object.entries(newsearchparams).forEach(([key, value]) => {
		searchparams.set(key, value);
	});

	const searchparams_str = searchparams.toString();

	const newhistoryurl = window.location.pathname + '?' + searchparams_str;

    history.pushState({ index: history.state.index+1, path: newhistoryurl }, '', newhistoryurl);
    
	CMechSearchParamsChanged(new URLSearchParams(newsearchparams))
}




function HandleLocalDBSyncUpdateTooLarge() {
	$N.ToastShow("LocalDB Sync Too Large", 4, 5000000)
}




const routeChanged = (path: string, direction:'firstload'|'back'|'forward' = 'firstload') => new Promise<num|null>(async (res, _rej) => {

	const viewsel            = document.getElementById("views") as HTMLElement;

    const [urlmatches, routeindex] = get_route_uri(path);

    if (direction === "firstload") {

		const loadresult = await routeload(routeindex, path, urlmatches, "beforeend");

		if (loadresult === 'failed') {
			$N.LocalDBSync.ClearAllObjectStores()
			$N.Unrecoverable("Error", "Could Not Load Page", "Reset App", LoggerSubjectE.switch_station_route_load_fail, "")
			res(null);
			return;
		}

		( viewsel.children[0] as HTMLElement ).style.display = "block";

		document.querySelector("#views")!.dispatchEvent(new Event("visibled"));

		$N.EngagementListen.LogEngagePoint(LoggerSubjectE.engagement_pageview, viewsel.children[0].tagName.toLowerCase())
    }

    else if (direction === "forward") {

		const loadresult = await routeload(routeindex, path, urlmatches, "beforeend");

		if (loadresult === 'failed') {
			$N.LocalDBSync.ClearAllObjectStores()
			$N.Unrecoverable("Error", "Could Not Load Page", "Reset App", LoggerSubjectE.switch_station_route_load_fail, "")
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
            }
            activeview.removeEventListener("transitionend", activeTransitionEnd);

			document.querySelector("#views")!.dispatchEvent(new Event("visibled"));

			$N.EngagementListen.LogEngagePoint(LoggerSubjectE.engagement_pageview, activeview.tagName.toLowerCase())
        });
    }

    else if (direction === "back") {

        const activeview = viewsel.children[viewsel.children.length - 1] as HTMLElement;
        let previousview = activeview?.previousElementSibling as HTMLElement;


        if (isSwipeBackGesture) {
            activeview.remove();
			previousview.classList.remove("previous_endstate");
			await new Promise((res, _rej) => setTimeout(res, 100));
			previousview.style.display = "block";
            document.querySelector("#views")!.dispatchEvent(new Event("view_load_done"));
            res(1);
            return;
        }

        if (!previousview) {
			const loadresult = await routeload(routeindex, path, urlmatches, "afterbegin");

            if (loadresult === "failed") {
				$N.LocalDBSync.ClearAllObjectStores()
				$N.Unrecoverable("Error", "Could Not Load Page", "Reset App", LoggerSubjectE.switch_station_route_load_fail, "")
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
            activeview.removeEventListener("transitionend", activeTransitionEnd);

			document.querySelector("#views")!.dispatchEvent(new Event("visibled"));
        });
    }

	res(1);
})





const routeload = (routeindex:num, _uri:str, urlmatches:str[], views_attach_point:'beforeend'|'afterbegin') => new Promise<string>( async (res, _rej) => {
	 
	const route           = _routes[routeindex];

	const pathparams      = GetPathParams(route.pathparams_propnames, urlmatches);
	const searchparams    = new URLSearchParams(window.location.search);

	const localdb_preload = route.lazyload_view.localdb_preload

	const promises:Promise<any>[] = []

	let loady_a:(pp:GenericRowT, sp:URLSearchParams) => Promise<null|Map<str,GenericRowT[]>> = home_loady_a
	let loady_b:(pp:GenericRowT, osp:URLSearchParams, nsp:URLSearchParams) => Promise<Map<str,GenericRowT[]>|null> = home_loady_b

	switch (route.lazyload_view.name) {
		case "home":
			loady_a = home_loady_a
			loady_b = home_loady_b
			break;

		/* XEN */
		case "finance":
			loady_a = finance_loady_a
			loady_b = finance_loady_b
			break;
		case "addtr":
			loady_a = addtr_loady_a
			loady_b = addtr_loady_b
			break;
		/* END XEN */


		/* PWT */
		case "machines":
			loady_a = machines_loady_a
			loady_b = machines_loady_b
			break;
		case "machine":
			loady_a = machine_loady_a
			loady_b = machine_loady_b
			break;
		case "machinetelemetry":
			loady_a = machinetelemetry_loady_a
			loady_b = machinetelemetry_loady_b
			break;
		case "notifications":
			loady_a = notifications_loady_a
			loady_b = notifications_loady_b
			break;
		/* END PWT */

		default:
			break;
	}

	promises.push( LazyLoadRun([route.lazyload_view]) )
	promises.push( CMechAddView(route.lazyload_view.name, pathparams, searchparams, localdb_preload, views_attach_point, loady_a, loady_b) )

	const r = await Promise.all(promises)

	if (r[0] === null || r[1] === null) { res('failed'); return; }

	res('success')
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




export { Init, AddRoute, HandleLocalDBSyncUpdateTooLarge }

if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).SwitchStation = { NavigateTo, NavigateBack, NavigateToSearchParams };










const home_loady_a = (_pathparams:GenericRowT, _searchparams: URLSearchParams) => new Promise<null|Map<str,GenericRowT[]>>(async (res, _rej) => {
	const a = new Map<str,GenericRowT[]>()
	a.set("testy1", [{testy1:1}, {testy1:2}])
	a.set("testy2", [{testy2:10}, {testy2:20}])
	res(a)	
})

const home_loady_b = (_pathparams:GenericRowT, _old_searchparams: URLSearchParams, _new_searchparams: URLSearchParams) => new Promise<Map<str,GenericRowT[]>|null>(async (res, _rej) => {
	const a = new Map<str,GenericRowT[]>()
	a.set("b_testy1", [{testy1:1}, {testy1:2}])
	a.set("b_testy2", [{testy2:10}, {testy2:20}])
	res(a)
})




/* XEN */
const finance_loady_a = (_pathparams:GenericRowT, _searchparams: URLSearchParams) => new Promise<null|Map<str,GenericRowT[]>>(async (res, _rej) => {
	const a = new Map<str,GenericRowT[]>()
	a.set("testy1", [{testy1:1}, {testy1:2}])
	a.set("testy2", [{testy2:10}, {testy2:20}])
	res(a)	
})

const finance_loady_b = (_pathparams:GenericRowT, _old_searchparams: URLSearchParams, _new_searchparams: URLSearchParams) => new Promise<Map<str,GenericRowT[]>|null>(async (res, _rej) => {
	const objectstores = await indexeddb_graball(["areas","cats","sources","tags", "payments", "transactions", "monthsnapshots"])
	if (objectstores === null) { res(null); return; }
	res(objectstores)
})




const addtr_loady_a = (_pathparams:GenericRowT, _searchparams: URLSearchParams) => new Promise<null|Map<str,GenericRowT[]>>(async (res, _rej) => {
	const a = new Map<str,GenericRowT[]>()
	res(a)	
})

const addtr_loady_b = (_pathparams:GenericRowT, _old_searchparams: URLSearchParams, _new_searchparams: URLSearchParams) => new Promise<Map<str,GenericRowT[]>|null>(async (res, _rej) => {
	const objectstores = await indexeddb_graball(["areas","cats","sources","tags","quick_notes"])
	//TODO: I could be trying to get object stores that dont exist. A scenario is that a previous view could, by chance, have preloaded the object stores so in testing its all hunky dory and then shit itself in production. indexeddb_graball needs to be passed this views localdb_preload to check and make sure I don't shoot myself
	if (objectstores === null) { res(null); return; }
	res(objectstores)
})
/* END XEN */




/* PWT */
const machines_loady_a = (_pathparams:GenericRowT, _searchparams: URLSearchParams) => new Promise<null|Map<str,GenericRowT[]>>(async (res, _rej) => {
	const a = new Map<str,GenericRowT[]>()
	res(a)	
})

const machines_loady_b = (_pathparams:GenericRowT, _old_searchparams: URLSearchParams, _new_searchparams: URLSearchParams) => new Promise<Map<str,GenericRowT[]>|null>(async (res, _rej) => {
	const objectstores = await indexeddb_graball(["machines"])
	//TODO: I could be trying to get object stores that dont exist. A scenario is that a previous view could, by chance, have preloaded the object stores so in testing its all hunky dory and then shit itself in production. indexeddb_graball needs to be passed this views localdb_preload to check and make sure I don't shoot myself
	if (objectstores === null) { res(null); return; }
	res(objectstores)
})


const machine_loady_a = (pathparams:GenericRowT, _searchparams: URLSearchParams) => new Promise<null|Map<str,GenericRowT[]>>(async (res, _rej) => {

	const a = new Map<str, GenericRowT[]>()

	const paths    = [`machines/${ pathparams.id }/statuses2`]
	const opts     = [{ order_by: "ts,desc", limit: 200 }]
	
	const httpopts = { method: "POST", body: JSON.stringify({ paths, opts })}

	const r        = await $N.FetchLassie('/api/firestore_retrieve', httpopts, {})
	// need to implement a full reject here and modify the switchstation and cmech to accomidate so the view wont be loaded at all
	if (!r.ok) { a.set(paths[0], []); res(a); return; } 

	a.set(paths[0], r.data![0]) 
	res(a)	
})

const machine_loady_b = (pathparams:GenericRowT, _old_searchparams: URLSearchParams, _new_searchparams: URLSearchParams) => new Promise<Map<str,GenericRowT[]>|null>(async (res, _rej) => {
	const objectstores = await indexeddb_graball(["machines"]) as Map<str,GenericRowT[]>
	const machine = objectstores.get("machines")!.find(m=> m.id === pathparams.id)
	if (objectstores === null) { res(null); return; }
	const n = new Map()
	n.set("machines", [machine])
	res(n)
})


const machinetelemetry_loady_a = (_pathparams:GenericRowT, _searchparams: URLSearchParams) => new Promise<null|Map<str,GenericRowT[]>>(async (res, _rej) => {

	const a = new Map<str, GenericRowT[]>()
	a.set("none", []) 
	res(a)	
})

const machinetelemetry_loady_b = (pathparams:GenericRowT, _old_searchparams: URLSearchParams, _new_searchparams: URLSearchParams) => new Promise<Map<str,GenericRowT[]>|null>(async (res, _rej) => {
	const objectstores = await indexeddb_graball(["machines"]) as Map<str,GenericRowT[]>
	const machine = objectstores.get("machines")!.find(m=> m.id === pathparams.id)
	if (objectstores === null) { res(null); return; }
	const n = new Map()
	n.set("machines", [machine])
	res(n)
})


const notifications_loady_a = (_pathparams:GenericRowT, _searchparams: URLSearchParams) => new Promise<null|Map<str,GenericRowT[]>>(async (res, _rej) => {

	const a = new Map<str, GenericRowT[]>()

	const r        = await $N.FetchLassie('/api/pwt/notifications/get_users_schedules')
	if (!r.ok) { res(null); return; } 

	a.set('users_info_for_notifications', r.data as GenericRowT[]) 
	res(a)	
})

const notifications_loady_b = (_pathparams:GenericRowT, _old_searchparams: URLSearchParams, _new_searchparams: URLSearchParams) => new Promise<Map<str,GenericRowT[]>|null>(async (res, _rej) => {
	const a = new Map<str, GenericRowT[]>()
	a.set("none", []) 
	res(a)	
})
/* END PWT */






const getAllPromise = (objectStore:IDBObjectStore) => new Promise((res, rej) => {
	const request = objectStore.getAll();
	request.onsuccess = (ev:any) => res(ev.target.result);
	request.onerror   = (ev:any) => rej(ev.target.error);
})


const indexeddb_graball = (objectstore_names:str[]) => new Promise<Map<str,GenericRowT[]>|null>(async (res, _rej) => {

	if (!db) db = await openindexeddb()

	const t1 = performance.now()

	if (db === null) { res(null); return; }

	const returns:Map<str,GenericRowT[]> = new Map<str,GenericRowT[]>() // key being the objectstore name

	const transaction             = ( db as IDBDatabase ).transaction(objectstore_names, 'readonly');

	const promises:Promise<any>[] = []

	for (const objectstore_name of objectstore_names) {
		const objectstore = transaction.objectStore(objectstore_name)
		promises.push(getAllPromise(objectstore))
	}

	const r = await Promise.all(promises).catch(_ => null);
	if (r === null) { res(null); return; }

	for (let i=0; i<r.length; i++) {
		returns.set(objectstore_names[i], r[i])
	}

	const t2 = performance.now()
	transaction.onerror = (_event:any) => res(null);

	console.log("IndexedDB Grab All took " + (t2 - t1) + " milliseconds.")
	res(returns)
})


const openindexeddb = () => new Promise<IDBDatabase|null>(async (res,_rej)=> {

	/*
	let databasename = "";

	if (
		( window.location.hostname === "localhost" && window.location.port === "3003" ) ||
		( window.location.hostname.includes("purewater") )
	) {
		databasename = "purewatertech";
	}

	if (
		( window.location.hostname === "localhost" && window.location.port === "3008" ) ||
		( window.location.hostname.includes("xen") )
	) {
		databasename = "xenition";
	}

	let dbconnect = indexedDB.open(databasename, 9)

	dbconnect.onerror = (event:any) => { 
		console.log("IndexedDB Error - " + event.target.errorCode)
		res(null)
	}

	dbconnect.onsuccess = async (event: any) => {
		event.target.result.onerror = (event:any) => {
			console.log("IndexedDB Error - " + event.target.errorCode)
		}
		const db = event.target.result
		res(db)
	}
	*/


	let dbconnect = indexedDB.open(_db_name, _db_version)

	dbconnect.onerror = (event:any) => { 
		console.log("IndexedDB Error - " + event.target.errorCode)
	}

	dbconnect.onsuccess = async (event: any) => {
		event.target.result.onerror = (event:any) => {
			console.log("IndexedDB Error - " + event.target.errorCode)
		}
		const db = event.target.result
		res(db)
	}

	dbconnect.onupgradeneeded = (event: any) => {
		const db = event.target.result
		_localdb_objectstores.forEach((dc) => {
			if (!db.objectStoreNames.contains(dc.name)) {

				const objectStore = db.createObjectStore(dc.name, { keyPath: 'id' });
                
				(dc.indexes || []).forEach(( prop:any )=> { // could be empty and wont create index
					objectStore.createIndex(prop, prop, { unique: false });
				})
			}
		})
	}
})


