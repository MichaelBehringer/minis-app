import { DatePicker } from 'antd'
import useIsMobile from '../hooks/useIsMobile'

const { RangePicker } = DatePicker

// Auswahl eines Zeitraums, die am Handy nicht aus dem Bildschirm laeuft.
//
// antds RangePicker zeigt in seinem Auswahlfeld zwei Monate nebeneinander -
// rund 580px. Auf einem 390px breiten Bildschirm passt das nicht: das Panel
// wird nach links geschoben, der linke Monat liegt ausserhalb und rechts
// bleibt Rand. Eine andere Ausrichtung hilft dagegen nicht, es ist einfach
// breiter als der Bildschirm.
//
// Deshalb am Handy zwei einzelne Datumsfelder. Deren Panel zeigt einen Monat
// (rund 280px) und passt. Am PC bleibt der RangePicker - dort ist er die
// bequemere Bedienung und hat den Platz.
//
// Die Schnittstelle ist die des RangePickers: value als [von, bis] und
// onChange mit demselben Paar. Damit funktioniert die Komponente auch als
// Kind eines Form.Item, das value und onChange selbst einsetzt.
export default function ZeitraumWahl({
  value,
  onChange,
  format = 'DD.MM.YYYY',
  allowClear = true,
  style,
  disabled,
}) {
  const isMobile = useIsMobile()

  const von = value?.[0] ?? null
  const bis = value?.[1] ?? null

  if (!isMobile) {
    return (
      <RangePicker
        style={style ?? { width: '100%' }}
        format={format}
        allowClear={allowClear}
        disabled={disabled}
        value={value ?? null}
        onChange={onChange}
      />
    )
  }

  // Ein leerer Zeitraum wird als null gemeldet, nicht als [null, null] - so
  // verhaelt sich der RangePicker beim Leeren ebenfalls.
  const setzen = (neuVon, neuBis) => {
    onChange?.(neuVon || neuBis ? [neuVon ?? null, neuBis ?? null] : null)
  }

  const gemeinsam = {
    format,
    allowClear,
    disabled,
    // Ohne das schiebt iOS beim Antippen die Tastatur ueber den Kalender.
    inputReadOnly: true,
    style: { flex: 1, minWidth: 0 },
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...style }}>
      <DatePicker
        {...gemeinsam}
        placeholder="Von"
        aria-label="Zeitraum von"
        value={von}
        // Ein Anfang nach dem Ende waere nur eine Fehlermeldung wert - besser
        // gar nicht anwaehlbar.
        disabledDate={(d) => Boolean(bis && d.isAfter(bis, 'day'))}
        onChange={(d) => setzen(d, bis)}
      />
      <span aria-hidden style={{ flexShrink: 0 }}>
        –
      </span>
      <DatePicker
        {...gemeinsam}
        placeholder="Bis"
        aria-label="Zeitraum bis"
        value={bis}
        disabledDate={(d) => Boolean(von && d.isBefore(von, 'day'))}
        onChange={(d) => setzen(von, d)}
      />
    </div>
  )
}
