
import { str, SSETriggersE } from "../defs_server_symlink.js"
import { $NT, LoggerTypeE, LoggerSubjectE } from "../defs.js"


type SSE_Listener = {
    name: str,
	el: HTMLElement,
    triggers:SSETriggersE[],
	priority:number,
    cb:(paths:str[])=>void
}


declare var $N: $NT;


const sse_listeners:SSE_Listener[] = []
let evt: EventSource|null = null
let connect_ts = 0
//let evt_state:EventState_ = EventState_.UNINITIALIZED
//let set_timeout_intrv:NodeJS.Timeout|null = null
//let connection_init_time = 0




function Init() {   
    boot_up()
}




function ForceStop() {   
	if (evt)
		evt.close()
}




const WaitTilConnectedOrTimeout = () => new Promise<boolean>(async (res, _rej)=> {

	let counter = 0

	if (evt && evt.readyState === EventSource.OPEN) {
		res(true)
		return
	} else {
		const intrv = setInterval(()=> {
			if (evt && evt.readyState === EventSource.OPEN) {
				clearInterval(intrv)
				res(true)
			}

			counter++

			if (counter > 30) {
				clearInterval(intrv)
				res(false)
			}

		}, 100)
	}
})




function Add_Listener(el:HTMLElement, name:str, triggers:SSETriggersE[], priority_:number|null, callback_:(obj:any)=>void) {

	for(let i = 0; i < sse_listeners.length; i++) {
		if (!sse_listeners[i].el.parentElement) {
			sse_listeners.splice(i, 1)   
		}
	}

	const priority = priority_ || 0

	const newlistener = {
		name: name,
		el: el,
		triggers,
		priority,
		cb: callback_
	}


	Remove_Listener(el, name) // will just return if not found

	sse_listeners.push(newlistener)

	sse_listeners.sort((a, b)=> a.priority - b.priority)
}




function Remove_Listener(el:HTMLElement, name:str) {   
	const i = sse_listeners.findIndex(l=> l.el.tagName === el.tagName && l.name === name)
	if (i === -1) return
	sse_listeners.splice(i, 1)   
}




function boot_up() {

    let id = localStorage.getItem('sse_id')

    if (!id) {
        id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
        localStorage.setItem('sse_id', id)
    }

    const isLocalhost = window.location.hostname === 'localhost'

	let eventSourceUrl = ''

	if (isLocalhost) 
		eventSourceUrl = "/sse_add_listener?id=" + id

	else if (location.hostname.includes('purewater')) 
		eventSourceUrl = "https://webapp-805737116651.us-central1.run.app/sse_add_listener?id=" + id

	else if (location.hostname.includes('purewater')) 
		eventSourceUrl = "https://webapp-805737116651.us-central1.run.app/sse_add_listener?id=" + id

	else 
		eventSourceUrl = "https://xenwebapp-962422772741.us-central1.run.app/sse_add_listener?id=" + id

    
    evt = new EventSource(eventSourceUrl);
	connect_ts = Date.now()

    evt.onerror = (_e) => {
		$N.Logger.Log(LoggerTypeE.error, LoggerSubjectE.sse_listener_error, ``)
    }

    evt.addEventListener("connected", (_e) => {
		//
    })

    evt.addEventListener("a_"+SSETriggersE.FIRESTORE_DOC_ADD, (e) => handle_firestore_docs(e, SSETriggersE.FIRESTORE_DOC_ADD)) 
	evt.addEventListener("a_"+SSETriggersE.FIRESTORE_DOC_PATCH, (e) => handle_firestore_docs(e, SSETriggersE.FIRESTORE_DOC_PATCH))
	evt.addEventListener("a_"+SSETriggersE.FIRESTORE_DOC_DELETE, (e) => handle_firestore_docs(e, SSETriggersE.FIRESTORE_DOC_DELETE))
	evt.addEventListener("a_"+SSETriggersE.FIRESTORE_COLLECTION, (e) => handle_firestore_docs(e, SSETriggersE.FIRESTORE_COLLECTION))



    // lets just see if the browser will take care of when user goes in and out of focus on window / app
}




function handle_firestore_docs(e:MessageEvent, trigger:SSETriggersE) {   
	const data = JSON.parse(e.data)
	const ls = sse_listeners.filter(l=> l.triggers.includes(trigger))
	if (!ls) throw new Error("should be at least one listener for FIRESTORE_COLLECTION, but none found")
	ls.forEach(l=> l.cb(data))
}






export { Init }

if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).SSEvents = {ForceStop, Add_Listener, Remove_Listener, WaitTilConnectedOrTimeout };

