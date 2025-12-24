

import { bool, str } from '../../../defs_server_symlink.js'
import { CMechLoadedDataT, $NT, GenericRowT, LazyLoadFuncReturnT } from "../../../defs.js"


declare var render: any;
declare var html: any;
declare var $N: $NT;


type AttributesT = {
    propa: string,
}

type ModelT = {
	dummydata: Object[],
}
type StateT = {
    propa: bool,
}


const ATTRIBUTES:AttributesT = { propa: "" }




class VTestAssist extends HTMLElement {

	m:ModelT = { dummydata: [] };
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




    async connectedCallback() {$N.CMech.RegisterView(this);}




	async attributeChangedCallback(name:string, oldval:string|boolean|number, newval:string|boolean|number) {
		$N.CMech.AttributeChangedCallback(this,name,oldval,newval);
	}




	disconnectedCallback() {   $N.CMech.ViewDisconnectedCallback(this);   }




	static load(_pathparams:GenericRowT, _searchparams:GenericRowT): Promise<LazyLoadFuncReturnT> {
		return new Promise(async (res, _rej) => {
			const d = new Map<str,GenericRowT[]>()
			const dummydata = [
				{ dummytext: "Chair" },
				{ dummytext: "Table" },
				{ dummytext: "Lamp" },
				{ dummytext: "Sofa" },
				{ dummytext: "Desk" },
				{ dummytext: "Shelf" },
				{ dummytext: "Bed" },
				{ dummytext: "Rug" },
			]
			d.set("dummydata", dummydata)
			res({ d, refreshon:[]})
		})
	}




	ingest(loadeddata: CMechLoadedDataT, _pathparams:GenericRowT, _searchparams:GenericRowT) {

		const dummydata = loadeddata.get('dummydata') || [];
		this.m.dummydata = dummydata;	
	}




    render() {
        render(this.template(this.s, this.m), this.shadow);
    }



    template = (_s:StateT, _m:ModelT) => { return html`{--css--}{--html--}`; }; 


}



customElements.define('v-testassist', VTestAssist);




export {  }


