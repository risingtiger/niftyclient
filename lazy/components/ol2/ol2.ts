import { str, num, bool } from "../../../defs_server_symlink.js";
import { animate_in, animate_out, init_animation_state } from "./ol2_animate.js";

declare var render: any;
declare var html: any;

enum ShapeE { FILL = "fill", FLOAT = "float" }
enum FloatShapeSizeE { S = 's', M = 'm', L = 'l', NA = 'na' }
enum BrowserScreenSizeCategoryE { SMALL, MEDIUM, LARGE }

type AttributesT = {
	close: str,
}

type StateT = {
	title: str,
	show_closebtn: bool,
	show_header: bool,
	scroll_end_timer?: any
	isopen: bool
}

type ModelT = {
	shape: ShapeE,
	floatsize: FloatShapeSizeE
}

const ATTRIBUTES: AttributesT = { close: "" };




class COl2 extends HTMLElement {

	a: AttributesT = { ...ATTRIBUTES };
	s: StateT = { title: "", show_closebtn: true, show_header: true, isopen: false };
	m: ModelT = { shape: ShapeE.FILL, floatsize: FloatShapeSizeE.M };

	shadow: ShadowRoot
	viewwrapperel!: HTMLElement
	content_el!: HTMLElement
	wrapper_el!: HTMLElement
	theme_color_meta!: HTMLMetaElement;

	static get observedAttributes() { return Object.keys(ATTRIBUTES); }

	constructor() {
		super();
		this.shadow = this.attachShadow({ mode: 'open' });
	}




	async connectedCallback() {

		this.s.title         = this.getAttribute("title") || "asdfsdf"
		this.s.show_closebtn = this.getAttribute("closebtn")   === "false" ? false : true
		this.s.show_header   = this.getAttribute("showheader") === "false" ? false : true
		const shapeA         = this.getAttribute("shape") || ""
		const floatsizeA     = this.getAttribute("floatsizes") || ""

		this.sc()

		const { shape, floatsize } = determine_shape_and_size(shapeA, floatsizeA, determine_screen_size_category())
		this.m.shape               = shape
		this.m.floatsize           = floatsize
		this.viewwrapperel         = ( document.querySelector('#views>.view:last-child') as any ).shadowRoot.querySelector(':host > .wrapper')
		this.content_el            = this.shadow.querySelector(".content") as HTMLElement
		this.wrapper_el            = this.shadow.querySelector(".wrapper") as HTMLElement
		this.theme_color_meta      = document.head.querySelector("meta[name='theme-color']")!;

		init_animation_state(this.theme_color_meta);

		this.addEventListener("click", (_e: MouseEvent) => {this.close();   }, false);
		this.content_el.addEventListener("click", (e: MouseEvent) => {   e.stopPropagation();   }, false);
		//this.firstElementChild!.addEventListener("close", () => { this.close(); })


		if (this.firstElementChild!.tagName.startsWith("C-") || this.firstElementChild!.tagName.startsWith("VP-")) {
			this.firstElementChild!.addEventListener("hydrated", async ()=> {
				await new Promise(resolve => setTimeout(resolve, 80));
				this.wrapper_el.scrollIntoView({behavior:"instant"});
				await new Promise(resolve => setTimeout(resolve, 80));
				await animate_in(this.content_el, this.viewwrapperel)
			})
		} else {
			// is not a component or view part, so we can continue immediately instead of waiting for the hydration, in other words, the DOM is already ready  
			await new Promise(resolve => setTimeout(resolve, 80));
			this.wrapper_el.scrollIntoView({behavior:"instant"});
			await new Promise(resolve => setTimeout(resolve, 80));
			await animate_in(this.content_el, this.viewwrapperel)
		}

		this.content_el.style.opacity = '1';
		this.s.isopen = true;

		this.onscroll = _event => {
			if (this.scrollTop < 20 && this.s.isopen) {
				this.closed();
			}
		}
	}




	async attributeChangedCallback(name: str) {

		if (name === "close") {
			this.close()
		}
	}




	sc() { render(this.template(this.s, this.m), this.shadow); }




	async close() {
		await this.animate_out()
		this.closed()
	}




	closed() {
		this.s.isopen = false; // probably not needed, but for clarity
		this.dispatchEvent(new Event('close'));
	}




	scrolled(_e: Event) {
		if (this.scrollTop <= 1 && this.hasAttribute("opened")) this.closed();
	}

	async animate_out() {
		await animate_out(this.content_el, this.viewwrapperel);
	}


	template = (_s: StateT, _m: ModelT) => { return html`{--css--}{--html--}`; };
}




customElements.define('c-ol2', COl2);




function determine_shape_and_size(_shapeA: str, floatsizeA:str, screen_size_category: BrowserScreenSizeCategoryE): { shape: ShapeE, floatsize: FloatShapeSizeE } {
	if (screen_size_category === BrowserScreenSizeCategoryE.SMALL) {
		return { shape: ShapeE.FILL, floatsize: FloatShapeSizeE.NA }
	}

	// For MEDIUM and LARGE screens, the shape is always FLOATING.
	// The size is determined from the attribute, defaulting to M.
	const shape = ShapeE.FLOAT
	let floatsize = FloatShapeSizeE.M

	if (floatsize) {
		switch (floatsizeA.trim().toLowerCase()) {
			case "s": floatsize = FloatShapeSizeE.S; break;
			case "m": floatsize = FloatShapeSizeE.M; break;
			case "l": floatsize = FloatShapeSizeE.L; break;
			default:  floatsize = FloatShapeSizeE.M; break;
		}
	}

	return { shape, floatsize }
}




function determine_screen_size_category(): BrowserScreenSizeCategoryE {
	const screen_width = window.innerWidth
	if (screen_width < 768) {
		return BrowserScreenSizeCategoryE.SMALL
	} else if (screen_width >= 768 && screen_width < 1024) {
		return BrowserScreenSizeCategoryE.MEDIUM
	} else {
		return BrowserScreenSizeCategoryE.LARGE
	}
}




export { }



