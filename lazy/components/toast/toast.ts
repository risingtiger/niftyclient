


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
    }




    async attributeChangedCallback(name:str, oldval:str, newval:str) {

        if (name == "action" && newval === 'run' && (oldval === '' || oldval === null)) {

            const msg = this.getAttribute("msg") || ""
            const level = this.getAttribute("level") || "0"
            const duration = this.getAttribute("duration") || DEFAULT_DURATION

            await this.action(msg, Number(level), Number(duration))

            this.setAttribute("action", "")
        }
    }




    action(msg:str, level:LevelT, duration:num|null) { 

        return new Promise((res) => { 

            duration = duration || DEFAULT_DURATION

            this.els.msg = this.shadow.getElementById("msg") as HTMLElement
            this.els.msg.textContent = msg


            switch (level) {
                case LevelT.INFO: this.classList.add("level_info"); break
                case LevelT.SAVED: this.classList.add("level_saved"); break
                case LevelT.SUCCESS: this.classList.add("level_success"); break
                case LevelT.WARNING: this.classList.add("level_warning"); break
                case LevelT.ERROR: this.classList.add("level_error"); break
            }

            this.style.display = "block"
            this.offsetHeight
            this.classList.add("active")

            setTimeout(() => {
                this.classList.remove("active")
                this.addEventListener("transitionend", transitionend)
            }, duration)


            function transitionend() {
                this.removeEventListener("transitionend", transitionend)
                this.style.display = "none"
                this.dispatchEvent(new CustomEvent('done'))
                res(1)
            }
    })}




    sc() {   render(this.template(), this.shadow);   }




    template = () => { return html`{--css--}{--html--}`; }; 
}




customElements.define('c-toast', CToast);









export {  }



