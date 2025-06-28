

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
	wrap_el!: HTMLElement
	content_el!: HTMLElement
	background_el!: HTMLElement

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

		this.wrap_el = this.shadow.querySelector(".wrapper") as HTMLElement
		this.content_el = this.shadow.querySelector(".content") as HTMLElement
		this.background_el = this.shadow.querySelector(".background") as HTMLElement;

		this.content_el.classList.add("transition-in");

		if (child.tagName.startsWith("C-") || child.tagName.startsWith("VP-")) {
			child.addEventListener("hydrated", continue_to_open.bind(this))
		} else {
			// is not a component or view part, so we can continue immediately instead of waiting for the hydration, in other words, the DOM is already ready  
			continue_to_open.bind(this)()
		}



		function continue_to_open() {

			this.sc()

			this.addEventListener("click", (_e: MouseEvent) => {   this.close();   }, false);
			this.content_el.addEventListener("click", (e: MouseEvent) => {   e.stopPropagation();   }, false);
			this.addEventListener("scroll", this.scrolled.bind(this))
			child.addEventListener("close", () => { this.close(); })
			this.content_el.addEventListener("transitionend", this.transition_finished.bind(this))

			setTimeout(() => {

				//this.wrap_el.scrollIntoView({ behavior: 'smooth' })
				setTimeout(()=> { 
					this.content_el.classList.remove("transition-in");
					this.animate_aux(performance.now(), 400, false);
					this.sc()
				}, 100);
			}, 100);

		}

	}




	async attributeChangedCallback(name: str) {

		if (name === "close") {
			this.close()
		}
	}




	sc() { render(this.template(this.s, this.m), this.shadow); }




	transition_finished(e: TransitionEvent) {

		if (e.propertyName !== "opacity") return;


		if (this.content_el.classList.contains("transition-out")) {
			this.closed()
		}
		else {
			const spacerel = this.shadow.querySelector(".spacer") as HTMLElement;
			spacerel.style.display = "block";
			this.wrap_el.scrollIntoView()

			this.setAttribute("opened", "true")
		}
	}




	close() {
		this.content_el.classList.add("transition-out");
		this.wrap_el.classList.remove("active");
		this.animate_aux(performance.now(), 200, true);
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

		if (this.scrollTop <= 1 && this.hasAttribute("opened")) this.closed();
	}



	animate_aux(start_time: number, duration: number, is_out: bool = false) {

		const now = performance.now();
		const elapsed = now - start_time;
		const progress = Math.min(elapsed / duration, 1);

		const opacity = is_out ? (1 - progress) : progress;

		const viewheader = document.querySelector("header.viewheader")
		const viewcontentel = document.querySelector("div.content")

		const background_max = .2
		const alpha = opacity * background_max;
		

		const flipped_alpha = 1 - alpha; 
		const gray_value = Math.round(flipped_alpha * 255);
		let hex_of_gray_value = gray_value.toString(16).padStart(2, '0').repeat(3).toUpperCase();

		console.log(hex_of_gray_value);
		document.body.style.backgroundColor = `#${hex_of_gray_value}`;
		this.background_el.style.opacity = `${alpha}`;

		if (progress < 1) {
			requestAnimationFrame(() => this.animate_aux(start_time, duration, is_out));
		}
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



