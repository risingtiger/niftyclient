
import { str, bool } from "../../../defs_server_symlink.js";
import { $NT, CMechViewPartT } from "../../../defs.js";
import { animate_in, animate_out, init_animation_state, get_isanmiating, run_handle_scroll, ShapeE, FloatShapeSizeE } from "./ol2_animate.js";

declare var render: any;
declare var html: any;
declare var $N: $NT;


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
	floatsize: FloatShapeSizeE,
	actionterm: str,
}

const ATTRIBUTES: AttributesT = { close: "" };




class COl2 extends HTMLElement {

	a: AttributesT = { ...ATTRIBUTES };
	s: StateT = { title: "", show_closebtn: true, show_header: true};
	m: ModelT = { shape: ShapeE.FILL, floatsize: FloatShapeSizeE.M, actionterm: "" };

	shadow: ShadowRoot
	viewwrapperel!: HTMLElement
	content_el!: HTMLElement
	wrapper_el!: HTMLElement
	theme_color_meta!: HTMLMetaElement;

	private handle_click = (_e: MouseEvent) => { this.close(); }
	private handle_content_click = (e: MouseEvent) => { e.stopPropagation(); }
	private handle_scroll = (_e: Event) => { 
		if (this.m.shape === ShapeE.FILL) {
			run_handle_scroll(this as any, this.viewwrapperel, ()=>this.closed()); 
		}
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
		this.m.actionterm    = this.getAttribute("actionterm") || ""
		const shapeA         = this.getAttribute("shape") || ""
		const floatsizeA     = this.getAttribute("floatsizes") || ""

		const { shape, floatsize } = determine_shape_and_size(shapeA, floatsizeA, determine_screen_size_category())
		this.m.shape               = shape
		this.m.floatsize           = floatsize

		this.setAttribute("shape", shape);

		this.sc()

		this.viewwrapperel         = ( document.querySelector('#views > .view:last-child') as any ).shadowRoot.querySelector(':host > .wrapper')
		this.content_el            = this.shadow.querySelector(".content") as HTMLElement
		this.wrapper_el            = this.shadow.querySelector(".wrapper") as HTMLElement


		this.addEventListener("click", this.handle_click, false);
		this.addEventListener("scroll", this.handle_scroll, false);
		this.content_el.addEventListener("click", this.handle_content_click, false);


		if (this.firstElementChild!.tagName.startsWith("VP-")) {
			const viewparthydrated = async () => {
				this.firstElementChild!.removeEventListener('viewparthydrated', viewparthydrated)
				this.firstElementChild!.removeEventListener('viewpartconnectfailed', viewpartconnectfailed)

				// Start postload but don't await - let init() run in parallel
				const postload_promise = $N.CMech.PostLoadViewPart(this.firstElementChild as HTMLElement & CMechViewPartT)

				// Begin transition animation immediately
				await this.init()

				// Now that overlay is fully transitioned in, await the postload
				await postload_promise;

				// we dont really need to await this.init or even the postload_promise because PostLoadViewPart calls ingest, render and revealed on the viewpart
			}
			const viewpartconnectfailed = () => {
				this.firstElementChild!.removeEventListener('viewparthydrated', viewparthydrated)
				this.firstElementChild!.removeEventListener('viewpartconnectfailed', viewpartconnectfailed)
				$N.Unrecoverable("Unable to Load Page", 'View part failed to connect.', "Back to Home", "srf", `vp component: ${this.firstElementChild!.tagName}`, null) // switch_station_route_load_fail
			}

			this.firstElementChild!.addEventListener('viewparthydrated', viewparthydrated)
			this.firstElementChild!.addEventListener('viewpartconnectfailed', viewpartconnectfailed)
		
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
		await init_animation_state(this as any);
		this.setAttribute('readytoanimate', '');
		await animate_in(this as any, this.viewwrapperel, this.content_el)
	}



	disconnectedCallback() {
		this.removeEventListener("click", this.handle_click);
		if (this.content_el) {
			this.content_el.removeEventListener("click", this.handle_content_click);
		}
		this.removeEventListener("scroll", this.handle_scroll);
	}




	async close() {
		if ( get_isanmiating(this as any) ) return;

		await animate_out(this as any, this.viewwrapperel, this.content_el);
		this.closed()
	}




	closed() {
		this.dispatchEvent(new Event('close'));
	}




	// scrolled(_e: Event) {
	// 	if (this.scrollTop <= 1 && this.hasAttribute("opened")) this.closed();
	// }

	actiontermclicked() {
		if (( this.firstElementChild as any ).actiontermclicked) { ( this.firstElementChild as any ).actiontermclicked(); }
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



