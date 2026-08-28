import '@testing-library/jest-dom/vitest'

// jsdom implementiert ResizeObserver nicht. antd nutzt es ueber
// rc-resize-observer in Layout, Menu, Table und Select.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// jsdom implementiert window.matchMedia nicht. antd braucht es fuer die
// responsiven Grid-Komponenten (Row/Col), sonst schlaegt jedes Rendern fehl.
// Ebenso der useIsMobile-Hook ueber antds Grid.useBreakpoint.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

// Node bringt seit v24 einen eigenen, experimentellen localStorage-Global mit,
// der ohne --localstorage-file undefined liefert - und der verdeckt in der
// jsdom-Umgebung den echten von jsdom. Jeder Zugriff im Test laeuft damit in
// einen TypeError, obwohl der Browser die Schnittstelle hat.
function speicherAttrappe() {
  const daten = new Map()
  return {
    getItem: (k) => (daten.has(String(k)) ? daten.get(String(k)) : null),
    setItem: (k, v) => void daten.set(String(k), String(v)),
    removeItem: (k) => void daten.delete(String(k)),
    clear: () => daten.clear(),
    key: (i) => Array.from(daten.keys())[i] ?? null,
    get length() {
      return daten.size
    },
  }
}

for (const name of ['localStorage', 'sessionStorage']) {
  let vorhanden = false
  try {
    vorhanden = Boolean(globalThis[name])
  } catch {
    // Zugriff wirft bei einer opaken Herkunft - gilt als nicht vorhanden.
  }
  if (!vorhanden) {
    const attrappe = speicherAttrappe()
    Object.defineProperty(globalThis, name, { value: attrappe, configurable: true, writable: true })
    if (globalThis.window && globalThis.window !== globalThis) {
      Object.defineProperty(globalThis.window, name, { value: attrappe, configurable: true, writable: true })
    }
  }
}
