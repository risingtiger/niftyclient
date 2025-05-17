import { str, GenericRowT } from "./defs_server_symlink.js";
import { LazyLoadT, $NT, INSTANCE_T, LoggerTypeE, LoggerSubjectE } from "./defs.js";


declare var $N: $NT;
declare var INSTANCE_LAZYLOAD_DATA_FUNCS:any
declare var SETTINGS:any


// --THE FOLLOWING GET BUNDLED INTO THE MAIN BUNDLE

import { Init as SwitchStationInit, AddRoute as SwitchStationAddRoute } from './alwaysload/switchstation.js';
import './thirdparty/lit-html.js';
import './alwaysload/fetchlassie.js';
import { Init as LocalDBSyncInit } from './alwaysload/localdbsync.js';
import './alwaysload/influxdb.js';
//import { Init as LazyLoadFilesInit } from './alwaysload/lazyload_files.js';
import { Init as SSEInit } from './alwaysload/sse.js';
import './alwaysload/logger.js';
import './alwaysload/engagementlisten.js';
import {Init as CMechInit} from './alwaysload/cmech.js';
import {Init as IDBInit } from './alwaysload/indexeddb.js';
import './alwaysload/utils.js';


//{--replace_slot.js--}


let serviceworker_reg: ServiceWorkerRegistration|null;


const LAZYLOAD_DATA_FUNCS = {

	appmsgs_indexeddb: (_pathparams:GenericRowT, _old_searchparams: URLSearchParams, _new_searchparams: URLSearchParams) => new Promise<Map<string, GenericRowT[]>>(async (res, _rej) => {
		res(new Map<str,GenericRowT[]>())
	}),

	appmsgs_other: (_pathparams:GenericRowT, _old_searchparams: URLSearchParams, _new_searchparams: URLSearchParams) => new Promise<Map<string, GenericRowT[]>>(async (res, _rej) => {
		res(new Map<str,GenericRowT[]>())
	}),

	login_indexeddb: (_pathparams:GenericRowT, _old_searchparams: URLSearchParams, _new_searchparams: URLSearchParams) => new Promise<Map<string, GenericRowT[]>>(async (res, _rej) => {
		res(new Map<str,GenericRowT[]>())
	}),

	login_other: (_pathparams:GenericRowT, _old_searchparams: URLSearchParams, _new_searchparams: URLSearchParams) => new Promise<Map<string, GenericRowT[]>>(async (res, _rej) => {
		res(new Map<str,GenericRowT[]>())
	}),

	setup_push_allowance_indexeddb: (_pathparams:GenericRowT, _old_searchparams: URLSearchParams, _new_searchparams: URLSearchParams) => new Promise<Map<string, GenericRowT[]>>(async (res, _rej) => {
		res(new Map<str,GenericRowT[]>())
	}),

	setup_push_allowance_other: (_pathparams:GenericRowT, _old_searchparams: URLSearchParams, _new_searchparams: URLSearchParams) => new Promise<Map<string, GenericRowT[]>>(async (res, _rej) => {
		res(new Map<str,GenericRowT[]>())
	}),
}




window.addEventListener("load", async (_e) => {

	const lazyload_data_funcs = { ...LAZYLOAD_DATA_FUNCS, ...INSTANCE_LAZYLOAD_DATA_FUNCS }
	const lazyloads = [...SETTINGS.MAIN.LAZYLOADS, ...SETTINGS.INSTANCE.LAZYLOADS]
	const all_localdb_objectstores = [ ...SETTINGS.INSTANCE.INFO.localdb_objectstores, ...SETTINGS.MAIN.INFO.localdb_objectstores ]

	{
		IDBInit(all_localdb_objectstores, SETTINGS.INSTANCE.INFO.firebase.project, SETTINGS.INSTANCE.INFO.firebase.dbversion)
		//LazyLoadFilesInit(lazyloads)
		$N.EngagementListen.Init()
		LocalDBSyncInit(SETTINGS.INSTANCE.INFO.localdb_objectstores, SETTINGS.INSTANCE.INFO.firebase.project, SETTINGS.INSTANCE.INFO.firebase.dbversion)
		CMechInit(lazyload_data_funcs)
	}

	if ((window as any).APPVERSION > 0) await setup_service_worker(lazyloads)

	localStorage.setItem("identity_platform_key", SETTINGS.INSTANCE.INFO.firebase.identity_platform_key)
	lazyloads.filter(l => l.type === "view").forEach(r => SwitchStationAddRoute(r))
	SwitchStationInit();

	setTimeout(()=> SSEInit, 5000)
})





document.querySelector("#views")!.addEventListener("visibled", () => {
})




let toast_id_counter = 0;
function ToastShow(msg: string, level?: number | null, _duration?: number | null) { // _duration argument is no longer used


    const toast_id = `maintoast-${toast_id_counter}`;
    
    const toast_el = document.createElement('c-toast') as any; // Cast to any for custom element properties
    toast_el.id = toast_id;

    toast_el.setAttribute("msg", msg || "");
    toast_el.setAttribute("level", level?.toString() || '0');
    toast_el.setAttribute("duration", '2147483647'); 
    
    document.body.append(toast_el);
    
    toast_el.setAttribute("action", "run");

    toast_el.addEventListener("click", () => {
        if (toast_el.parentElement) { // Check if the element is still in the DOM
            toast_el.remove();
        }
    });

    toast_el.addEventListener("done", () => {
        if (toast_el.parentElement) { // Check if the element is still in the DOM
            toast_el.remove();
        }
    });

	setTimeout(() => {
		const toast_els = document.querySelectorAll("c-toast");
		let   bottom_position = 20;
		for (const el of toast_els) {
			( el as HTMLElement).style.bottom = `${bottom_position}px`;
			bottom_position += 60;
		}
	}, 10)
}
$N.ToastShow = ToastShow;




async function Unrecoverable(subj: string, msg: string, btnmsg: string, logsubj: LoggerSubjectE, logerrmsg: string|null, redirectionurl:string|null) {
	
	/*
	await new Promise((res, _rej) => {
		const deleteRequest = indexedDB.deleteDatabase(SETTINGS.INSTANCE.INFO.firebase.project);
		deleteRequest.onsuccess = () => {res(true); };
		deleteRequest.onerror =   () => {res(true); }; // Resolve even on error to proceed
	})
	*/

	const redirect = redirectionurl || `/v/appmsgs?logsubj=${logsubj}`;
	setalertbox(subj, msg, btnmsg, redirect);
	$N.Logger.Log(LoggerTypeE.error, logsubj, ( logerrmsg || "" ));

	localStorage.removeItem("synccollections"); // Corrected from removeChild to removeItem
}
$N.Unrecoverable = Unrecoverable;




function setalertbox(subj: string, msg: string, btnmsg: string, redirect: string, clickHandler?: () => void) {
	const modal = document.getElementById('alert_notice');
	if (!modal) return; // Guard clause if modal isn't found
	modal.classList.add('active');

	const titleEl = document.getElementById('alert_notice_title');
	const msgEl = document.getElementById('alert_notice_msg');
	const btnReset = document.getElementById('alert_notice_btn');

	if (titleEl) titleEl.textContent = subj;
	if (msgEl) msgEl.textContent = msg;
	
	if (btnReset) {
		btnReset.textContent = btnmsg;
        // To prevent multiple listeners if setalertbox is called multiple times for the same button,
        // replace the button with a clone of itself. This removes all old event listeners.
        const newBtnReset = btnReset.cloneNode(true) as HTMLElement;
        btnReset.parentNode?.replaceChild(newBtnReset, btnReset); // Use parentNode for safety

		newBtnReset.addEventListener('click', () => {
			if (clickHandler) {
				clickHandler();
			} else {
				window.location.href = redirect;
			}
		});
	}
}






const setup_service_worker = (lazyloads:any[]) => new Promise<void>((resolve, _reject) => {

	/*

    {
      "type": "view",
      "urlmatch": "^machines$",
      "name": "machines",
      "is_instance": true,
      "dependencies": [
        {"type": "component", "name": "ol"},
        {"type": "component", "name": "pol"},
        {"type": "component", "name": "form"},
        {"type": "component", "name": "in"},
        {"type": "component", "name": "dselect"},
        {"type": "component", "name": "btn"},
        {"type": "component", "name": "toast"},
        {"type": "component", "name": "metersreport"},
        {"type": "component", "name": "machinedetails"},
        {"type": "component", "name": "machinemap"}
      ],
      "auth": ["user", "admin", "store_manager", "scanner"],
      "localdb_preload": ["machines"]
    },
    {
      "type": "view",
      "urlmatch": "^machines/:id$",
      "name": "machine",
      "is_instance": true,
      "dependencies": [
        {"type": "component", "name": "ol"},
        {"type": "component", "name": "reveal"},
        {"type": "component", "name": "form"},
        {"type": "component", "name": "in"},
        {"type": "component", "name": "dselect"},
        {"type": "component", "name": "btn"},
        {"type": "component", "name": "toast"},
        {"type": "component", "name": "metersreport"},
        {"type": "component", "name": "machinedetails"},
        {"type": "component", "name": "machinemap"}
      ],
      "auth": ["user", "admin", "store_manager", "scanner"],
      "localdb_preload": ["machines"]
    },
    {
      "type": "view",
      "urlmatch": "^machines/:id/telemetry$",
      "name": "machinetelemetry",
      "is_instance": true,
      "dependencies": [
        {"type": "component", "name": "graphing"},
        {"type": "component", "name": "ol"},
        {"type": "component", "name": "toast"}
      ],
      "auth": ["user", "admin", "store_manager", "scanner"],
      "localdb_preload": ["machines"]
    },
	*/

	// Extract name and urlmatch from lazyloads
	const view_routes = lazyloads
		.filter(l => l.type === "view")
		.map(l => [l.name, l.urlmatch]);
	


	// Check if very first time loading the service worker, so we can skip the controllerchange event
	let hasPreviousController = navigator.serviceWorker.controller ? true : false;

	 navigator.serviceWorker.register('/sw.js').then(registration => {

		serviceworker_reg = registration;

         navigator.serviceWorker.ready.then(() => {                                                             
			registration.active?.postMessage({                                                                 
				action:"initial_pass_auth_info",                                                               
				id_token: localStorage.getItem("id_token"),                                                    
				token_expires_at: localStorage.getItem("token_expires_at"),                                    
				refresh_token: localStorage.getItem("refresh_token"),                                          
				user_email: localStorage.getItem("user_email")                                                 
			});                                                                                                

			resolve()
		}); 

		navigator.serviceWorker.addEventListener('message', (event:any) => {

			if (event.data.action === 'update_auth_info') {
				localStorage.setItem("id_token", event.data.id_token)
				localStorage.setItem("token_expires_at", event.data.token_expires_at.toString())
				localStorage.setItem("refresh_token", event.data.refresh_token)
			}

			else if (event.data.action === 'update_init') {
				$N.SSEvents.ForceStop()
				setTimeout(() => {
					if (serviceworker_reg)
						serviceworker_reg?.update()
				}, 300)
			}

			else if (event.data.action === 'error_out') {
				$N.Logger.Log(LoggerTypeE.error, event.data.subject as LoggerSubjectE, `${event.data.msg}`)

				if (event.data.subject === LoggerSubjectE.sw_fetch_not_authorized) {
					Unrecoverable("Not Authenticated", "Please Login", "Login", LoggerSubjectE.sw_fetch_not_authorized, event.data.errmsg, "/v/login")
				} else {
					Unrecoverable("App Error", event.data.errmsg, "Restart App", event.data.subject as LoggerSubjectE, event.data.errmsg, null)
				}
			}

			else if (event.data.action === 'logit') {
				$N.Logger.Log(Number(event.data.type) as LoggerTypeE, event.data.subject as LoggerSubjectE, `${event.data.msg}`)
			}
		});

		navigator.serviceWorker.addEventListener('controllerchange', onNewServiceWorkerControllerChange);

		navigator.serviceWorker.addEventListener('updatefound', (_e:any) => {
			$N.SSEvents.ForceStop()
		});


		function onNewServiceWorkerControllerChange() {

			// This event is fired when the service worker controller changes. skip on very first load
			if (!hasPreviousController) {hasPreviousController = true; return;}

			 
			const redirect = `/v/appmsgs?appupdate=done`;
			setalertbox("App Update", "app has been updated. needs restarted", "Restart App", redirect);
			$N.Logger.Log(LoggerTypeE.info, LoggerSubjectE.app_update, "");
		}
	});
})








