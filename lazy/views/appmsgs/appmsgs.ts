
import { bool } from '../../../defs_server_symlink.js'
import { CMechLoadedDataT, $NT, GenericRowT } from "../../../defs.js"




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
	showdatawipe: bool,
	show_gen_logsubj: bool,
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
		showdatawipe: false,
		show_gen_logsubj: false,
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




	kd(_loadeddata: CMechLoadedDataT, loadstate:string, _pathparams:GenericRowT, searchparams:GenericRowT) {
		if (loadstate === 'initial' || loadstate === 'searchchanged') {
			this.s.logsubj = searchparams.logsubj || ''
			this.s.showappupdated = searchparams.appupdate || false

			if (searchparams.appupdate) {
				this.s.showappupdated = true
			}
			else if (this.s.logsubj === 'ldr') { // data wipe
				this.s.showdatawipe = true
			}
			else if (this.s.logsubj) { // generic
				this.s.show_gen_logsubj = true;
			}
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


