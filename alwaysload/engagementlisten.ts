

//import { bool, num, str, SSETriggersE } from '../defs_server_symlink.js'
import { EngagementListenerT, EngagementListenerEvents } from "../defs.js"


const INTERVAL_RUN_BASE              = 1 * 60 * 1000; // 1 minute in ms
const INTERVAL_RUN_SECONDARY_CADENCE = 15 * 60 * 1000; // 15 minute in ms
// const INTERVAL_RUN_QUATERNARY        = 1 * 60 * 60 * 1000; // 1 hour in ms
const INTERVAL_RUN_QUINARY_CADENCE   = 24 * 60 * 60 * 1000; // 1 day in ms


//declare var $N: $NT;
const _elisteners:EngagementListenerT[] = []
let _visible_timeout: ReturnType<typeof setTimeout> | null = null;
let _hidden_timeout: ReturnType<typeof setTimeout> | null = null;




function Add_Listener(el:HTMLElement, name:string, type_:any[], priority_:number|null, callback_:(s:EngagementListenerEvents)=>void) {

    const type = type_

	for(let i = 0; i < _elisteners.length; i++) {
		if (!_elisteners[i].el.parentElement) {
			_elisteners.splice(i, 1)
		}
	}

    const existing_listener = _elisteners.find(l=> JSON.stringify(l.type) === JSON.stringify(type) && l.name === name)

    if (existing_listener) Remove_Listener(el, name, type)

	const priority = priority_ || 0

    _elisteners.push({
		el,
        name,
        type,
		priority,
        callback: callback_
    })

	_elisteners.sort((a, b)=> a.priority - b.priority)
}




function Remove_Listener(el:HTMLElement, name:string, type_:any[]) {
    const i = _elisteners.findIndex(l=> l.el.tagName === el.tagName && l.name === name && JSON.stringify(l.type) === JSON.stringify(type_))
    if (i === -1) return
    _elisteners.splice(i, 1)
}




function Init() {

	document.addEventListener('visibilitychange', () => {
		// Cancel any pending callbacks on every visibility change
		if (_visible_timeout !== null) { clearTimeout(_visible_timeout); _visible_timeout = null; }
		if (_hidden_timeout !== null) { clearTimeout(_hidden_timeout); _hidden_timeout = null; }

		if (document.visibilityState === 'visible') {
			_visible_timeout = setTimeout(() => {
				_visible_timeout = null;
				for(const l of _elisteners.filter(l=> l.type.includes('visible'))) {
					l.callback('visible')
				}
			}, 500)
		}
		else if (document.visibilityState === 'hidden') {
			_hidden_timeout = setTimeout(() => {
				_hidden_timeout = null;
				for(const l of _elisteners.filter(l=> l.type.includes('hidden'))) {
					l.callback('hidden')
				}
			}, 500)
		}
	})

	window.addEventListener('resize', () => {
		for(const l of _elisteners.filter(l=> l.type.includes('resize'))) {
			l.callback('resize')
		}
	});

	setInterval(() => {
		const now     = Date.now();
		interval_run_if_time_secondary(now);
		interval_run_if_time_quinary(now);
	}, INTERVAL_RUN_BASE);


}




function interval_run_if_time_secondary(now:number) {
	const lastrun = localStorage.getItem('engagementlisten_lastsecondaryrun');
	if (!lastrun || now - parseInt(lastrun) > INTERVAL_RUN_SECONDARY_CADENCE) {
		for(const l of _elisteners.filter(l=> l.type.includes('15interval'))) {
			l.callback('15interval')
		}
		localStorage.setItem('engagementlisten_lastsecondaryrun', now.toString());
	}
}

function interval_run_if_time_quinary(now:number) {
	const lastrun = localStorage.getItem('engagementlisten_lastquinaryrun');
	if (!lastrun || now - parseInt(lastrun) > INTERVAL_RUN_QUINARY_CADENCE) {
		// perform daily task
		localStorage.setItem('lastdailyrun', now.toString());
	}
}



export { Init } 

if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).EngagementListen = { Init, Add_Listener, Remove_Listener };



