import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Calendar,
  Card,
  Empty,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
  theme,
} from 'antd'
import {
  ClockCircleOutlined,
  EnvironmentOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { doGetRequestAuth } from '../helper/RequestHelper'
import { myToastError } from '../helper/ToastHelper'
import useIsMobile from '../hooks/useIsMobile'
import Sheet from './Sheet'

// Uhrzeit aus dem Backend: "18:30:00".
//
// Das Formatargument wirkt nur, weil AppProviders das Plugin customParseFormat
// laedt - ohne das ergab dayjs("18:30:00", "HH:mm:ss") Invalid Date, und genau
// das stand hier vorher auf dem Bildschirm.
function uhrzeit(wert) {
  if (!wert) return ''
  const d = dayjs(wert, 'HH:mm:ss')
  return d.isValid() ? d.format('HH:mm') : String(wert).substring(0, 5)
}

function tagText(dateBegin) {
  const d = dayjs(dateBegin)
  if (!d.isValid()) return dateBegin

  const heute = dayjs().startOf('day')
  const tage = d.startOf('day').diff(heute, 'day')

  if (tage === 0) return 'Heute'
  if (tage === 1) return 'Morgen'
  return d.format('dddd, DD.MM.YYYY')
}

// Karte eines Einsatzes. Hervorgehoben, wenn es der naechste ist - die
// eigentliche Frage auf dieser Seite ist "wann bin ich das naechste Mal dran".
function EinsatzKarte({ ev, hervorgehoben, eigenerName }) {
  const { token } = theme.useToken()

  // Die eigene Person aus der Liste nehmen - dass man selbst eingeteilt ist,
  // ist der Grund, warum die Karte hier steht.
  const andere = (ev.assignedNames ?? []).filter((n) => n !== eigenerName)

  return (
    <Card
      size="small"
      style={{
        marginBottom: 12,
        borderColor: hervorgehoben ? token.colorPrimary : undefined,
        borderWidth: hervorgehoben ? 2 : 1,
      }}
    >
      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        <Space align="center" wrap size={8}>
          <Typography.Text strong style={{ fontSize: 16 }}>
            {tagText(ev.dateBegin)}
          </Typography.Text>
          {hervorgehoben && <Tag color="processing">Als nächstes</Tag>}
        </Space>

        <Typography.Text style={{ fontSize: 15 }}>{ev.name}</Typography.Text>

        <Space size={16} wrap>
          <Typography.Text type="secondary">
            <ClockCircleOutlined aria-hidden /> {uhrzeit(ev.timeBegin)} Uhr
          </Typography.Text>
          <Typography.Text type="secondary">
            <EnvironmentOutlined aria-hidden /> {ev.location}
          </Typography.Text>
        </Space>

        {/* Wer sonst eingeteilt ist. Nach "wann bin ich dran" die zweite
            Frage - und bisher nirgends in der Anwendung zu sehen. */}
        {andere.length > 0 && (
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              <TeamOutlined aria-hidden /> Mit dabei
            </Typography.Text>
            <div style={{ marginTop: 4 }}>
              {andere.map((n) => (
                <Tag key={n} style={{ marginBottom: 4 }}>
                  {n}
                </Tag>
              ))}
            </div>
          </div>
        )}
      </Space>
    </Card>
  )
}

export default function Home({ userId, token }) {
  const [events, setEvents] = useState([])
  const [eigenerName, setEigenerName] = useState('')
  const [loading, setLoading] = useState(true)
  const [ansicht, setAnsicht] = useState('liste')
  const [zeigeVergangene, setZeigeVergangene] = useState(false)
  const [tagesEvents, setTagesEvents] = useState([])
  const [sheetOffen, setSheetOffen] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    async function laden() {
      setLoading(true)
      try {
        const [person, res] = await Promise.all([
          doGetRequestAuth(`user/${userId}`, token),
          doGetRequestAuth(`events/${userId}`, token),
        ])
        setEigenerName(
          `${person.data?.firstname ?? ''} ${person.data?.lastname ?? ''}`.trim()
        )
        setEvents(res.data || [])
      } catch {
        // Vorher stand hier nur ein finally: schlug das Laden fehl, zeigte die
        // Seite eine leere Liste, als gaebe es keine Einsaetze.
        myToastError('Einsätze konnten nicht geladen werden')
      } finally {
        setLoading(false)
      }
    }
    laden()
  }, [userId, token])

  const { kommende, vergangene } = useMemo(() => {
    const heute = dayjs().startOf('day')
    const sortiert = [...events].sort((a, b) =>
      String(a.dateBegin).localeCompare(String(b.dateBegin))
    )
    return {
      kommende: sortiert.filter((e) => !dayjs(e.dateBegin).isBefore(heute)),
      // Die jüngste Vergangenheit zuerst.
      vergangene: sortiert
        .filter((e) => dayjs(e.dateBegin).isBefore(heute))
        .reverse(),
    }
  }, [events])

  const eventsAmTag = (wert) => {
    const datum = wert.format('YYYY-MM-DD')
    return events.filter((e) => e.dateBegin === datum)
  }

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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
        <Spin size="large" />
      </div>
    )
  }

  const liste = zeigeVergangene ? vergangene : kommende

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <Segmented
        block
        style={{ marginBottom: 12 }}
        value={ansicht}
        onChange={setAnsicht}
        options={[
          { label: 'Liste', value: 'liste' },
          { label: 'Kalender', value: 'kalender' },
        ]}
      />

      {ansicht === 'liste' && (
        <>
          <Segmented
            block
            size="small"
            style={{ marginBottom: 12 }}
            value={zeigeVergangene ? 'vergangen' : 'kommend'}
            onChange={(v) => setZeigeVergangene(v === 'vergangen')}
            options={[
              { label: `Kommende (${kommende.length})`, value: 'kommend' },
              { label: `Vergangene (${vergangene.length})`, value: 'vergangen' },
            ]}
          />

          {liste.length === 0 ? (
            <Empty
              description={
                zeigeVergangene
                  ? 'Keine vergangenen Einsätze'
                  : 'Du bist derzeit zu keiner Messe eingeteilt'
              }
            />
          ) : (
            liste.map((ev, i) => (
              <EinsatzKarte
                key={ev.id}
                ev={ev}
                eigenerName={eigenerName}
                hervorgehoben={!zeigeVergangene && i === 0}
              />
            ))
          )}
        </>
      )}

      {ansicht === 'kalender' && (
        <Card size="small" styles={{ body: { padding: isMobile ? 4 : 12 } }}>
          <Calendar
            // Am Handy die kompakte Form: ein Monatsraster in voller Breite
            // ist auf 390px gequetscht.
            fullscreen={!isMobile}
            cellRender={zelleRendern}
            onSelect={(datum, info) => {
              if (info?.source !== 'date') return
              const treffer = eventsAmTag(datum)
              if (treffer.length > 0) {
                setTagesEvents(treffer)
                setSheetOffen(true)
              }
            }}
          />
        </Card>
      )}

      <Sheet
        open={sheetOffen}
        onClose={() => setSheetOffen(false)}
        title={
          tagesEvents.length > 0
            ? dayjs(tagesEvents[0].dateBegin).format('dddd, DD.MM.YYYY')
            : 'Einsätze'
        }
      >
        {tagesEvents.map((ev) => (
          <EinsatzKarte key={ev.id} ev={ev} eigenerName={eigenerName} />
        ))}
      </Sheet>
    </div>
  )
}
