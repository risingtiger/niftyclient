

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
	scroll_end_timer?: any
	isopen: bool
	animatetheme: { duration:num, start_time:num|null, start_color:num, start_range:num, color_range:num  }
}

type ModelT = {
	shape: ShapeE,
	floatsize: FloatShapeSizeE
}


const ATTRIBUTES: AttributesT = { close: "" };




class COl2 extends HTMLElement {

	a: AttributesT = { ...ATTRIBUTES };
	s: StateT = { title: "", show_closebtn: true, show_header: true, isopen: false, animatetheme: { duration: 0, start_time: null, start_color: 155, start_range: 100, color_range: 100 } };
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




const animate_in = (content_el:HTMLElement, viewwrapperel:HTMLElement) => new Promise<void>(async (res,_rej) => {

    content_el.style.opacity = '0';
    
    const content_keyframes = [
        { transform: 'translate3d(0, 20vh, 0)', opacity: 0 },
        { transform: 'translate3d(0, 0, 0)', opacity: 1 }
    ];
    
    const viewwrapperel_keyframes = [
        { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
        { transform: 'translate3d(0, 20px, 0) scale(0.92)', opacity: 0.7 }
    ];
    
    const animation_options = {
        duration: 560,
        easing: 'cubic-bezier(0, 0.850, 0.250, 1)',
        fill: 'forwards' as FillMode
    };
    
    animate_theme_and_body_color(animation_options.duration, false);

    const content_animation       = content_el.animate(content_keyframes, animation_options);
    const viewwrapperel_animation = viewwrapperel.animate(viewwrapperel_keyframes, animation_options);
    
    await Promise.all([content_animation.finished, viewwrapperel_animation.finished]);
    
	res()
})




const animate_out = async (content_el: HTMLElement, viewwrapperel: HTMLElement) => new Promise<void>(async (res, _rej) => {
    
    const content_keyframes = [
        { transform: 'translate3d(0, 0, 0)', opacity: 1 },
        { transform: 'translate3d(0, 20vh, 0)', opacity: 0 }
    ];
    
    const viewwrapperel_keyframes = [
        { transform: 'translate3d(0, 20px, 0) scale(0.92)', opacity: 0.7 },
        { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 }
    ];
    
    const animation_options = {
        duration: 350,
        easing: 'cubic-bezier(0, 0.850, 0.250, 1)',
        fill: 'forwards' as FillMode
    };
    
    animate_theme_and_body_color(animation_options.duration, true);
    
    const content_animation = content_el.animate(content_keyframes, animation_options);
    const viewwrapperel_animation = viewwrapperel.animate(viewwrapperel_keyframes, animation_options);
    
    await Promise.all([content_animation.finished, viewwrapperel_animation.finished]);

	res()
})




function animate_theme_and_body_color(duration: number, is_out: bool = false) {

	this.s.animatetheme.duration = duration;
	this.s.animatetheme.start = null;

    this.s.animatetheme.start_color = is_out ? 155 : 255;
    const end_color = is_out ? 255 : 155;
    this.s.animatetheme.color_range = end_color - this.s.animatetheme.start_color;

    requestAnimationFrame((ct)=>animate_theme_and_body_color__frame(ct));
}



function animate_theme_and_body_color__frame(current_time: number) {
	if (this.s.animatetheme.start === null) {
		this.s.animatetheme.start = current_time;
	}
	const elapsed = current_time - this.s.animatetheme.start;
	const progress = Math.min(elapsed / this.s.animatetheme.duration, 1);

	const color_val = Math.round(this.s.animatetheme.start_color + this.s.animatetheme.color_range * progress);
	const color_str = `rgb(${color_val},${color_val},${color_val})`;

	this.theme_color_meta!.setAttribute("content", color_str);
	document.body.style.backgroundColor = color_str;

	if (progress < 1) {
		requestAnimationFrame(animate_theme_and_body_color__frame);
	}
}







export { }



