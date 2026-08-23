import { App as AntApp, ConfigProvider } from 'antd'
import deDE from 'antd/locale/de_DE'
import dayjs from 'dayjs'
import 'dayjs/locale/de'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { useEffect } from 'react'
import { ColorSchemeContext } from './colorScheme'
import { registerMessageInstance } from './helper/ToastHelper'
import useColorScheme from './hooks/useColorScheme'
import { THEME_COLOR_DARK, THEME_COLOR_LIGHT, buildTheme } from './theme'

// Die Locale-Datei zu importieren registriert sie nur - aktiv wird sie erst
// hier. Vorher stand dieser Aufruf als Seiteneffekt in Home.jsx, waehrend
// Einteilung.jsx dayjs ohne Locale importierte: ob deutsch formatiert wurde,
// hing damit an der Ladereihenfolge der Module.
dayjs.locale('de')

// Ohne dieses Plugin ignoriert dayjs das Formatargument: dayjs('18:00:00',
// 'HH:mm:ss') ergibt dann Invalid Date. Genau das stand bisher im
// Detail-Dialog der Startseite.
dayjs.extend(customParseFormat)

// Haelt die theme-color-Angabe im Dokument mit dem aktiven Schema synchron.
// Sie faerbt bei der installierten App die Statusleiste - bliebe sie fest,
// haette man im Dunkelmodus einen violetten Balken ueber schwarzem Inhalt.
function useThemeColorMeta(isDark) {
  useEffect(() => {
    const color = isDark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT
    for (const el of document.querySelectorAll('meta[name="theme-color"]')) {
      el.setAttribute('content', color)
    }
  }, [isDark])
}

// Stellt die message-Instanz fuer ToastHelper bereit, damit Toasts Theme und
// Sprache sehen.
function ToastBridge({ children }) {
  const { message } = AntApp.useApp()

  useEffect(() => {
    registerMessageInstance(message)
    return () => registerMessageInstance(null)
  }, [message])

  return children
}

export default function AppProviders({ children }) {
  const colorScheme = useColorScheme()
  useThemeColorMeta(colorScheme.isDark)

  return (
    <ColorSchemeContext.Provider value={colorScheme}>
      <ConfigProvider locale={deDE} theme={buildTheme(colorScheme.isDark)}>
        <AntApp>
          <ToastBridge>{children}</ToastBridge>
        </AntApp>
      </ConfigProvider>
    </ColorSchemeContext.Provider>
  )
}
