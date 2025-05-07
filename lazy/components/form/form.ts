

import { str, num, bool } from "../../../defs_server_symlink.js";

declare var render: any;
declare var html: any;




type StateT = {
    placeholder: str,
}

type ModelT = {
    placeholder: str,
}








class CForm extends HTMLElement {

    s:StateT
    m:ModelT

    c_in_els:NodeListOf<HTMLElement>
    shadow:ShadowRoot




    constructor() {   

        super(); 

        this.shadow = this.attachShadow({mode: 'open'});

        this.s = {
            placeholder: this.getAttribute("placeholder") || "",
        }


    }




    connectedCallback() {   

        this.sc()

        /*
        this.c_in_els = this.querySelectorAll("c-in");

        this.c_in_els.forEach((el:HTMLElement) => {
            el.addEventListener("save", (e:any) => {
                this.dispatchEvent(new CustomEvent("itemsave", { detail: e.detail }));
            });
        });
        */
    }




    sc() {   render(this.template(this.s), this.shadow);   }




    template = (_s:StateT) => { return html`{--css--}{--html--}`; }; 
}




customElements.define('c-form', CForm);




export {  }



