import axios from "axios";

export const baseUrl = window.location.hostname + ":" + window.location.port
const url = "http://localhost:8080/"

export async function doPostRequest(path, param) {
	return axios.post(url+path, param)
}

export async function doPostRequestAuth(path, param, auth) {
	return axios.post(url+path, param, {headers: {Authorization: 'Bearer ' + auth}})
}

// export async function doGetRequest(path) {
// 	return axios.get(url+path)
// }

export async function doGetRequestBlob(path) {
	return axios.get(url+path, { responseType: 'blob' })
}

export async function doGetRequestAuth(path, auth) {
	return axios.get(url+path, {headers: {Authorization: 'Bearer ' + auth}})
}

// export async function doDeleteRequest(path, param) {
// 	return axios.delete(url+path, param)
// }

export async function doDeleteRequestAuth(path, param, auth) {
	const dataObj = { data: param, headers: {Authorization: 'Bearer ' + auth}}
	return axios.delete(url+path, dataObj)
}

// export async function doPutRequest(path, param) {
// 	return axios.put(url+path, param)
// }

export async function doPutRequestAuth(path, param, auth) {
	return axios.put(url+path, param, {headers: {Authorization: 'Bearer ' + auth}})
}

export async function doPatchRequestAuth(path, param, auth) {
    return axios.patch(url + path, param, {
        headers: {
            Authorization: 'Bearer ' + auth
        }
    });
}
