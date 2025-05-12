
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
    showlogs: bool,
	showappupdated: bool
	logs: string[],
    logsubj: string,
}




const ATTRIBUTES:AttributesT = { propa: "" }




class VAppMsgs extends HTMLElement {

	m:ModelT = { propa: "" };
	a:AttributesT = { ...ATTRIBUTES };
    s:StateT = {
		showlogs: false,
		showappupdated: false,
		logs: [],
        logsubj: ""
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
			this.s.logsubj = searchparams.logsubj || ''

			this.s.showappupdated = searchparams.appupdate || false

		}
	}




    sc() {
        render(this.template(this.s), this.shadow);
    }




	show_logs() {

		const l = localStorage.getItem('logs')
		this.s.logs = l && l.includes('-') ? l.split('-') : [(l || '')]

		this.s.showlogs = true
		this.sc();
	}



    template = (s:StateT) => { return html`{--css--}{--html--}`; }; 

}




customElements.define('v-appmsgs', VAppMsgs);




export {  }


