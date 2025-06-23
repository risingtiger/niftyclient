import { bool, str } from "../defs_server_symlink.js";
import { LazyLoadT } from "../defs.js";




let _lazyloads:LazyLoadT[] = [];
const _loaded:Map<string, LazyLoadT> = new Map();
let timeoutWaitingAnimateId:any = null




function Init(lazyloads_:LazyLoadT[]) {
    _lazyloads = lazyloads_
    
    const script_tags = document.head.querySelectorAll('script[is_lazyload_asset]')
	const keymap = new Map<string, LazyLoadT>()
	lazyloads_.forEach(lazyload => {
		const key = get_filepath(lazyload.type, lazyload.name, lazyload.is_instance)
		keymap.set(key, lazyload)
	})
    
	script_tags.forEach(script => {
		const src = script.getAttribute('src')
		if (!src) return;

		const lazyload = keymap.get(src)!
		_loaded.set(src, lazyload)
	})
}




function LoadView(lazyloadview:LazyLoadT) {   return new Promise<number|null>(async (res, rej)=> {

	setBackgroundOverlay(true)
	timeoutWaitingAnimateId = setTimeout(() => {   setWaitingAnimate(true);   }, 1000);

    const loadque:LazyLoadT[] = []

    addtoque(lazyloadview, loadque)

	const r = await retrieve_loadque(loadque)

	clearTimeout(timeoutWaitingAnimateId)
	setBackgroundOverlay(false)
	setWaitingAnimate(false)

	if (r === null) { rej(); return; }

    res(1)
})}




function addtoque(load:LazyLoadT, loadque:LazyLoadT[]) {

	const load_key = get_filepath(load.type, load.name, load.is_instance)

	if (load.dependencies && load.dependencies.length !== 0) {
		for (const dep of load.dependencies) {
			const dep_load = _lazyloads.find(l=> l.type === dep.type && l.name === dep.name)!
			addtoque(dep_load, loadque)
		}
	}

	if (!_loaded.has(load_key))  loadque.push(load);
}




function retrieve_loadque(loadque: LazyLoadT[]) { return new Promise<number|null>(async (res, _rej)=> {

    const promises:Promise<bool>[] = []

    const filepaths = loadque.map(l=> get_filepath(l.type, l.name, l.is_instance))

	for(const f of filepaths) { promises.push(import_file(f)); }

	try   { await Promise.all(promises); }
	catch { res(null); return; }

	for(const load of loadque) { 
		const load_key = get_filepath(load.type, load.name, load.is_instance)
		_loaded.set(load_key, load);
	}

    res(1)
})}




const import_file = (path: string) => new Promise<any>((res, rej) => {

	//path = (path.split(".js")[0]) + "__" + Date.now() + "__.js"

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




export { LoadView, Init }
