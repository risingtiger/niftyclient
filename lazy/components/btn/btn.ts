


import { str, num, bool } from "../../../defs_server_symlink.js";

declare var render: any;
declare var html: any;



enum ModeT { INERT = 0, SAVING = 1, SAVED = 2 }


type StateT = {
    mode: ModeT,
}

type ModelT = {
	show_anime_on_click: bool,
}

type ElsT = {
    animeffect:HTMLElement|null,
}




class CBtn extends HTMLElement {

    s:StateT
    m:ModelT
    els:ElsT
    
    shadow:ShadowRoot








    constructor() {   

        super(); 

        this.shadow = this.attachShadow({mode: 'open'});

        this.s = { mode: ModeT.INERT}
        this.m = { show_anime_on_click: true }
        this.els = { animeffect: null}
    }




    connectedCallback() {   

		this.m.show_anime_on_click = this.hasAttribute("noanime") ? false : true

		this.sc()

		this.addEventListener("click", () => { this.is_clicked() })
    }




    async attributeChangedCallback(_name:str, _oldval:str, _newval:str) {
    }




    click_resolved()         {   this.to_stop_anime();            }




    is_clicked() {
        if (this.s.mode == ModeT.INERT) {
            if (this.m.show_anime_on_click) this.to_start_anime()
			this.dispatchEvent(new CustomEvent("btnclick", {detail: {resolved: this.click_resolved.bind(this)}}))
        }
    }




    to_start_anime() {   

        if (this.s.mode === ModeT.INERT) {
            
            this.s.mode = ModeT.SAVING

            this.els.animeffect = document.createElement("c-animeffect")
            this.els.animeffect.setAttribute("active", "")

            this.shadow.appendChild(this.els.animeffect)

            this.els.animeffect.offsetWidth
            this.els.animeffect.className = "active"

            this.shadow.getElementById("slotwrap")!.classList.add("subdued")
        }
    }



    to_stop_anime() {   

        if (this.s.mode === ModeT.SAVING) {
            
            this.s.mode = ModeT.SAVED

            this.els.animeffect!.className = "";

            setTimeout(() => {

                this.els.animeffect!.remove()
                this.shadow.querySelector("#slotwrap")!.classList.remove("subdued")

                this.s.mode = ModeT.INERT

            }, 100)
        }
    }




    sc() {   render(this.template(), this.shadow);   }




    template = () => { return html`{--css--}{--html--}`; }; 
}




customElements.define('c-btn', CBtn);









export {  }



