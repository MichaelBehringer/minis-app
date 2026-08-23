import { theme as antdTheme } from 'antd'

// Liturgisches Violett als Markenfarbe. antd leitet daraus die restlichen
// Farbabstufungen (hover, active, border, bg) selbst ab.
const BRAND = '#5c4b9c'

// Die Statusleiste der installierten App bekommt diese Farbe (index.html +
// manifest). Hier definiert, damit Theme und PWA nicht auseinanderlaufen.
export const THEME_COLOR_LIGHT = BRAND
export const THEME_COLOR_DARK = '#141414'

// Gemeinsame Tokens fuer hell und dunkel. Die beiden wichtigsten Werte:
//
// controlHeight 44 - antd liefert 32px. Das iOS-Minimum fuer Trefferflaechen
//   liegt bei 44px, und die App wird ueberwiegend am Handy bedient.
// fontSize 16 - unter 16px zoomt Safari beim Fokussieren eines Eingabefeldes
//   die ganze Seite hinein und wieder heraus.
const sharedToken = {
  colorPrimary: BRAND,
  colorLink: BRAND,
  controlHeight: 44,
  controlHeightSM: 36,
  controlHeightLG: 52,
  fontSize: 16,
  borderRadius: 8,
  // Etwas mehr Luft als antd-Default, damit gestapelte Elemente am Handy
  // nicht aneinanderkleben.
  marginXS: 10,
  paddingContentVerticalSM: 12,
}

const sharedComponents = {
  Button: {
    fontWeight: 500,
    paddingInline: 20,
  },
  Card: {
    paddingLG: 16,
  },
  Checkbox: {
    controlInteractiveSize: 22,
  },
  Table: {
    cellPaddingBlock: 14,
  },
  Segmented: {
    controlHeight: 44,
  },
}

export function buildTheme(isDark) {
  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      ...sharedToken,
      ...(isDark
        ? {
            // Auf schwarzem Grund ist das dunkle Violett kaum vom Hintergrund
            // zu unterscheiden; eine deutlich hellere Stufe traegt den Kontrast.
            colorPrimary: '#a08ee6',
            colorLink: '#a08ee6',
          }
        : {}),
    },
    components: sharedComponents,
  }
}
