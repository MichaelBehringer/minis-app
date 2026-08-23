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
// react-responsive braucht es ebenfalls.
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
