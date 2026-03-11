import { $NT, ToastLevelT, ViewHeaderT } from "./defs.js";


declare var $N: $NT;
declare var SETTINGS:any


// --THE FOLLOWING GET BUNDLED INTO THE MAIN BUNDLE

import { Init as SwitchStationInit, Get_Lazyload_View_Url_Patterns } from './alwaysload/switchstation.js';
import './thirdparty/lit-html.js';
import './alwaysload/fetchlassie.js';
import { Init as LocalDBSyncInit  } from './alwaysload/localdbsync.js';
import './alwaysload/influxdb.js';
import { Init as SSEInit, Close as SSEClose } from './alwaysload/sse.js';
import { init as loggerInit } from './alwaysload/logger.js';
import { Init as EngagementListenInit } from './alwaysload/engagementlisten.js';
import { Init as LazyLoadFilesInit } from "./alwaysload/lazyload_files.js"
import { Init as DatahodlInit } from "./alwaysload/datahodl.js"
import {Init as CMechInit} from './alwaysload/cmech.js';
import {Init as IDBInit } from './alwaysload/indexeddb.js';
import './alwaysload/utils.js';


//{--replace_slot.js--}


let _serviceworker_reg: ServiceWorkerRegistration|null;
//let _shared_worker: SharedWorker|null = null;
//let _worker_port: MessagePort|null = null;





window.addEventListener("load", async (_e) => {

	const lazyloads = [...SETTINGS.MAIN.LAZYLOADS, ...SETTINGS.INSTANCE.LAZYLOADS]
	const all_localdb_objectstores = [ ...SETTINGS.INSTANCE.INFO.localdb_objectstores, ...SETTINGS.MAIN.INFO.localdb_objectstores ]
	const lazyload_view_urlpatterns = Get_Lazyload_View_Url_Patterns(lazyloads);

	localStorage.setItem("identity_platform_key", SETTINGS.INSTANCE.INFO.firebase.identity_platform_key)

	if ((window as any).APPVERSION > 0) {
		try         { await setup_service_worker(lazyload_view_urlpatterns); }
		catch (err) { alert("unable to load service worker"); console.error("Service Worker setup failed:", err); return; }
	}

	/* **** load always load modules **** */
	{
		IDBInit(all_localdb_objectstores, SETTINGS.INSTANCE.INFO.firebase.project, SETTINGS.INSTANCE.INFO.firebase.dbversion)
		EngagementListenInit()
		LocalDBSyncInit(SETTINGS.INSTANCE.INFO.localdb_objectstores, SETTINGS.INSTANCE.INFO.firebase.project, SETTINGS.INSTANCE.INFO.firebase.dbversion)
		DatahodlInit()
		CMechInit()
		loggerInit();
		LazyLoadFilesInit(lazyloads);
		await SwitchStationInit();
	}
	/* ********************************** */

	// let path:string;
	// if (window.location.pathname === '/' || window.location.pathname === '' || window.location.pathname === '/index.html') {
	// 	path = 'home'
	// } else {
	// 	path = window.location.pathname.slice(3) + window.location.search // remove /v/ prefix and combine in search
	// }

	setTimeout(()=> SSEInit(), 2500)

	//init_shared_worker()
})




window.addEventListener('online', () => {
	if (_serviceworker_reg?.active) {
		_serviceworker_reg.active.postMessage({ action: "networkchange", data: { state: 'online' } });
	}
});

window.addEventListener('offline', () => {
	if (_serviceworker_reg?.active) {
		_serviceworker_reg.active.postMessage({ action: "networkchange", data: { state: 'offline' } });
	}
});

document.addEventListener('visibilitychange', () => {
	if (_serviceworker_reg?.active) {
		_serviceworker_reg.active.postMessage({ action: "visibilitychange", is_visible: document.visibilityState === 'visible' });
	}
});





async function ToastShow(msg: string|{title:string,sub:string}, level: ToastLevelT = 'info', duration: number = 4000) { 

	let toastel = document.querySelector('body > c-toast') as HTMLElement & {addtoast:any} | null;

	if (!toastel) { // c-toast requires component to be loaded which should happen after initial load
		document.body.insertAdjacentHTML('beforeend', '<c-toast></c-toast>');
		toastel = document.querySelector('body > c-toast');
	}

	await new Promise(resolve => setTimeout(resolve, 100)) // wait for c-toast to be ready, can make this more robust if needed
	toastel.addtoast(msg, level, duration);
}
$N.ToastShow = ToastShow;




function setHeader(opts: ViewHeaderT) {

	const header = document.getElementById('viewheader')!;

	if (opts.disable) {
		header.classList.add('hidden');
		return;
	}

	header.classList.remove('hidden');

	if (!opts.skip_title) {
		const h1 = header.querySelector('.middle h1');
		h1.textContent = opts.title;
	}

	const left = header.querySelector('.left') as HTMLElement;
	const leftbackbtnel = left.querySelector('.backbtn') as HTMLElement;
	if (opts.backurl) {
		left.classList.remove('hidden');
		leftbackbtnel.onclick = () => $N.SwitchStation.GoBack({ default: opts.backurl! });
	} else {
		left.classList.add('hidden');
		leftbackbtnel.onclick = null;
	}


	const actionctrls = header.querySelector('.right .icobtns') as HTMLElement;
	actionctrls.innerHTML = ''; // clear existing
	actionctrls.style.width = "";

	if (opts.actions) {
		for (const action of opts.actions) {
			const divEl = document.createElement('div');
			divEl.className = 'icobtn';
			const iconEl = document.createElement('i');
			iconEl.className = `icon-${action.icon}`;
			divEl.onclick = action.onClick;
			// actionctrls.style.width = `${opts.actions.length * 28}px`;
			divEl.appendChild(iconEl);
			actionctrls.appendChild(divEl);
		}
	}
}
$N.Header = { set: setHeader };




// function clickity(el:HTMLElement) {
// 	el.classList.add("clickity")
// 	const activeviewel = document.querySelector("#views > .view:last-child")!
// 	const intrv = setInterval(() => {
// 		const isactive = activeviewel.getAttribute("data-active") === "true"
// 		if (!isactive) {
// 			el.classList.remove("clickity")
// 			clearInterval(intrv)
// 		}
// 	}, 100)
// 	setTimeout(() => {
// 		el.classList.remove("clickity")
// 		clearInterval(intrv)
// 	}, 8000)
// }
// $N.Clickity = clickity;




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






async function Unrecoverable(subj: string, msg: string, btnmsg: string, logsubj: string, logerrmsg: string|null, redirectionurl?:string|null) {

	const redirect = redirectionurl || `/v/appmsgs?logsubj=${logsubj}`;
	setalertbox(subj, msg, btnmsg, redirect);
	$N.Logger.log(40, logsubj, logerrmsg||"");
}
$N.Unrecoverable = Unrecoverable;




async function GetConnectedState(): Promise<'online' | 'offline'> {

	if (!_serviceworker_reg?.active) return 'online';

	return new Promise((resolve) => {

		const handler = (event: MessageEvent) => {
			if (event.data.action === 'connectedstate') {
				navigator.serviceWorker.removeEventListener('message', handler);
				resolve(event.data.state as 'online' | 'offline');
			}
		};

		navigator.serviceWorker.addEventListener('message', handler);
		_serviceworker_reg.active!.postMessage({ action: 'getconnectedstate' });
	});
}
$N.GetConnectedState = GetConnectedState;




function setalertbox(subj: string, msg: string, btnmsg: string, redirect: string, clickHandler?: () => void) {

	const modal = document.getElementById('alert_notice');
	if (!modal) return; // Guard clause if modal isn't found

	const isAlreadyActive = modal.classList.contains('active');

	if (!isAlreadyActive) {
		modal.classList.add('active');

		const titleEl = document.getElementById('alert_notice_title');
		const btnReset = document.getElementById('alert_notice_btn');

		if (titleEl) titleEl.textContent = subj;

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

	// Always add the new message
	const msgContainer = document.getElementById('alert_notice_msg_container');
	if (msgContainer) {
		const newMsgEl = document.createElement('p');
		newMsgEl.textContent = msg;
		msgContainer.appendChild(newMsgEl);

		// Scroll to bottom to show the latest message
		msgContainer.scrollTop = msgContainer.scrollHeight;
	}
}




const setup_service_worker = (lazyload_view_urlpatterns:any[]) => new Promise<void>((resolve, reject) => {

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
		})
		.catch((err) => {   reject(err);   });

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

			else if (event.data.action === 'backonline') {
				document.dispatchEvent(new Event('backonline'));
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
			 
			const origin = window.location.origin;
			window.location.href = "https://yavada.com/bouncebacktonifty.html?origin=" + encodeURIComponent(origin);
		}
	})
	.catch((err) => {
		reject(err);
	});
})








