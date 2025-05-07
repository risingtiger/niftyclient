

import { str, bool } from "../../../defs_server_symlink.js";

declare var render: any;
declare var html: any;

enum ModeE { CLOSED = 0, OPEN = 1 }
enum TypeE { SELECTBOX = 0, MENU = 1, GENERAL = 1 }

type OptionT = { val: str, label: str }

type StateT = {
    mode: ModeE,
    isanimating: bool,
    instigator_term: str,
    options_str: str,
    options: OptionT[],
    val: str,
    term: str,
    did_first_run: bool,
    focusedOptionIndex: number  // Added to keep track of the focused option
}

type ModelT = {
    type: TypeE
}

type ElsT = {
    instigator: HTMLElement,
    instigator_cnt: HTMLElement,
    dialog_view: HTMLDialogElement,
    option_items_ul: HTMLUListElement | null  // Added reference to the options list
}

const DUMMY_EL = document.createElement("div")

class CDselect extends HTMLElement {

    s: StateT
    m: ModelT
    els: ElsT

    animatehandles: { view: Animation | null, instigator: Animation | null, }
    keyframes: { view: KeyframeEffect | null, instigator: KeyframeEffect | null, }
    shadow: ShadowRoot

    static get observedAttributes() { return ['term', 'val', 'open']; }

    constructor() {

        super();

        this.shadow = this.attachShadow({ mode: 'open' });

        this.s = {
            mode: ModeE.CLOSED,
            isanimating: false,
            instigator_term: "",
            options: [],
            options_str: "",
            val: "",
            term: "",
            did_first_run: false,
            focusedOptionIndex: -1  // Initialize to -1 (no option focused)
        }
        this.m = { type: TypeE.SELECTBOX }
        this.els = {
            instigator: DUMMY_EL,
            instigator_cnt: DUMMY_EL,
            dialog_view: (DUMMY_EL as any),
            option_items_ul: null  // Initialize as null
        }

        this.animatehandles = { view: null, instigator: null, }
        this.keyframes = { view: null, instigator: null, }

    }

    connectedCallback() {

        this.s.options_str = this.getAttribute("options") || "";
        this.s.val = this.getAttribute("val") || "";

        const typestr: str = this.getAttribute("type") || (this.s.options_str ? "selectbox" : "general");

        switch (typestr) {
            case "selectbox": this.m.type = TypeE.SELECTBOX; break;
            case "menu": this.m.type = TypeE.MENU; break;
            default: this.m.type = TypeE.GENERAL; break;
        }

        if (this.s.options_str) this.s.options = parse_options(this.s.options_str)

        this.s.term = set_term(this.getAttribute("term"), this.m.type, this.s.options, this.s.val)

        this.sc()

        this.els.instigator = this.shadow.getElementById("instigator") as HTMLElement
        this.els.instigator_cnt = this.els.instigator.querySelector(".cnt") as HTMLElement
        this.els.dialog_view = this.shadow.getElementById("dialog_view") as HTMLDialogElement

        // Add ARIA attributes to the instigator
        this.els.instigator.setAttribute("role", "combobox")
        this.els.instigator.setAttribute("aria-haspopup", "listbox")
        this.els.instigator.setAttribute("aria-expanded", "false")
        this.els.instigator.setAttribute("tabindex", "0")  // Ensure instigator is focusable

        this.els.instigator.addEventListener("click", () => this.instigator_clicked())

        // Add keydown listener for instigator to handle Space and Enter keys
        this.els.instigator.addEventListener("keydown", (event) => this.instigator_keydown(event))

        this.els.dialog_view.addEventListener("click", (e) => this.dialog_clicked(e))

        // Close the dialog when Escape key is pressed
        document.addEventListener("keydown", (event) => this.document_keydown(event))

        this.s.did_first_run = true

        if (this.hasAttribute("open")) {
            setTimeout(() => this.to_open(), 20)
        }
    }

    async attributeChangedCallback(name: str, old_val: str, new_val: str) {

        if (this.s.did_first_run === false) return

        if (name === "term") {
            this.s.term = set_term(new_val, this.m.type, this.s.options, this.s.val)
            this.sc()
        }

        else if (name === "val") {
            this.s.val = new_val
            this.sc()

            if (this.s.mode === ModeE.OPEN && this.m.type === TypeE.SELECTBOX) {
                set_active_option(this.els.dialog_view, new_val)
            }
        }

        else if (name === "open" && new_val === "" && old_val === null && this.s.mode === ModeE.CLOSED) {
            this.to_open()
        }

        else if (name === "open" && new_val === null && old_val === "" && this.s.mode === ModeE.OPEN) {
            this.to_closed()
        }
    }

    sc() { render(this.template(this.s), this.shadow); }

    dialog_clicked(e: MouseEvent) {
        if (e.target === this.els.dialog_view && this.s.mode === ModeE.OPEN) {
            this.removeAttribute("open")
            this.dispatchEvent(new CustomEvent("cancelled", {}))
        }
    }

    instigator_clicked() {
        this.setAttribute("open", "")
    }

    // New method to handle keydown events on the instigator
    instigator_keydown(event: KeyboardEvent) {
        if (event.key === " " || event.key === "Enter") {
            event.preventDefault()
            if (this.s.mode === ModeE.CLOSED) {
                this.setAttribute("open", "")
            } else {
                this.removeAttribute("open")
            }
        } else if (event.key === "ArrowDown") {
            event.preventDefault()
            if (this.s.mode === ModeE.CLOSED) {
                this.setAttribute("open", "")
            }
            setTimeout(() => this.focusOption(0), 100)  // Focus first option
        }
    }

    // New method to handle keydown events on the document (for Escape key)
    document_keydown(event: KeyboardEvent) {
        if (event.key === "Escape" && this.s.mode === ModeE.OPEN) {
            event.preventDefault()
            this.removeAttribute("open")
            this.els.instigator.focus()  // Return focus to instigator
        }
    }

    // New method to handle keydown events on the options list
    options_keydown(event: KeyboardEvent) {
        const optionsLength = this.s.options.length
        if (event.key === "ArrowDown") {
            event.preventDefault()
            this.s.focusedOptionIndex = (this.s.focusedOptionIndex + 1) % optionsLength
            this.focusOption(this.s.focusedOptionIndex)
        } else if (event.key === "ArrowUp") {
            event.preventDefault()
            this.s.focusedOptionIndex = (this.s.focusedOptionIndex - 1 + optionsLength) % optionsLength
            this.focusOption(this.s.focusedOptionIndex)
        } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            this.selectOption(this.s.focusedOptionIndex)
        } else if (event.key === "Escape") {
            event.preventDefault()
            this.removeAttribute("open")
            this.els.instigator.focus()
        }
    }

    // New method to focus an option by index
    focusOption(index: number) {
        if (!this.els.option_items_ul) return
        const options = this.els.option_items_ul.querySelectorAll("li")
        if (options.length === 0) return

        options.forEach((option) => {
            option.setAttribute("tabindex", "-1")
            option.classList.remove("focused")
        })

        const optionToFocus = options[index] as HTMLElement
        optionToFocus.setAttribute("tabindex", "0")
        optionToFocus.focus()
        optionToFocus.classList.add("focused")

        // Update aria-activedescendant
        this.els.instigator.setAttribute("aria-activedescendant", optionToFocus.id)
    }

    // New method to select an option programmatically
    selectOption(index: number) {
        const option = this.s.options[index]
        if (option) {
            const detail: any = {}
            detail.newval = option.val
            detail.oldval = this.s.val

            this.setAttribute("val", option.val)
            this.setAttribute("term", option.label)

            setTimeout(() => {
                this.removeAttribute("open")
                this.dispatchEvent(new CustomEvent("changed", { detail }))
                this.els.instigator.focus()
            }, 200)
        }
    }

    async option_clicked(e: MouseEvent) {

        const el = e.currentTarget as HTMLElement

        const detail: any = {}

        const val = el.getAttribute("val")!
        const term = el.querySelector("h5")!.textContent!

        detail.newval = val
        detail.oldval = this.s.val

        this.setAttribute("val", val)
        this.setAttribute("term", term)

        setTimeout(() => {
            this.removeAttribute("open")
            this.dispatchEvent(new CustomEvent("changed", { detail }))
            this.els.instigator.focus()
        }, 200)
    }

    to_open = () => {

        if (this.s.mode === ModeE.CLOSED && this.s.isanimating === false) {

            const xy = this.els.instigator.getBoundingClientRect()
            const viewportHeight = window.innerHeight
            const viewportWidth = window.innerWidth
            const margin = 3

            if (this.m.type === TypeE.SELECTBOX || this.m.type === TypeE.MENU) {
                const option_items_ul = render_options(this.s.options, this.s.val, this.m.type, this.option_clicked.bind(this))

                const existing_ul = this.shadow.getElementById("option_items") as HTMLUListElement

                if (existing_ul) {
                    existing_ul.remove()
                }

                this.els.dialog_view.querySelector("#dialog_wrap")!.prepend(option_items_ul)
                this.els.option_items_ul = option_items_ul  // Store reference to the options list

                // Add ARIA attributes and event listeners to options list
                option_items_ul.setAttribute("role", "listbox")
                option_items_ul.addEventListener("keydown", (event) => this.options_keydown(event))
            }

            // Set aria-expanded to true when opening
            this.els.instigator.setAttribute("aria-expanded", "true")

            this.els.dialog_view.style.visibility = 'hidden'
            this.els.dialog_view.style.display = 'block'

            const dialogContent = this.els.dialog_view.querySelector("#dialog_wrap") as HTMLElement
            const contentHeight = dialogContent.offsetHeight
            const contentWidth = dialogContent.offsetWidth
            const dialogHeight = contentHeight + 7
            const dialogWidth = contentWidth

            const width = `${dialogWidth}px`

            this.els.dialog_view.style.display = ''
            this.els.dialog_view.style.visibility = ''

            const height = `${dialogHeight}px`

            let top: number
            if (xy.bottom + dialogHeight + margin <= viewportHeight) {
                top = xy.bottom + margin
            } else if (xy.top - dialogHeight - margin >= 0) {
                top = xy.top - dialogHeight - margin
            } else {
                top = Math.max(0, (viewportHeight - dialogHeight) / 2)
            }

            let left: number
            if (xy.left + dialogWidth + margin <= viewportWidth) {
                left = xy.left
            } else if (xy.right - dialogWidth - margin >= 0) {
                left = xy.right - dialogWidth
            } else {
                left = Math.max(0, (viewportWidth - dialogWidth) / 2)
            }

            this.els.dialog_view.style.width = width
            this.els.dialog_view.style.height = height

            this.els.dialog_view.style.top = `${top}px`;
            this.els.dialog_view.style.left = `${left}px`;

            (this.els.dialog_view as HTMLDialogElement).showModal()

            this.s.mode = ModeE.OPEN

            this.sc()

            // Focus the first option when opening
            this.s.focusedOptionIndex = 0
            setTimeout(() => this.focusOption(this.s.focusedOptionIndex), 100)
        }
    }

    to_closed = () => new Promise<void>((resolve) => {

        if (this.s.mode === ModeE.OPEN && this.s.isanimating === false) {
            this.sc()
            this.s.mode = ModeE.CLOSED;
            this.els.dialog_view.classList.add("closing")

            // Set aria-expanded to false when closing
            this.els.instigator.setAttribute("aria-expanded", "false")
            this.els.instigator.removeAttribute("aria-activedescendant")

            setTimeout(() => {
                this.els.dialog_view.classList.remove("closing");
                this.els.dialog_view.close();
                resolve()
            }, 400)
        }
    })

    animate_view_end() {
        if (this.animatehandles.view!.currentTime === 0) {

        } else {
            //this.els.dialog_view.style.display = "none";
        }

        this.s.isanimating = false
    }

    animate_instigator_end() {
        if (this.animatehandles.instigator!.currentTime === 0) {

        } else {

            //this.els.input.select();
        }

    }

    template = (_s: StateT) => { return html`{--css--}{--html--}`; };
}

customElements.define('c-dselect', CDselect);

function render_options(options: OptionT[], options_val: str, type: TypeE, option_clicked: (e: MouseEvent) => void): HTMLUListElement {

    const ulitemsel = document.createElement("ul")
    ulitemsel.classList.add("options")
    ulitemsel.id = "option_items"

    ulitemsel.classList.add("items")
    ulitemsel.setAttribute("role", "listbox")  // Added ARIA role

    options.forEach((x, index) => {

        const liel = document.createElement("li")

        const h5el = document.createElement("h5")
        h5el.textContent = x.label
        liel.setAttribute("val", x.val)

        liel.appendChild(h5el)

        if (x.val === options_val && type === TypeE.SELECTBOX) {
            liel.classList.add("selected")
        } else {
            liel.insertAdjacentHTML("beforeend", `<span class='postpend'></span>`)
        }

        liel.insertAdjacentHTML("beforeend", `<span class='postpend'></span>`)

        liel.addEventListener("click", (e: MouseEvent) => option_clicked(e))

        // Make options focusable and add ARIA attributes
        liel.setAttribute("role", "option")
        liel.setAttribute("tabindex", "-1")  // Remove from tab order, manage focus manually
        liel.id = `option-${index}`  // Assign unique ID for aria-activedescendant

        ulitemsel.appendChild(liel)
    })

    return ulitemsel
}

function parse_options(options_str: str): OptionT[] {

    const options: OptionT[] = options_str.split(",").map((x, _i) => {

        const parts = x.trim().split(":")

        return {
            label: parts[0], val: parts[1] ?? parts[0]
        }
    })

    return options
}

function set_term(term: str | null, type: TypeE, options: OptionT[] | null, val: str): str {

    if (term) {
        return term

    } else if (!term && (type === TypeE.SELECTBOX || type === TypeE.MENU)) {

        const option = options ? options.find(o => o.val === val) : null
        return option ? option.label : val

    } else {
        return val
    }
}

function set_active_option(dialog_view_el: HTMLElement, val: str) {

    const option_els = dialog_view_el.querySelectorAll("#option_items > li")

    option_els.forEach((x, _i) => { x.classList.remove("selected") })

    const active_li_el = dialog_view_el.querySelector(`#option_items > li[val='${val}']`) as HTMLElement
    if (active_li_el) {
        active_li_el.classList.add("selected")
    }
}

export { }
