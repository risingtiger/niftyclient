

import { num, str } from "../defs_server_symlink.js"
import { $NT, GenericRowT, CMechViewT, CMechViewPartT, CMechViewLoadStateT } from "../defs.js"
import {
	LoadViewData         as DataHodlLoadViewData,
	PostLoadViewData     as DataHodlPostLoadViewData,
	GetViewData          as DataHodlGetViewData,
	GetViewPartData      as DataHodlGetViewPartData,
	RemoveViewData       as DataHodlRemoveViewData,
	LoadViewPartData     as DataHodlLoadViewPartData,
	PostLoadViewPartData as DataHodlPostLoadViewPartData,
	RemoveViewPartData   as DataHodlRemoveViewPartData,
	ReloadAllViewData    as DataHodlReloadAllViewData
} from './datahodl.js'


declare var $N: $NT;


let   _viewsel = document.body as HTMLElement; // will be set to #views
let   _postloadpromises: Array<Promise<boolean>>;
let   _viewparts: Map<str, Set<HTMLElement & CMechViewPartT>> = new Map() // used to track view parts that are in the process of registering for a given view. reset on each AddView call. map by viewname




const Init = () => {

	_viewsel = document.getElementById("views") as HTMLElement;

	_viewsel.addEventListener ("revealed", handle_revealed);
	$N.EngagementListen.Add_Listener(_viewsel, "cmech_view_resize_listener", [ "resize" ], null, update_from_resize);
}




const AddView = (viewname:	 str, pathparams:	 GenericRowT, searchparams:GenericRowT, localdb_preload: str[]) => new Promise<num|null>(async (res, rej)=> {

	_viewparts.set(viewname, new Set());

	try   { await DataHodlLoadViewData(viewname, pathparams, searchparams, localdb_preload); }
	catch { remove_view_aux(viewname); rej(); return; }

	const parentEl      = document.querySelector("#views")!;
	parentEl.insertAdjacentHTML("beforeend", `<v-${viewname} class='view'></v-${viewname}>`);
	const viewcomponent = document.querySelector(`#views > v-${viewname}`) as HTMLElement & CMechViewT

	const d = DataHodlGetViewData(viewname)

	viewcomponent.ingest(d.loadeddata, d.pathparams, d.searchparams, 'initial')
	viewcomponent.render();

	$N.Header.set(viewcomponent.header);

	const shadow = (viewcomponent as any).shadow as ShadowRoot;
	if(shadow.firstElementChild.tagName !== 'LINK') { // only do this when main css is NOT linked 
		shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, (window as any).maincss];
	}

	// render will cause any viewparts to register and call RegisterViewPart. This will happen before wait_for_all_render_and_hydration even gets called

	try   { await wait_for_all_render_and_hydration(viewname, viewcomponent); }
	catch { remove_view_aux(viewname); rej(); return; }

	if(viewcomponent.hydrated) viewcomponent.hydrated();

	res(1);

	_postloadpromises = [];
	_postloadpromises.push(DataHodlPostLoadViewData(viewname)); 
	for( const vp of [ ..._viewparts.get(viewname) ] ) {
		const tagname       = ( vp.tagName.toLowerCase() ).split("-")[1]
		_postloadpromises.push( DataHodlPostLoadViewPartData (viewname, tagname, vp.attributes ) );
	}
})




const RegisterView = (_component:HTMLElement & CMechViewT) => {
}




const RegisterViewPart = async (component:HTMLElement & CMechViewPartT): Promise<void> => {

	const tagname       = component.tagName.toLowerCase()
	const tagname_split = tagname.split("-")

	if (tagname_split.length !== 2) throw new Error("viewpart name can only contain one hyphen")

	const viewpartname  = tagname_split[1]
	let   vp_data: any  = null

	if (tagname_split[0] !== 'vp') throw new Error("Not a view part component")

	for(const prop in component.a) component.a[prop] = component.getAttribute(prop);

	const ancestor_viewname       = find_ancestor_viewname(component);
	( component as any ).viewname = ancestor_viewname!

	_viewparts.get(ancestor_viewname).add(component)

	try         { vp_data = await DataHodlLoadViewPartData(ancestor_viewname, viewpartname, component.attributes); }
	catch (err) {
		component.dispatchEvent(new Event('viewpartconnectfailed'));
		return;
	}

	const vd  = DataHodlGetViewData(ancestor_viewname)
	const vpd = DataHodlGetViewPartData(ancestor_viewname, `vp-${viewpartname}`)
	
	component.ingest(vpd?.loadeddata || vd.loadeddata, vd.pathparams, vd.searchparams, 'initial')
	component.render()

	const shadow = (component as any).shadow as ShadowRoot;
	if(shadow.firstElementChild.tagName !== 'LINK') { // only do this when main css is NOT linked 
		shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, (window as any).maincss];
	}

	if(component.hydrated) component.hydrated();

	// earlier in this function DataHodlLoadViewPartData call is awaited, which gives 
	// wait_for_all_render_and_hydration a chance to attach its event listeners before this event is dispatched
	component.dispatchEvent(new Event('viewparthydrated'));
}




const PostLoadViewPart = async (component: HTMLElement & CMechViewPartT): Promise<boolean> => { // only used by external modules like the overlay

	const tagname           = component.tagName.toLowerCase()
	const tagname_split     = tagname.split("-")
	const viewpartname      = tagname_split[1]
	const ancestor_viewname = (component as any).viewname

	let postdata: any       = null

	try   { postdata = await DataHodlPostLoadViewPartData(ancestor_viewname, viewpartname, component.attributes) }
	catch {
		$N.Unrecoverable('Post data fail', `Post data load failed for view ${viewpartname}`, 'Reset App', 'cmp', 'Unable to Post Load', null);
		return false; 
	}

	if (!postdata) return false

	const d = DataHodlGetViewData(ancestor_viewname)
	const vp_merged = DataHodlGetViewPartData(ancestor_viewname, viewpartname)

	component.ingest(vp_merged?.loadeddata || d.loadeddata, d.pathparams, d.searchparams, 'postload')
	component.render()
	if (component.revealed) component.revealed()	

	return true
}




const AttributeChangedCallback = (component:HTMLElement, name:string, oldval:str|boolean|number, newval:string|boolean|number, _opts?:object) => new Promise<void>((res)=> {

	if (oldval === null) return

	const a = (component as any).a as {[key:string]:any}

	a[name] = newval

	if (!a.updatescheduled) {
		a.updatescheduled = true
		Promise.resolve().then(()=> { 
			a.updatescheduled = false
			res()
		})
	}
})




const ViewDisconnectedCallback     = (component:HTMLElement) => {   remove_view_aux(component.tagName.toLowerCase().split("-")[1]);   }
const ViewPartDisconnectedCallback = (component:HTMLElement & CMechViewPartT) => {
	const tagname = component.tagName.toLowerCase()
	const viewpartname = tagname.split("-")[1]
	const ancestor_viewname = (component as any).viewname
	
	if (_viewparts.has(ancestor_viewname)) _viewparts.get(ancestor_viewname).delete(component)
	
	DataHodlRemoveViewPartData(ancestor_viewname, viewpartname)
}




const UpdateView = (viewname:str, pathparams:GenericRowT, searchparams:GenericRowT, eventname:CMechViewLoadStateT) => new Promise<void>(async (res, rej) => {

	const viewel = document.querySelector(`#views > v-${viewname}`) as HTMLElement & CMechViewT

	try   { await DataHodlReloadAllViewData(viewname, pathparams, searchparams) }
	catch { remove_view_aux(viewname); rej(); return }

	const d = DataHodlGetViewData(viewname)

	viewel.ingest(d.loadeddata, pathparams, searchparams, eventname)
	viewel.render()

	$N.Header.set(viewel.header);

	for (const subel of _viewparts.get(viewname) ) {
		const viewpartname = subel.tagName.toLowerCase().split("-")[1] 
		const viewpartdata = DataHodlGetViewPartData(viewname, viewpartname)
		subel.ingest(viewpartdata?.loadeddata || d.loadeddata, pathparams, searchparams, eventname)
		subel.render()
	}

	res()
})




/*
const UpdateFromChangedParams = (viewname:str, pathparams:GenericRowT, searchparams:GenericRowT) => new Promise<void>(async (res, rej) => {

	const viewel = document.querySelector(`#views > v-${viewname}`) as HTMLElement & CMechViewT

	try   { await DataHodlReloadAllViewData(viewname, pathparams, searchparams) }
	catch { remove_view_aux(viewname); rej(); return }

	const d = DataHodlGetViewData(viewname)

	viewel.ingest(d.loadeddata, pathparams, searchparams, 'paramschanged')
	viewel.render()

	for (const subel of _viewparts.get(viewname) ) {
		const viewpartdata = DataHodlGetViewPartData(viewname, subel.tagName.toLowerCase())
		subel.ingest(viewpartdata?.loadeddata || d.loadeddata, pathparams, searchparams, 'paramschanged')
		subel.render()
	}

	res()
})




const UpdateFromChangedData = (viewname:str, pathparams:GenericRowT, searchparams:GenericRowT, loadeddata: Map<str, GenericRowT[]>, eventname:CMechViewLoadStateT = 'paramschanged') => {

	const viewel     = document.querySelector(`#views > v-${viewname}`) as HTMLElement & CMechViewT

	viewel.ingest(loadeddata, pathparams, searchparams, eventname)
	viewel.render()

	for (const subel of _viewparts.get(viewname) ) {
		const viewpartdata = DataHodlGetViewPartData(viewname, subel.tagName.toLowerCase())
		subel.ingest(viewpartdata?.loadeddata || loadeddata, pathparams, searchparams, eventname)
		subel.render()
	}
}
*/




const GetViewParts = (viewname:str): Set<HTMLElement & CMechViewPartT> | undefined => {
	return _viewparts.get(viewname)
}




const find_ancestor_viewname = (component: HTMLElement): str | null => {

	let current: Node = component;
	while (true) {
		const root = current.getRootNode() as any;
		if (root === document) return null;
		const host = root.host;
		const tagname = host.tagName.toLowerCase();
		if (tagname.startsWith('v-')) return tagname.split('-')[1];
		current = host;
	}
}




const wait_for_all_render_and_hydration = async (viewname: str, _viewcomponent: HTMLElement & CMechViewT) => new Promise<void>((res, rej) => {
	
	let   viewpart_hydrated_events_count = 0;
	let   failed = false;

	// _viewparts for this view (if any) will have been populated during the initial render of the view part component in RegisterViewPart
	const viewparts_set = _viewparts.get(viewname)!;

	if (viewparts_set.size === 0) { res(); return; }

	const viewparthydrated = () => {
		if (failed) return;
		viewpart_hydrated_events_count += 1;

		if (viewpart_hydrated_events_count < viewparts_set.size) return;

		for (const part of viewparts_set) {
			part.removeEventListener("viewparthydrated", viewparthydrated);
			part.removeEventListener("viewpartconnectfailed", viewpartfailed);
		}

		res();
	}

	const viewpartfailed = () => {
		failed = true;
		for (const part of viewparts_set) {
			part.removeEventListener("viewparthydrated", viewparthydrated);
			part.removeEventListener("viewpartconnectfailed", viewpartfailed);
		}
		rej();
	}

	for (const part of viewparts_set) {
		part.addEventListener("viewparthydrated", viewparthydrated);
		part.addEventListener("viewpartconnectfailed", viewpartfailed);
	}

	setTimeout(() => {
		failed = true;
		for (const part of viewparts_set) {
			part.removeEventListener("viewparthydrated", viewparthydrated);
			part.removeEventListener("viewpartconnectfailed", viewpartfailed);
		}
		rej();
	}, 15000); 
})




const handle_revealed = async (ev:CustomEvent) => {

	const viewname     = ev.detail.viewname as str
	const viewel       = document.querySelector(`#views > v-${viewname}`) as HTMLElement & CMechViewT

	let postfuncexists:boolean[]

	try   { postfuncexists = await Promise.all(_postloadpromises); }
	catch { $N.Unrecoverable('Post data fail', `Post data load failed for view ${viewname}`, 'Reset App', 'cmp', 'Unable to Post Load', null); return; }

	if (postfuncexists.some( v => v === true )) { // post data may be of view or of a(some) viewpart or both

		const d = DataHodlGetViewData(viewname)

		viewel.ingest(d.loadeddata, d.pathparams, d.searchparams, 'postload')
		viewel.render();

		for (const subel of ( [..._viewparts.get(viewname)] as ( HTMLElement & CMechViewPartT )[] )) { // may or may not have viewparts
			const viewpartdata = DataHodlGetViewPartData(viewname, subel.tagName.toLowerCase()) // may or may not have data
			subel.ingest(viewpartdata?.loadeddata || d.loadeddata, d.pathparams, d.searchparams, 'postload');
			subel.render();
		}
	}

	for (const subel of ( [..._viewparts.get(viewname)] as ( HTMLElement & CMechViewPartT )[] )) {   if(subel.revealed) subel.revealed();   }
	if (viewel.revealed) viewel.revealed()
}




const update_from_resize = () => {

	const allviews = Array.from(_viewsel.children) as HTMLElement[];
	for(const view of allviews) {
		const viewname = view.tagName.toLowerCase().split("-")[1]
		for (const subel of [..._viewparts.get(viewname)]) {   subel.render();   }
		( view as any ).render()
	}
}




const remove_view_aux = (viewname:str) => {

	_viewparts.delete(viewname)
	_postloadpromises = []

	DataHodlRemoveViewData(viewname)
}



// const wait_for_stylesheets = (shadowRoot: ShadowRoot) => new Promise<void>((res) => {
//
// 	if ( shadowRoot.firstElementChild.tagName !== 'LINK' ) { res(); return; }  // in prod, skip this entirely
//
// 	const links = shadowRoot.querySelectorAll('link[rel="stylesheet"]') as NodeListOf<HTMLLinkElement>;
//
// 	if (links.length === 0) { res(); return; }
//
// 	let loaded = 0;
// 	const total = links.length;
//
// 	const check_complete = () => {
// 		loaded++;
// 		if (loaded >= total) res();
// 	};
//
// 	for (let i = 0; i < links.length; i++) {
// 		const link = links[i];
// 		if (link.sheet) { check_complete(); continue; }
//
// 		link.addEventListener('load', check_complete, { once: true });
// 		link.addEventListener('error', check_complete, { once: true });
// 	}
//
// 	setTimeout(() => res(), 3000);
// })
//



export { Init, AddView, UpdateView, GetViewParts }

if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).CMech = {RegisterView, RegisterViewPart, PostLoadViewPart, AttributeChangedCallback, ViewDisconnectedCallback, ViewPartDisconnectedCallback };




