import { Drawer } from 'antd'
import useCloseOnBack from '../hooks/useCloseOnBack'
import useIsMobile from '../hooks/useIsMobile'

// Ein Overlay, das am Handy von unten ueber die ganze Hoehe kommt und am PC
// von rechts als Panel.
//
// Bewusst statt eines Modals: ein Modal mit vier Reitern oder einer langen
// Namensliste ist am Handy ein Fenster im Fenster mit zwei Scrollbereichen.
// Ueber die volle Hoehe bleibt genau ein Scrollbereich.
//
// 100dvh und nicht 100vh oder height="100%": vh rechnet mit der ausgefahrenen
// Adressleiste, die Kopfzeile des Sheets waere nach dem Scrollen oben
// abgeschnitten.
export default function Sheet({
  open,
  onClose,
  title,
  footer,
  children,
  width = 480,
  extra,
}) {
  const isMobile = useIsMobile()

  // Die Zurueck-Geste schliesst das Sheet statt die App zu verlassen. Als
  // installierte PWA stand man beim ersten Verlaufseintrag - ein Wischen von
  // der Seite hat die App mitten im Einteilen geschlossen.
  useCloseOnBack(open, onClose)

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      extra={extra}
      footer={footer}
      placement={isMobile ? 'bottom' : 'right'}
      height={isMobile ? '100dvh' : undefined}
      width={isMobile ? undefined : width}
      styles={{
        body: {
          paddingBottom: `calc(16px + var(--safe-bottom))`,
        },
        footer: {
          paddingBottom: `calc(12px + var(--safe-bottom))`,
        },
      }}
    >
      {children}
    </Drawer>
  )
}
