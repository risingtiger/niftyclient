

import { $NT } from "../../../defs.js"
import { num, bool, str } from "../../../defs_server_symlink.js"

declare var Chartist_LineChart: any;
declare var Chartist_BarChart: any;
declare var render: any;
declare var html: any;
declare var $N: $NT;



type AttributesT = {
    bucket: str, // what influxdb  bucket. ex. PWT
    measurement: str, // what influxdb  measurement. ex. PSI
    fields: str, // what influxdb fields in specified measurement to show. ex. City psi and/or After Filter Psi
    tags: str, // what influxdb tags , machine_id etc
    type: str, // line or bar
    unixtimestamp: str, // point in time at which graph starts
    intrv: str, // interval -- how many seconds per point. ex. For 5 minute interval set to 300 (300 seconds in 5 minutes)
    ppf: str, // points Per Frame. ex. For One Day with 5 minute increments it will be 288 points
    lowhigh: str, // low and high values for y axis. ex. 0,100
    unitterms: str, // ex gals or psi
	colors: str, // comma-separated hex color values for series. ex. #0091e8,#1eeba7,#eb1e7c
	timezonecity: str, // IANA city name in America/ region. ex. Denver or New_York
}


type SeriesT = { 
    field: str,
    tag: {name:str, val:str}
    points: {   
        val: num, 
        date: Date 
    }[]
}

type StateT = {
    updatescheduled: bool, // for attributes update tracking
    graphtype: str, // tracks current chart type (line or bar) to detect when it changes
}

type ModelT = {
    prop: str,
}



const ATTRIBUTES:AttributesT = { bucket: "", measurement: "", fields: "", tags: "", type: "", intrv: "", ppf: "", lowhigh: "", unitterms: "", unixtimestamp: "", colors: "", timezonecity: "" }




class CGraphing extends HTMLElement {

    s:StateT
    m:ModelT
	a:AttributesT = { ...ATTRIBUTES };

    shadow:ShadowRoot
	graph:any = null




	static get observedAttributes() { return Object.keys(ATTRIBUTES); }




    constructor() {   
        super(); 

        this.s = {
			updatescheduled: false,
			graphtype: "",
        }

        this.shadow = this.attachShadow({mode: 'open'});

    }




	async connectedCallback() {   

		this.sc(); // call it so that the css can be sucked in

		for (const prop in this.a) (this.a as any)[prop] = this.getAttribute(prop)

		const div = document.createElement('div')
		div.className = 'ct-chart ct-octave'
		this.shadow.appendChild(div)

		this.setit()
			.then(()=> {
				this.dispatchEvent(new Event('hydrated'))
			})
			.catch(()=> {
				this.renderError()
			})
	}




    attributeChangedCallback(name:str, oldValue:str|bool|num, newValue:str|bool|num) {

		if (oldValue === null) return;

		(this.a as any)[name] = newValue

		if (this.s.updatescheduled) return
		this.s.updatescheduled = true

		Promise.resolve().then(()=> {
			this.s.updatescheduled = false
			this.setit()
				.then(()=> {
					// NOT calling sc(), since DOM is directly manipulated
				})
				.catch(()=> {
				this.renderError()
			})
		})
    }




    sc() {   render(this.template(this.s, this.m), this.shadow);   }




	renderError() {

		const el = this.shadow.querySelector('.ct-chart') as HTMLElement

		el.innerHTML = ''
		el.style.display = 'flex'
		el.style.alignItems = 'center'
		el.style.justifyContent = 'center'
		el.style.height = '100%'
		el.textContent = 'error in rendering graph'

		this.graph = null
	}




	setit = () => new Promise<void>(async (res, rej) => {

		const begin = Number (this.a.unixtimestamp)
		const intrv = Number (this.a.intrv)
		const ppf   = Number (this.a.ppf)

		const end = begin + (intrv * ppf)

		const qr = await $N.InfluxDB.Retrieve_Series(this.a.bucket, [begin], [end], [this.a.measurement], [this.a.fields], [this.a.tags], [intrv]).catch(()=> "")
		if (qr === "") {
			rej()
			return
		}

		this.render_graph_frame(this.shadow.querySelector('.ct-chart')!, this.a.type, qr[0], this.a.lowhigh, this.a.unitterms)

		res()
	})




	applySeriesColors() {
		const colors = this.a.colors ? this.a.colors.split(",") : []
		if (colors.length === 0) return

		let existing = this.shadow.querySelector('#series-colors') as HTMLStyleElement
		if (!existing) {
			existing = document.createElement('style')
			existing.id = 'series-colors'
			this.shadow.appendChild(existing)
		}

		const abc = "abcdefghijklmnopqrstuvwxyz"
		let css = ""
		for (let i = 0; i < colors.length; i++) {
			const letter = abc[i]
			const color = colors[i].trim()
			css += `.ct-chart .ct-series-${letter} .ct-line, .ct-chart .ct-series-${letter} .ct-bar, .ct-chart .ct-series-${letter} .ct-point { stroke: ${color}; }\n`
			css += `.ct-chart .ct-series-${letter} .ct-area, .ct-chart .ct-series-${letter} .ct-slice-pie { fill: ${color}; }\n`
		}
		existing.textContent = css
	}


	render_graph_frame = (el:HTMLElement, type:str, series_list:SeriesT[], lowhigh:str, unitterms:str) => {

		const ylow  = Number(lowhigh.split(",")[0])
		const yhigh = Number(lowhigh.split(",")[1])

		let data:{labels:num[], series:any[]} = { labels:[], series:[] }

		let x_rangeticks:num[] = []
		let x_disp_str:str[]   = []

		data = this.render_graph_frame___series_to_chartist_data(series_list)
		x_rangeticks = data.labels
		x_disp_str   = this.render_graph_frame___get_x_disp_str(series_list[0].points.map((p)=> p.date), x_rangeticks.length, this.a.timezonecity)

		const opts = this.render_graph_frame___set_common_opts(x_disp_str, ylow, yhigh, unitterms)

		this.applySeriesColors()

		if (this.graph && this.s.graphtype === type) {
			this.graph.update(data, opts)
			return;
		}

		if (this.graph) this.graph.detach()

		this.s.graphtype = type
		this.graph = (type === "line") ? new Chartist_LineChart(el, data, opts) : new Chartist_BarChart(el, data, opts)    
	}



	render_graph_frame___get_x_disp_str = (point_dates:Date[], _ticks_count:num, tz:str) => {

		const timezone = "America/" + tz
		const x_disp_str:str[] = []

		point_dates.forEach((d, _index)=> {

			const hrs = Number(d.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }))
			let hr12 = ""

			if (hrs === 0)
				hr12 = "12am"
			else if (hrs === 12)
				hr12 = "12pm"
			else if (hrs < 12)
				//hr12 = hrs + "am"
				hr12 = hrs.toString()
			else
				//hr12 = (hrs - 12) + "pm"
				hr12 = (hrs - 12).toString()

			x_disp_str.push( hr12 )
		})

		return x_disp_str
	}




	render_graph_frame___series_to_chartist_data = (s:SeriesT[]) => {

		const labels = s[0].points.map((p)=> Math.floor(p.date.getTime()/1000))

		const series = s.map((ss)=> ss.points.map((p)=> p.val))

		return { labels, series }
	}




	render_graph_frame___set_common_opts = (x_disp_str:str[], yl:num, yh:num, ut:str) => {

		const short_hand_unit_term = ut.split(",")[1]
		
		return {
			fullWidth: true,
			showPoint: false,
			//chartPadding: {
			//    right: 20
			//},
			axisY: {
				onlyInteger: true,
				low: yl,
				high: yh,
				divisor: 10,
				labelInterpolationFnc: (val:num, _indx:num) => {
					return `${val}${short_hand_unit_term}`
				}
			},
			axisX: {
				showGrid: false,
				labelInterpolationFnc: (_unixstamp:number, index:number) => {
					return x_disp_str[index]
				}
			}
		}
	}



    template = (_s:StateT, _m:ModelT) => { return html`{--css--}{--html--}`; }; 
}





customElements.define('c-graphing', CGraphing);



export {  }





