
//@ts-ignore
//import { initializeApp } from "firebase/app";
//@ts-ignore
//import { getMessaging, getToken  } from "firebase/messaging";




import { bool, str } from '../../../defs_server_symlink.js'
import { $NT, LazyLoadFuncReturnT, GenericRowT, ViewHeaderT } from "../../../defs.js"


declare var render: any;
declare var html: any;
declare var $N: $NT;




const firebaseConfig = {
	apiKey: "AIzaSyAx0ix0_Yz6RN6_-5kiwU-_uWm4sErpXdw",
	authDomain: "purewatertech.firebaseapp.com",
	databaseURL: "https://purewatertech.firebaseio.com",
	projectId: "purewatertech",
	storageBucket: "purewatertech.firebasestorage.app",
	messagingSenderId: "805737116651",
	appId: "1:805737116651:web:9baada48dc65d9b72c9fae",
	measurementId: "G-5VBS981F9K"
};

const vapidKey = "BF6MOQVRtD-cw7q34V_3x2xGdnEyym2wNj0wS_qJQtnRnZHagqxV1vVpfVKX6Km-qkhCn4IIS_Pt4mMfqPxyd68"



let firebase_service:any = {}
firebase_service.initializeApp = {}
firebase_service.getMessaging = {}
firebase_service.getToken = {}
firebase_service.app = {}
firebase_service.messaging = {}



type AttributesT = {
    propa: string,
}

type ModelT = {
	propa: string,
}
type StateT = {
    is_subscribed: bool,
}




const ATTRIBUTES:AttributesT = { propa: "" }




class VSetupPushAllowance extends HTMLElement {

	m:ModelT = { propa: "" };
	a:AttributesT = { ...ATTRIBUTES };
    s:StateT = {
		is_subscribed: false,
	}
	header:ViewHeaderT = { title: 'Notifications', backurl: 'home' }

    shadow:ShadowRoot




	static get observedAttributes() { return Object.keys(ATTRIBUTES); }




    constructor() {   
        super(); 
        this.shadow = this.attachShadow({mode: 'open'});
    }




    async connectedCallback() {$N.CMech.RegisterView(this);}




	async attributeChangedCallback(name:string, oldval:string|boolean|number, newval:string|boolean|number) {
		$N.CMech.AttributeChangedCallback(this,name,oldval,newval);
	}




	disconnectedCallback() {   $N.CMech.ViewDisconnectedCallback(this);   }




	static load(_pathparams:GenericRowT, _searchparams:GenericRowT): Promise<LazyLoadFuncReturnT> {
		return new Promise(async (res, _rej) => {
			const d = new Map<str,GenericRowT[]>()
			res({ d, refreshon:[]})
		})
	}




	ingest() {}




	async hydrated() {
		try { await loadfirebase(); }
		catch (e) { 
			$N.Unrecoverable("Error loading subscription system", e, "Back to Home", "gen", "error loading firebase from gstatic", null);
			return;
		}

		navigator.serviceWorker.ready

			.then((registration) => {
				return registration.pushManager.getSubscription()
			})

			.then(subscription => {
				if (subscription) {
					this.s.is_subscribed = true
				} else {
					this.s.is_subscribed = false
				}
				this.render()
				setTimeout(()=> {   this.dispatchEvent(new Event('hydrated'))   }, 100)
			})
			
			.catch(err => {
				console.error('Error during getSubscription()', err)
			})
	}




    render() {
        render(this.template(this.s), this.shadow);
    }




    async Subscribe(e:CustomEvent) {

        navigator.serviceWorker.ready
			.then(async (reg:ServiceWorkerRegistration) => {

				const result = await Notification.requestPermission()

				if (result !== 'granted') {
					throw new Error('Permission not granted for Notification')
				}

				else {

					await reg.pushManager.subscribe({
						userVisibleOnly: true,
						applicationServerKey: urlBase64ToUint8Array(vapidKey)
					})

					firebase_service.messaging = firebase_service.getMessaging()

					const fcm_token = await firebase_service.getToken(firebase_service.messaging, { 
						serviceWorkerRegistration: reg,
						vapidKey 
					})

					const user_email = localStorage.getItem('user_email')
					const r = await $N.FetchLassie('/api/push_subscriptions/add?user_email=' + user_email + '&fcm_token='+fcm_token, {
						method: 'GET',
						headers: { 'Content-type': 'application/json' },
					})

					e.detail.done()

					if (!r.ok) {
						alert ('Error trying to subscribe: ' + r.statusText)	
						return
					}	

					this.s.is_subscribed = true
					this.render()


					await reg.showNotification('Notification with ServiceWorker', {
						body: 'Notification with ServiceWorker',
					})
				}
			})
    }




    async Unsubscribe(e:CustomEvent) {

        navigator.serviceWorker.ready

        .then(async (reg:ServiceWorkerRegistration) => {

            reg.pushManager.getSubscription().then((subscription) => {
                subscription!
                  .unsubscribe()
                  .then(async (_successful) => {

                    const user_email = localStorage.getItem('user_email')
                    await $N.FetchLassie('/api/push_subscriptions/remove?user_email=' + user_email, {
                        method: 'GET',
                        headers: {
                            'Content-type': 'application/json'
                        },
                    })

                    this.s.is_subscribed = false
                    this.render()

					e.detail.done()

                  })
                  .catch((_e) => {
                  });
              });

        }).catch(_ => {
        })
    }




    /*
    request_notification_permission() {

        return new Promise(async (res, rej) => {

            const permission = await Notification.requestPermission()

            if (permission === 'granted') {

                res(true)
            } else {
                rej(false)
            }
        })
    }
    */




    /*
    async subscribe_user_to_push() {

        navigator.serviceWorker.ready
        .then(async registration => {
            const vapid_public_key = 'BE12SQmupb1Zw7Bw5JDgknlHe_3p3MbZWYVd4fhowa_An_-YHcp4joi_8IqEZN4fkLMIviV0PP-DVocfQVnd2vU'

            return registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: vapid_public_key
            })

        }).then(async subscription => {

            const queryjson = JSON.stringify({
                user_email: localStorage.getItem('user_email'),
                subscription
            })

            await FetchLassie('/api/webpush_add_subscription?fuckyouanyways='+queryjson, {
                method: 'GET',
                headers: {
                    'Content-type': 'application/json'
                },
                //body: JSON.stringify({user_email: "accounts@risingtiger.com", subscriptionL: {a:1}})
                    /*
                body: 
            })

            this.s.is_subscribed = true
            this.render()
        })
    }
    */




    template = (_s:StateT	) => { return html`{--css--}{--html--}`; }; 

}




customElements.define('v-setup_push_allowance', VSetupPushAllowance);




function loadfirebase() {   return new Promise(async (res:any, rej:any)=> {

    try {
        // Load Firebase app first
        //@ts-ignore
        const firebaseApp = await import("https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js")
        
        // Initialize the app first
        firebase_service.initializeApp = firebaseApp.initializeApp
        firebase_service.app = firebase_service.initializeApp(firebaseConfig)
        

        // Then load messaging
        //@ts-ignore
        const firebaseMessaging = await import("https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging.js")
        
        firebase_service.getMessaging = firebaseMessaging.getMessaging
        firebase_service.getToken = firebaseMessaging.getToken

        res(true)
    } catch (e) { 
        console.error("Firebase loading error:", e)
        rej(e)
    }
})}




function urlBase64ToUint8Array(base64String:any) {

    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}




export {  }


