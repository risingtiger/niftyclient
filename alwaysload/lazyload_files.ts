import { bool, str } from "../defs_server_symlink.js";
import { LazyLoadT } from "../defs.js";




let _lazyloads:LazyLoadT[] = [];
const _loaded:LazyLoadT[] = [];
let timeoutWaitingAnimateId:any = null





function Run(loads:LazyLoadT[]) {   return new Promise<number|null>(async (res, _rej)=> {

	if (loads.length === 0) { res(1); return; }

	setBackgroundOverlay(true)
	timeoutWaitingAnimateId = setTimeout(() => {   setWaitingAnimate(true);   }, 1000);

    const loadque:LazyLoadT[] = []

    for(const load of loads) addtoque(load, loadque)

	const r = await retrieve_loadque(loadque)

	clearTimeout(timeoutWaitingAnimateId)
	setBackgroundOverlay(false)
	setWaitingAnimate(false)

	if (r === null) { res(null); return; }

    res(1)
})}




function Init(lazyloads_:LazyLoadT[]) {
    _lazyloads = lazyloads_
}




function addtoque(load:LazyLoadT, loadque:LazyLoadT[]) {

	let is_already_loaded = _loaded.find(l=> l.type === load.type && l.name === load.name) 
	if (is_already_loaded !== undefined) {
		return;
	}

	for (const dep of load.dependencies) {
		const dep_load = _lazyloads.find(l=> l.type === dep.type && l.name === dep.name)
		if (dep_load === undefined) {
			console.error("LazyLoad dependency not found", dep)
		} else {
			addtoque(dep_load, loadque)
		}
	}

	loadque.push(load)
}




function retrieve_loadque(loadque: LazyLoadT[]) { return new Promise<number|null>(async (res, _rej)=> {

    const promises:Promise<bool>[] = []

    const filepaths = loadque.map(l=> get_filepath(l.type, l.name, l.is_instance))

	for(const f of filepaths) { promises.push(import_file(f)); }

	try   { await Promise.all(promises); }
	catch { res(null); return; }

    res(1)
})}




const import_file = (path: string) => new Promise<any>((res, rej) => {

	import(path)
		.then((module: any) => {
			res(module);
		})
		.catch((err) => {
			rej(err);
		})
});




function get_filepath(type:str, name:str, is_instance:bool|null) {

    let path = is_instance ? `/assets/instance/` : "/assets/"

    switch (type) {
        case "view": 
            path += `lazy/views/${name}/${name}.js`
            break;
        case "component":
            path += `lazy/components/${name}/${name}.js`
            break;
        case "thirdparty":
            path += `thirdparty/${name}.js`
            break;
        case "workers":
            path += `lazy/workers/${name}.js`
            break;
        case "lib":
            path += `lazy/libs/${name}.js`
            break;
        case "directive":
            path += `lazy/directives/${name}.js`
            break;
    }

    return path
}




function setBackgroundOverlay(ison:boolean) {
    const xel = document.querySelector("#lazyload_overlay")!
    if (ison) {   xel.classList.add("active");   } else {   xel.classList.remove("active");   }
}




function setWaitingAnimate(ison:boolean) {
    const xel = document.querySelector("#lazyload_overlay .waiting_animate")!
    if (ison) {   xel.classList.add("active");   } else {   xel.classList.remove("active");   }
}




export { Run, Init }
