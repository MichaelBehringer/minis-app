import { Button, Space, notification } from 'antd'
import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Wie oft im Hintergrund nach einer neuen Fassung gesehen wird, solange die
// App offen bleibt.
const PRUEFINTERVALL = 60 * 60 * 1000

// Meldet eine neue Version und laesst den Nutzer entscheiden, wann geladen
// wird. Ein automatischer Reload mitten im Einteilen einer Messe waere
// aergerlich, deshalb 'prompt' statt 'autoUpdate' in der vite.config.
export default function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return

      // Der Browser sieht von sich aus bei einer Navigation nach einem neuen
      // Service Worker. Eine vom Startbildschirm gestartete App wird aber
      // meist nur in den Vordergrund geholt und nicht neu geladen - ohne diese
      // Pruefung koennte sie wochenlang auf einer alten Fassung stehen, ohne
      // es zu merken.
      const pruefen = () => {
        if (document.visibilityState !== 'visible') return
        // Ein Fehlschlag ist kein Problem: ohne Netz gibt es nichts zu holen,
        // und beim naechsten Mal wird wieder gesehen.
        registration.update().catch(() => {})
      }

      document.addEventListener('visibilitychange', pruefen)
      // Zusaetzlich fuer die, die die App tagelang offen liegen lassen.
      // Bewusst ohne Aufraeumen: die Komponente haengt in main.jsx und lebt
      // so lange wie die Anwendung selbst.
      setInterval(pruefen, PRUEFINTERVALL)
    },
  })

  useEffect(() => {
    if (!needRefresh) return

    const key = 'pwa-update'
    notification.info({
      key,
      message: 'Neue Version verfügbar',
      description: 'Die App wurde aktualisiert. Jetzt neu laden?',
      duration: 0,
      placement: 'top',
      btn: (
        <Space>
          <Button
            size="small"
            onClick={() => {
              setNeedRefresh(false)
              notification.destroy(key)
            }}
          >
            Später
          </Button>
          <Button type="primary" size="small" onClick={() => updateServiceWorker(true)}>
            Neu laden
          </Button>
        </Space>
      ),
    })
  }, [needRefresh, setNeedRefresh, updateServiceWorker])

  useEffect(() => {
    if (!offlineReady) return
    notification.success({
      message: 'Offline einsatzbereit',
      description: 'Die App startet jetzt auch ohne Netz.',
      placement: 'top',
      duration: 4,
    })
    setOfflineReady(false)
  }, [offlineReady, setOfflineReady])

  return null
}
