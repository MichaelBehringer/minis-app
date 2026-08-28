import { useCallback, useState } from 'react'

const SCHLUESSEL = 'jwtToken'

// Der Zugriff auf den Speicher kann werfen - im privaten Modus mancher Browser
// und wenn Site-Daten gesperrt sind. Das darf die Anmeldung nicht verhindern:
// scheitert das Ablegen, haelt React das Token weiter im State und die Sitzung
// endet erst beim Neuladen.
function lese(name) {
  try {
    return globalThis[name]?.getItem(SCHLUESSEL) || null
  } catch {
    return null
  }
}

function schreibe(name, wert) {
  try {
    globalThis[name].setItem(SCHLUESSEL, wert)
  } catch {
    // bewusst still - siehe oben
  }
}

function entferne(name) {
  try {
    globalThis[name]?.removeItem(SCHLUESSEL)
  } catch {
    // bewusst still - siehe oben
  }
}

// Hooks used for user authentication with Tokens
function useToken() {
  const [token, setToken] = useState(
    () => lese('localStorage') ?? lese('sessionStorage')
  )

  const saveToken = useCallback((userToken, remember) => {
    schreibe(remember ? 'localStorage' : 'sessionStorage', userToken)
    setToken(userToken)
  }, [])

  // Ein vom Server erneuertes Token gehoert in denselben Speicher wie das
  // alte. Wer "Angemeldet bleiben" nicht angekreuzt hat, soll durch die
  // Verlaengerung nicht doch dauerhaft angemeldet werden - deshalb wird der
  // Speicherort nicht neu entschieden, sondern der vorhandene beschrieben.
  const erneuereToken = useCallback((userToken) => {
    if (lese('localStorage')) {
      schreibe('localStorage', userToken)
    } else if (lese('sessionStorage')) {
      schreibe('sessionStorage', userToken)
    } else {
      // Zwischenzeitlich abgemeldet - die Antwort einer noch laufenden Anfrage
      // darf die Sitzung dann nicht wiederbeleben.
      return
    }
    setToken(userToken)
  }, [])

  const removeToken = useCallback(() => {
    entferne('localStorage')
    entferne('sessionStorage')
    setToken(null)
  }, [])

  return {
    setToken: saveToken,
    erneuereToken,
    token,
    removeToken,
  }
}

export default useToken
