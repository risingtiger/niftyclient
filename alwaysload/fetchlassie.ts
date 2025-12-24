

import { str } from "../defs_server_symlink.js"
import { FetchResultT, FetchLassieHttpOptsT, FetchLassieOptsT } from "../defs.js"


let _timeoutWaitingAnimateId:any = null
let _activeRequestCount = 0 // Track number of active requests







function FetchLassie(url:str, http_optsP:FetchLassieHttpOptsT|undefined|null, opts:FetchLassieOptsT|undefined|null) { return new Promise<FetchResultT>(async (fetch_callback)=> { 

    const http_opts     = http_optsP || { method: "GET", headers: {}, body: null }

    http_opts.method    = typeof http_opts.method !== "undefined" ? http_opts.method : "GET"
    http_opts.headers   = typeof http_opts.headers !== "undefined" ? http_opts.headers : {}
    http_opts.body      = typeof http_opts.body !== "undefined" ? http_opts.body : null

	if (!opts) { opts   = { retries: 0, background: true, animate: true, cacheit: false }; }

	opts.retries                = opts.retries || 0
	opts.background             = opts.background || true
	opts.animate                = opts.animate || true
	opts.cacheit                = opts.cacheit || false


    if (opts.cacheit) {
		const future_epoch_seconds = get_cache_future_epoch_seconds_from_str(opts.cacheit === true ? "5m" : opts.cacheit as string)
        http_opts.headers = http_opts.headers || {};
        http_opts.headers['Nifty-Cache'] = future_epoch_seconds.toString();
	}

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
		http_opts.headers["exitdelay"] = 3.1
	}

	let result:any = null
	for(let i = 0; i < opts.retries+1; i++) {
		result = await fetchit(url, http_opts)

		if (result.status !== 503) break

		// will cycle to next retry if more retries specified
		await new Promise((res)=>setTimeout(res, 1500)) 
	}

    _activeRequestCount--;


	/* ---------- CLEAR ANIMATION IF NO MORE ACTIVE REQUESTS ---------- */
    if (_activeRequestCount === 0) {
        if (_timeoutWaitingAnimateId !== null) {
            clearTimeout(_timeoutWaitingAnimateId);
            _timeoutWaitingAnimateId = null;
        }
        setBackgroundOverlay(false);
        setWaitingAnimate(false);
    }
	/* ---------------------------------------------- */


	if (result.status !== 200) {
		fetch_callback({headers:result.headers, status: result.status, statusText: result.statusText, ok: false})
		return;
	}

	try {
		const returnobj:FetchResultT = {
			headers: result.headers,
			status: 200, // we handled non-200 above
			statusText: result.statusText,
			ok: true, // we've handled non-200 above
		}

		if (http_opts.headers["Accept"] === "application/json") {
			returnobj.data = await result.json() // call could fail
		} else {
			returnobj.data = await result.text() // call could fail
		}
		fetch_callback(returnobj)

	} catch (e) {
		fetch_callback({status: 400, statusText: "Could not parse text or json", ok: false, headers: result.headers})
	}
})}




const fetchit = (url:string, http_opts:FetchLassieHttpOptsT) => new Promise<Response>((response_callback,_rej)=> {
	fetch( url, http_opts )
		.then(async (server_response:Response)=> {
			response_callback(server_response)
		});

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




function get_cache_future_epoch_seconds_from_str(cache_time_amount:string):string {

	const normalized = cache_time_amount.trim().toLowerCase()
	const match = normalized.match(/^(\d{1,3})([smhd])$/)

	if (!match) {
		// Unhandled Case: handle invalid cache time format
		return Math.floor(Date.now() / 1000).toString()
	}

	const amount = Number(match[1])
	const unit = match[2]
	let multiplier = 1

	if (unit === "m") multiplier = 60
	if (unit === "h") multiplier = 3600
	if (unit === "d") multiplier = 86400

	const nowInSeconds = Math.floor(Date.now() / 1000)
	return ( nowInSeconds + amount * multiplier ).toString()
}




if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).FetchLassie = FetchLassie;



