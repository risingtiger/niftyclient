import {  } from "./defs_server_symlink.js";
import { LazyLoadT, $NT, INSTANCE_T, LoggerTypeE, LoggerSubjectE } from "./defs.js";


declare var INSTANCE:INSTANCE_T; // set here for LSP support only
declare var $N: $NT;


// --THE FOLLOWING GET BUNDLED INTO THE MAIN BUNDLE

import { Init as SwitchStationInit, AddRoute as SwitchStationAddRoute } from './alwaysload/switchstation.js';
import './thirdparty/lit-html.js';
import './alwaysload/fetchlassie.js';
import { Init as LocalDBSyncInit } from './alwaysload/localdbsync.js';
import './alwaysload/influxdb.js';
import { Init as LazyLoadInit } from './alwaysload/lazyload.js';
import { Init as SSEInit } from './alwaysload/sse.js';
import './alwaysload/logger.js';
import './alwaysload/engagementlisten.js';
import {Init as CMechInit} from './alwaysload/cmech.js';
import './alwaysload/utils.js';


//{--main_instance.js--}


let _is_in_initial_view_load = false;
let serviceworker_reg: ServiceWorkerRegistration|null;


const LAZYLOADS: LazyLoadT[] = [

	// VIEWS

	{
		type: "view",
		urlmatch: "^setup_push_allowance$",
		name: "setup_push_allowance",
		is_instance: false,
		dependencies: [
			{ type: "component", name: "ol" },
			{ type: "component", name: "btn" },
		],
		auth: ["admin", "store_manager", "scanner"]
	},


	// COMPONENTS

	{
		type: "component",
		name: "graphing",
		is_instance: false,
		dependencies: [{ type: "thirdparty", name: "chartist" }],
		auth: []
	},

	{
		type: "component",
		name: "ol",
		is_instance: false,
		dependencies: [],
		auth: []
	},

	{
		type: "component",
		name: "pol",
		is_instance: false,
		dependencies: [],
		auth: [],
	},

	{
		type: "component",
		name: "tl",
		is_instance: false,
		dependencies: [],
		auth: []
	},

	{
		type: "component",
		name: "reveal",
		is_instance: false,
		dependencies: [],
		auth: []
	},

	{
		type: "component",
		name: "form",
		is_instance: false,
		dependencies: [],
		auth: []
	},

	{
		type: "component",
		name: "dselect",
		is_instance: false,
		dependencies: [],
		auth: []
	},

	{
		type: "component",
		name: "in",
		is_instance: false,
		dependencies: [
			{ type: "component", name: "dselect" },
			{ type: "component", name: "animeffect" }
		],
		auth: []
	},

	{
		type: "component",
		name: "animeffect",
		is_instance: false,
		dependencies: [],
		auth: []
	},

	{
		type: "component",
		name: "toast",
		is_instance: false,
		dependencies: [],
		auth: []
	},

	{
		type: "component",
		name: "btn",
		is_instance: false,
		dependencies: [
			{ type: "component", name: "animeffect" },
		],
		auth: []
	},

	// THIRDPARTY

	{
		type: "thirdparty",
		name: "chartist",
		is_instance: false,
		dependencies: [],
		auth: []
	},


	// LIBS

	{
		type: "lib",
		name: "testlib",
		is_instance: false,
		dependencies: [],
		auth: []
	},


	// DIRECTIVES
];




window.addEventListener("load", async (_e) => {

	const lazyloads = [...LAZYLOADS, ...INSTANCE.LAZYLOADS]

	//const localdb_objectstores = [ ...INSTANCE.INFO.localdb_objectstores, "__localwrites" ]

	{
		LazyLoadInit(lazyloads)
		$N.EngagementListen.Init()
		LocalDBSyncInit(INSTANCE.INFO.localdb_objectstores, INSTANCE.INFO.firebase.project, INSTANCE.INFO.firebase.dbversion)
		CMechInit()
	}

	if ((window as any).APPVERSION > 0) await setup_service_worker()

	localStorage.setItem("identity_platform_key", INSTANCE.INFO.firebase.identity_platform_key)
	lazyloads.filter(l => l.type === "view").forEach(r => SwitchStationAddRoute(r))
	SwitchStationInit(INSTANCE.INFO.localdb_objectstores, INSTANCE.INFO.firebase.project, INSTANCE.INFO.firebase.dbversion);

	SSEInit()
})





document.querySelector("#views")!.addEventListener("visibled", () => {
	if (_is_in_initial_view_load)   _is_in_initial_view_load = false
})




function ToastShow(msg: string, level?: number | null, duration?: number | null) {

	let existing_toast = document.getElementById("maintoast")

	if (existing_toast) {
		console.log("toast already showing")
		return
	}

	const htmlstr = `<c-toast id="maintoast" msg="" level="" duration=""></c-toast>`
	document.body.insertAdjacentHTML("beforeend", htmlstr)
	let toast_el = document.getElementById("maintoast")! as any

	toast_el.setAttribute("msg", msg || "")
	toast_el.setAttribute("level", level || '0')
	toast_el.setAttribute("duration", duration ? duration.toString() : '4500')

	toast_el.setAttribute("action", "run")

	toast_el.addEventListener("done", () => {
		document.body.removeChild(toast_el)
	})
}
$N.ToastShow = ToastShow




function Unrecoverable(subj: string, msg: string, btnmsg: string, logsubj: LoggerSubjectE, logerrmsg: string = "") {
	const redirect = `/index.html?logsubj=${logsubj}`;
	setalertbox(subj, msg, btnmsg, redirect);
	$N.Logger.Log(LoggerTypeE.error, logsubj, logerrmsg);
}
$N.Unrecoverable = Unrecoverable




function setalertbox(subj: string, msg: string, btnmsg: string, redirect: string, clickHandler?: () => void) {
	const modal = document.getElementById('alert_notice')!
	modal.classList.add('active');

	const titleEl = document.getElementById('alert_notice_title')!
	const msgEl = document.getElementById('alert_notice_msg')!
	const btnReset = document.getElementById('alert_notice_btn')!

	titleEl.textContent = subj;
	msgEl.textContent = msg;
	btnReset.textContent = btnmsg;

	if (btnReset) {
		btnReset.addEventListener('click', () => {
			if (clickHandler) {
				clickHandler();
			} else {
				window.location.href = redirect;
			}
		});
	}
}






const setup_service_worker = () => new Promise<void>((resolve, _reject) => {

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
					localStorage.clear();
					serviceworker_reg?.update()
				}, 300)
			}

			else if (event.data.action === 'error_out') {
				$N.LocalDBSync.ClearAllObjectStores()
				Unrecoverable("App Error", event.data.errmsg, "Restart App", event.data.subject as LoggerSubjectE, event.data.errmsg)
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
			if (!hasPreviousController) {
				hasPreviousController = true
				return;
			}
			$N.LocalDBSync.ClearAllObjectStores()

			 
			{   // set alertbox and log it
				const redirect = `/index.html?appupdate=done`;
				setalertbox("App Update", "app has been updated. needs restarted", "Restart App", redirect);
				$N.Logger.Log(LoggerTypeE.info, LoggerSubjectE.app_update, "");
			}
		}
	});
})








