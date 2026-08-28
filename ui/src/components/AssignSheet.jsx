import { useMemo, useState } from 'react'
import {
  Alert,
  App as AntApp,
  Button,
  Empty,
  Input,
  Space,
  Spin,
  Tag,
  Typography,
  theme,
} from 'antd'
import { BulbOutlined, CheckOutlined, HeartOutlined } from '@ant-design/icons'
import {
  abstandText,
  gruppiereOptionen,
  metaFuer,
  nameVon,
  naechsterText,
  vorschlagFuerOffenePlaetze,
} from '../helper/einteilung'
import { myToastInfo } from '../helper/ToastHelper'
import Sheet from './Sheet'

// Zustaende, bei denen ein Einteilen der eigenen Angabe des Ministranten
// widerspricht. Blockiert wird nichts - an Weihnachten wird eingeteilt, wer da
// ist -, aber es soll eine Entscheidung sein und kein Versehen: im Bestand
// liegen 26 Einteilungen auf einem Tag, den dieselbe Person selbst gesperrt
// hat.
//
// Der Wochentag fehlt hier absichtlich. Er ist ein Wunsch, keine Absage, und
// eine Rueckfrage bei jedem der rund 40 Faelle im Bestand waere nur im Weg.
const RUECKFRAGE = {
  banned: {
    titel: 'hat diesen Tag gesperrt',
    text: 'Die Sperrung bleibt bestehen. Trotzdem einteilen?',
  },
  inactive: {
    titel: 'ist als inaktiv geführt',
    text: 'Inaktive Ministranten werden normalerweise nicht eingeteilt. Trotzdem einteilen?',
  },
}

// Eine Zeile pro Ministrant.
//
// Bewusst ein Knopf ueber die ganze Breite mit mindestens 48px Hoehe: das
// ersetzt ein Mehrfach-Select mit gruppierten Optionen, das am Handy in einer
// schmalen Kartenspalte praktisch nicht bedienbar war.
function MiniZeile({ option, aktiv, vorgeschlagen, wunschNamen, onToggle }) {
  const { token } = theme.useToken()
  const meta = metaFuer(option.status)
  const naechster = naechsterText(option)

  return (
    <button
      type="button"
      onClick={() => onToggle(option.id)}
      aria-pressed={aktiv}
      aria-label={`${nameVon(option)}, ${meta.tagText}, ${abstandText(option)}`}
      style={{
        width: '100%',
        minHeight: 48,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        textAlign: 'start',
        padding: '8px 12px',
        marginBottom: 6,
        cursor: 'pointer',
        borderRadius: token.borderRadius,
        // Ein Vorschlag ist noch nichts Gespeichertes - gestrichelt, damit der
        // Unterschied zu einer Einteilung auf einen Blick sichtbar ist.
        border: vorgeschlagen
          ? `1px dashed ${token.colorPrimary}`
          : `1px solid ${aktiv ? token.colorPrimary : token.colorBorderSecondary}`,
        background: aktiv ? token.controlItemBgActive : token.colorBgContainer,
        color: token.colorText,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 24,
          height: 24,
          flexShrink: 0,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `1px solid ${aktiv ? token.colorPrimary : token.colorBorder}`,
          background: aktiv ? token.colorPrimary : 'transparent',
          color: '#fff',
        }}
      >
        {aktiv && <CheckOutlined style={{ fontSize: 13 }} />}
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 500 }}>{nameVon(option)}</span>
        <span
          style={{
            display: 'block',
            fontSize: 12,
            color: token.colorTextSecondary,
          }}
        >
          {abstandText(option)}
          {naechster ? ` · ${naechster}` : ''}
        </span>
        {/* Die gepflegten Wunschpartner. Seit die automatische Zuteilung weg
            ist, ist das die Stelle, an der sie noch etwas beitragen. */}
        {wunschNamen.length > 0 && (
          <span
            style={{
              display: 'block',
              fontSize: 12,
              color: token.colorTextTertiary,
            }}
          >
            <HeartOutlined aria-hidden /> gern mit {wunschNamen.join(', ')}
          </span>
        )}
      </span>

      <Tag
        color={vorgeschlagen ? 'blue' : meta.tagColor}
        style={{ marginInlineEnd: 0, flexShrink: 0 }}
      >
        {vorgeschlagen ? 'Vorschlag' : meta.tagText}
      </Tag>
    </button>
  )
}

export default function AssignSheet({
  open,
  onClose,
  event,
  optionen,
  laedt,
  zugewiesen,
  onToggle,
  onMehrereEinteilen,
}) {
  const { token } = theme.useToken()
  const { modal } = AntApp.useApp()
  const [suche, setSuche] = useState('')
  // Der noch nicht bestätigte Vorschlag, zusammen mit der Messe, zu der er
  // gehört. Die Id mitzuführen ist einfacher als sie in einem Effekt zu
  // löschen: bei einer anderen Messe gilt der Vorschlag schlicht nicht.
  const [vorschlagFuer, setVorschlagFuer] = useState({ eventId: null, ids: [] })

  // Beim Entfernen wird nie gefragt - nur beim Einteilen gegen eine Angabe,
  // die der Ministrant selbst gemacht hat.
  const tippen = (id) => {
    const option = optionen.find((o) => o.id === id)
    const frage = zugewiesen.includes(id) ? null : RUECKFRAGE[option?.status]

    if (!frage) {
      onToggle(id)
      return
    }

    modal.confirm({
      title: `${nameVon(option)} ${frage.titel}`,
      content: frage.text,
      okText: 'Trotzdem einteilen',
      cancelText: 'Abbrechen',
      onOk: () => onToggle(id),
    })
  }

  // Namen der Wunschpartner nachschlagen. Das Backend liefert Ids, die Namen
  // stehen in derselben Liste - eine zweite Abfrage waere unnoetig.
  const nameNachId = useMemo(() => {
    const map = new Map()
    for (const o of optionen) map.set(o.id, nameVon(o))
    return map
  }, [optionen])

  const gefiltert = useMemo(() => {
    const s = suche.trim().toLowerCase()
    if (!s) return optionen
    return optionen.filter((o) => nameVon(o).toLowerCase().includes(s))
  }, [optionen, suche])

  const gruppen = useMemo(() => gruppiereOptionen(gefiltert), [gefiltert])

  const anzahl = zugewiesen.length
  const soll = event?.minimalUser ?? 0
  const offen = soll - anzahl

  const messeId = event?.id
  const vorschlag = vorschlagFuer.eventId === messeId ? vorschlagFuer.ids : []
  const verwerfen = () => setVorschlagFuer({ eventId: null, ids: [] })

  const vorschlagen = () => {
    const ids = vorschlagFuerOffenePlaetze(optionen, zugewiesen, soll)
    if (ids.length === 0) {
      myToastInfo('Es ist niemand verfügbar, der noch nicht eingeteilt ist')
      return
    }
    setVorschlagFuer({ eventId: messeId, ids })
  }

  const uebernehmen = async () => {
    const ids = vorschlag
    verwerfen()
    await onMehrereEinteilen(ids)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={event?.name ?? 'Einteilen'}
      extra={
        <Button type="primary" onClick={onClose}>
          Fertig
        </Button>
      }
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Typography.Text type="secondary">
          {anzahl} von {soll} eingeteilt
          {/* Der Sollwert wird in der Praxis meist genau getroffen (80 von
              122 Messen), manchmal ueberschritten (29) - beides ist kein
              Fehler und wird deshalb neutral gemeldet. */}
          {anzahl > soll && soll > 0 ? ' (mehr als vorgesehen)' : ''}
          {anzahl < soll ? ` · noch ${soll - anzahl} nötig` : ''}
        </Typography.Text>

        {/* Der Knopf füllt nur die offenen Plätze und speichert nichts -
            entschieden wird beim Übernehmen. Das ist der Unterschied zur
            entfernten Vollautomatik. */}
        {offen > 0 && vorschlag.length === 0 && (
          <Button
            block
            icon={<BulbOutlined aria-hidden />}
            onClick={vorschlagen}
          >
            Vorschlag für {offen} offene {offen === 1 ? 'Stelle' : 'Stellen'}
          </Button>
        )}

        {vorschlag.length > 0 && (
          <Alert
            type="info"
            showIcon
            message={`${vorschlag.length} vorgeschlagen${
              vorschlag.length < offen ? ` von ${offen} offenen Stellen` : ''
            }`}
            description="Noch nicht gespeichert. Einzelne lassen sich vorher antippen."
            action={
              <Space direction="vertical" size={4}>
                <Button size="small" type="primary" onClick={uebernehmen}>
                  Übernehmen
                </Button>
                <Button size="small" onClick={verwerfen}>
                  Verwerfen
                </Button>
              </Space>
            }
          />
        )}

        <Input.Search
          placeholder="Namen suchen"
          allowClear
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          aria-label="Ministranten nach Namen suchen"
        />

        {laedt ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : gruppen.length === 0 ? (
          <Empty description="Keine Ministranten gefunden" />
        ) : (
          gruppen.map((gruppe) => (
            <div key={gruppe.status}>
              <Typography.Text
                strong
                style={{
                  display: 'block',
                  marginBottom: 6,
                  color: token.colorTextSecondary,
                  fontSize: 13,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                {gruppe.meta.groupLabel} ({gruppe.eintraege.length})
              </Typography.Text>

              {gruppe.eintraege.map((option) => (
                <MiniZeile
                  key={option.id}
                  option={option}
                  aktiv={zugewiesen.includes(option.id)}
                  vorgeschlagen={vorschlag.includes(option.id)}
                  wunschNamen={(option.preferredWith ?? [])
                    .map((id) => nameNachId.get(id))
                    .filter(Boolean)}
                  onToggle={tippen}
                />
              ))}
            </div>
          ))
        )}
      </Space>
    </Sheet>
  )
}
