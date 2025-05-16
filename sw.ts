enum UpdateState { DEFAULT, UPDATING, UPDATED }


const PRELOAD_ASSETS = [
	"/assets/lazy/views/appmsgs/appmsgs.js",
	"/assets/lazy/views/login/login.js",
	"/assets/instance/lazy/views/home/home.js"
]

const INITIAL_CHECK_CONNECTIVITY_INTERVAL = 5000;
const MAX_CHECK_CONNECTIVITY_INTERVAL     = 5 * 60 * 1000; // 5 minutes max backoff
const EXITDELAY                           = 9000 // just the default. can be overridden in the fetch request

let _cache_name        = 'cacheV__0__';
let _cache_version     = Number(_cache_name.split("__")[1])
let _id_token          = ""
let _token_expires_at  = 0
let _refresh_token     = ""
let _user_email        = ""
let _isoffline         = false
let _check_connectivity_interval = INITIAL_CHECK_CONNECTIVITY_INTERVAL;
let timeouthandler:any = null





self.addEventListener('install', (event:any) => {
	event.waitUntil((async () => {

		// Optionally, pre-cache any needed static assets here:
		// const cache = await caches.open(CACHE_NAME);
		// await cache.addAll([
		//   '/index.html',
		//   '/main.js',
		//   '/styles.css',
		//   ...
		// ]);

		await (self as any).skipWaiting();
	})());
});




self.addEventListener('activate', (event:any) => {
	event.waitUntil((async () => {
		const cacheKeys = await caches.keys();
		for (const key of cacheKeys) {
			if (key !== _cache_name) {
				await caches.delete(key);
			}
		}

		await (self as any).clients.claim();

		setTimeout(()=> preload_all_components(), 12000)
	})());
});




self.addEventListener('controllerchange', (_e:any) => {
})




self.addEventListener('fetch', (e:any) => {

    let promise = new Promise(async (res, _rej) => {

		if (e.request.url.includes("identitytoolkit.googleapis.com") || e.request.url.includes("sse_add_listener")) {
			const r = await fetch(e.request)
			res(r)
			return
		}

		const accepth = e.request.headers.get('Accept') || ""
		const calltype:"data"|"file" = accepth.includes('json') || accepth.includes('csv') ? "data" : "file"

		const response = (calltype === "data") ? await handle_data_call(e.request) : await handle_file_call(e.request)

		res(response)
    })

    e.respondWith(promise)
})




self.addEventListener('message', async (e:any) => {

	if (e.data.action === "update") {
		//@ts-ignore
		self.registration?.update()
	}

	else if (e.data.action === "initial_pass_auth_info") {
		_id_token = e.data.id_token;
		_token_expires_at = Number(e.data.token_expires_at);
		_refresh_token = e.data.refresh_token;
		_user_email = e.data.user_email;
	}
})




self.addEventListener('push',(e:any)=>{

    if(self.Notification.permission == 'denied'){
        return;
    }

    if(self.Notification.permission == 'default'){
        //
    }

    try{
        const msg = (e.data.json()).data

        const options = {   body: msg.body   };

        e.waitUntil((self as any).registration.showNotification(msg.title,options))

    } catch(err){
        throw new Error('Error in SW: '+err)
    }
})




self.addEventListener('notificationclick', (event:any) => {

    event.waitUntil(
        //(self as any).clients.openWindow("some page")
    )
})

/*
self.addEventListener("pushsubscriptionchange", (event) => {

    const subscription = (self as any).registration.pushManager.subscribe(event.oldSubscription.options)

    .then((subscription) =>
    fetch("register", {
    method: "post",
    headers: {
    "Content-type": "application/json",
    },
    body: JSON.stringify({
    endpoint: subscription.endpoint,
    }),
    }),
    );
    event.waitUntil(subscription);
    },

    false,
)
*/

/*
async function check_update_polling() {

	while (true) {

		await new Promise(r => setTimeout(r, 3000))

		console.log("check_update_polling")
		const response = await fetch('/api/latest_app_version')
		const server_version = Number(await response.text())

		//@ts-ignore
		//self.clients.matchAll().then((clients:any) => {
		//	clients.forEach((client:any) => {
		//		client.postMessage({ msg: "testlog", cache_version, server_version })
		//	})
		//})

		//@ts-ignore
		if (Number(server_version) != cache_version && self.registration && self.registration.update) {
			//@ts-ignore
			self.registration?.update()
		}
    }
}
*/




const handle_data_call = (r:Request) => new Promise<Response>(async (res, _rej) => { 





	/*
	now sometin be fucked with the data fetch. getting bunch o errors on 
    POST http://localhost:3004/api/firestore_get_batch net::ERR_ABORTED 503 (Network error)
	even when connected to the network.
		*/








	if (_isoffline && !r.headers.get('call_even_if_offline')) {
		res(new Response(null, { status: 503, statusText: 'Network error - App Offline' }))
		return
	}


	const ar = await authrequest().catch(err=> err)
	if (ar === "ok") {
		// do nothing. its ok
	}
	else if (ar === "Network error") {
		if (!_isoffline) _check_connectivity_interval = INITIAL_CHECK_CONNECTIVITY_INTERVAL
		check_connectivity()
		_isoffline = true;
		res(new Response(null, { status: 503, statusText: 'Network error - On Auth Request' }))
		// cannot authenticate. But this is a network error, so give retries etc a chance to recover before killing the app
		return
	}
	else {
		// auth cannot authenticate. so do NOT resolve promise. Main.js has been notified and will handle eventual page redirection 
		return
	}

	const is_appapi   = r.url.includes("/api/") ? true : false
	const new_headers = new Headers(r.headers);

	if (is_appapi) {
		new_headers.append('appversion', _cache_version.toString())
		new_headers.append('Authorization', `Bearer ${_id_token}`)
	}

	const { signal, abortsignal_timeoutid } = set_abort_signal(r.headers)

	const new_request = new Request(r, {headers: new_headers, cache: 'no-store', signal});

	const server_response = await fetch(new_request)
		.catch(() => {
			if (!_isoffline) _check_connectivity_interval = INITIAL_CHECK_CONNECTIVITY_INTERVAL
			_isoffline = true;
			check_connectivity()
			res(new Response( null, { status: 503, statusText: 'Network error' } ))
			return null
		})
	if (!server_response) return;


	_isoffline = false;

	clearTimeout(abortsignal_timeoutid)

	if (is_appapi && server_response.status === 401) { // unauthorized
		await error_out("sw4", "") 
		// don't resolve. the fetch request will stay pending. But main.js will be notified and will handle the error including page redirection
		return
	}

	else if (is_appapi && server_response.status === 410) {
		(self as any).clients.matchAll().then((clients:any) => {
			clients.forEach((client: any) => {
				client.postMessage({ action: 'update_init' });
			})
		})
		// don't resolve. the fetch request will stay pending. But main.js will be notified and will handle update including page redirection
		return

	} else {
		res(server_response) 
	} 

	if (server_response.status !== 200)   logit( 40, "swe", `${ new_request.url } - ${ server_response.status } - ${ server_response.statusText }` )
})




const handle_file_call = (r:Request) => new Promise<Response>(async (res, _rej) => { 

	const nr = (r.url.includes("__.js")) ? create_jsimport_file_call_request(r) : r

	const cache   = await caches.open(_cache_name)
	const match_r = await cache.match(nr)

	if (match_r) { 
		res(match_r) 

	} else if (_isoffline && !nr.headers.get('call_even_if_offline')) {
		res(set_failed_file_response())                                                                            

	} else {
		const { signal, abortsignal_timeoutid } = set_abort_signal(nr.headers)
		
		try {
			const response = await fetch(nr, { signal })
			_isoffline = false;
			clearTimeout(abortsignal_timeoutid)
			
			if (response.status === 200 && should_url_be_cached(nr)) {
				cache.put(nr, response.clone())
			}
			res(response)

		} catch (err:any) {
			logit(40, "swe", `${nr.url} - Network error`)
			if (!_isoffline) _check_connectivity_interval = INITIAL_CHECK_CONNECTIVITY_INTERVAL
			_isoffline = true;
			check_connectivity()
			res(set_failed_file_response())
		}
	}
})




const create_jsimport_file_call_request = (existing_r:Request): Request => {

	// lazyload_files import uses a cache buster to ensure that the file is reloaded on failed atempts. 
	// this function strips the cache buster from the url and creates a new request object with the same properties as the original request
	// this way we can still store it in the local Cache for subsequent calls

	const url = existing_r.url.split("__")[0] + ".js"

    const new_request = new Request(url, {
        body: null,
        cache: "default", 
        credentials: "same-origin",
        headers: {},
		integrity: "",
        method: "GET",
        mode: "cors",
        redirect: "error",
        referrer: existing_r.referrer,
		referrerPolicy: "strict-origin-when-cross-origin",
    });
    return new_request;
}




const set_failed_file_response = () => { 

	let headers: {[key: string]: string} = {
		'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
	}
	const returnresponse = new Response('Failed to Fetch File', {                               
		status: 503,                                                               
		statusText: 'Network error',                                                
		headers
	})

	return returnresponse
}




function set_abort_signal(headers:Headers) {

	let controller = new AbortController()
	const { signal } = controller;
	const exitdelay = headers.get("exitdelay") || EXITDELAY;
	const abortsignal_timeoutid     = setTimeout(() => { controller.abort(); }, Number(exitdelay));

	return { signal, abortsignal_timeoutid }
}



function should_url_be_cached(request:Request) {
    if (request.url.includes(".webmanifest") || request.url.includes("/assets/") || request.url.includes("/v/")) {
        return true;
    }
    // Also cache .js files that are not dynamic imports with ?t= (already handled by create_jsimport_file_call_request)
    // and ensure we are caching the version without ?t= for dynamic imports
    else if (request.url.endsWith(".js")) {
        return true;
    }
    else {
        return false;
    }
}




function authrequest() { return new Promise<string>(async (res,rej)=> { 

	// keep in mind that when retries are set (case in point being the refocus of the app), its probably gonna be authrequest that is gonna be first initial call 
	// right now the the exitdelay is overriden to be 2.7 seconds (check FetchLassie logic to ascertain current value). a little problematic because refresh token could take longer on slow connections

    if (!_id_token) {
		await error_out("sw4", "authrequest no token in browser storage")
		rej("No token in browser storage")
        return
    }


    if (Date.now()/1000 > _token_expires_at-30) {

        const body = { refresh_token: _refresh_token }

        const { signal, abortsignal_timeoutid } = set_abort_signal(new Headers()); // dumb header, not used

        fetch('/api/refresh_auth', {
            method: 'POST',
            headers: {'Content-Type': 'application/json',},
            body: JSON.stringify(body),
            signal: signal

        }).then(async r=> {
            clearTimeout(abortsignal_timeoutid);

            let data = await r.json() as any

            if (data.error) {
				await error_out("sw4", "authrequest refresh failed - " + data.error.message)
				rej("Refresh failed")
            }

            else {
                _id_token = data.id_token
                _refresh_token = data.refresh_token
                _token_expires_at = Math.floor(Date.now()/1000) + Number(data.expires_in);

				(self as any).clients.matchAll().then((clients:any) => {
					clients.forEach((client: any) => {
						client.postMessage({
							action: 'update_auth_info',
							id_token: _id_token,
							refresh_token: _refresh_token,
							token_expires_at: _token_expires_at
						})
					})
				})

                res("ok")
            }

        }).catch(async _err=> {
            clearTimeout(abortsignal_timeoutid);
			rej("Network error") 
        })
    }

    else {
        res("ok")
    }
})}




const error_out = (subject:string, errmsg:string="") => new Promise((res, _rej) => {

	(self as any).clients.matchAll().then((clients:any) => {
		clients.forEach((client: any) => {
			client.postMessage({
				action: 'error_out',
				subject,
				errmsg
			})
		})
	})

	// by the time this settimeout hits, the main thread has been notified and should have already completely redirected the app to error page
	setTimeout(()=> { res(1) }, 100)
})




function logit(type:number, subject:string, msg:string="") {

	(self as any).clients.matchAll().then((clients:any) => {
		setTimeout(()=> {
			clients.forEach((client: any) => {
				client.postMessage({
					action: 'logit',
					type,
					subject,
					msg
				})
			})
		},100)
	})
}




const check_connectivity = async () => {

	if (_isoffline) {

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 3000);

		await fetch('/api/ping', { signal: controller.signal })
			.then(()=> {
				clearTimeout(timeout);
				_check_connectivity_interval = MAX_CHECK_CONNECTIVITY_INTERVAL
				_isoffline = false;
			})
			.catch(()=> {
				clearTimeout(timeout);
				_check_connectivity_interval = Math.min(_check_connectivity_interval * 1.5, MAX_CHECK_CONNECTIVITY_INTERVAL)
				_isoffline = true;
			})
	}

	clearTimeout(timeouthandler)
	// hack! just keep it checking every 5 seconds
	_check_connectivity_interval = INITIAL_CHECK_CONNECTIVITY_INTERVAL
	timeouthandler = setTimeout(() => check_connectivity(), _check_connectivity_interval)
}




const preload_all_components = () => new Promise(async (res, _rej) => {

	// empty for now. may put toast in there. but have to actually load it and make it accessible to DOM

	const cache   = await caches.open(_cache_name)

	const promises = SELECTED_PRELOAD_COMPONENTS.map(async (url) => new Promise(async (res_b, _rej_b) => {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 12000);
		
		const r = await fetch(url, { signal: controller.signal }).catch(()=>null)
		clearTimeout(timeout);
		
		if (!r || r.status !== 200) { res_b(0); return; }

		cache.put(url, r!.clone())
		res_b(1)
	}))

	Promise.all(promises).then(() => {
		res(1);
	});
});
