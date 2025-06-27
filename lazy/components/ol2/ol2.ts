

import { str, num, bool } from "../../../defs_server_symlink.js";


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


		this.sc()

		const wrapel = this.shadow.querySelector(".wrapper") as HTMLElement
		const contentel = this.shadow.querySelector(".content") as HTMLElement
		contentel.classList.add("transition-in");

		if (child.tagName.startsWith("C-") || child.tagName.startsWith("VP-")) {
			child.addEventListener("hydrated", continue_to_open.bind(this))
		} else {
			// is not a component or view part, so we can continue immediately instead of waiting for the hydration, in other words, the DOM is already ready  
			continue_to_open.bind(this)()
		}



		function continue_to_open() {

			this.sc()

			this.addEventListener("click", (_e: MouseEvent) => {   this.close();   }, false);
			this.shadow.querySelector(".content")!.addEventListener("click", (e: MouseEvent) => {   e.stopPropagation();   }, false);
			this.addEventListener("scroll", this.scrolled.bind(this))
			child.addEventListener("close", () => { this.close(); })
			this.shadow.querySelector(".content").addEventListener("transitionend", this.transition_finished.bind(this))

			setTimeout(() => {
				this.scrollTop = this.scrollHeight / 2
				contentel.classList.remove("transition-in");
				wrapel.classList.add("active")
				this.track_opening_animation();
				this.sc()
			}, 100);

		}

	}




	track_opening_animation() {
		const contentel = this.shadow.querySelector(".content") as HTMLElement;
		if (!contentel) { return; }

		const animate = () => {
			// The 'opened' attribute is set when the transition ends, which stops the loop.
			if (this.hasAttribute("opened")) { return; }

			const transform_style = window.getComputedStyle(contentel).transform;
			if (transform_style && transform_style !== 'none') {
				const matrix = new DOMMatrix(transform_style);
				const transform_y = matrix.m42;
				// You can now use the transform_y value for other things.
			}

			requestAnimationFrame(animate);
		};

		requestAnimationFrame(animate);
	}




	async attributeChangedCallback(name: str) {

		if (name === "close") {
			this.close()
		}
	}




	sc() { render(this.template(this.s, this.m), this.shadow); }




	transition_finished(e: TransitionEvent) {

		if (e.propertyName !== "opacity") return;


		const contentel = this.shadow.querySelector(".content") as HTMLElement

		if (contentel.classList.contains("transition-out")) {
			this.closed()
		}
		else {
			this.setAttribute("opened", "true")
		}
		/*
		if (this.wrapperAnimation!.playbackRate === -1) {
			this.removeAttribute("closing")
			this.removeAttribute("opened")
			this.setAttribute("closed", "true")
			this.dispatchEvent(new Event('close'))
		} else {
			this.removeAttribute("opening")
			this.removeAttribute("closed")
			this.setAttribute("opened", "true")
		}
		*/
	}




	close() {
		this.shadow.querySelector(".content")!.classList.add("transition-out");
		this.shadow.querySelector(".wrapper")!.classList.remove("active");
	}




	closed() {
		this.setAttribute("closed", "true")
		this.dispatchEvent(new Event('close'));
	}




	scrolled(e: Event) {
		const scrollTop = (e.target as HTMLElement).scrollTop;
		const perc = (scrollTop / (this.scrollHeight)) * 100;

		const gray_value = Math.round(255 - (perc / 100) * 255);
		const gray_color = `rgb(${gray_value}, ${gray_value}, ${gray_value})`;

		document.body.style.backgroundColor = gray_color;

		if (this.scrollTop <= 1) this.closed();
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



