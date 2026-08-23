import { Button, Space, notification } from 'antd'
import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Meldet eine neue Version und laesst den Nutzer entscheiden, wann geladen
// wird. Ein automatischer Reload mitten im Einteilen einer Messe waere
// aergerlich, deshalb 'prompt' statt 'autoUpdate' in der vite.config.
export default function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

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
