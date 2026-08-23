import { message as staticMessage } from 'antd'

// Die statische message-API von antd kann den React-Context nicht lesen, sieht
// also weder Theme noch Locale (antd warnt deswegen in der Konsole). Damit die
// Aufrufstellen unverändert bleiben können, hinterlegt AppProviders hier die
// Instanz aus App.useApp(); bis dahin greift die statische API als Rückfall.
let instance = null

export function registerMessageInstance(messageInstance) {
  instance = messageInstance
}

function api() {
  return instance ?? staticMessage
}

export function myToastError(txt) {
  api().error(txt, 3)
}

export function myToastSuccess(txt) {
  api().success(txt, 3)
}

export function myToastInfo(txt) {
  api().info(txt, 3)
}
