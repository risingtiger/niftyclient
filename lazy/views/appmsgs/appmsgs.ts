
import { bool } from '../../../defs_server_symlink.js'
import { CMechLoadedDataT, CMechLoadStateE, $NT, GenericRowT } from "../../../defs.js"




declare var render: any;
declare var html: any;
declare var $N: $NT;



type AttributesT = {
    propa: string,
}

type ModelT = {
	propa: string,
}
type StateT = {
    propa: bool,
}




const ATTRIBUTES:AttributesT = { propa: "" }




class VAppMsgs extends HTMLElement {

	m:ModelT = { propa: "" };
	a:AttributesT = { ...ATTRIBUTES };
    s:StateT = {
		propa: false
	}

    shadow:ShadowRoot




	static get observedAttributes() { return Object.keys(ATTRIBUTES); }




    constructor() {   

        super(); 
        this.shadow = this.attachShadow({mode: 'open'});
    }




    async connectedCallback() {   
		await $N.CMech.ViewConnectedCallback(this)
		this.dispatchEvent(new Event('hydrated'));
    }




	async attributeChangedCallback(name:string, oldval:string|boolean|number, newval:string|boolean|number) {
		$N.CMech.AttributeChangedCallback(this,name,oldval,newval);
	}




	disconnectedCallback() {   $N.CMech.ViewDisconnectedCallback(this);   }




	kd(_loadeddata: CMechLoadedDataT, loadstate:CMechLoadStateE, _pathparams:GenericRowT, searchparams:GenericRowT) {
		if (loadstate === CMechLoadStateE.INITIAL || loadstate === CMechLoadStateE.SEARCHCHANGED) {
		}
	}




    sc() {
        render(this.template(this.s), this.shadow);
    }




    template = (_s:StateT	) => { return html`{--css--}{--html--}`; }; 

}




customElements.define('v-appmsgs', VAppMsgs);




export {  }


