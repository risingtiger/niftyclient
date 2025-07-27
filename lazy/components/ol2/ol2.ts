
import { str, bool } from "../../../defs_server_symlink.js";
import { animate_in, animate_out, init_animation_state, get_isanmiating, run_handle_scroll } from "./ol2_animate.js";

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
}

type ModelT = {
	shape: ShapeE,
	floatsize: FloatShapeSizeE
}

const ATTRIBUTES: AttributesT = { close: "" };




class COl2 extends HTMLElement {

	a: AttributesT = { ...ATTRIBUTES };
	s: StateT = { title: "", show_closebtn: true, show_header: true};
	m: ModelT = { shape: ShapeE.FILL, floatsize: FloatShapeSizeE.M };

	shadow: ShadowRoot
	viewwrapperel!: HTMLElement
	content_el!: HTMLElement
	wrapper_el!: HTMLElement
	theme_color_meta!: HTMLMetaElement;

	private handle_click = (_e: MouseEvent) => { this.close(); }
	private handle_content_click = (e: MouseEvent) => { e.stopPropagation(); }
	private handle_scroll = (_e: Event) => { 
		run_handle_scroll(this, this.viewwrapperel, ()=>this.closed()); 
	}

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

		const { shape, floatsize } = determine_shape_and_size(shapeA, floatsizeA, determine_screen_size_category())
		this.m.shape               = shape
		this.m.floatsize           = floatsize

		this.setAttribute("shape", shape);

		this.sc()

		this.viewwrapperel         = ( document.querySelector('#views>.view:last-child') as any ).shadowRoot.querySelector(':host > .wrapper')
		this.content_el            = this.shadow.querySelector(".content") as HTMLElement
		this.wrapper_el            = this.shadow.querySelector(".wrapper") as HTMLElement
		this.theme_color_meta      = document.head.querySelector("meta[name='theme-color']")!;


		this.addEventListener("click", this.handle_click, false);
		this.content_el.addEventListener("click", this.handle_content_click, false);


		if (this.firstElementChild!.tagName.startsWith("C-") || this.firstElementChild!.tagName.startsWith("VP-")) {
			this.firstElementChild!.addEventListener("hydrated", async ()=> {
				this.init()
			})
		} else {
			// is not a component or view part, so we can continue immediately instead of waiting for the hydration, in other words, the DOM is already ready  
			this.init()
		}
	}




	async attributeChangedCallback(name: str) {

		if (name === "close") {
			this.close()
		}
	}




	sc() { render(this.template(this.s, this.m), this.shadow); }




	async init() {

		await new Promise(resolve => setTimeout(()=>resolve(1),20));

		if (this.m.shape === ShapeE.FILL) {
			this.wrapper_el.scrollIntoView({behavior:"instant"});
			this.addEventListener('scroll', this.handle_scroll);
		}

		await new Promise(resolve => setTimeout(()=>resolve(1),20));

		init_animation_state(this.theme_color_meta, this.m.shape);

		await animate_in(this.content_el, this.viewwrapperel)
	}



	disconnectedCallback() {
		this.removeEventListener("click", this.handle_click);
		if (this.content_el) {
			this.content_el.removeEventListener("click", this.handle_content_click);
		}
		this.removeEventListener("scroll", this.handle_scroll);
	}




	async close() {
		if ( get_isanmiating() ) return;

		await this.animate_out()
		this.closed()
	}




	closed() {
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



