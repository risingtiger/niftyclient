


import { str, bool } from "../../../defs_server_symlink.js";

declare var render: any;
declare var html: any;



enum ModeT { INERT = 0, SAVING = 1, SAVED = 2 }

type AttributesT = {
    val: str,
}

type StateT = {
    mode: ModeT,
}

type ModelT = {
	propa: bool,
}


const ATTRIBUTES:AttributesT = { val: "" }



class CForm2 extends HTMLElement {

	a:AttributesT = { ...ATTRIBUTES };
    s:StateT
    m:ModelT
    
    shadow:ShadowRoot








    constructor() {

        super();

        this.shadow = this.attachShadow({mode: 'open'});

        this.s = { mode: ModeT.INERT}
        this.m = { propa: true }

        this.shadow.addEventListener('keydown', (e) => {
            const ke = e as KeyboardEvent;
            if (ke.key === 'Enter') {
                ke.preventDefault();
                this.submitForm();
            }
        });
    }




    connectedCallback() {
		this.sc()
    }




    async attributeChangedCallback(name:string, oldval:string|boolean|number, newval:string|boolean|number) {

		if (oldval === null) return

		const a = this.a as {[key:string]:any}

		a[name] = newval


		if (!a.updatescheduled) {
			a.updatescheduled = true
			Promise.resolve().then(()=> { 
				this.sc()
				a.updatescheduled = false
			})
		}
    }




    submitForm() {
		console.log("ya")
        this.s.mode = ModeT.SAVING;
        this.sc();
    }




    sc() {   render(this.template(), this.shadow);   }

    template = () => { return html`{--css--}{--html--}`; };
}




customElements.define('c-form2', CForm2);









export {  }



