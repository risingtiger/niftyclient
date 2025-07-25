

import { str, num, bool } from "../../../defs_server_symlink.js";
import { animate_in, animate_out } from "./ol2_animate.js";


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
}

type ModelT = {
	shape: ShapeE,
	floatsize: FloatShapeSizeE
}


const ATTRIBUTES: AttributesT = { close: "" }




class COl2 extends HTMLElement {

	a: AttributesT = { ...ATTRIBUTES };
	s: StateT = { title: "", show_closebtn: true, show_header: true };
	m: ModelT = { shape: ShapeE.FILL, floatsize: FloatShapeSizeE.M };

	shadow: ShadowRoot
	wrap_el!: HTMLElement
	content_el!: HTMLElement

	static get observedAttributes() { return Object.keys(ATTRIBUTES); }

	constructor() {
		super();
		this.shadow = this.attachShadow({ mode: 'open' });
	}




	connectedCallback() {

		this.s.title         = this.getAttribute("title") || "asdfsdf"
		this.s.show_closebtn = this.getAttribute("closebtn")   === "false" ? false : true
		this.s.show_header   = this.getAttribute("showheader") === "false" ? false : true
		const shapeA         = this.getAttribute("shape") || ""
		const floatsizeA     = this.getAttribute("floatsizes") || ""

		const child = this.firstElementChild as HTMLElement
		const screen_size_category = determine_screen_size_category()

		const { shape, floatsize } = determine_shape_and_size(shapeA, floatsizeA, screen_size_category)
		this.m.shape          = shape
		this.m.floatsize           = floatsize


		// Set initial opacity for animation
		this.style.opacity = "1";

		this.sc()

		// wrap_el is within the shadow dom of body > .views > .view. set wrap_el to it AI!
		this.wrap_el = this.shadow.querySelector(".wrapper") as HTMLElement
		this.content_el = this.shadow.querySelector(".content") as HTMLElement

		if (child.tagName.startsWith("C-") || child.tagName.startsWith("VP-")) {
			child.addEventListener("hydrated", continue_to_open.bind(this))
		} else {
			// is not a component or view part, so we can continue immediately instead of waiting for the hydration, in other words, the DOM is already ready  
			continue_to_open.bind(this)()
		}



		function continue_to_open() {
			this.addEventListener("click", (_e: MouseEvent) => {this.close();   }, false);
			this.content_el.addEventListener("click", (e: MouseEvent) => {   e.stopPropagation();   }, false);
			//this.addEventListener("scroll", this.scrolled.bind(this))
			child.addEventListener("close", () => { this.close(); })

			// Animate in the overlay
			animate_in(this, this.content_el, this.wrap_el)
		}
	}




	async attributeChangedCallback(name: str) {

		if (name === "close") {
			this.close()
		}
	}




	sc() { render(this.template(this.s, this.m), this.shadow); }




	close() {
		this.animate_out()
	}




	closed() {
		this.setAttribute("closed", "true")
		this.dispatchEvent(new Event('close'));
	}




	scrolled(_e: Event) {
		if (this.scrollTop <= 1 && this.hasAttribute("opened")) this.closed();
	}

	async animate_out() {
		await animate_out(this, this.content_el, this.wrap_el, this.m.shape);
		this.closed();
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



