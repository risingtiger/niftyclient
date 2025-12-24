

import { PRELOAD_BASE_ASSETS_T } from './defs.js';


//enum UpdateState { DEFAULT, UPDATING, UPDATED }

const enum RequestURLType { INTERNAL_API, FILE, VIEW_URL}

const enum ConnectStateE { ONLINE, OFFLINE }

const PRELOAD_BASE_ASSETS:PRELOAD_BASE_ASSETS_T[] = [
	"/v/appmsgs",
	"/v/login",
	"/v/home",
	"/",
]

//const INITIAL_CHECK_CONNECTIVITY_INTERVAL = 5000;
const CONNECTEDSTATE_CHECK_TIMEOUT             = 5000
const PERIODIC_MAINTENANCE_INTERVAL            = 60 * 60 * 1000; // every hour
const INITIAL_PERIODIC_MAINTENANCE_INTERVAL    = 15 * 1000 
const DELAY_PRELOAD_BASE_ASSETS                = 10 * 1000;
const EXITDELAY                                = 9000 // just the default. can be overridden in the fetch request
const BACKOFF_MAX                              = 24; // max 120s (5s * 24)

let _cache_name                                = 'cacheV__0__';
let _cache_version                             = Number(_cache_name.split("__")[1])
let _id_token                                  = ""
let _token_expires_at                          = 0
let _refresh_token                             = ""
let _lazyload_view_urlpatterns:Array<string[]> = []
let _connectedstate                            = ConnectStateE.ONLINE; // assume online at start
let _connectedcheck_timeout:any                = 0;
let _backoff_multiplier                        = 1;
let _is_test_logging                           = true;
const _client_visibility:Map<string, boolean>  = new Map(); // track visibility per client/tab







self.addEventListener('install', (event:any) => {

	//(self as any).skipWaiting();
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

		setTimeout(()=> preload_base_assets_into_cache(PRELOAD_BASE_ASSETS), DELAY_PRELOAD_BASE_ASSETS);
	})());
});




self.addEventListener('controllerchange', (_e:any) => {
})




self.addEventListener('fetch', (e:FetchEvent) => {

	let requesturltype:RequestURLType = RequestURLType.VIEW_URL // default view_Url

	const pathname = ( new URL(e.request.url) ).pathname;

	if (pathname.startsWith("sse_add_listener")) {   return;   }


	if (pathname.startsWith('/v/') || pathname === '/') {
		requesturltype = RequestURLType.VIEW_URL;
		e.respondWith(handle_file_call(e.request, pathname, requesturltype)) // always returns a response
		return;
	}

	if (pathname.startsWith('/assets/') || pathname.startsWith('/favicon.ico') || pathname.startsWith('/app.webmanifest') || pathname.startsWith('/shared_worker.js')) {
		requesturltype = RequestURLType.FILE;
		e.respondWith(handle_file_call(e.request, pathname, requesturltype)) // always returns a response
		return;
	}

	if (pathname.startsWith('/api/')) {
		requesturltype = RequestURLType.INTERNAL_API;
		e.respondWith(handle_data_call(e.request)); // always returns a response
		return;
	}

	e.respondWith(new Promise<Response>(async (res, _rej) => {
		try {
			const r = await fetch(e.request, { signal: AbortSignal.timeout(EXITDELAY) });
			res(r)

		} catch (err) {
			set_connectedstate_offline('fetch call timeout');
			res(new Response(null, { status: 503, statusText: 'Network error' }));
		}
	}));

})




self.addEventListener('message', async (e:any) => {

	if (e.data.action === "update") {
		//@ts-ignore
		self.registration?.update()
	}

	else if (e.data.action === "initial_data_pass") {
		_id_token = e.data.id_token;
		_token_expires_at = Number(e.data.token_expires_at);
		_refresh_token = e.data.refresh_token;
		_lazyload_view_urlpatterns = e.data.lazyload_view_urlpatterns;
		clearTimeout(_connectedcheck_timeout) // probably not needed since this should be the first call 	
		setTimeout(()=>periodicmaintenance(), INITIAL_PERIODIC_MAINTENANCE_INTERVAL);
		connectedcheck()
	}

	else if (e.data.action === 'networkchange') {
		clearTimeout(_connectedcheck_timeout)	
		_connectedcheck_timeout = setTimeout(()=> {
			connectedcheck()
		}, 750) // give it a timeout because the phone might be active on the cell network but not actually online just yet
	}

	else if (e.data.action === 'set_test_logging_true') {
		_is_test_logging = true;
	}

	else if (e.data.action === 'visibilitychange') {
		const clientId = e.source?.id;
		if (!clientId) return;
		
		const was_any_focused = isAnyClientFocused();
		_client_visibility.set(clientId, e.data.is_visible);
		const is_any_focused = isAnyClientFocused();
		
		// if app just came back into focus, trigger an immediate check
		if (!was_any_focused && is_any_focused) {
			clearTimeout(_connectedcheck_timeout);
			connectedcheck();
		}
	}

	else if (e.data.action === 'getconnectedstate') {
		e.source.postMessage({ 
			action: 'connectedstate', 
			state: _connectedstate === ConnectStateE.ONLINE ? 'online' : 'offline' 
		});
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

	const base_headers  = new Headers(r.headers);
	const should_cache  = base_headers.has('Nifty-Cache')
	const cache_api     = should_cache ? await caches.open(_cache_name) : null

	// Check cache first before checking offline state
	if (should_cache && cache_api) {
		const cached_response = await cache_api!.match(r);
		if (cached_response) {
			const keys = await cache_api!.keys();
			const req = keys.find(k => k.url === r.url && k.method === r.method && k.headers.has('Nifty-Cache'));
			const cache_ts = req?.headers.get('Nifty-Cache') || null;	
			const ts = cache_ts ? Number(cache_ts) : null;
			if (ts && !isNaN(ts)) { 
				const nowts = Math.round(Date.now() / 1000)

				if (nowts > ts) {
					// cache expired. default to proceed to network fetch

				} else {
					const headers_with_flag = new Headers(cached_response.headers);
					headers_with_flag.set('Nifty-Is-Cache', 'true');
					const flagged_response = new Response(cached_response.body, {
						status: cached_response.status,
						statusText: cached_response.statusText,
						headers: headers_with_flag
					});
					res(flagged_response);
					return
				}
			}
			// unable to verify ts. proceed to network fetch
		}
		// no valid cache found, proceed to network fetch
	}

	// Now check offline state - no valid cache available at this point
	if (_connectedstate === ConnectStateE.OFFLINE) {
		res(new Response(null, { status: 503, statusText: 'Network error - App Offline', headers: new Headers() }));
		return
	}


	let ar:any;

	try			{ ar = await authrequest(); }
	catch (err) { 
		if (err === "Network error") {
			set_connectedstate_offline('data call timeout');
			res(new Response(null, { status: 503, statusText: 'Network error', headers: new Headers() })); 
			return; 
		}
		await error_out("sw4", "authrequest failed during data call - " + err)
		res(new Response(null, { status: 401, statusText: 'Unauthorized', headers: new Headers() })); return; 
	}


	base_headers.append('versionofapp', _cache_version.toString())
	base_headers.append('Authorization', `Bearer ${_id_token}`)

	const network_request = new Request(r, { headers: base_headers, cache: 'no-store', signal: AbortSignal.timeout(EXITDELAY) });

	let server_response:Response;

	try			    {   server_response = await fetch(network_request) }
	catch (err:any) {
		set_connectedstate_offline('data call timeout');
		res(new Response(null, { status: 503, statusText: 'Network error', headers: new Headers() }));
		return;
	}


	if (server_response.status === 401) { // unauthorized
		await error_out("sw4", "") 
		res(new Response( null, { status: 401, statusText: 'Unauthorized', headers: new Headers()  } ))
		return
	}

	if (server_response.headers.get('updatedrequired')) {
		(self as any).clients.matchAll().then((clients:any) => {
			clients.forEach((client: any) => {
				client.postMessage({ action: 'update_init' });
			})
		})
		// resolve, otherwise the fetch request will stay pending and disrupt service worker from updating
		res(new Response( null, { status: 426, statusText: 'updatedrequired', headers: new Headers()  } ))
		return

	}

	if (server_response.status === 200 && should_cache && cache_api) {   
		cache_api!.put(network_request!, server_response.clone());   
	}

	res(server_response) 
})




/*
const revalidate_cached_request = async (original_request: Request, _cached_response: Response, response_digest: string, base_headers: Headers, cache_api: Cache) => new Promise<void>(async (res, _rej) => {

	let r:Response;

	base_headers.set('Nifty-Cache-Digest', response_digest);

	const { signal } = set_abort_signal(base_headers)
	const cache_refresh_request = new Request(original_request, { headers: base_headers, cache: 'no-store', signal });

	try { r = await fetch(cache_refresh_request); } 
	catch (_err) { console.error("revalidate_cached_request fetch error"); res(); return; }

	if (r.status === 304) {   console.log("no modifications"); return;   }

	if (r.status !== 200) {   res(); return;   }

	await cache_api.put(cache_refresh_request, r.clone());

	(self as any).clients.matchAll().then((clients:any) => {
		clients.forEach((client:any) => {
			client.postMessage({ action: 'cache_revalidated', url: original_request.url });
		})
	})
});
*/




const handle_file_call = (nr:Request, pathname:string, requesturltype:RequestURLType) => new Promise<Response>(async (res, _rej) => { 

	const viewname            = requesturltype === RequestURLType.VIEW_URL ? get_view_name_from_url(pathname) : null;
	const request_for_viewurl = viewname ? new Request("/v/"+viewname) : null
	
	const cache   = await caches.open(_cache_name)
	const match_r = await cache.match(request_for_viewurl || nr)

	if (match_r) {   res(match_r); return;  } 


	if (_connectedstate === ConnectStateE.OFFLINE) {   res(set_failed_file_response()); return;   }


	let r:any
	try { r = await fetch(nr, { signal: AbortSignal.timeout(EXITDELAY) }); }
	catch (err:any) {
		set_connectedstate_offline('file call timeout');
		res(set_failed_file_response())
		return
	}
		
	if (r.status !== 200) {
		res(set_failed_file_response())
		return;
	}

	if (r.status === 200 && should_url_be_cached(pathname)) {
		cache.put(request_for_viewurl || nr, r.clone())
	}
	res(r)
})




const get_view_name_from_url = (pathname: string): string | null => {

	pathname = pathname.slice(3) // remove leading "/v/"

	for (const [viewname, pattern] of _lazyload_view_urlpatterns) {
		const regex = new RegExp(pattern);

		if (regex.test(pathname))    return viewname;
	}
	
	return null;
}




const set_failed_file_response = () => { 
	let headers: {[key: string]: string} = {
		'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
	}

	const responsebody = `Unable to Load File`

	const returnresponse = new Response(responsebody, {                               
		status: 503,                                                               
		statusText: 'Network error',                                                
		headers
	})

	return returnresponse
}




// const set_failed_file_response_htmlpage = (_nr:Request) => { 
//
// 	let headers = new Headers({
// 		'Content-Type': 'text/html; charset=UTF-8',
// 		'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
// 		'X-Content-Type-Options': 'nosniff'
// 	})
//
// 	const responsebody = `<!DOCTYPE html>
// 	<html lang="en">
// 	<head>
// 		<meta charset="UTF-8">
// 		<meta name="viewport" content="width=device-width, initial-scale=1.0">
// 		<title>Unable To Load Page</title>
// 	</head>
// 	<body>
// 		<script>
// 			setTimeout(()=> {
// 				window.location.href = "/v/appmsgs?logsubj=sw4&logmsg=Unable to load page - " + window.location.href
// 			}, 2000)
// 		</script>
// 	</body>
// 	</html>`
//
// 	const returnresponse = new Response(responsebody, {                               
// 		status: 200,                                                               
// 		statusText: 'OK',                                                
// 		headers: headers
// 	})
//
// 	return returnresponse
// }
//
//
//
//
// const set_failed_file_response_other = (_nr:Request) => { 
//
// 	let headers: {[key: string]: string} = {
// 		'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
// 	}
//
// 	const responsebody = `Unable to Load File`
//
// 	const returnresponse = new Response(responsebody, {                               
// 		status: 503,                                                               
// 		statusText: 'Network error',                                                
// 		headers
// 	})
//
// 	return returnresponse
// }
//




function should_url_be_cached(pathname:string) {
    if (pathname.includes(".webmanifest") || pathname.includes("/assets/") || pathname.includes("/v/") || pathname === "/") {
        return true;
    }
    else if (pathname.endsWith(".js")) {
        return true;
    }
    else {
        return false;
    }
}




const authrequest = () => new Promise<string>(async (res,rej)=> { 

    if (!_id_token) {
		await error_out("sw4", "authrequest no token in browser storage")
		rej("No token in browser storage")
        return
    }


    if (Date.now()/1000 > _token_expires_at-30) {

        const body = { refresh_token: _refresh_token }

        fetch('/api/refresh_auth', {
            method: 'POST',
            headers: {'Content-Type': 'application/json',},
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(EXITDELAY)

        }).then(async r=> {

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
			rej("Network error") 
        })
    }
    else {
        res("ok")
    }
})




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

	res(1)
})




/*
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
*/




const isAnyClientFocused = () => _client_visibility.size === 0 || [..._client_visibility.values()].some(v => v === true);




const set_connectedstate_offline = (logmsg = "set to offline") => {

	_connectedstate = ConnectStateE.OFFLINE;
	clearTimeout(_connectedcheck_timeout);
	_connectedcheck_timeout = setTimeout(()=> connectedcheck(), 500);  

	for_testing_log(logmsg);
}

const getBackoffTimeout = () => CONNECTEDSTATE_CHECK_TIMEOUT * _backoff_multiplier;
const incrementBackoff  = () => { _backoff_multiplier = Math.min(_backoff_multiplier + 1, BACKOFF_MAX); }
const resetBackoff      = () => { _backoff_multiplier = 1; }




const connectedcheck = async () => {

	const navigOn    = (self as any).navigator.onLine ? true : false
	
	const anyFocused = isAnyClientFocused();

	// online and stable and app focused - use base interval, reset backoff
	if (_connectedstate === ConnectStateE.ONLINE && navigOn && anyFocused) {	
		resetBackoff();
		_connectedcheck_timeout = setTimeout(()=> connectedcheck(), CONNECTEDSTATE_CHECK_TIMEOUT);  
		return;   
	}

	// online but app not focused - use backoff
	if (_connectedstate === ConnectStateE.ONLINE && navigOn && !anyFocused) {	
		incrementBackoff();
		_connectedcheck_timeout = setTimeout(()=> connectedcheck(), getBackoffTimeout());  
		return;   
	}

	// was online, now navigator says offline - start backing off
	if (_connectedstate === ConnectStateE.ONLINE && !navigOn) {   
		_connectedstate = ConnectStateE.OFFLINE; 
		incrementBackoff();
		_connectedcheck_timeout = setTimeout(()=> connectedcheck(), getBackoffTimeout());  
		return;   
	}

	// still offline, keep backing off
	if (_connectedstate === ConnectStateE.OFFLINE && !navigOn) {    
		incrementBackoff();
		_connectedcheck_timeout = setTimeout(()=> connectedcheck(), getBackoffTimeout());  
		return;   
	}

	// at this point, internal state is offline, but navigator says online, so do a fetch test

	fetch('/api/ping', { signal: AbortSignal.timeout(3000) })
		.then((r:Response)=> {
			if (r.status !== 200) { 
				_connectedstate = ConnectStateE.OFFLINE;
				incrementBackoff();
				_connectedcheck_timeout = setTimeout(()=> connectedcheck(), getBackoffTimeout());  
				return; 
			}
			// ping succeeded - back online, reset backoff
			_connectedstate = ConnectStateE.ONLINE
			if (isAnyClientFocused()) {
				resetBackoff();
				_connectedcheck_timeout = setTimeout(()=> connectedcheck(), CONNECTEDSTATE_CHECK_TIMEOUT);
			} else {
				incrementBackoff();
				_connectedcheck_timeout = setTimeout(()=> connectedcheck(), getBackoffTimeout());
			}

			// let the main thread know we're back online
			(self as any).clients.matchAll().then((clients:any) => {
				clients.forEach((client: any) => {
					client.postMessage({ action: 'backonline' });
				})
			})
		})
		.catch(()=> {
			_connectedstate = ConnectStateE.OFFLINE;
			incrementBackoff();
			_connectedcheck_timeout = setTimeout(()=> connectedcheck(), getBackoffTimeout());
		})
}




const periodicmaintenance = async () => {

	// clean up stale client visibility entries
	const activeClients = await (self as any).clients.matchAll();
	const activeIds = new Set(activeClients.map((c:any) => c.id));
	for (const [id] of _client_visibility) {
		if (!activeIds.has(id)) _client_visibility.delete(id);
	}

	// yoink out caches older than what their Nifty-Cache header says
	const now  = Math.round(Date.now() / 1000)
	let cache  = await caches.open(_cache_name);
	const keys = await cache.keys();

	keys.forEach((req) => {
		const tsstring = req.headers.get('Nifty-Cache')
		if (!tsstring) return;

		const ts = Number(tsstring)
		if (now > ts) {
			cache.delete(req.url);
		}
	})

	setTimeout(()=> periodicmaintenance(), PERIODIC_MAINTENANCE_INTERVAL);
}




const preload_base_assets_into_cache = (assets:string[]) => new Promise(async (res, _rej) => {

    const cache = await caches.open(_cache_name);

    const promises = assets.map(async (url) => {
        try {
            const cached_response = await cache.match(url);
            if (cached_response) {
                return 1; // Already cached
            }

            const response = await fetch(url, { signal: AbortSignal.timeout(EXITDELAY) });

            if (response && response.status === 200) {
                await cache.put(url, response.clone());
                return 1; // Fetched and cached
            }
            return 0; 
        } catch (error:any) {
            return 0; 
        }
    });

    Promise.all(promises).then(() => {
        res(1); 
    });
});




function for_testing_log(msg:string, secondarymsg:string="") {

	if (!_is_test_logging) return;

	if (!secondarymsg) { console.debug(msg); } else { console.debug(msg, secondarymsg);  }
}




