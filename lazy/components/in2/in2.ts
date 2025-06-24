


import { str, num, bool } from "../../../defs_server_symlink.js";

declare var Lit_Element: any;
declare var render: any;
declare var html: any;
//declare var Lit_Css: any;



//enum ModeT { EDIT = 0, VIEW = 1, SAVING = 2, SAVED = 3, ERRORED = 4 }
enum TypeT { INPUT = 0, DSELECT = 1, TOGGLE = 2 }
type InputStrT = "none" | "text" | "phone" | "email" | "password" | "number" | "url" | "date" | "time" | "datetime" | "month" | "week" | "color" | "search" | "file" | "range"
//enum InputTypeT { NONE = 0, TEXT = 1, PHONE = 2, EMAIL = 3, PASSWORD = 4, NUMBER = 5, URL = 6, DATE = 7, TIME = 8, DATETIME = 9, MONTH = 10, WEEK = 11, COLOR = 12, SEARCH = 13, FILE = 14, RANGE = 15 }

type AttributesT = {
    val: str,
}

type StateT = {
    issaving: bool,
    val: str,
	newval: str,
	options: str,
    err_msg: str,
	min: str,
	max: str,
	updatemoment: number
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
    s:StateT = { val: "", newval: "", issaving: false, err_msg: "", options: "", min: "", max: "", updatemoment: 0 }
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

        this.s.val   = this.getAttribute("val") || ""
        this.m.label = this.getAttribute("label") || ""
        this.m.labelwidth = parseInt(this.getAttribute("labelwidth") || "125")
        this.m.name = this.getAttribute("name") || ""
		this.s.options = this.getAttribute("options") || ""
		this.s.min = this.getAttribute("min") || ""
		this.s.max = this.getAttribute("max") || ""

		this.a.val = this.s.val


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


		/*
		if (oldval === null || newval === oldval) return


        if (name === "val") { 

			this.s.val = newval

			if (this.s.mode === ModeT.VIEW && !this.s.isanimating) {
				// TOGGLE IS NEVER IN VIEW MODE
				if (this.m.type === TypeT.INPUT) {  
					this.els.displayval!.textContent = this.s.val
				}
				else if (this.m.type === TypeT.DSELECT) {  
					this.els.displayval!.textContent = this.gettextofoptionsval()
				}
			}
			else if (this.s.mode === ModeT.EDIT && !this.s.isanimating) {
				if (this.m.type === TypeT.TOGGLE) {  
					if (this.s.val === "true") { this.els.switch!.classList.add("istrue"); } else { this.els.switch!.classList.remove("istrue"); } 
				}
				if (this.m.type === TypeT.INPUT) {  
					this.els.input!.value = this.s.val
				}
				else if (this.m.type === TypeT.DSELECT) {  
					this.els.dselect!.setAttribute("val", this.s.val)
				}
			}
        }
		*/
    }




    sc() {   
		render(this.template(this.a, this.s, this.m), this.shadow);   
		/*
		inputel.addEventListener("input", (e)=> this.inputchanged(e)); 
		inputel.addEventListener("focus", (e)=> this.focused(e)); 
		inputel.addEventListener("blur",  (e)=> this.blurred(e)); 
		inputel.addEventListener("keyup", (e)=> this.keyupped(e)); 
		*/
	}




    public updatedone(newval?:str) {      

		const diff = Date.now() - this.s.updatemoment

		if (diff > 1000) {
			this.setAttribute("val", newval || this.s.newval);

			// DISABLE FOR NOW

			/*
			this.s.issaving = false;
			this.sc()
			*/
		} else {
			setTimeout(() => { 
				this.setAttribute("val", newval || this.s.newval);
				/*

				// DISABLE FOR NOW

				this.s.issaving = false;
				this.sc()
				*/
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

		if (val !== this.s.val) {
			confirm("Do you want to save changes?") ? this.runupdate() : console.log('nope');
		}
	}




    keyupped(e:KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			this.runupdate()
			this.sc()
		}
	}




	toggle_toggled(e:Event) {
		if (this.s.val === "true") {
			this.s.newval = "false"
		} else {
			this.s.newval = "true"
		}
		this.sc()
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
							@input="${()=>this.inputchanged()}"  
							@blur="${()=>this.blurred()}" 
							@focus="${()=>this.focused()}" 
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
			this.s.newval = this.s.val === "true" ? "false" : "true"

		} else if (this.m.type === TypeT.INPUT) {
			const inputel = this.shadow.querySelector("input") as HTMLInputElement|null;
			this.s.newval = inputel!.value!

		} else if (this.m.type === TypeT.DSELECT) {
			this.s.newval = this.els.dselect?.getAttribute("val") || ""
		}

		if (this.s.newval === this.s.val) {      
			this.s.newval = ""
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





    __not_used_set_existing_dom_according_to_attr_val() {
		// if (this.m.type === TypeT.TOGGLE) {
		// }
	}




    __not_used_insert_edit(_immediate_focus = false) {

		/*
        this.els.edit = document.createElement("span")
        this.els.edit.id = "edit"

        if (this.m.type === TypeT.TOGGLE) {
            this.els.switch = document.createElement("span")
            const span_inner_el = document.createElement("span")

            this.els.switch.className = "switch"
            span_inner_el.className = "inner"
            
            this.els.switch.style.transition = "none"
            span_inner_el.style.transition = "none"

            if (this.s.val === "true") { this.els.switch.classList.add("istrue") }

            this.els.switch.appendChild(span_inner_el)

            this.els.edit.appendChild(this.els.switch)

            setTimeout(() => {
                this.els.switch!.style.transition = ""
                span_inner_el.style.transition = ""
            }, 700)

            this.els.switch.addEventListener("click", () => {
                const newval = this.s.val === "true" ? "false" : "true"
                if (newval === "true") { this.els.switch!.classList.add("istrue") } else { this.els.switch!.classList.remove("istrue") }
				this.to_updating(this.s.val, newval)
            })

        } else if (this.m.type === TypeT.INPUT) {

            this.els.input = document.createElement("input")
            this.els.input.type = this.m.inputtype
            this.els.input.value = this.s.val
            this.els.input.placeholder = this.getAttribute("placeholder") || ""
			this.els.input.enterKeyHint="done" 


            if (this.els.input.type === "range") {
                this.els.input.min = this.getAttribute("min") || ""
                this.els.input.max = this.getAttribute("max") || ""
            }

            this.els.edit.appendChild(this.els.input)

				
            this.els.input.addEventListener("input", () => {
				this.dispatchEvent(new CustomEvent("change", {detail: {newval:this.els.input!.value, oldval:this.s.val}}))
            })

			this.els.editdone = document.createElement("i")
			this.els.editdone.innerHTML = "&#xf103;"

			this.els.input.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					const newval = this.els.input?.value || ""
					const oldval = this.s.val
					this.to_updating(oldval, newval)
					this.els.input?.blur()
				}
			})

			this.els.editdone.addEventListener("click", () => {
				const newval = this.els.input?.value || ""
				const oldval = this.s.val
				this.to_updating(oldval, newval)
			})

			this.els.edit.appendChild(this.els.editdone)

            if (immediate_focus) {
                setTimeout(()=>this.els.input!.focus(), 800)
            }

        } else if (this.m.type === TypeT.DSELECT) {

            this.els.dselect = document.createElement("c-dselect")
            this.els.dselect.setAttribute("options", this.getAttribute("options") || "")
            this.els.dselect.setAttribute("val", this.s.val)


            this.els.dselect.addEventListener("changed", (e:Event) => {
				const newval = (e as CustomEvent).detail.newval || ""
				const oldval = (e as CustomEvent).detail.oldval
				this.to_updating(oldval, newval); 
            })

            this.els.dselect.addEventListener("cancelled", (_e:Event) => {
				this.s.mode = ModeT.SAVED
				this.to_view()
            })

            this.els.edit.appendChild(this.els.dselect)

            if (immediate_focus) {
                setTimeout(()=> this.els.dselect!.setAttribute("open", ""), 200)
            }
        }

        this.els.section?.appendChild(this.els.edit)
		*/
    }





    __not_used_insert_view() {

        this.els.view = document.createElement("span")
        this.els.view.id = "view"
        this.els.displayval = document.createElement("p")
        this.els.action = document.createElement("i")
		this.els.action.innerHTML = "&#xf114;" 

		if (this.m.type === TypeT.DSELECT) {
			this.els.displayval.textContent = this.gettextofoptionsval()
		} else {
			this.els.displayval.textContent = this.s.val
		}

        this.els.view.appendChild(this.els.displayval)
        this.els.view.appendChild(this.els.action)

        if (this.s.err_msg) {
            const err_msg_el = document.createElement("span")
            err_msg_el.id = "err_msg"
            err_msg_el.textContent = this.s.err_msg
            this.els.view.appendChild(err_msg_el)
        }

        this.els.section?.appendChild(this.els.view) 
    }




    __not_used_to_edit() {

        if (this.s.mode === ModeT.VIEW && this.s.isanimating === false) {

            this.s.mode = ModeT.EDIT
            this.s.isanimating = true

            this.insert_edit(true)

            this.set_animation()

            this.animatehandles!.edit!.play()
            this.animatehandles!.view!.play()

            this.animatehandles!.edit!.onfinish = () => {
                this.s.isanimating = false
                this.els.view?.parentElement?.removeChild(this.els.view)
            }
        }
    }




    __not_used_set_to_updating(oldval:str|null = null, newval:str) { 

        if (this.s.mode === ModeT.EDIT && this.s.isanimating === false) {

            this.s.mode = ModeT.SAVING

			if (newval === oldval) {   this.to_updated_result(newval); return;   }


			if (this.m.type === TypeT.INPUT) {
                this.els.editdone?.classList.add("hide_while_spinner")
            }

            this.els.animeffect = document.createElement("c-animeffect")
            this.els.animeffect.setAttribute("active", "")

            this.els.edit?.appendChild(this.els.animeffect)
            /*
            if (this.m.type === TypeT.TOGGLE) {
            } else if (this.m.type === TypeT.INPUT) {
            } else if (this.m.type === TypeT.DSELECT) {
            }
            */

            this.els.animeffect.offsetWidth
            this.els.animeffect.className = "active"

			this.dispatchEvent(new CustomEvent("update", {detail: { 
				name:this.m.name, 
				newval, oldval,
				set_update_fail: this.set_update_fail.bind(this)
			}}))

            setTimeout(() => {
				this.to_updated_result(newval)
            }, 350)
        }
    }




    __not_used_to_updated_result(newval:str) {

		this.s.err_msg = ""

		this.s.mode = ModeT.SAVED

		// this triggers attribute changed right away, so mode will be SAVED and thus NOT run further event code, just set the s.val thats it
		this.setAttribute("val", newval)

		if (this.m.type === TypeT.TOGGLE) {

			console.log("about to move forward on toggle mode set")
			this.els.animeffect?.remove()
			this.s.mode = ModeT.EDIT

		} else if (this.m.type === TypeT.INPUT) {

			this.to_view()

		} else if (this.m.type === TypeT.DSELECT) {

			this.to_view()
		}
    }




    __not_used_to_error_result(reverttoval:str, error:str) {

		this.s.err_msg = error || "";

		if (this.m.type === TypeT.TOGGLE) {

			this.els.animeffect?.remove()
			if (reverttoval === "true") { this.els.switch!.classList.add("istrue"); } else { this.els.switch!.classList.remove("istrue"); } 
			this.s.mode = ModeT.EDIT

		} else if (this.m.type === TypeT.INPUT) {

			this.s.mode = ModeT.ERRORED
			this.setAttribute("val", (reverttoval ? reverttoval : this.s.val))
			this.els.input!.value = this.s.val
			this.to_view()

		} else if (this.m.type === TypeT.DSELECT) {

			this.s.mode = ModeT.ERRORED
			this.setAttribute("val", (reverttoval ? reverttoval : this.s.val))
			this.to_view()
		}

		console.error("error: unable to save " + this.m.name + " -- " + error)
    }




    __not_used_to_view() {

        if ( (this.s.mode === ModeT.SAVED || this.s.mode === ModeT.ERRORED) && this.s.isanimating === false) {

            this.s.mode = ModeT.VIEW
            this.s.isanimating = true

            this.insert_view()

            this.set_animation()

            this.animatehandles!.edit!.reverse()
            this.animatehandles!.view!.reverse()

            this.animatehandles!.edit!.onfinish = () => {
                this.s.isanimating = false
                this.els.edit?.parentElement?.removeChild(this.els.edit)
            }
        }
    }




    __not_used_set_animation() {

        const a = this.animatehandles
        const k = this.keyframes

        k.view = new KeyframeEffect(
            this.els.view, 
            [{opacity: 1, transform: "perspective(300px) translate3d(0, 0, 0)"}, {transform: "perspective(300px) translate3d(0, -21px, 0)", opacity: 0}], 
            {duration:290, easing: "cubic-bezier(.18,.24,.15,1)", fill: "both"}
        )

        k.edit = new KeyframeEffect(
            this.els.edit, 
            [{transform: "perspective(300px) translate3d(0, 21px, 13px) rotateX(72deg)", opacity: 0}, {transform: "perspective(300px) translate3d(0, 0, 0) rotateX(0)", opacity: 1}], 
            {duration:290, easing: "cubic-bezier(.18,.24,.15,1.0)", fill: "both"}
        )

        a.view = new Animation(k.view, document.timeline);
        a.edit = new Animation(k.edit, document.timeline);
    }




	__not_used_gettextofoptionsval() {
		const options = this.getAttribute("options") || ""
		if (options) {
			const options_arr = options.split(",")
			const option = options_arr.find((o:str) => o.split(":")[1] === this.s.val)
			return option ? option.split(":")[0] : this.s.val

		} else {
			return this.s.val
		}
	}



    /*
    EditDoneClicked() {
        if (this.s.mode === 'edit' && this.s.isanimating === false) {

            const inputel = this.shadow.getElementById("input") as HTMLInputElement
            if (inputel.value === this.s.val) {
                this.to_view()
            }

            else {
                this.to_saving()
            }

        }
    }
    */








    template = (_a:AttributesT, _s:StateT, _m:ModelT) => { return html`{--css--}{--html--}`; }; 
}




//@ts-ignore
customElements.define('c-in2', CIn2);


























export {  }



