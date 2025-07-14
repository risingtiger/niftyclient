


import { str, num, bool } from "../../../defs_server_symlink.js";

declare var Lit_Element: any;
declare var render: any;
declare var html: any;



enum TypeT { INPUT = 0, DSELECT = 1, TOGGLE = 2 }
type InputStrT = "none" | "text" | "phone" | "email" | "password" | "number" | "url" | "date" | "time" | "datetime" | "month" | "week" | "color" | "search" | "file" | "range"

type AttributesT = {
    val: str,
}

type StateT = {
    issaving: bool,
    val: str,
	saved_val: str,
	newval: str,
	options: str,
    err_msg: str,
	min: str,
	max: str,
	updatemoment: number,
	saveability: bool
}

type ModelT = {
    name: str,
    type: TypeT,
    inputtype: InputStrT,
    label: str,
    labelwidth: num,
    placeholder: str,
}


type AnimationHandlesT = {
    view: Animation|null,
    edit: Animation|null,
}

type KeyframesT = {
    view: KeyframeEffect|null,
    edit: KeyframeEffect|null,
}


const ATTRIBUTES:AttributesT = { val: "" }






class CIn2 extends Lit_Element {

	a:AttributesT = { ...ATTRIBUTES };
    s:StateT = { val: "", saved_val:"", newval: "", issaving: false, err_msg: "", options: "", min: "", max: "", updatemoment: 0, saveability: true }
    m:ModelT = { name: "", type: TypeT.TOGGLE, inputtype: "text", label: "", labelwidth: 0, placeholder: "" }
	controlel:HTMLElement = document.body
    
    animatehandles: AnimationHandlesT = { view: null, edit: null } // label: null }
    keyframes: KeyframesT = { view: null, edit: null } // label: null }
    shadow:ShadowRoot


	static get observedAttributes() { return Object.keys(ATTRIBUTES); }



    constructor() {   
        super(); 
        this.shadow = this.attachShadow({mode: 'open'});
    }




    connectedCallback() {   

        const attr_typestr = this.getAttribute("type") || "text"

        this.m.label = this.getAttribute("label") || ""
        this.m.labelwidth = parseInt(this.getAttribute("labelwidth") || "125")
        this.m.name = this.getAttribute("name") || ""
		this.m.placeholder = this.getAttribute("placeholder") || ""
        this.s.val   = this.getAttribute("val") || ""
		this.s.options = this.getAttribute("options") || ""
		this.s.min = this.getAttribute("min") || ""
		this.s.max = this.getAttribute("max") || ""
		this.s.saveability = this.hasAttribute("nosave") ? false : true

		this.a.val = this.s.val
		this.s.saved_val = this.s.val


        if (attr_typestr === "toggle") {
            this.m.type = TypeT.TOGGLE
            this.m.inputtype = "none"

        } else if (attr_typestr === "dselect") {
            this.m.type = TypeT.DSELECT
            this.m.inputtype = "none"

        } else { 
            this.m.type = TypeT.INPUT
            this.m.inputtype = attr_typestr as InputStrT;
        }

        this.addEventListener("click", (e:any) => this.clicked(e), true)

        this.sc()

		this.controlel = this.shadow.querySelector(".controlel") as HTMLElement;
    }




    async attributeChangedCallback(name:string, oldval:string|boolean|number, newval:string|boolean|number) {

		if (oldval === null) return

		const a = this.a as {[key:string]:any}

		a[name] = newval

		if (name === "val") {
			this.s.val = newval as str
		}

		if (!a.updatescheduled) {
			a.updatescheduled = true
			Promise.resolve().then(()=> { 
				this.sc()
				a.updatescheduled = false
			})
		}
    }




    sc() {   
		render(this.template(this.a, this.s, this.m), this.shadow);   
	}




    public updatedone(newval?:str) {      

		const diff = Date.now() - this.s.updatemoment

		if (diff > 1000) {
			this.setAttribute("val", newval || this.s.newval);
			this.s.issaving = false;
			this.saved_val = this.s.newval;
			this.sc()

		} else {
			setTimeout(() => { 
				this.setAttribute("val", newval || this.s.newval);
				this.s.issaving = false;
				this.s.saved_val = this.s.newval;
				this.sc()

			}, 1000);
		}
	}




    public updatefailed(reverttoval:str, _error:str) {      

		const diff = Date.now() - this.s.updatemoment

		if (diff > 1000) {
			this.setAttribute("val", reverttoval || this.s.val);
		} else {
			setTimeout(() => { 
				this.setAttribute("val", reverttoval || this.s.val);
			}, 1000);
		}
	}


    clicked(_e:Event) {
    }




    inputchanged() {
		this.setAttribute("val", (this.controlel as HTMLInputElement).value || "");
		this.dispatchEvent(new CustomEvent("input", {detail: { 
			name:this.m.name, 
			newval:this.s.newval, 
			oldval:this.s.val
		}}))
	}




    focused() {
		( this.controlel as HTMLInputElement ).select();
		this.sc()
	}




    blurred() {
		const val = ( this.controlel as HTMLInputElement ).value || "";

		if (this.s.saveability && val !== this.s.val && !this.s.issaving) {
			confirm("Do you want to save changes?") ? this.runupdate() : console.log('nope');
		}
	}




    keyupped(e:KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			if (this.s.saveability) {
				this.runupdate()
				this.sc()
			}
		}
	}




	dselect_updated() {
		this.runupdate()
		this.sc()
	}




	toggle_toggled(e:Event) {

		const el = (e.currentTarget as any)
		el.classList.add("animate")

		if (this.s.val === "true") {
			el.classList.remove("istrue")
		} else {
			el.classList.add("istrue")
		}

		this.runupdate()
	}




    actionicon_clicked(_e:Event) {
		this.controlel.focus()
	}




    label_clicked(_e:Event) {
		this.controlel.focus()
	}




	rendercontrol() {

		if (this.m.type === TypeT.TOGGLE) {

			return html`<span 
							class="switch ${this.s.val==='true'?'istrue':''}"
							@click="${(e:any)=>this.toggle_toggled(e)}"
							class="controlel"><span class="inner"></span></span>`;

		} else if (this.m.type === TypeT.DSELECT) {

			return html`<c-dselect 
							options="${this.getAttribute('options') || ''}" 
							@update="${()=>this.dselect_updated()}" 
							val="${this.s.val}"></c-dselect>`;

		} else if (this.m.type === TypeT.INPUT) {

			let minmax = this.s.min ? `min="${this.s.min}"` : "";
			minmax += this.s.max ? ` max="${this.s.max}"` : "";
			return html`
				<input 
							@input="${()=>this.inputchanged()}"  
							@blur="${()=>this.blurred()}" 
							@focus="${()=>this.focused()}" 
							@keyup="${(e:any)=>this.keyupped(e)}" 
							class="controlel"
							type="${this.m.inputtype}" 
							value="${this.s.val}" 
							placeholder="${this.m.placeholder}" 
							enterkeyhint="done" ${minmax} name="${this.m.name}"></input>`;
		}
	}




    runupdate() { 

		if (this.m.type === TypeT.TOGGLE) {
			const toggleel = this.shadow.querySelector(".switch") as HTMLElement
			this.s.newval  = toggleel.classList.contains("istrue") ? "true" : "false";

		} else if (this.m.type === TypeT.INPUT) {
			const inputel = this.shadow.querySelector("input") as HTMLInputElement;
			this.s.newval = inputel!.value!

		} else if (this.m.type === TypeT.DSELECT) {
			const dselectel = this.shadow.querySelector("c-dselect") as HTMLElement;
			this.s.newval   = dselectel.getAttribute("val")!
		}

		if (this.s.newval === this.s.saved_val) {      
			this.s.newval = ""
			return
		}

		this.s.updatemoment = Date.now()

		this.dispatchEvent(new CustomEvent("update", {detail: { 
			name:this.m.name, 
			newval:this.s.newval, 
			oldval:this.s.val,
			failed: this.updatefailed.bind(this),
			done: this.updatedone.bind(this)
		}}))

		this.s.issaving = true;
		this.sc()
    }



    template = (_a:AttributesT, _s:StateT, _m:ModelT) => { return html`{--css--}{--html--}`; }; 
}




//@ts-ignore
customElements.define('c-in2', CIn2);


export {  }



