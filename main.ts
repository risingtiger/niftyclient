import { str, GenericRowT } from "./defs_server_symlink.js";
import { $NT, LazyLoadFuncReturnT } from "./defs.js";


declare var $N: $NT;
declare var INSTANCE_LAZYLOAD_DATA_FUNCS:any
declare var SETTINGS:any


// --THE FOLLOWING GET BUNDLED INTO THE MAIN BUNDLE

import { Init as SwitchStationInit } from './alwaysload/switchstation.js';
import './thirdparty/lit-html.js';
import './alwaysload/fetchlassie.js';
import { Init as LocalDBSyncInit  } from './alwaysload/localdbsync.js';
import './alwaysload/influxdb.js';
//import { Init as LazyLoadFilesInit } from './alwaysload/lazyload_files.js';
import { Init as SSEInit, Close as SSEClose } from './alwaysload/sse.js';
import { Init as LoggerInit } from './alwaysload/logger.js';
import { Init as EngagementListenInit } from './alwaysload/engagementlisten.js';
import {Init as CMechInit} from './alwaysload/cmech.js';
import {Init as IDBInit } from './alwaysload/indexeddb.js';
import './alwaysload/utils.js';


//{--replace_slot.js--}


let _serviceworker_reg: ServiceWorkerRegistration|null;
//let _shared_worker: SharedWorker|null = null;
//let _worker_port: MessagePort|null = null;


const LAZYLOAD_DATA_FUNCS = {

	appmsg_main: (_pathparams:GenericRowT, _searchparams: URLSearchParams, _localdb_preload?:str[]) => new Promise<LazyLoadFuncReturnT>(async (res, _rej) => {

		const d = new Map<str,GenericRowT[]>()
		res({ d, refreshspecs:[]})
	}),

	login_main: (_pathparams:GenericRowT, _searchparams: URLSearchParams, _localdb_preload?:str[]) => new Promise<LazyLoadFuncReturnT>(async (res, _rej) => {

		const d = new Map<str,GenericRowT[]>()
		res({ d, refreshspecs:[]})
	}),

	setup_push_allowance_main: (_pathparams:GenericRowT, _searchparams: URLSearchParams, _localdb_preload?:str[]) => new Promise<LazyLoadFuncReturnT>(async (res, _rej) => {
		const d = new Map<str,GenericRowT[]>()
		res({ d, refreshspecs:[]})
	}),
}




window.addEventListener("load", async (_e) => {


	const lazyload_data_funcs = { ...LAZYLOAD_DATA_FUNCS, ...INSTANCE_LAZYLOAD_DATA_FUNCS }
	const lazyloads = [...SETTINGS.MAIN.LAZYLOADS, ...SETTINGS.INSTANCE.LAZYLOADS]
	const all_localdb_objectstores = [ ...SETTINGS.INSTANCE.INFO.localdb_objectstores, ...SETTINGS.MAIN.INFO.localdb_objectstores ]

	{
		IDBInit(all_localdb_objectstores, SETTINGS.INSTANCE.INFO.firebase.project, SETTINGS.INSTANCE.INFO.firebase.dbversion)
		EngagementListenInit()
		//LocalDBSyncInit(SETTINGS.INSTANCE.INFO.localdb_objectstores, SETTINGS.INSTANCE.INFO.firebase.project, SETTINGS.INSTANCE.INFO.firebase.dbversion)
		CMechInit(lazyload_data_funcs)
		LoggerInit();
		
	}


	localStorage.setItem("identity_platform_key", SETTINGS.INSTANCE.INFO.firebase.identity_platform_key)

	const lazyload_view_urlpatterns = SwitchStationInit(lazyloads);

	if ((window as any).APPVERSION > 0) await setup_service_worker(lazyload_view_urlpatterns)
	//init_shared_worker()
	setTimeout(()=> SSEInit(), 1800)
	//await new Promise<void>((res)=> setTimeout(()=>{ res() }, 500)); 
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




/*
function init_shared_worker() {
	_shared_worker = new SharedWorker('/shared_worker.js');
	_worker_port = _shared_worker.port;
	
	_worker_port.removeEventListener('message', handle_shared_worker_message); // Remove any previous listeners to avoid duplicates
	_worker_port.addEventListener('message', handle_shared_worker_message);
	_worker_port.start();
}
function handle_shared_worker_message(e: MessageEvent) {

	if (e.data.action === 'WORKER_CONNECTED') {
		console.log("Shared Worker connected");
	
	} else if (e.data.action === 'SSE_EVENT' || 
		e.data.action === 'SSE_CONNECTION_STATUS' || 
		e.data.action === 'SSE_CONNECTED' || 
		e.data.action === 'SSE_ERROR') {
		
		// Forward SSE messages to the SSE module
		if ($N.SSEvents && $N.SSEvents.HandleMessage) {
			$N.SSEvents.HandleMessage(e.data);
		}
	}
}
$N.GetSharedWorkerPort = ()=>_worker_port!;
*/






async function Unrecoverable(subj: string, msg: string, btnmsg: string, logsubj: string, logerrmsg: string|null, redirectionurl:string|null) {

	const redirect = redirectionurl || `/v/appmsgs?logsubj=${logsubj}`;
	setalertbox(subj, msg, btnmsg, redirect);
	$N.Logger.Log(40, logsubj, logerrmsg||"");
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





const setup_service_worker = (lazyload_view_urlpatterns:any[]) => new Promise<void>((resolve, _reject) => {

	// Check if very first time loading the service worker, so we can skip the controllerchange event
	let hasPreviousController = navigator.serviceWorker.controller ? true : false;

	 navigator.serviceWorker.register('/sw.js').then(registration => {

		_serviceworker_reg = registration;

         navigator.serviceWorker.ready.then(() => {                                                             
			registration.active?.postMessage({                                                                 
				action:"initial_data_pass",                                                               
				id_token: localStorage.getItem("id_token"),                                                    
				token_expires_at: localStorage.getItem("token_expires_at"),                                    
				refresh_token: localStorage.getItem("refresh_token"),                                          
				user_email: localStorage.getItem("user_email"),
				lazyload_view_urlpatterns,
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
				SSEClose()
				setTimeout(() => {
					if (_serviceworker_reg)
						_serviceworker_reg?.update()
				}, 300)
			}

			else if (event.data.action === 'error_out') {

				if (event.data.subject === "sw4") { // sw fetch not authorized
					Unrecoverable("Not Authenticated", "Please Login", "Login", "sw4", event.data.errmsg, "/v/login")
				} else {
					Unrecoverable("App Error", event.data.errmsg, "Restart App", event.data.subject, event.data.errmsg, null)
				}
			}

			/*
			else if (event.data.action === 'logit') {
				// can add this back in to logger if needed
			}
			*/
		});

		navigator.serviceWorker.addEventListener('controllerchange', onNewServiceWorkerControllerChange);

		navigator.serviceWorker.addEventListener('updatefound', (_e:any) => {
			SSEClose()
		});


		function onNewServiceWorkerControllerChange() {

			// This event is fired when the service worker controller changes. skip on very first load
			if (!hasPreviousController) {hasPreviousController = true; return;}
			 
			const redirect = `/v/appmsgs?appupdate=done`;
			window.location.href = redirect;
			//setalertbox("App Update", "app has been updated. needs restarted", "Restart App", redirect);
		}
	});
})








