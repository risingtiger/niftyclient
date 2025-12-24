

//TODO: wrap this up. its still rought, untested and unfinished. not sure what needs done, but just go through it and finish it up


import { str, num } from "../../../defs_server_symlink.js";

declare var Lit_Element: any;
declare var render: any;
declare var html: any;




enum TypeT { INPUT = 0, DSELECT = 1, TOGGLE = 2 }
type InputStrT = "none" | "text" | "phone" | "email" | "password" | "number" | "url" | "date" | "time" | "datetime" | "month" | "week" | "color" | "search" | "file" | "range"

type AttributesT = {
    val: str,
}

type StateT = {
    savingstate: 0|1|2,
    val: str,
	options: str,
    err_msg: str,
	min: str,
	max: str,
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
    s:StateT = { val: "", savingstate: 0, err_msg: "", options: "", min: "", max: "" }
    m:ModelT = { name: "", type: TypeT.TOGGLE, inputtype: "text", label: "", labelwidth: 0, placeholder: "" }
    
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

        this.m.label       = this.getAttribute("label") || ""
        this.m.labelwidth  = parseInt(this.getAttribute("labelwidth") || "125")
        this.m.name        = this.getAttribute("name") || ""
		this.m.placeholder = this.getAttribute("placeholder") || ""
        this.s.val         = this.getAttribute("val") || ""
		this.s.options     = this.getAttribute("options") || ""
		this.s.min         = this.getAttribute("min") || ""
		this.s.max         = this.getAttribute("max") || ""

		this.a.val         = this.s.val


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
    }




    async attributeChangedCallback(name:string, oldval:string|boolean|number, newval:string|boolean|number) {

		// when value is saved from component including in2 and then the component rerenders it updates the val attribute which will have already been set
		if (oldval === null || oldval === newval) { return; }

		const a = this.a as {[key:string]:any}

		a[name] = newval

		if (name === "val") {
			console.log("attributeChangedCallback oldval -> newval", oldval, newval)
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




    clicked(_e:Event) {
    }




    focused() {
		
		if (this.m.type === TypeT.INPUT) {
			( this.shadow.querySelector(".controlel") as HTMLInputElement ).select();
		}
	}



    blurred() {
	}




    keyupped(_e:KeyboardEvent) {

	}




	toggle_toggled(e:Event) {

		const el = (e.currentTarget as any)

		if (this.s.val === "true") { el.classList.remove("istrue") } else { el.classList.add("istrue"); }
		this.valchanged(el.classList.contains("istrue") ? "true" : "false")
	}




	toggle_keydown(e:KeyboardEvent) {

		if (e.key !== " ") return;

		e.preventDefault()
		const el = (e.currentTarget as any)
		if (this.s.val === "true") { el.classList.remove("istrue") } else { el.classList.add("istrue"); }
		this.valchanged(el.classList.contains("istrue") ? "true" : "false")
	}




	valchanged(newval:string) {

		const oldval = this.s.val
		this.setAttribute("val", newval)
		this.dispatchEvent(new CustomEvent("update", {detail: { 
			name:this.m.name, 
			newval:newval, 
			oldval:oldval,
		}}))

	}




	number_spinner_clicked(_e:Event, direction: "up" | "down") {

		if (this.m.inputtype !== "number") return;

		const currentval = parseFloat(this.s.val) || 0;
		const step = parseFloat(this.getAttribute("step") || "1");
		const max = this.s.max ? parseFloat(this.s.max) : Infinity;
		const min = this.s.min ? parseFloat(this.s.min) : -Infinity;

		const newval = direction === "up" 
			? Math.min(currentval + step, max)
			: Math.max(currentval - step, min);

		this.valchanged(newval.toString());
	}




    label_clicked(_e:Event) {
		( this.shadow.querySelector(".controlel") as HTMLElement ).focus()
	}




	rendercontrol() {

		if (this.m.type === TypeT.TOGGLE) {

			return html`<span 
							class="switch ${this.s.val==='true'?'istrue':''}"
							tabindex="0"
							@click="${(e:any)=>this.toggle_toggled(e)}"
							@keydown="${(e:any)=>this.toggle_keydown(e)}"
							class="controlel"><span class="inner"></span></span>`;

		} else if (this.m.type === TypeT.DSELECT) {

			return html`<c-dselect 
							options="${this.getAttribute('options') || ''}" 
							@update="${(e:any)=>{this.valchanged(e.detail.newval)}}" 
							val="${this.s.val || 'none'}"></c-dselect>`;

		} else if (this.m.type === TypeT.INPUT) {

			if (this.m.name === "merchant") console.log("merchant ", this.s.val);
			
			const inputEl = html`
				<input 
							@input="${(e:any)=>this.valchanged(e.currentTarget.value)}"  
							@blur="${()=>this.blurred()}" 
							@focus="${()=>this.focused()}" 
							@keyup="${(e:any)=>this.keyupped(e)}" 
							class="controlel"
							type="${this.m.inputtype}" 
							value="${this.s.val}" 
							placeholder="${this.m.placeholder}" 
							enterkeyhint="done" 
							${this.s.min ? html`min="${this.s.min}"` : ""}
							${this.s.max ? html`max="${this.s.max}"` : ""}
							name="${this.m.name}"></input>`;

			if (this.m.inputtype === "number") {
				const currentval = parseFloat(this.s.val) || 0;
				const max = this.s.max ? parseFloat(this.s.max) : Infinity;
				const min = this.s.min ? parseFloat(this.s.min) : -Infinity;
				const isAtMax = currentval >= max;
				const isAtMin = currentval <= min;

			return html`
				<div class="number-spinner">
					${inputEl}
					<div class="spinner-buttons">
						<button class="spinner-btn spinner-up" 
								tabindex="-1"
								@click="${(e:any)=>this.number_spinner_clicked(e, "up")}"
								?disabled="${isAtMax}">
							<i class="icon icon-arrowup"></i>
						</button>
						<button class="spinner-btn spinner-down" 
								tabindex="-1"
								@click="${(e:any)=>this.number_spinner_clicked(e, "down")}"
								?disabled="${isAtMin}">
							<i class="icon icon-arrowdown"></i>
						</button>
					</div>
				</div>`;
			}

			return inputEl;
		}
	}




    template = (_a:AttributesT, _s:StateT, _m:ModelT) => { return html`{--css--}{--html--}`; }; 
}




//@ts-ignore
customElements.define('c-in2', CIn2);


export {  }



