import { Badge, Calendar, Card } from 'antd'
import useIsMobile from '../hooks/useIsMobile'
import KalenderKopf from './KalenderKopf'

// Die Kalenderansicht der Startseite, bewusst in einer eigenen Datei.
//
// antds Calendar zieht die ganze Datumsmaschinerie mit - rund ein Drittel des
// Bundles. Die Standardansicht ist die Liste, der Kalender also der Sonderfall.
// Als eigene Datei laedt App ihn per React.lazy erst beim Umschalten.
export default function HomeKalender({ eventsAmTag, onTagWaehlen }) {
  const isMobile = useIsMobile()

  // Im Kalender die Anzahl anzeigen statt eines farbigen Blocks. Der Block
  // sagte nur "hier ist irgendwas" - man musste tippen, um es zu erfahren.
  const zelleRendern = (wert) => {
    const anzahl = eventsAmTag(wert).length
    if (anzahl === 0) return null
    return (
      <div style={{ textAlign: 'center', lineHeight: 1 }}>
        <Badge count={anzahl} size="small" />
      </div>
    )
  }

  return (
    <Card size="small" styles={{ body: { padding: isMobile ? 4 : 12 } }}>
      <Calendar
        // Am Handy die kompakte Form: ein Monatsraster in voller Breite ist
        // auf 390px gequetscht.
        fullscreen={!isMobile}
        // Eigene Kopfzeile statt der eingebauten: deren Auswahlfelder fuer
        // Jahr und Monat brachen in der schmalen Karte untereinander um.
        headerRender={({ value, onChange }) => (
          <KalenderKopf value={value} onChange={onChange} />
        )}
        cellRender={zelleRendern}
        onSelect={(datum, info) => {
          if (info?.source === 'date') onTagWaehlen(datum)
        }}
      />
    </Card>
  )
}
