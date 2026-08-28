import axios from "axios";

// Default: relativer Pfad. In Dev leitet der Vite-Proxy /server/ auf das
// Backend um, in Produktion macht das nginx (location /server/).
//
// Vorher stand hier eine feste Adresse auf http://localhost:8080/, die im
// Container nicht funktionieren konnte und vor jedem Deployen von Hand
// geaendert werden musste. VITE_API_URL ueberschreibt den Default nur fuer
// Sonderfaelle.
const url = import.meta.env.VITE_API_URL ?? "/server/"

// Eigene Instanz statt der globalen: der Interceptor unten soll ausschliesslich
// fuer die Aufrufe dieser Anwendung gelten.
const client = axios.create()

let onUnauthorized = null
let onTokenErneuert = null
let bereitsGemeldet = false

// Wird von TokenContainer gesetzt. Der Interceptor kann removeToken nicht
// selbst aufrufen, weil das an React-State haengt.
export function registerUnauthorizedHandler(handler) {
	onUnauthorized = handler
	// Nach einer erneuten Anmeldung soll wieder gemeldet werden koennen.
	bereitsGemeldet = false
}

// Ist die Antwort ein abgelaufenes oder ungueltiges Token?
//
// Die AuthUser-Middleware antwortet mit 401, sowohl bei fehlendem als auch bei
// ungueltigem Token (server/middleware/authUser.go). Denselben Code liefert
// aber auch die Anmeldung selbst bei falschem Passwort - und dort gibt es
// keine Sitzung zu beenden, sonst wuerde ein Tippfehler beim Anmelden als
// "Sitzung abgelaufen" gemeldet.
//
// Unterschieden wird deshalb am Authorization-Header: nur Anfragen, die
// tatsaechlich ein Token mitgeschickt haben, koennen ein ungueltiges haben.
export function istTokenUngueltig(error) {
	if (error?.response?.status !== 401) return false
	return Boolean(error?.config?.headers?.Authorization)
}

// Wird von TokenContainer gesetzt. Der Server verlaengert die Sitzung bei
// Benutzung und legt das neue Token in den Antwortkopf.
export function registerTokenRenewalHandler(handler) {
	onTokenErneuert = handler
}

client.interceptors.response.use((response) => {
	// Ohne das waere nach der Gueltigkeitsdauer Schluss, auch bei taeglicher
	// Nutzung. Der Kopf kommt an jeder beliebigen Antwort - deshalb hier und
	// nicht an einer bestimmten Anfrage.
	const neu = response?.headers?.['x-neues-token']
	if (neu && onTokenErneuert) {
		onTokenErneuert(neu)
	}
	return response
}, (error) => {
	if (istTokenUngueltig(error) && onUnauthorized && !bereitsGemeldet) {
		// Nur einmal: bei mehreren gleichzeitig laufenden Anfragen gaebe es
		// sonst mehrere Meldungen.
		bereitsGemeldet = true
		onUnauthorized()
	}
	return Promise.reject(error)
})

export async function doPostRequest(path, param) {
	return client.post(url+path, param)
}

export async function doPostRequestAuth(path, param, auth) {
	return client.post(url+path, param, {headers: {Authorization: 'Bearer ' + auth}})
}

export async function doGetRequestAuth(path, auth) {
	return client.get(url+path, {headers: {Authorization: 'Bearer ' + auth}})
}

// Fuer Dateidownloads. Braucht den Token, seit /pdf/events nicht mehr
// oeffentlich ist - ein window.open kann keinen Header setzen.
export async function doGetRequestBlobAuth(path, auth) {
	return client.get(url+path, {
		responseType: 'blob',
		headers: {Authorization: 'Bearer ' + auth},
	})
}

export async function doDeleteRequestAuth(path, param, auth) {
	const dataObj = { data: param, headers: {Authorization: 'Bearer ' + auth}}
	return client.delete(url+path, dataObj)
}

export async function doPutRequestAuth(path, param, auth) {
	return client.put(url+path, param, {headers: {Authorization: 'Bearer ' + auth}})
}

export async function doPatchRequestAuth(path, param, auth) {
	return client.patch(url+path, param, {headers: {Authorization: 'Bearer ' + auth}})
}
