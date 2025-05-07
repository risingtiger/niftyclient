

import { $NT, LoggerTypeE, LoggerSubjectE, GenericRowT } from "../defs.js"


declare var $N: $NT;


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




function Log(type:LoggerTypeE, subject:LoggerSubjectE, message:string) {

	//if ( window.location.hostname === "localhost" )   return


	const logs = localStorage.getItem("logs") || ""
	const ts = Math.floor(Date.now() / 1000)

	const newlog = `${type},${subject},${message},${ts}`

	const newstr = `${logs}${newlog}--`

	localStorage.setItem("logs", newstr)

	if (newstr.length > 2000) {
		Save()
	}
}




async function Save() {

	//if ( window.location.hostname === "localhost" )   return


	let logs = localStorage.getItem("logs")
	let user_email = localStorage.getItem("user_email")

	if (!user_email || !logs) 
		return


	let device = get_device()
	let browser = get_browser()

	if (logs.length > 5) {
		logs = logs.slice(0, -2) // remove the last -- from the logs

		const url = "/api/logger/save"

		const fetchopts = {   
			method: "POST",
			body: JSON.stringify({user_email, device, browser, logs}),
		}

		const r = await $N.FetchLassie(url, fetchopts, null)
		if (!r.ok) {
			// if the save fails, we will just leave the logs in localstorage
		} else {
			localStorage.setItem("logs", "")
		}
	}
}




async function Get() {

	let user_email = localStorage.getItem("user_email")

	if (!user_email)   return


	const url = "/api/logger/get?user_email=" + user_email

    const csvstr = await $N.FetchLassie(url, { headers: { 'Content-Type': 'text/csv', 'Accept': 'text/csv' } }, {  } )
	if (!csvstr.ok) {   alert ("unable to retrieve logs"); return;   }

	$N.Utils.CSV_Download(csvstr.data as string, "logs")
}




async function logger_ticktock() {
	setTimeout(()=> {
		Save()
		logger_ticktock()
	}, 1000 * 60 * 60 * 24)
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


logger_ticktock()




if (!(window as any).$N) {   (window as any).$N = {};   }
((window as any).$N as any).Logger = { Log, Save, Get };
