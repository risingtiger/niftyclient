


import { str, num, bool } from "../../../defs_server_symlink.js";

declare var render: any;
declare var html: any;



enum ModeT { INERT = 0, PROCESSING = 1, PROCESSED = 2 }


type StateT = {
	mode: ModeT,
	itemindex: number,      // currently active btnitem index
	clicked_index: number,  // which btnitem was just clicked (pending done())
}

type ModelT = {
	show_anime_on_click: bool,
	show_pulse_on_click: bool,
}

type ElsT = {
	animeffect: HTMLElement | null,
	clicked_btnitem: CBtnItem | null,  // the btnitem that was clicked and is processing
	highlight: HTMLElement | null,
}




class CBtn extends HTMLElement {

	s: StateT
	m: ModelT
	els: ElsT
	shadow: ShadowRoot




	constructor() {

		super();

		this.shadow = this.attachShadow({mode: 'open'});

		this.s = { mode: ModeT.INERT, itemindex: 0, clicked_index: 0 }
		this.m = { show_anime_on_click: true, show_pulse_on_click: true }
		this.els = { animeffect: null, clicked_btnitem: null, highlight: null }
	}




	connectedCallback() {

		this.m.show_anime_on_click = this.hasAttribute("noanime") ? false : true
		this.m.show_pulse_on_click = this.hasAttribute("nopulse") ? false : true

		this.sc()

		this.els.highlight = this.shadow.getElementById('highlight')

		const existing_btnitems = Array.from(this.querySelectorAll(':scope > c-btnitem')) as CBtnItem[]

		if (existing_btnitems.length === 0) {
			const btnitem = document.createElement('c-btnitem') as CBtnItem
			while (this.childNodes.length > 0) btnitem.appendChild(this.childNodes[0])
			this.appendChild(btnitem)
		}

		const btnitems = Array.from(this.querySelectorAll(':scope > c-btnitem')) as CBtnItem[]

		if (btnitems.length > 1) this.setAttribute('btngroup', '')

		const active_idx = btnitems.findIndex(item => item.hasAttribute('isactive'))
		this.s.itemindex = active_idx >= 0 ? active_idx : 0

		this.update_highlight(btnitems)

		this.addEventListener("click", (e) => { this.is_clicked(e) })
	}




	async attributeChangedCallback(_name: str, _oldval: str, _newval: str) {
	}




	async done() {
		this.s.mode = ModeT.PROCESSED
		await this.set_to_processing_done();

		const btnitems = Array.from(this.querySelectorAll(':scope > c-btnitem')) as CBtnItem[]

		if (btnitems.length > 1 && this.s.clicked_index !== this.s.itemindex) {
			btnitems[this.s.itemindex].removeAttribute('isactive')
			btnitems[this.s.clicked_index].setAttribute('isactive', '')
			this.s.itemindex = this.s.clicked_index
			this.update_highlight(btnitems)
		}

		this.s.mode = ModeT.INERT
	}




	is_clicked(e: Event) {

		if (this.s.mode !== ModeT.INERT) return

		const path = e.composedPath()
		const clicked_btnitem = path.find(el => el instanceof CBtnItem) as CBtnItem | undefined

		if (!clicked_btnitem) return

		const btnitems = Array.from(this.querySelectorAll(':scope > c-btnitem')) as CBtnItem[]
		const clicked_index = btnitems.indexOf(clicked_btnitem)

		if (clicked_index < 0) return

		this.s.clicked_index = clicked_index
		this.els.clicked_btnitem = clicked_btnitem

		this.dispatchEvent(new CustomEvent("btnclick", {detail: {done: this.done.bind(this), index: clicked_index}}))
		this.s.mode = ModeT.PROCESSING
		setTimeout(() => { if (this.s.mode === ModeT.PROCESSING) this.done() }, 5000)

		if (this.m.show_pulse_on_click) {
			clicked_btnitem.classList.remove("click-enlarge")
			clicked_btnitem.offsetWidth
			clicked_btnitem.classList.add("click-enlarge")
			clicked_btnitem.addEventListener("animationend", () => {
				clicked_btnitem.classList.remove("click-enlarge")
				if (this.m.show_anime_on_click && this.s.mode === ModeT.PROCESSING) this.set_to_processing_mode()
			}, { once: true })
		} else {
			if (this.m.show_anime_on_click) this.set_to_processing_mode()
		}
	}




	set_to_processing_mode() {

		if (!this.els.clicked_btnitem) return

		const animeffect = document.createElement("c-animeffect")
		animeffect.setAttribute("active", "")

		this.els.clicked_btnitem.shadow.appendChild(animeffect)
		this.els.animeffect = animeffect

		animeffect.offsetWidth
		animeffect.className = "active"
	}




	set_to_processing_done = () => new Promise<void>((res) => {

		if (this.els.animeffect) this.els.animeffect.className = ""

		setTimeout(() => {

			if (this.els.animeffect) {
				this.els.animeffect.remove()
				this.els.animeffect = null
			}
			res()

		}, 100)
	})




	async update_highlight(btnitems: CBtnItem[]) {

		if (btnitems.length <= 1) {
			if (this.els.highlight) this.els.highlight.classList.add('hidden')
			return
		}

		await new Promise(r => setTimeout(r, 20))

		const target = btnitems[this.s.itemindex]
		if (!this.els.highlight || !target) return

		const firstRect = btnitems[0].getBoundingClientRect()
		const targetRect = target.getBoundingClientRect()

		let offset = targetRect.left - firstRect.left
		let width = targetRect.width

		if (this.s.itemindex === 0)						 {   offset = offset + 3;   }
		else if (this.s.itemindex === btnitems.length-1) {   offset = offset + 4; width = width - 1;   }
		else											 {   offset = offset + 3.5;  }

		this.els.highlight.style.transform = `translateX(${offset}px)`
		this.els.highlight.style.width = `${width}px`
	}




	sc() { render(this.template(), this.shadow); }




	template = () => { return html`{--css--}{--html--}`; };
}




customElements.define('c-btn', CBtn);




const BTNITEM_STYLES = `
	:host {
		display: block;
		padding: 0 8px;
		cursor: pointer;
		box-sizing: border-box;
		-webkit-tap-highlight-color: transparent;
		z-index: 1;
	}
	:host([isactive]) {
		font-weight: bold;
	}

	:host c-animeffect {
		position: absolute;
		top: 7px;
		left: calc(50% - 10px);
		width: 20px;
		height: 20px;
	}

	@keyframes breathe-click {
		0%   { transform: scale(1); }
		40%  { transform: scale(1.22); }
		70%  { transform: scale(0.95); }
		100% { transform: scale(1); }
	}

	:host(.click-enlarge) {
		animation: breathe-click 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
	}
`




class CBtnItem extends HTMLElement {

	shadow: ShadowRoot

	constructor() {
		super()
		this.shadow = this.attachShadow({mode: 'open'})
	}

	connectedCallback() {
		this.shadow.innerHTML = `<style>${BTNITEM_STYLES}</style><slot></slot>`
	}
}




customElements.define('c-btnitem', CBtnItem);




export { }


