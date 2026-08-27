import { Button, Typography } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

// Kopfzeile fuer die Kalender, als headerRender an antds Calendar uebergeben.
//
// Ersetzt die eingebaute Kopfzeile vollstaendig. Die bestand aus zwei
// Auswahlfeldern fuer Jahr und Monat plus einem Umschalter Monat/Jahr - in
// einem schmalen Container brechen die untereinander um, und am Handy sind
// Auswahlfelder ohnehin die kleineren Trefferflaechen.
//
// Stattdessen zwei Pfeile ueber die vollen 44px und ein Sprung zu Heute. Damit
// ist auch die Jahresansicht weg, die hier niemand braucht.
export default function KalenderKopf({ value, onChange }) {
  const heute = dayjs()
  const imAktuellenMonat = value.isSame(heute, 'month')

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 0 10px',
      }}
    >
      <Button
        aria-label="Vorheriger Monat"
        icon={<LeftOutlined aria-hidden />}
        onClick={() => onChange(value.subtract(1, 'month'))}
      />

      <Typography.Text
        strong
        style={{
          flex: 1,
          textAlign: 'center',
          fontSize: 16,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value.format('MMMM YYYY')}
      </Typography.Text>

      <Button
        aria-label="Nächster Monat"
        icon={<RightOutlined aria-hidden />}
        onClick={() => onChange(value.add(1, 'month'))}
      />

      {/* Im aktuellen Monat gesperrt statt ausgeblendet: sonst springt die
          Kopfzeile beim Blaettern in der Breite. */}
      <Button
        type="text"
        disabled={imAktuellenMonat}
        onClick={() => onChange(heute)}
      >
        Heute
      </Button>
    </div>
  )
}
