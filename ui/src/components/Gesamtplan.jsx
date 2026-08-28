import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Empty, Input, Space, Spin, Tag, Typography, theme } from 'antd'
import { ClockCircleOutlined, EnvironmentOutlined, TeamOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { doGetRequestAuth } from '../helper/RequestHelper'
import { myToastError } from '../helper/ToastHelper'
import ZeitraumWahl from './ZeitraumWahl'

// Der Gesamtplan, lesend, für jeden Angemeldeten.
//
// Bisher sah ein Ministrant nur seine eigenen Einsätze. Wer am Sonntag dran
// ist, stand nur im PDF - und das ist ab Rolle 2. Dabei hängt genau dieser Plan
// in der Kirche aus; geheim ist daran nichts. Nebeneffekt: Absprachen unter
// Ministranten ("tauschen wir?") werden überhaupt erst möglich.

function standardZeitraum() {
  return [dayjs(), dayjs().add(2, 'month')]
}

function uhrzeit(wert) {
  if (!wert) return ''
  const d = dayjs(wert, 'HH:mm:ss')
  return d.isValid() ? d.format('HH:mm') : String(wert).substring(0, 5)
}

function MesseZeile({ ev, userId }) {
  const { token } = theme.useToken()
  const namen = ev.assignedNames ?? []
  const binDabei = (ev.assignedUserIds ?? []).includes(userId)

  return (
    <Card
      size="small"
      style={{
        marginBottom: 8,
        // Eigene Einsätze hervorheben: in einer Liste von sechzig Messen ist
        // "bin ich dabei" die erste Frage, die man an sie hat.
        borderColor: binDabei ? token.colorPrimary : undefined,
      }}
    >
      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
          <Typography.Text strong>
            {dayjs(ev.dateBegin).format('dd, DD.MM.YYYY')}
          </Typography.Text>
          {binDabei && <Tag color="processing" style={{ marginInlineEnd: 0 }}>Mein Einsatz</Tag>}
        </Space>

        <Typography.Text>{ev.name}</Typography.Text>

        <Space size={14} wrap>
          <Typography.Text type="secondary">
            <ClockCircleOutlined aria-hidden /> {uhrzeit(ev.timeBegin)}
          </Typography.Text>
          <Typography.Text type="secondary">
            <EnvironmentOutlined aria-hidden /> {ev.location}
          </Typography.Text>
        </Space>

        <div>
          {namen.length === 0 ? (
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              <TeamOutlined aria-hidden /> Noch niemand eingeteilt
            </Typography.Text>
          ) : (
            namen.map((name) => (
              <Tag key={name} style={{ marginBottom: 4 }}>
                {name}
              </Tag>
            ))
          )}
        </div>
      </Space>
    </Card>
  )
}

export default function Gesamtplan({ token, userId }) {
  const [zeitraum, setZeitraum] = useState(standardZeitraum)
  const [plan, setPlan] = useState([])
  const [laedt, setLaedt] = useState(true)
  const [suche, setSuche] = useState('')

  const holePlan = useCallback(
    async (bereich) => {
      const von = dayjs(bereich[0]).format('YYYY-MM-DD')
      const bis = dayjs(bereich[1]).format('YYYY-MM-DD')
      const res = await doGetRequestAuth(`plan?from=${von}&to=${bis}`, token)
      return res.data || []
    },
    [token]
  )

  // Der Zustand wird erst nach dem await gesetzt, nicht synchron im Effekt.
  useEffect(() => {
    let abgebrochen = false

    holePlan(standardZeitraum())
      .then((daten) => {
        if (!abgebrochen) setPlan(daten)
      })
      .catch(() => {
        if (!abgebrochen) myToastError('Plan konnte nicht geladen werden')
      })
      .finally(() => {
        if (!abgebrochen) setLaedt(false)
      })

    return () => {
      abgebrochen = true
    }
  }, [holePlan])

  const zeitraumGewechselt = async (bereich) => {
    setZeitraum(bereich)
    if (!bereich || !bereich[0] || !bereich[1]) return

    setLaedt(true)
    try {
      setPlan(await holePlan(bereich))
    } catch (fehler) {
      myToastError(
        fehler?.response?.data?.error ?? 'Plan konnte nicht geladen werden'
      )
    } finally {
      setLaedt(false)
    }
  }

  const gefiltert = useMemo(() => {
    const s = suche.trim().toLowerCase()
    if (!s) return plan
    // Auch über die Namen: "wann ist Anna dran" ist die zweite Frage an einen
    // Gesamtplan.
    return plan.filter((ev) =>
      `${ev.name} ${ev.location} ${(ev.assignedNames ?? []).join(' ')}`
        .toLowerCase()
        .includes(s)
    )
  }, [plan, suche])

  return (
    <div>
      <Space direction="vertical" size={8} style={{ width: '100%', marginBottom: 12 }}>
        <ZeitraumWahl value={zeitraum} onChange={zeitraumGewechselt} />
        <Input.Search
          placeholder="Messe, Ort oder Name suchen"
          allowClear
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          aria-label="Im Plan suchen"
        />
      </Space>

      {laedt ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <Spin size="large" />
        </div>
      ) : gefiltert.length === 0 ? (
        <Empty description="Keine Messen in diesem Zeitraum" />
      ) : (
        gefiltert.map((ev) => <MesseZeile key={ev.id} ev={ev} userId={userId} />)
      )}
    </div>
  )
}
