
import { str } from "../defs_server_symlink.js"


type SSE_Listener = {
    name: str,
	el: HTMLElement,
    eventnames:string[],
	paths:str[]|null,
	priority:number,
    cb:(paths:str[])=>void
}


const _sse_listeners:SSE_Listener[] = []
let _sse_event_source:EventSource|null = null



function Init() {   

    let sse_id = localStorage.getItem('sse_id')

    if (!sse_id) {
        sse_id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
        localStorage.setItem('sse_id', sse_id)
    }

    const is_localhost = self.location.hostname === 'localhost'
    
    let event_source_url = ''
    
    if (is_localhost) 
        event_source_url = "/sse_add_listener?id=" + sse_id
    
    else if (location.hostname.includes('purewater')) 
        event_source_url = "https://webapp-805737116651.us-central1.run.app/sse_add_listener?id=" + sse_id
    
    else if (location.hostname.includes('purewater')) 
        event_source_url = "https://webapp-805737116651.us-central1.run.app/sse_add_listener?id=" + sse_id
    
    else 
        event_source_url = "https://xenwebapp-962422772741.us-central1.run.app/sse_add_listener?id=" + sse_id
    
    _sse_event_source = new EventSource(event_source_url)
    
    _sse_event_source.onerror = (_e) => {
        //broadcast_to_all_ports({action: 'SSE_ERROR'})
    }
    
    _sse_event_source.addEventListener("connected", (_e) => {
        //broadcast_to_all_ports({action: 'SSE_CONNECTED'})
    })
    
    _sse_event_source.addEventListener("datasync_doc_add", (e) => { // doc add
        handle_message({
            action: 'SSE_EVENT', 
            eventname: 'datasync_doc_add', 
            data: e.data
        })
    })
    
    _sse_event_source.addEventListener("datasync_doc_patch", (e) => { // doc patch
        handle_message({
            action: 'SSE_EVENT', 
            eventname: 'datasync_doc_patch', 
            data: e.data
        })
    })
    
    _sse_event_source.addEventListener("datasync_doc_delete", (e) => { // doc delete
        handle_message({
            action: 'SSE_EVENT', 
            eventname: 'datasync_doc_delete', 
            data: e.data
        })
    })
    
    _sse_event_source.addEventListener("datasync_collection", (e) => { // collection change
        handle_message({
            action: 'SSE_EVENT', 
            eventname: 'datasync_collection', 
            data: e.data
        })
    })
}




function Add_Listener(el:HTMLElement, name:str, eventnames:string[], paths:str[]|null, priority_:number|null, callback_:(obj:any)=>void) {

	for(let i = 0; i < _sse_listeners.length; i++) {
		if (!_sse_listeners[i].el.parentElement) {
			_sse_listeners.splice(i, 1)   
		}
	}

	const priority = priority_ || 0

	const newlistener = {
		name: name,
		el: el,
		eventnames,
		paths,
		priority,
		cb: callback_
	}


	Remove_Listener(el, name) // will just return if not found

	_sse_listeners.push(newlistener)

	_sse_listeners.sort((a, b)=> a.priority - b.priority)
}




function Close() {
	if (_sse_event_source) {
		_sse_event_source.close()
	}
}




function Remove_Listener(el:HTMLElement, name:str) {   
	const i = _sse_listeners.findIndex(l=> l.el.tagName === el.tagName && l.name === name)
	if (i === -1) return
	_sse_listeners.splice(i, 1)   
}




function handle_message(data: any) {
	const eventname   = data.eventname
	const event_data  = JSON.parse(data.data)
	const event_paths = event_data.paths ? event_data.paths : ( event_data.path ? [event_data.path] : null )
	handle_firestore_docs_from_worker(event_data, eventname, event_paths)
}




function handle_firestore_docs_from_worker(data:any, eventname:string, event_paths:str[]|null) {   

	const ls = _sse_listeners.filter(l=> { 
		l.eventnames.includes(eventname);
		// if paths are specified, check if any of the paths match AI!
	})



	if (!ls) throw new Error("should be at least one listener for FIRESTORE_COLLECTION, but none found")
	ls.forEach(l=> l.cb(data))
}

/*
function boot_up_with_shared_worker() {

    let id = localStorage.getItem('sse_id')

    if (!id) {
        id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
        localStorage.setItem('sse_id', id)
    }

    const worker_port = $N.GetSharedWorkerPort()
	if(worker_port) worker_port.postMessage({action: 'SSE_INIT_CONNECTION', sse_id: id})
}
*/




export { Init, Close }

if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).SSEvents = {Add_Listener, Remove_Listener };




