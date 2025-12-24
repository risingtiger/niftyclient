

import { str } from "../defs_server_symlink";




function CSVDownload(csvstr:string, filename:string) {

	const blob = new Blob([csvstr], {type: 'text/csv'})
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
    a.setAttribute('href', url) 
    a.setAttribute('download', `${filename}.csv`); 
	a.click()
	URL.revokeObjectURL(url)
}




function resolve_object_references(list: {[key: str]: any}[],  object_stores: Map<string, {[key: str]: any}[]>): {[key: str]: any}[] {

    const lookup_maps = new Map<string, Map<string, any>>();
	const o = {}
	object_stores.forEach((storeData, storeName) => {
		o[storeName.slice(2)] = storeData;
	});
    
    // Initialize lookup maps only for stores that are needed
    // We'll populate them on-demand when first encountered

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
				// we are assuming '1:' prefix is always present, since these are all object stores
                const storeData = o[storeName]!
                
                lookup_map = new Map();

                for (const storeItem of storeData)    lookup_map.set(storeItem.id, storeItem);

                lookup_maps.set(storeName, lookup_map);
            }
            
			item[key+'ref'] = lookup_map.get(itemId);
        }
    }

	return list;
}




if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).Utils = { CSVDownload, resolve_object_references };
