

import { str } from "../defs_server_symlink";




function CSV_Download(csvstr:string, filename:string) {

    const blob = new Blob([csvstr], { type: 'text/csv' }); 
  
    const url = window.URL.createObjectURL(blob) 
  
    const a = document.createElement('a') 
  
    a.setAttribute('href', url) 
  
    a.setAttribute('download', `${filename}.csv`); 
  
    a.click()
}

function resolve_object_references(list: {[key: str]: any}[],  object_stores: Map<string, {[key: str]: any}[]>): {[key: str]: any}[] {

    // Create lookup maps for each object store for O(1) access by ID
    const lookup_maps = new Map<string, Map<string, any>>();
    
    // Initialize lookup maps only for stores that are needed
    // We'll populate them on-demand when first encountered

	//const t1 = performance.now();
    
    for (const item of list) {
        // Check each property of the object
        for (const key in item) {
            const value = item[key];
            
            if (!value || typeof value !== 'object' || !value.__path) {
                continue;
            }
            
            const [storeName, itemId] = value.__path;
            
            // Get or create the lookup map for this store
            let lookup_map = lookup_maps.get(storeName);
            if (!lookup_map) {
                const storeData = object_stores.get(storeName)!
                
                lookup_map = new Map();

                for (const storeItem of storeData)    lookup_map.set(storeItem.id, storeItem);

                lookup_maps.set(storeName, lookup_map);
            }
            
			item[key+'ref'] = lookup_map.get(itemId);
        }
    }

	/*
	const t2 = performance.now();
	console.log("resolve_object_references took " + (t2 - t1) + " milliseconds. with length " + list.length);
	*/
	return list;
}




if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).Utils = { CSV_Download, resolve_object_references };
