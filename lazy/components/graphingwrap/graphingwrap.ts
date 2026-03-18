

import { $NT } from "../../../defs.js"
import { num, bool, str } from "../../../defs_server_symlink.js"

declare var render: any;
declare var html: any;
declare var $N: $NT;



type MeasurementT = {
	name: str,
	selected: bool,
	type: "line" | "bar",
	fields: { name: str, selected: bool }[],
}


type AttributesT = { // refer to CGraph AttributesT for descriptions of these properties

	// these are mostly pass through to CGraphing
    bucket: str,
    tags: str,
    intrv: str,
    ppf: str,
    lowhigh: str,
    unitterms: str,
	// END pass through to CGaphing

	timezonecity: str, // for getting the date string in the correct timezone for the x axis labels. ex. New_York
	datestr: str, // ISO-8601 (e.g., 2021-12-23) if set, will override unixtimestamp. must have timezonecity set as well: e.g. Denver

	measurements: str, // json of measurements with their corresponding fields
}


type StateT = {
	measurements: MeasurementT[],
	measurement: str,
	fields: str,
	type: "line" | "bar",
	colors: str, // comma-separated hex colors matching the selected fields, passed to c-graphing
	final_unixtimestamp: num, // computed from datestr and timezonecity or (if not set) directly from unixtimestamp
	datestr: str,
	timezonecity: str,
    updatescheduled: bool, // for attributes update tracking
	reflectingback: bool, // guard to prevent re-entry when reflecting state back to attributes
}


type ModelT = {
    prop: str,
}


const COLORS = ["#0091e8", "#1eeba7", "#eb1e7c"]

const ATTRIBUTES:AttributesT = { bucket: "", tags: "", intrv: "", ppf: "", lowhigh: "", unitterms: "", timezonecity: "", datestr: "", measurements: "" }




class CGraphingWrap extends HTMLElement {

    s:StateT
    m:ModelT
	a:AttributesT = { ...ATTRIBUTES };

    shadow:ShadowRoot




	static get observedAttributes() { return Object.keys(ATTRIBUTES); }




    constructor() {   
        super(); 

        this.s = {
			measurements: [],
			measurement: "",
			fields: "",
			type: "bar", // default
			colors: "",
			final_unixtimestamp: 0,
			datestr: "",
			timezonecity: "",
			updatescheduled: false,
			reflectingback: false,
        }

        this.shadow = this.attachShadow({mode: 'open'});
    }




	async connectedCallback() {   

		for (const prop in this.a) (this.a as any)[prop] = this.getAttribute(prop)

		this.s.measurements = JSON.parse(this.a.measurements || "[]")

		// make sure all have selected set
		for (let i = 0; i < this.s.measurements.length; i++) {
			if (typeof this.s.measurements[i].selected === "undefined") throw new Error("measurement " + this.s.measurements[i].name + " is missing a selected property")
			for (let ii = 0; ii < this.s.measurements[i].fields.length; ii++) {
				if (typeof this.s.measurements[i].fields[ii].selected === "undefined") throw new Error("field " + this.s.measurements[i].fields[ii].name + " is missing a selected property")
			}
		}

		this.setit_from_attributechange_or_firstrun();
		this.sc();
	}




    attributeChangedCallback(name:str, oldValue:str|bool|num, newValue:str|bool|num) {

		if (oldValue === null) return;
		if (this.s.reflectingback) return;

		(this.a as any)[name] = newValue

		if (this.s.updatescheduled) return
		this.s.updatescheduled = true

		Promise.resolve().then(()=> {
			this.s.updatescheduled = false
			this.setit_from_attributechange_or_firstrun();
			this.sc()
		})
    }




	setit_from_attributechange_or_firstrun() {
		this.s.timezonecity = this.a.timezonecity || "Denver"
		this.s.datestr      = this.a.datestr || new Date().toLocaleDateString("en-CA", { timeZone: "America/" + this.s.timezonecity })
		this.s.measurements = JSON.parse(this.a.measurements || "[]")

		if (this.s.measurements.length === 0) throw new Error("missing measurements or datestr or timezonecity attribute")
	}




    sc() {   
		this.s.final_unixtimestamp = this.get_midnight_UTC_time(this.s.datestr, this.s.timezonecity)
		this.s.measurement = this.s.measurements.find(m => m.selected)?.name || ""

		const selectedMeasurement = this.s.measurements.find(m => m.selected)
		const allFields = selectedMeasurement?.fields || []
		this.s.fields = allFields.filter(f => f.selected).map(f => f.name).join(',')
		this.s.type = selectedMeasurement?.type || "line"
		this.s.colors = allFields.map((f, i) => f.selected ? (COLORS[i] || '#999') : null).filter(c => c !== null).join(',')

		render(this.template(this.s, this.m, this.a), this.shadow);   
	}




	reflect(name:str, value:any) {
		this.s.reflectingback = true
		this.setAttribute(name, typeof value === 'string' ? value : JSON.stringify(value))
		this.s.reflectingback = false
	}




	measurementClicked(e:CustomEvent) {
		const index = e.detail.index
		for (const m of this.s.measurements) m.selected = false
		this.s.measurements[index].selected = true

		this.reflect('measurements', this.s.measurements)
		this.sc()
		e.detail.done()
	}




	fieldClicked(index:num) {
		const selected = this.s.measurements.find(m => m.selected)
		if (!selected) return

		for (const f of selected.fields) f.selected = false
		selected.fields[index].selected = true

		this.reflect('measurements', this.s.measurements)
		this.sc()
	}




	datePrev(e:CustomEvent) {
		const d = new Date(this.s.datestr + "T00:00:00")
		d.setDate(d.getDate() - 1)
		this.s.datestr = d.toISOString().slice(0, 10)
		this.reflect('datestr', this.s.datestr)
		this.sc()
		e.detail.done()
	}




	dateNext(e:CustomEvent) {
		const d = new Date(this.s.datestr + "T00:00:00")
		d.setDate(d.getDate() + 1)
		this.s.datestr = d.toISOString().slice(0, 10)
		this.reflect('datestr', this.s.datestr)
		this.sc()
		e.detail.done()
	}




	dateChanged(e:Event) {
		const input = e.target as HTMLInputElement
		this.s.datestr = input.value
		this.reflect('datestr', this.s.datestr)
		this.sc()
	}




	timezoneChanged(e:Event) {
		const select = e.target as HTMLSelectElement
		this.s.timezonecity = select.value
		this.reflect('timezonecity', this.s.timezonecity)
		this.sc()
	}





	get_midnight_UTC_time = (datestr:str, timezonecity:str) : num => {

		const tz = "America/" + timezonecity

		if (!datestr) {
			const now = new Date()
			const parts = now.toLocaleDateString("en-CA", { timeZone: tz }) // en-CA gives YYYY-MM-DD
			datestr = parts
		}

		const [year, month, day] = datestr.split("-").map(Number)
		const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0) // midnight UTC for the date

		// Format that UTC instant in the target timezone, extract parts, and reconstruct
		// as a UTC timestamp to get the offset without relying on browser-local parsing
		const formatter = new Intl.DateTimeFormat("en-US", {
			timeZone: tz,
			year: "numeric", month: "2-digit", day: "2-digit",
			hour: "2-digit", minute: "2-digit", second: "2-digit",
			hour12: false,
		})
		const parts = formatter.formatToParts(new Date(utcGuess))
		const p = (type:string) => parseInt(parts.find(p => p.type === type)!.value)
		const localAtGuess = Date.UTC(p("year"), p("month") - 1, p("day"), p("hour"), p("minute"), p("second"))
		const offsetMs = utcGuess - localAtGuess // positive when tz is behind UTC (e.g., America/Denver)

		const midnightLocalAsUTC = utcGuess + offsetMs

		return Math.floor(midnightLocalAsUTC / 1000)
	}




    template = (_s:StateT, _m:ModelT, _a:AttributesT) => { return html`{--css--}{--html--}`; }; 
}




customElements.define('c-graphingwrap', CGraphingWrap);




export {  }





