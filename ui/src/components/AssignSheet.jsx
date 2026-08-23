import { useMemo } from 'react'
import { Button, Empty, Input, Space, Spin, Tag, Typography, theme } from 'antd'
import { CheckOutlined, HeartOutlined } from '@ant-design/icons'
import { useState } from 'react'
import {
  abstandText,
  gruppiereOptionen,
  metaFuer,
  nameVon,
  naechsterText,
} from '../helper/einteilung'
import Sheet from './Sheet'

// Eine Zeile pro Ministrant.
//
// Bewusst ein Knopf ueber die ganze Breite mit mindestens 48px Hoehe: das
// ersetzt ein Mehrfach-Select mit gruppierten Optionen, das am Handy in einer
// schmalen Kartenspalte praktisch nicht bedienbar war.
function MiniZeile({ option, aktiv, wunschNamen, onToggle }) {
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
        border: `1px solid ${aktiv ? token.colorPrimary : token.colorBorderSecondary}`,
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

      <Tag color={meta.tagColor} style={{ marginInlineEnd: 0, flexShrink: 0 }}>
        {meta.tagText}
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
}) {
  const { token } = theme.useToken()
  const [suche, setSuche] = useState('')

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
          {/* Der Sollwert wird in der Praxis meist ueberschritten - das ist
              kein Fehler und wird deshalb neutral gemeldet. */}
          {anzahl > soll && soll > 0 ? ' (mehr als vorgesehen)' : ''}
          {anzahl < soll ? ` · noch ${soll - anzahl} nötig` : ''}
        </Typography.Text>

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
                  wunschNamen={(option.preferredWith ?? [])
                    .map((id) => nameNachId.get(id))
                    .filter(Boolean)}
                  onToggle={onToggle}
                />
              ))}
            </div>
          ))
        )}
      </Space>
    </Sheet>
  )
}
