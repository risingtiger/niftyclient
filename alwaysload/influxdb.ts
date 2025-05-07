

import { str, num } from "../defs_server_symlink.js";
import { $NT, FetchResultT } from "../defs.js";

declare var $N: $NT;


function Retrieve_Series(bucket:str, begins:num[], ends:num[], msrs:str[], fields:str[], tags:str[], intrv:num[], priors:str[]) {   
    return new Promise<any>(async (res, rej)=> { 
        const body = { bucket, begins, ends, msrs, fields, tags, intrv, priors } 

        const r = await influx_fetch_paths("retrieve_series", body)
		if (!r.ok) {   rej(); return;   }

		const parsed_data = (r.data as any[])

        for (let i=0; i<parsed_data.length; i++) {
            for (let ii=0; ii<parsed_data[i].length; ii++) {
                for (let iii=0; iii<parsed_data[i][ii].points.length; iii++) {
                    parsed_data[i][ii].points[iii].date = new Date(parsed_data[i][ii].points[iii].date)
                }
            }
        }
        res(parsed_data) 
    })
}




function Retrieve_Points(bucket:str, begins:num[], ends:num[], msrs:str[], fields:str[], tags:str[]) {   
    return new Promise<any>(async (res, rej)=> { 
        const body = { bucket, begins, ends, msrs, fields, tags} 

        const r = await influx_fetch_paths("retrieve_points", body)
		if (!r.ok) {   rej(); return;   }

		const parsed_data = (r.data as any[])

        for (let i=0; i<parsed_data.length; i++) {
            parsed_data[i].date = new Date(parsed_data[i].date)
            parsed_data[i].val = parsed_data[i].val === "true" ? true : false
        }

        res(parsed_data) 
    })
}




function Retrieve_Medians(bucket:str, begins:num[], ends:num[], dur_amounts:num[], dur_units:str[], msrs:str[], fields:str[], tags:str[], aggregate_fn:str[]) {   
    return new Promise<any>(async (res, rej)=> { 
        const body = { bucket, begins, ends, dur_amounts, dur_units, msrs, fields, tags, aggregate_fn}

        const r = await influx_fetch_paths("retrieve_medians", body)
		if (!r.ok) {   rej(); return;   }

		const parsed_data = r.data as any

        res(parsed_data) 
    })
}




function influx_fetch_paths(path:str, body:any) {   return new Promise<FetchResultT>(async (res)=> {

    const fetchopts = {method: "POST", body: JSON.stringify(body),}
    const r = await $N.FetchLassie('/api/influxdb_'+path, fetchopts)
    res(r)
})}





if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).InfluxDB = { Retrieve_Series, Retrieve_Points, Retrieve_Medians };
