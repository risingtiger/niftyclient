

import { $NT, GenericRowT, LazyLoadT, LoggerSubjectE } from  "../../../defs.js" 
import { str, num, bool } from "../../../defs_server_symlink.js";


declare var $N: $NT;
declare var render: any;
declare var html: any;




enum ShapeE { NOT_APPLICABLE, PRIORITY_MOBILE_FULL, PRIORITY_MOBILE_BOTTOM_HALF, PRIORITY_MOBILE_BOTTOM_THIRD, PRIORITY_DESKTOP_MD, PRIORITY_DESKTOP_LG, PRIORITY_DESKTOP_XL, PRIORITY_DESKTOP_XXL, XS }

type StateT = {
	title: str,
    width: str,
    height: str,
    top: str,
    left: str,
    margin_left: str,
    shape: ShapeE,
    /*pinto: str,*/
    show_closebtn: bool,
    show_header: bool,
    is_mobile_centric: bool,
}

type ModelT = {
    prop: num
}








class COl extends HTMLElement {

    s:StateT
    m:ModelT

    $:any

    wrapperAnimation!:Animation|null
    backgroundAnimation!:Animation|null
    viewAnimation!:Animation|null
    viewheaderAnimation!:Animation|null
    sheet:CSSStyleSheet
    shadow:ShadowRoot




    static get observedAttributes() { return ['close']; }




    constructor() {   

        super(); 

        this.s = {
			title: "",
            width: "",
            height: "",
            top: "",
            left: "",
            margin_left: "",
            shape: ShapeE.PRIORITY_MOBILE_FULL,
            /*pinto: "",*/
            show_closebtn: true,
            show_header: true,
            is_mobile_centric: false,
        }

        this.$ = this.querySelector

        this.shadow = this.attachShadow({mode: 'open'});


    }




    connectedCallback() {   

		this.s.title = this.getAttribute("title") || "asdfsdf"
        this.s.show_closebtn = this.getAttribute("closebtn") === "false" ? false : true
        this.s.show_header = this.getAttribute("showheader") === "false" ? false : true

        const child = this.firstElementChild as HTMLElement

        child.addEventListener("close", ()=> {
            this.close()
        })

        this.sc()


        if (child.tagName.startsWith("C-") || child.tagName.startsWith("VP-")) {
            child.addEventListener("hydrated", continue_to_open.bind(this))
			$N.EngagementListen.LogEngagePoint(LoggerSubjectE.engagement_overlayview, child.tagName.toLowerCase())
        } else {
            continue_to_open.bind(this)()
        }



        function continue_to_open() {
            this.setup_pos_size_etc()
            this.setup_dom()
            this.setup_animations_etc()

            this.wrapperAnimation!.addEventListener("finish", animate_finished.bind(this))

            this.sc()
            this.setAttribute("opening", "true")
            animate_in(this.backgroundAnimation, this.viewAnimation, this.viewheaderAnimation, this.wrapperAnimation)
        }

        function animate_finished() {
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
        }
    }




    async attributeChangedCallback(name:str) {

        if (name === "close") { 
            this.close()
        }
    }




    sc() {   render(this.template(this.s, this.m), this.shadow);   }




    close() {
        this.setAttribute("closing", "true")
        animate_out(this.backgroundAnimation!, this.viewAnimation!, this.viewheaderAnimation!, this.wrapperAnimation!)
    }



    setup_animations_etc() {

        let elW  = this.shadow.querySelector(".wrapper")!
        let elB  = this.shadow.querySelector(".backgroundcover") as HTMLElement
        let elC  = document.querySelector("#views .view")!.shadowRoot!.querySelector(".content") as HTMLElement
        let elCH = document.querySelector("#views .view")!.shadowRoot!.querySelector("header") as HTMLElement


        this.backgroundAnimation = elB.animate(ol_animations.get("background_fade_in")!, ol_timings.get("mobile_a") as any)
        this.backgroundAnimation.pause()

        this.viewAnimation = elC.animate(ol_animations.get(`${this.s.is_mobile_centric ? 'mobile' : 'desktop'}_view_slide_down`)!, ol_timings.get("mobile_a") as any)
        this.viewAnimation.pause()

        this.viewheaderAnimation = elCH.animate(ol_animations.get(`${this.s.is_mobile_centric ? 'mobile' : 'desktop'}_view_slide_down`)!, ol_timings.get("mobile_a") as any)
        this.viewheaderAnimation.pause()

        this.wrapperAnimation = elW.animate(ol_animations.get(`${this.s.is_mobile_centric ? 'mobile' : 'desktop'}_wrapper_fade_up`)!, ol_timings.get("mobile_a") as any)
        this.wrapperAnimation.pause()
    }



    setup_pos_size_etc() {

        const ww = window.innerWidth
        //const hh = window.innerHeight

        const pb = this.getAttribute("shape") || "0"
        const pw = this.getAttribute("width") || "0"
        const ph = this.getAttribute("height") || "0"
        const pt = this.getAttribute("top") || "0"
        const pl = this.getAttribute("left") || "0"
        /*
        const pp = this.getAttribute("pinto") || ""
        const ps = this.getAttribute("pinposition") || ""
        const pa = this.getAttribute("pintoalign") || ""
        */

        const shape:ShapeE = Number(pb) || ShapeE.PRIORITY_MOBILE_FULL
        let width = Number(pw)
        let height = Number(ph)
        let width_num = 0
        let height_num = 0
        let top = Number(pt)
        let left = Number(pl)
        /*
        let pinto_query_str = pp
        let pinto_el:HTMLElement|null = null
        let position = ps
        let align = pa
        */

        const DESKTOP_DEFAULT_WIDTH = 480
        const DESKTOP_TO_MOBILE_DOWNSIZE_WIDTH = 390
        const DESKTOP_DEFAULT_HEIGHT = 800
        const DESKTOP_DEFAULT_TOP = 34

        const MOBILE_DEFAULT_HALF_HEIGHT = 400
        const MOBILE_DEFAULT_THIRD_HEIGHT = 200

        if (width > 0) {

            if (ww < DESKTOP_DEFAULT_WIDTH) {
                width = 0
                height = 0
            }

            else {
                width = Number(pw)
                height = height || DESKTOP_DEFAULT_HEIGHT
            }


        /*
        } else if (pinto_query_str) {

            const rn = this.getRootNode() as ShadowRoot

            if (!rn) {
                console.error("No root node for pinto")
                return
            }

            pinto_el = rn.querySelector(this.s.pinto) as HTMLElement
            const rect = pinto_el.getBoundingClientRect()

            if (position) {

                const p = position.split(" ").map(p=> p.trim())
                const a = align.split(" ").map(a=> a.trim())
                const alignleftdif = a[0] === 'right' ? -width_num : 0
                const aligntopdif = a[1] === 'bottom' ? -height_num : 0

                if (p[0] === "left") {
                    left = (rect.left + alignleftdif + (Number(left) || 0))
                }
                if (p[0] === "right") {
                    left = (rect.right + alignleftdif + (Number(left) || 0))
                }
                if (p[1] === "top") {
                    top = (rect.top + aligntopdif + (Number(top) || 0))
                }
                if (p[1] === "bottom") {
                    top = (rect.bottom + aligntopdif + (Number(top) || 0))
                }
            } else {
                left = rect.left
                top = rect.bottom
            }

        }
        */

        } else if (shape === ShapeE.PRIORITY_MOBILE_FULL || shape === ShapeE.PRIORITY_MOBILE_BOTTOM_HALF || shape === ShapeE.PRIORITY_MOBILE_BOTTOM_THIRD) {

            if (ww < DESKTOP_DEFAULT_WIDTH) {

                width = 0

                if (shape === ShapeE.PRIORITY_MOBILE_FULL) {
                    height = 0
                } else if (shape === ShapeE.PRIORITY_MOBILE_BOTTOM_HALF) {
                    height = MOBILE_DEFAULT_HALF_HEIGHT
                } else if (shape === ShapeE.PRIORITY_MOBILE_BOTTOM_THIRD) {
                    height = MOBILE_DEFAULT_THIRD_HEIGHT
                }

            } else {
                width = DESKTOP_TO_MOBILE_DOWNSIZE_WIDTH
                height = DESKTOP_DEFAULT_HEIGHT
            }
        }

        else if (shape === ShapeE.PRIORITY_DESKTOP_MD || shape === ShapeE.PRIORITY_DESKTOP_LG || shape === ShapeE.PRIORITY_DESKTOP_XL || shape === ShapeE.PRIORITY_DESKTOP_XXL) {

            if (ww < DESKTOP_DEFAULT_WIDTH) {
                width = 0
                height = 0
            } 

            else {

                if (shape === ShapeE.PRIORITY_DESKTOP_MD) {
                    width = DESKTOP_DEFAULT_WIDTH
                    height = DESKTOP_DEFAULT_HEIGHT
                }

                else if (shape === ShapeE.PRIORITY_DESKTOP_LG) {
                    width = 640
                    height = 1000
                }

                else if (shape === ShapeE.PRIORITY_DESKTOP_XL) {
                    width = 800
                    height = 1200
                }

                else if (shape === ShapeE.PRIORITY_DESKTOP_XXL) {
                    width = 1024
                    height = 1400
                }
            }
        }

        else if (shape === ShapeE.XS) {
            width = 280
            height = 550
        }


        if (width === 0) {
            this.s.width = "100%"
            this.s.left = '0'
        } else {
            this.s.width = width + 'px'
            
            this.s.left = left ? left + 'px' : '50%'
            this.s.margin_left = '-' + width/2 + 'px'
        }

        if (height === 0) {
            this.s.height = "100%"
            this.s.top = '0'
        } else {
            this.s.height = height + 'px'
            this.s.top = top ? top + 'px' : DESKTOP_DEFAULT_TOP + 'px'
        }

        this.s.is_mobile_centric = ww < DESKTOP_DEFAULT_WIDTH ? true : false
    }




    setup_dom() {

        const wrapper_el = this.shadow.querySelector(".wrapper") as HTMLElement

        wrapper_el.style.width = this.s.width
        wrapper_el.style.maxHeight = this.s.height
        wrapper_el.style.height = this.s.height
        wrapper_el.style.top = this.s.top
        wrapper_el.style.left = this.s.left
        wrapper_el.style.marginLeft = this.s.margin_left
        wrapper_el.style.display = 'block grid';
        wrapper_el.style.gridTemplateRows = 'auto 1fr';

		if (this.s.is_mobile_centric) {
			wrapper_el.classList.add("mobile_centric")
		}
    }




    template = (_s:StateT, _m:ModelT) => { return html`{--css--}{--html--}`; }; 
}




customElements.define('c-ol', COl);




function animate_in(backgroundAnimation:Animation, viewAnimation:Animation, viewheaderAnimation:Animation, wrapperAnimation:Animation) {

    backgroundAnimation!.playbackRate = 1
    backgroundAnimation!.currentTime = 0
    backgroundAnimation!.play()

    viewAnimation!.playbackRate = 1
    viewAnimation!.currentTime = 0
    viewAnimation!.play()

    viewheaderAnimation!.playbackRate = 1
    viewheaderAnimation!.currentTime = 0
    viewheaderAnimation!.play()

    wrapperAnimation!.playbackRate = 1
    wrapperAnimation!.currentTime = 0
    wrapperAnimation!.play()
}




function animate_out(backgroundAnimation:Animation, viewAnimation:Animation, viewheaderAnimation:Animation, wrapperAnimation:Animation) {

    backgroundAnimation!.reverse()

    viewAnimation!.reverse()
    viewheaderAnimation!.reverse()

    wrapperAnimation!.reverse()
}




/*
function get_params(background:BackgroundT, wrapper:WrapperT, view_str:str, background_str:str, wrapper_str:str) : { background:BackgroundT, wrapper:WrapperT } {

    view_str = view_str || ""
    background_str = background_str || ""
    wrapper_str = wrapper_str || ""

    const background_return = background
    const wrapper_return = wrapper

    runit(background_str.split(","), background_return)
    runit(wrapper_str.split(","), wrapper_return)

    return { background:background_return, wrapper:wrapper_return } 

    
    function runit(s:str[], o:any) {
        s.forEach((x:str)=> {
            let y = x.trim().split(":")
            y = y.map((z:str)=> z.trim())

            let val:boolean|number|string|null = y[1]
            let valn = Number(val)
            if (val === "true") val = true
            else if (val === "false") val = false
            else if (val === "null") val = null
            else if (!isNaN(valn)) val = valn
            else val = String(val)

            o[y[0]] = val
        })
    }
}
*/




const ol_animations = new Map<str, Array<any>>()

ol_animations.set("mobile_wrapper_fade_up", [
    {opacity: '0', transform: `translate3d(0, 44px, 0)`},
    {opacity: '1', transform: "translate3d(0, 0, 0)"}
])

ol_animations.set("desktop_wrapper_fade_up", [
    {opacity: '0', transform: `translate3d(0, 19px, 0)`},
    {opacity: '1', transform: "translate3d(0, 0, 0)"}
])

ol_animations.set("mobile_view_slide_down", [
    {transform: `scale(1) translate3d(0, 0px, 0)`},
    {transform: "scale(0.9) translate3d(0, 28px, 0)"}
])

ol_animations.set("desktop_view_slide_down", [
    {transform: `scale(1) translate3d(0, 0px, 0)`},
    {transform: "scale(0.97) translate3d(0, 15px, 0)"}
])

ol_animations.set("background_fade_in", [
    {opacity: `0`},
    {opacity: "1"}
])

const ol_timings = new Map<str, any>()

ol_timings.set("mobile_a", {
    duration: 300,
    easing: "cubic-bezier(0.69, 0, 0.29, 1)",
    fill: "both",
    iterations: 1,
})

ol_timings.set("dekstop_a", {
    duration: 300,
    easing: "cubic-bezier(0.69, 0, 0.29, 1)",
    fill: "both",
    iterations: 1,
})





export {  }



