


enum UpdateState { DEFAULT, UPDATING, UPDATED }


const EXITDELAY = 12000 // just the default. can be overridden in the fetch request

let cache_name = 'cacheV__0__';
let _cache_version = Number(cache_name.split("__")[1])
let _id_token = ""
let _token_expires_at = 0
let refresh_token = ""
let user_email = ""
let _isoffline = false

setInterval(()=> { check_connectivity(); }, 5000)




self.addEventListener('install', (event:any) => {
	event.waitUntil((async () => {
		console.log("sw.ts install")

		// Optionally, pre-cache any needed static assets here:
		// const cache = await caches.open(CACHE_NAME);
		// await cache.addAll([
		//   '/index.html',
		//   '/main.js',
		//   '/styles.css',
		//   ...
		// ]);

		await (self as any).skipWaiting();
		console.log("sw.ts install - after skipWaiting")
	})());
});


self.addEventListener('activate', (event:any) => {
	event.waitUntil((async () => {
		console.log("sw.ts activate")
		const cacheKeys = await caches.keys();
		for (const key of cacheKeys) {
			if (key !== cache_name) {
				console.log("sw.ts activate - deleting cache: " + key)
				await caches.delete(key);
			}
		}

		await (self as any).clients.claim();
	})());
});




self.addEventListener('controllerchange', (_e:any) => {
})




self.addEventListener('fetch', (e:any) => {

    let promise = new Promise(async (res, _rej) => {

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
		refresh_token = e.data.refresh_token;
		user_email = e.data.user_email;
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

	if (_isoffline && !r.headers.get('call_even_if_offline')) {
		res(new Response(null, { status: 503, statusText: 'Network error' }))
		return
	}


	const ar = await authrequest().catch(err=> err)
	if (ar === "Network error") {
		res(new Response(null, { status: 503, statusText: 'Network error' }))
		return
	}
	else if (ar === "Refresh failed") {
		res(new Response(null, { status: 401, statusText: 'Unauthorized' }))
		return
	}

	// TODO: for cross origin CORS requests, I need to handle the preflight OPTIONS request and response status of 0
	// currently no cors requests going on

	const is_appapi   = r.url.includes("/api/") ? true : false
	const new_headers = new Headers(r.headers);

	if (is_appapi) {
		new_headers.append('appversion', _cache_version.toString())
		new_headers.append('Authorization', `Bearer ${_id_token}`)
	}

	const { signal, abortsignal_timeoutid } = set_abort_signal(r.headers)

	const new_request = new Request(r, {headers: new_headers, cache: 'no-store', signal});

	fetch(new_request)
		.then(async (server_response:any)=> {
			
			_isoffline = false;
			clearTimeout(abortsignal_timeoutid)

			if (is_appapi && server_response.status === 401) { // unauthorized
				await error_out("sw4", "") 
				res(server_response)
			}

			else if (is_appapi && server_response.status === 410) {
				(self as any).clients.matchAll().then((clients:any) => {
					clients.forEach((client: any) => {
						client.postMessage({   action: 'update_init'   })
					})
					res(server_response)
				})

			} else  {
				res(server_response)
			} 

			if (server_response.status !== 200)   logit( 40, "swe", `${ new_request.url } - ${ server_response.status } - ${ server_response.statusText }` )

		})
		.catch(async (err:any)=> {
			logit(40, "swe", `${new_request.url} - fetch catch - ${err.message || 'Unknown error'}`)
			_isoffline = true
			res(new Response( null, { status: 503, statusText: 'Network error' } ))
		})
})




const handle_file_call = (r:Request) => new Promise<Response>(async (res, _rej) => { 

	const cache   = await caches.open(cache_name)
	const match_r = await cache.match(r)

	if (match_r) { 
		res(match_r) 

	} else if (_isoffline && !r.headers.get('call_even_if_offline')) {
		res(new Response('File not available offline', {                               
			status: 503,                                                               
			statusText: 'Offline Mode',                                                
			headers: { 'Content-Type': 'text/plain' }                                  
		}))                                                                            

	} else {
		const { signal, abortsignal_timeoutid } = set_abort_signal(r.headers)
		
		try {
			const response = await fetch(r, { signal })
			_isoffline = false;
			clearTimeout(abortsignal_timeoutid)
			
			if (response.status === 200 && should_url_be_cached(r)) {
				// cache is relatively small. will put in mechanism to clear it out if needed when I get time
				cache.put(r, response.clone())
			}
			res(response)

		} catch (err) {
			logit(40, "swe", `${r.url} - fetch catch - ${err.message || 'Unknown error'}`)
			_isoffline = true
			res(new Response('Failed to fetch file', { 
				status: 503, 
				statusText: 'Network error',
				headers: { 'Content-Type': 'text/plain' }
			}))
		}
	}
})




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
    else {
        return false;
    }
}



function check_connectivity() {

	if (!_isoffline) return

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 4000);

	fetch('/api/ping', { 
		cache: 'no-store',
		signal: controller.signal 
	})
		.then(response => {
			clearTimeout(timeoutId);
			if (response.ok) {
				_isoffline = false;
			}
		})
		.catch(_err => {
			clearTimeout(timeoutId);
		})
}




function authrequest() { return new Promise(async (res,rej)=> { 

	// keep in mind that when retries are set (case in point being the refocus of the app), its probably gonna be authrequest that is gonna be first initial call 
	// right now the the exitdelay is overriden to be 2.7 seconds (check FetchLassie logic to ascertain current value). a little problematic because refresh token could take longer on slow connections

    if (!_id_token) {
		await error_out("swe", "authrequest no token in browser storage")
		rej()
        return
    }


    if (Date.now()/1000 > _token_expires_at-30) {

        const body = { refresh_token }

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
				await error_out("swe", "authrequest refresh failed - " + data.error.message)
				rej("Refresh failed")
            }

            else {
                _id_token = data.id_token
                refresh_token = data.refresh_token
                _token_expires_at = Math.floor(Date.now()/1000) + Number(data.expires_in);

				(self as any).clients.matchAll().then((clients:any) => {
					clients.forEach((client: any) => {
						client.postMessage({
							action: 'update_auth_info',
							id_token: _id_token,
							refresh_token,
							token_expires_at: _token_expires_at
						})
					})
				})

                res(1)
            }

        }).catch(async err=> {
            clearTimeout(abortsignal_timeoutid);
			rej("Network error") 
        })
    }

    else {
        res(1)
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



