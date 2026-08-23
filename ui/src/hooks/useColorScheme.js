import { useEffect, useState } from 'react'

const STORAGE_KEY = 'colorScheme'
const QUERY = '(prefers-color-scheme: dark)'

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    // Privater Modus / gesperrte Site-Daten: dann gilt die Geraeteeinstellung.
    return 'system'
  }
}

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia(QUERY).matches
    : false
}

// Farbschema der App: 'system' folgt der Geraeteeinstellung, 'light'/'dark'
// ueberschreiben sie. Die Wahl wird pro Geraet gemerkt.
export default function useColorScheme() {
  const [preference, setPreference] = useState(readStored)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  useEffect(() => {
    if (!window.matchMedia) return
    const mql = window.matchMedia(QUERY)
    const onChange = (e) => setSystemDark(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    try {
      if (preference === 'system') {
        localStorage.removeItem(STORAGE_KEY)
      } else {
        localStorage.setItem(STORAGE_KEY, preference)
      }
    } catch {
      // Nicht speicherbar ist kein Fehler, die Wahl gilt dann nur bis zum Neuladen.
    }
  }, [preference])

  const isDark = preference === 'system' ? systemDark : preference === 'dark'

  return { isDark, preference, setPreference }
}
