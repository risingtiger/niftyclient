

import { str } from "../../../defs_server_symlink.js";

declare var render: any;
declare var html: any;




enum WhatE { INIT = 0, SPIN = 1 }

type AttributesT = {
    prop: str,
    active: boolean,
}

type StateT = {
    what: WhatE,
}

type ModelT = {
	propa:str
}


const ATTRIBUTES:AttributesT = { prop: "", active: false }




class CAnimeffect extends HTMLElement {

	a:AttributesT = { ...ATTRIBUTES };
    s:StateT = { what: WhatE.INIT };
    m:ModelT = { propa: "" };

    shadow:ShadowRoot


	static get observedAttributes() { return Object.keys(ATTRIBUTES); }


    constructor() {   
        super(); 
        this.shadow = this.attachShadow({mode: 'open'});
    }




    connectedCallback() {   
		this.a.active = this.hasAttribute('active')
		this.s.what = WhatE.SPIN // spin is default. we'll add more animation types later
		this.sc();
    }




    async attributeChangedCallback(name:str, _old_val:str, new_val:str) {
		
		if (name === 'active') {
			this.a.active = new_val === 'true'
			this.sc();
		}
    }




    sc() {   render(this.template(this.s, this.m), this.shadow);   }




    template = (_s:StateT, _m:ModelT) => { return html`{--css--}{--html--}`; }; 
}




customElements.define('c-animeffect', CAnimeffect);




export {  }



