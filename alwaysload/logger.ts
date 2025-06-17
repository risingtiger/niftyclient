

import { str } from "../defs_server_symlink.js"
import { $NT } from "../defs.js"


declare var $N: $NT;

//subject: "srf" | "ixe" | "sse" | "sw4" | "swe" | "lde" | "ldp" | "ldr" | "aup" | "epv" | "eov"; // switch_station_route_load_fail | indexeddb_error | sse_listener_error | sw_fetch_not_authorized | sw_fetch_error | localdbsync_error | localdbsync_error_toomany_pending | localdbsync_third_day_reset | app_update | engagement_pageview | engagement_overlayview
// convert the comment above to a multiline comment with each subject on a new line along with its description AI!
type LogItemT = {
	type: 10|20|25|30|40; // debug | info | info_engagement | warning | error
	subject: "srf" | "ixe" | "sse" | "sw4" | "swe" | "lde" | "ldp" | "ldr" | "aup" | "epv" | "eov"; 
	message: string;
	ts: number; 
}

enum DeviceTypeE {
	desktop = "dsk",
	mobile = "mbl",
	tablet = "tbl"
}


enum BrowserE {
	chrome = "chr",
	firefox = "frx",
	safari = "saf",
	other = "otr"
}




const LOG_STORE_NAME = "pending_logs";
const MAX_SENDBEACON_PAYLOAD_SIZE = 60 * 1024; // 60KB




function Init() {
	$N.EngagementListen.Add_Listener(document.body, "logger", "hidden", null, () => {
		sendlogs()
	})
}



async function Log(type: LoggerTypeE, subject: LoggerSubjectE, message: string) {

    if (window.location.hostname === "localhost")   return;


	let ts = Math.floor(Date.now() / 1000);

	if (message.length > 36) {message = message.slice(0, 33) + "...";}

    const log_entry = {type, subject, message, ts};

    try   { await $N.IDB.AddOne(LOG_STORE_NAME, log_entry); } 
	catch {}
}




async function Get() {

	let user_email = localStorage.getItem("user_email")

	if (!user_email)   return


	const url = "/api/logger/get?user_email=" + user_email

    const csvstr = await $N.FetchLassie(url, { headers: { 'Content-Type': 'text/csv', 'Accept': 'text/csv' } }, {  } )
	if (!csvstr.ok) {   alert ("unable to retrieve logs"); return;   }

	$N.Utils.CSV_Download(csvstr.data as string, "logs")
}




async function sendlogs() {

	let   all_logs:any

    try   { all_logs = await $N.IDB.GetAll([ LOG_STORE_NAME ]); }
    catch { return }


	if (all_logs.get(LOG_STORE_NAME)?.length === 0)    return;


    let logs_str = all_logs.get(LOG_STORE_NAME)?.map(format_logitem).join("\n") || "";
	let user_email = localStorage.getItem("user_email") || "unknown";

	logs_str = `${user_email}\n${get_device()}\n${get_browser()}\n` + logs_str; // server will use string indexes to parse back out device and browser

	if (logs_str.length > MAX_SENDBEACON_PAYLOAD_SIZE)  {
		await $N.IDB.ClearAll(LOG_STORE_NAME).catch(() => null);
		return;
	}

    if (navigator.sendBeacon("/api/logger/save", logs_str)) {
		await $N.IDB.ClearAll(LOG_STORE_NAME).catch(() => null);
	} 
}




function format_logitem(logitem: LogItemT): str {
	return `${logitem.type},${logitem.subject},${logitem.message},${logitem.ts}`; 
}




function get_device() {

	const ua = navigator.userAgent;

	const isTablet = /iPad|Tablet|PlayBook|Nexus 7|Nexus 10|KFAPWI/i.test(ua) ||
		   (/(Android)/i.test(ua) && !/Mobile/i.test(ua));

	const isMobile = /Mobi|Mobile|iPhone|iPod|BlackBerry|Windows Phone|Opera Mini/i.test(ua);

	if (isTablet) {
		return DeviceTypeE.tablet
	} else if (isMobile) {
		return DeviceTypeE.mobile
	} else {
		return DeviceTypeE.desktop
	}
}





function get_browser() {

	const ua = navigator.userAgent;
	let browser = BrowserE.other;

	if (/Firefox\/\d+/.test(ua)) {
	browser = BrowserE.firefox;
	} else if (/Edg\/\d+/.test(ua)) {
	browser = BrowserE.chrome;
	} else if (/Chrome\/\d+/.test(ua) && !/Edg\/\d+/.test(ua) && !/OPR\/\d+/.test(ua)) {
	browser = BrowserE.chrome;
	} else if (/Safari\/\d+/.test(ua) && !/Chrome\/\d+/.test(ua) && !/OPR\/\d+/.test(ua) && !/Edg\/\d+/.test(ua)) {
	browser = BrowserE.safari;
	} else if (/OPR\/\d+/.test(ua)) {
	browser = BrowserE.chrome;
	}

	return browser;
}



export { Init }


if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).Logger = { Log, Get };




