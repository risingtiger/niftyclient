


import { str, num, bool } from "../../../defs_server_symlink.js";

declare var render: any;
declare var html: any;



enum ModeT { INERT = 0, SAVING = 1, SAVED = 2 }


type StateT = {
    mode: ModeT,
}

type ModelT = {
	wait_for_confirm: bool
}

type ElsT = {
    animeffect:HTMLElement|null,
}




class CBtnGroup extends HTMLElement {

    shadow: ShadowRoot

    constructor() {   
        super(); 
        this.shadow = this.attachShadow({mode: 'open'});
    }

    connectedCallback() {   
        this.render()
    }

    render() {   
        render(this.template(), this.shadow);   
    }

    template = () => { 
        return html`{--css--}{--html--}`; 
    }; 
}

customElements.define('c-btn-group', CBtnGroup);









export {  }



