


import { str, num, bool } from "../../../defs_server_symlink.js";

declare var render: any;
declare var html: any;



enum ModeT { CLOSED = 0, OPEN = 1, OPENING = 2, CLOSING = 3 }
enum LevelT { INFO = 0, SAVED = 1, SUCCESS = 2, WARNING = 3, ERROR = 4  }


const DEFAULT_DURATION = 2000


type StateT = {
    mode: ModeT,
    level: LevelT,
    level_class: str,
    isanimating: bool,
    msg: str,
}

type ModelT = {
    c: str,
}

type ElsT = {
    msg:HTMLElement,
    //wrap:HTMLElement,
}




const DUMMYEL = document.createElement("div");



class CToast extends HTMLElement {

    s:StateT
    m:ModelT
    els:ElsT
    
    shadow:ShadowRoot




    static get observedAttributes() { return ['action']; }




    constructor() {   

        super(); 

        this.shadow = this.attachShadow({mode: 'open'});

        this.s = { mode: ModeT.CLOSED, level: LevelT.INFO, isanimating: false, msg: "", level_class:""}
        this.m = { c: "" }
        this.els = { msg: DUMMYEL, /*wrap: DUMMYEL*/ }
    }




    connectedCallback() {   
        this.sc()
		// const level = this.getAttribute("level") || "info"
		// const msg = this.getAttribute("msg") || ""
		// const duration = this.getAttribute("duration") || DEFAULT_DURATION
    }




    async attributeChangedCallback(_name:str, _oldval:str, _newval:str) {

        // if (name == "action" && newval === 'run' && (oldval === '' || oldval === null)) {
        //
        //     const level = this.getAttribute("level") || "info"
        //
        //     const msg = this.getAttribute("msg") || ""
        //     const duration = this.getAttribute("duration") || DEFAULT_DURATION
        //
        //     await this.action(msg, level, Number(duration))
        //
        //     this.setAttribute("action", "")
        // }
    }




    addtoast(msg:str|{title:string,sub:string}, levelstr:string, duration:num|null ) { 

		const toast_container_el = this.shadow.querySelector("#wrapper") as HTMLElement

		duration = duration || DEFAULT_DURATION

		const title = typeof msg === "string" ? msg : msg.title
		const sub = typeof msg === "string" ? "" : msg.sub

		const htmlstr = `
			<div class="atoast ${this.getlevelfromstr(levelstr)}">
				<div class="close-btn"><svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="1" y1="1" x2="9" y2="9"></line><line x1="9" y1="1" x2="1" y2="9"></line></svg></div>
				<div class="messaging_wrapper">
					<div class="title">${title}</div>
					<div class="sub">${sub}</div>
				</div>
			</div>`

		toast_container_el.insertAdjacentHTML("afterbegin", htmlstr)

		const new_toast_el = toast_container_el.firstElementChild as HTMLElement

		new_toast_el.classList.add("active")

		const close_btn = new_toast_el.querySelector(".close-btn") as HTMLElement
		close_btn.addEventListener("click", () => this.closetoast(new_toast_el))

		const timeout_id = setTimeout(() => {
			this.closetoast(new_toast_el)
		}, duration)

		// Store timeout so closetoast can clear it if manually closed early
		new_toast_el.dataset.timeoutId = String(timeout_id)
    }




    closetoast(toast_el:HTMLElement) {

		// Prevent double-close
		if (toast_el.classList.contains("closing")) return

		// Clear the auto-remove timeout if still pending
		const timeout_id = toast_el.dataset.timeoutId
		if (timeout_id) clearTimeout(Number(timeout_id))

		toast_el.classList.remove("active")
		toast_el.classList.add("closing")

		toast_el.addEventListener("transitionend", function onend() {
			toast_el.removeEventListener("transitionend", onend)
			toast_el.remove()
		})
    }




    sc() {   render(this.template(), this.shadow);   }




	getlevelfromstr(levelstr:str) {
		switch (levelstr.toLowerCase()) {
			case "info":    return "level_info";    
			case "saved":   return "level_saved";   
			case "success": return "level_success"; 
			case "warning": return "level_warning"; 
			case "error":   return "level_error";   
			default:        return "level_info";    
		}
	}




    template = () => { return html`{--css--}{--html--}`; }; 
}




customElements.define('c-toast', CToast);









export {  }



