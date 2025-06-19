
import { str } from "../defs_server_symlink.js"
import { $NT } from "../defs.js"


type SSE_Listener = {
    name: str,
	el: HTMLElement,
    triggers:number[],
	priority:number,
    cb:(paths:str[])=>void
}


declare var $N: $NT;


const _sse_listeners:SSE_Listener[] = []




function Init() {   
    boot_up()
}




function HandleMessage(data: any) {
	const trigger = data.trigger
	const event_data = JSON.parse(data.data)
	handle_firestore_docs_from_worker(event_data, trigger)
}




function Add_Listener(el:HTMLElement, name:str, triggers:number[], priority_:number|null, callback_:(obj:any)=>void) {

	for(let i = 0; i < _sse_listeners.length; i++) {
		if (!_sse_listeners[i].el.parentElement) {
			_sse_listeners.splice(i, 1)   
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

	_sse_listeners.push(newlistener)

	_sse_listeners.sort((a, b)=> a.priority - b.priority)
}




function Remove_Listener(el:HTMLElement, name:str) {   
	const i = _sse_listeners.findIndex(l=> l.el.tagName === el.tagName && l.name === name)
	if (i === -1) return
	_sse_listeners.splice(i, 1)   
}




function boot_up() {

    let id = localStorage.getItem('sse_id')

    if (!id) {
        id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
        localStorage.setItem('sse_id', id)
    }

    const worker_port = $N.GetSharedWorkerPort()
	worker_port.postMessage({action: 'SSE_INIT_CONNECTION', sse_id: id})
}








function handle_firestore_docs_from_worker(data:any, trigger:number) {   
	const ls = _sse_listeners.filter(l=> l.triggers.includes(trigger))
	if (!ls) throw new Error("should be at least one listener for FIRESTORE_COLLECTION, but none found")
	ls.forEach(l=> l.cb(data))
}






export { Init }

if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).SSEvents = {Add_Listener, Remove_Listener, HandleMessage };

