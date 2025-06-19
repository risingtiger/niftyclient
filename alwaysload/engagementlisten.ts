

//import { bool, num, str, SSETriggersE } from '../defs_server_symlink.js'
import { EngagementListenerT } from "../defs.js"


//declare var $N: $NT;
const elisteners:EngagementListenerT[] = []




function Add_Listener(el:HTMLElement, name:string, type_:any, priority_:number|null, callback_:()=>void) {

    const type = type_

	for(let i = 0; i < elisteners.length; i++) {
		if (!elisteners[i].el.parentElement) {
			elisteners.splice(i, 1)   
		}
	}

    const existing_listener = elisteners.find(l=> l.type === type && l.name === name)

    if (existing_listener) Remove_Listener(el, name, type)

	const priority = priority_ || 0

    elisteners.push({
		el,
        name,
        type,
		priority,
        callback: callback_
    })

	elisteners.sort((a, b)=> a.priority - b.priority)
}




function Remove_Listener(el:HTMLElement, name:string, type_:any) {   
    const i = elisteners.findIndex(l=> l.el.tagName === el.tagName && l.name === name && l.type === type_)
    if (i === -1) return
    elisteners.splice(i, 1)   
}




function Init() {

	document.addEventListener('visibilitychange', () => { 
		if (document.visibilityState === 'visible') {
			setTimeout(() => { 
				for(const l of elisteners.filter(l=> l.type === 'visible')) {
					l.callback()
				}
			}, 500)
		}
		else if (document.visibilityState === 'hidden') {
			setTimeout(() => { 
				for(const l of elisteners.filter(l=> l.type === 'hidden')) {
					l.callback()
				}
			}, 500)
		}
	})

	window.addEventListener('resize', () => {
		for(const l of elisteners.filter(l=> l.type === 'resize')) {
			l.callback()
		}
	});
}



export { Init } 

if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).EngagementListen = { Init, Add_Listener, Remove_Listener };


