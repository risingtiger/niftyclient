

import { str } from "../defs_server_symlink.js"
import { FetchResultT, FetchLassieHttpOptsT, FetchLassieOptsT } from "../defs.js"


let _timeoutWaitingAnimateId:any = null
let _activeRequestCount = 0 // Track number of active requests




function FetchLassie(url:str, http_optsP:FetchLassieHttpOptsT|undefined|null, opts:FetchLassieOptsT|undefined|null) { return new Promise<FetchResultT>(async (fetch_callback)=> { 

    const http_opts     = http_optsP || { method: "GET", headers: {}, body: null }

    http_opts.method    = typeof http_opts.method !== "undefined" ? http_opts.method : "GET"
    http_opts.headers   = typeof http_opts.headers !== "undefined" ? http_opts.headers : {}
    http_opts.body      = typeof http_opts.body !== "undefined" ? http_opts.body : null

	if (!opts) { opts   = { retries: 0, background: true, animate: true }; }

	opts.retries        = opts.retries || 0
	opts.background     = opts.background || true
	opts.animate        = opts.animate || true

    _activeRequestCount++;

	if (opts.background) {   setBackgroundOverlay(true);   }
    
    // Only start animation timer if it's not already running
	if (opts.background && opts.animate && _timeoutWaitingAnimateId === null) { 
		_timeoutWaitingAnimateId = setTimeout(() => {   setWaitingAnimate(true);   }, 1000);
	}

    if(!http_opts.headers["Content-Type"]) http_opts.headers["Content-Type"] = "application/json"
    if(!http_opts.headers["Accept"]) http_opts.headers["Accept"] = "application/json"

	http_opts.headers["sse_id"] = localStorage.getItem('sse_id') || null

	if (opts.retries && opts.retries > 0) {
		http_opts.headers["call_even_if_offline"] = "true"
		http_opts.headers["exitdelay"] = 2.7
	}

	let result:any = null
	for(let i = 0; i < opts.retries+1; i++) {
		result = await fetchit(url, http_opts)

		if (result.status !== 503) break

		// will cycle to next retry if more retries specified
	}

    _activeRequestCount--;

    // Only clear animations if this is the last active request
    if (_activeRequestCount === 0) {
        if (_timeoutWaitingAnimateId !== null) {
            clearTimeout(_timeoutWaitingAnimateId);
            _timeoutWaitingAnimateId = null;
        }
        setBackgroundOverlay(false);
        setWaitingAnimate(false);
    }

	if (result.status === 503) {
		fetch_callback({ status: 503, statusText: "Network error", ok: false }); 
		return;
	}

	const returnobj:FetchResultT = {
		status: result.status,
		statusText: result.statusText,
		ok: result.status === 200,
	}

	try {
		if (result.status === 200) {
			if (http_opts.headers["Accept"] === "application/json") {
				returnobj.data = await result.json() // call could fail
			} else {
				returnobj.data = await result.text() // call could fail
			}
		}
	} catch (e) { /* do nothing. data is empty */ }


	fetch_callback(returnobj)
})}




const fetchit = (url:string, http_opts:FetchLassieHttpOptsT) => new Promise<Response>((response_callback,_rej)=> {
	fetch( url, http_opts )
		.then(async (server_response:Response)=> {
			response_callback(server_response)
			// just pass through basically. service worker handles hanging fertches etc, so handle
			// status 200, 400 or any other at the instance code
		})
		// no need to catch errors here, as we are already catching them in the service worker
})




function setBackgroundOverlay(ison:boolean) {
    const xel = document.querySelector("#fetchlassy_overlay")!
    if (ison) {   xel.classList.add("active");   } else {   xel.classList.remove("active");   }
}




function setWaitingAnimate(ison:boolean) {
    const xel = document.querySelector("#fetchlassy_overlay .waiting_animate")!
    if (ison) {   xel.classList.add("active");   } else {   xel.classList.remove("active");   }
}




if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).FetchLassie = FetchLassie;



