import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Col,
  Empty,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import {
  ClockCircleOutlined,
  DownloadOutlined,
  EditOutlined,
  EnvironmentOutlined,
  PlusOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  doDeleteRequestAuth,
  doGetRequestAuth,
  doGetRequestBlobAuth,
  doPatchRequestAuth,
  doPutRequestAuth,
} from '../helper/RequestHelper'
import { myToastError, myToastInfo, myToastSuccess } from '../helper/ToastHelper'
import useIsMobile from '../hooks/useIsMobile'
import { nameVon } from '../helper/einteilung'
import AssignSheet from './AssignSheet'
import MesseSheet from './MesseSheet'
import ZeitraumWahl from './ZeitraumWahl'

// Beim Öffnen nicht mit leerem Bildschirm anfangen: von heute an zwei Monate
// nach vorn ist der Zeitraum, in dem geplant wird.
function standardZeitraum() {
  return [dayjs().startOf('day'), dayjs().add(2, 'month').endOf('day')]
}

function uhrzeit(wert) {
  if (!wert) return ''
  const d = dayjs(wert, 'HH:mm:ss')
  return d.isValid() ? d.format('HH:mm') : String(wert).substring(0, 5)
}

// Karte einer Messe mit dem Einstieg ins Einteilen.
function MesseKarte({ ev, namenNachId, onEinteilen, onBearbeiten }) {
  const zugewiesen = ev.assignedUserIds ?? []
  const soll = ev.minimalUser ?? 0
  const anzahl = zugewiesen.length

  // minimalUser ist ein Sollwert, kein Limit - in den Daten wird er
  // ueberwiegend ueberschritten. Deshalb drei neutrale Zustaende statt einer
  // Fehlermeldung.
  const farbe =
    anzahl === 0 ? 'default' : anzahl < soll ? 'orange' : 'green'

  return (
    <Card
      size="small"
      style={{ height: '100%' }}
      title={
        <span style={{ whiteSpace: 'normal', lineHeight: 1.35 }}>{ev.name}</span>
      }
      extra={
        <Space size={4}>
          <Tag color={farbe} style={{ marginInlineEnd: 0 }}>
            {anzahl}/{soll}
          </Tag>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined aria-hidden />}
            onClick={() => onBearbeiten(ev)}
            aria-label={`${ev.name} am ${dayjs(ev.dateBegin).format('DD.MM.YYYY')} bearbeiten`}
          />
        </Space>
      }
    >
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Typography.Text strong>
          {dayjs(ev.dateBegin).format('dd, DD.MM.YYYY')}
        </Typography.Text>

        <Space size={14} wrap>
          <Typography.Text type="secondary">
            <ClockCircleOutlined aria-hidden /> {uhrzeit(ev.timeBegin)}
          </Typography.Text>
          <Typography.Text type="secondary">
            <EnvironmentOutlined aria-hidden /> {ev.location}
          </Typography.Text>
        </Space>

        <div style={{ minHeight: 28 }}>
          {anzahl === 0 ? (
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              <TeamOutlined aria-hidden /> Noch niemand eingeteilt
            </Typography.Text>
          ) : (
            zugewiesen.map((id) => (
              <Tag key={id} style={{ marginBottom: 4 }}>
                {namenNachId.get(id) ?? `#${id}`}
              </Tag>
            ))
          )}
        </div>

        <Button
          block
          type={anzahl < soll ? 'primary' : 'default'}
          onClick={() => onEinteilen(ev)}
          style={{ marginTop: 4 }}
        >
          Einteilen
        </Button>
      </Space>
    </Card>
  )
}

export default function Einteilung({ token }) {
  const isMobile = useIsMobile()

  const [zeitraum, setZeitraum] = useState(standardZeitraum)
  const [events, setEvents] = useState([])
  // Startet auf true: der erste Ladevorgang laeuft schon, wenn der Bildschirm
  // erscheint.
  const [laedtEvents, setLaedtEvents] = useState(true)
  const [locationList, setLocationList] = useState([])
  const [namensvorschlaege, setNamensvorschlaege] = useState([])
  const [alleMinis, setAlleMinis] = useState([])

  const [neueMesseOffen, setNeueMesseOffen] = useState(false)
  // Die Messe, die bearbeitet wird - null heisst "neu anlegen".
  const [bearbeiteteMesse, setBearbeiteteMesse] = useState(null)

  const [aktivesEvent, setAktivesEvent] = useState(null)
  const [optionen, setOptionen] = useState([])
  const [laedtOptionen, setLaedtOptionen] = useState(false)

  // Namen zu den zugewiesenen Ids. Die Karten zeigen Namen, das Backend
  // liefert bei den Messen nur Ids.
  const namenNachId = useMemo(() => {
    const map = new Map()
    for (const u of alleMinis) map.set(u.id, nameVon(u))
    return map
  }, [alleMinis])

  // Nur holen, ohne Zustand zu setzen - damit derselbe Code aus einem
  // Effekt und aus einem Bedienschritt heraus benutzt werden kann.
  const holeEvents = useCallback(
    async (bereich) => {
      const von = dayjs(bereich[0]).format('YYYY-MM-DD')
      const bis = dayjs(bereich[1]).format('YYYY-MM-DD')
      const res = await doGetRequestAuth(`events?from=${von}&to=${bis}`, token)
      return res.data || []
    },
    [token]
  )

  // Fuer Bedienschritte: Zeitraum gewechselt, Messe angelegt.
  const ladeEvents = useCallback(
    async (bereich) => {
      if (!bereich || !bereich[0] || !bereich[1]) return
      setLaedtEvents(true)
      try {
        setEvents(await holeEvents(bereich))
      } catch {
        myToastError('Messen konnten nicht geladen werden')
      } finally {
        setLaedtEvents(false)
      }
    },
    [holeEvents]
  )

  useEffect(() => {
    doGetRequestAuth('user', token)
      .then((res) => setAlleMinis(res.data || []))
      .catch(() => myToastError('Ministrantenliste konnte nicht geladen werden'))
    doGetRequestAuth('location', token)
      .then((res) => setLocationList(res.data || []))
      .catch(() => myToastError('Orte konnten nicht geladen werden'))
    // Die bisher verwendeten Messenamen als Vorschlagsliste. Ein Fehler ist
    // hier folgenlos - dann gibt es eben keine Vorschläge.
    doGetRequestAuth('eventNames', token)
      .then((res) => setNamensvorschlaege(res.data || []))
      .catch(() => {})
  }, [token])

  // Erstes Laden. Der Zustand wird erst nach dem await gesetzt, nicht
  // synchron im Effekt - sonst folgt auf das Rendern sofort das naechste.
  // Das Abbruch-Flag verhindert ein Setzen nach dem Ausblenden.
  useEffect(() => {
    let abgebrochen = false

    holeEvents(standardZeitraum())
      .then((daten) => {
        if (!abgebrochen) setEvents(daten)
      })
      .catch(() => {
        if (!abgebrochen) myToastError('Messen konnten nicht geladen werden')
      })
      .finally(() => {
        if (!abgebrochen) setLaedtEvents(false)
      })

    return () => {
      abgebrochen = true
    }
  }, [holeEvents])

  const oeffneEinteilen = async (ev) => {
    setAktivesEvent(ev)
    setOptionen([])
    setLaedtOptionen(true)
    try {
      const res = await doGetRequestAuth(
        `event/${ev.id}/assignment-options`,
        token
      )
      setOptionen(res.data.options || [])
    } catch {
      myToastError('Verfügbarkeit konnte nicht geladen werden')
    } finally {
      setLaedtOptionen(false)
    }
  }

  const zugewiesenAktiv = aktivesEvent
    ? events.find((e) => e.id === aktivesEvent.id)?.assignedUserIds ?? []
    : []

  const setzeZuweisung = (eventId, ids) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, assignedUserIds: ids } : e))
    )
  }

  // Ein Tippen ist genau eine Änderung. Vorher wurde die ganze Liste des
  // Mehrfach-Selects verglichen und daraus ein Stapel Anfragen abgeleitet.
  const umschalten = async (userId) => {
    if (!aktivesEvent) return

    const alt = zugewiesenAktiv
    const hinzu = !alt.includes(userId)
    const neu = hinzu ? [...alt, userId] : alt.filter((id) => id !== userId)

    // Sofort anzeigen, damit das Antippen nicht auf den Server wartet.
    setzeZuweisung(aktivesEvent.id, neu)

    try {
      await doPatchRequestAuth(
        `events/${aktivesEvent.id}/assign/${hinzu ? 'add' : 'remove'}`,
        { userId },
        token
      )
    } catch {
      setzeZuweisung(aktivesEvent.id, alt)
      myToastError('Änderung konnte nicht gespeichert werden')
    }
  }

  // Mehrere auf einmal - fuer den uebernommenen Vorschlag.
  //
  // Eine eigene Funktion und nicht sechsmal umschalten(): das liest jedes Mal
  // den Zustand von vorher, weil setState asynchron ist. Sechs Aufrufe in einem
  // Durchgang wuerden also fuenf Anzeigen wieder verwerfen, obwohl alle sechs
  // Anfragen beim Server ankommen.
  const mehrereEinteilen = async (userIds) => {
    if (!aktivesEvent || userIds.length === 0) return

    const alt = zugewiesenAktiv
    const neu = [...alt, ...userIds.filter((id) => !alt.includes(id))]
    setzeZuweisung(aktivesEvent.id, neu)

    try {
      // Nacheinander, nicht parallel: es sind hoechstens ein paar Anfragen, und
      // bei einem Fehler ist nachvollziehbar, wo es aufgehoert hat.
      for (const userId of userIds) {
        await doPatchRequestAuth(
          `events/${aktivesEvent.id}/assign/add`,
          { userId },
          token
        )
      }
      myToastSuccess(
        `${userIds.length} ${userIds.length === 1 ? 'Ministrant' : 'Ministranten'} eingeteilt`
      )
    } catch {
      // Zurueckdrehen genuegt hier nicht: ein Teil kann schon gespeichert sein.
      // Deshalb frisch laden, damit die Anzeige dem Stand der Datenbank
      // entspricht.
      myToastError('Vorschlag konnte nicht vollständig gespeichert werden')
      await ladeEvents(zeitraum)
    }
  }

  const speichereMessen = async (neueEvents) => {
    try {
      if (neueEvents.length === 1) {
        await doPutRequestAuth('event', neueEvents[0], token)
        myToastSuccess('Messe angelegt')
      } else {
        await doPutRequestAuth('events', { events: neueEvents }, token)
        myToastSuccess(`${neueEvents.length} Messen angelegt`)
      }
      await ladeEvents(zeitraum)
      return true
    } catch {
      myToastError('Messen konnten nicht angelegt werden')
      return false
    }
  }

  const aendereMesse = async (id, daten) => {
    try {
      await doPatchRequestAuth(`event/${id}`, daten, token)
      myToastSuccess('Messe gespeichert')
      await ladeEvents(zeitraum)
      return true
    } catch (fehler) {
      myToastError(
        fehler?.response?.data?.error ?? 'Messe konnte nicht gespeichert werden'
      )
      return false
    }
  }

  const loescheMesse = async (id) => {
    try {
      const res = await doDeleteRequestAuth(`event/${id}`, undefined, token)
      const entfernt = res.data?.removedAssignments ?? 0
      myToastSuccess(
        entfernt === 0
          ? 'Messe gelöscht'
          : `Messe gelöscht, ${entfernt} ${entfernt === 1 ? 'Einteilung' : 'Einteilungen'} mit entfernt`
      )
      await ladeEvents(zeitraum)
      return true
    } catch (fehler) {
      myToastError(
        fehler?.response?.data?.error ?? 'Messe konnte nicht gelöscht werden'
      )
      return false
    }
  }

  const pdfHerunterladen = async () => {
    if (!zeitraum || !zeitraum[0] || !zeitraum[1]) {
      myToastInfo('Bitte zuerst einen Zeitraum auswählen')
      return
    }

    const von = dayjs(zeitraum[0]).format('YYYY-MM-DD')
    const bis = dayjs(zeitraum[1]).format('YYYY-MM-DD')

    try {
      // Als Blob mit Token, nicht per window.open: der Endpunkt ist nicht mehr
      // oeffentlich, und ein window.open kann keinen Header setzen. Der
      // bisherige relative Pfad zeigte ohnehin nicht auf das Backend - nginx
      // kennt nur / und /server/, der Knopf lieferte die index.html.
      const res = await doGetRequestBlobAuth(
        `pdf/events?from=${von}&to=${bis}`,
        token
      )

      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `Miniplan_${von}_bis_${bis}.pdf`
      a.click()
      // Ohne das Freigeben bleibt der Blob bis zum Neuladen im Speicher.
      URL.revokeObjectURL(url)
    } catch {
      myToastError('Plan konnte nicht erzeugt werden')
    }
  }

  return (
    <div>
      <Space
        direction={isMobile ? 'vertical' : 'horizontal'}
        style={{ width: '100%', marginBottom: 16 }}
        size={8}
      >
        <ZeitraumWahl
          style={{ width: isMobile ? '100%' : 260 }}
          value={zeitraum}
          allowClear={false}
          onChange={(v) => {
            setZeitraum(v)
            ladeEvents(v)
          }}
        />

        <Space style={{ width: isMobile ? '100%' : undefined }} size={8}>
          <Button
            type="primary"
            icon={<PlusOutlined aria-hidden />}
            onClick={() => setNeueMesseOffen(true)}
            block={isMobile}
          >
            Messe anlegen
          </Button>
          <Button
            icon={<DownloadOutlined aria-hidden />}
            onClick={pdfHerunterladen}
            block={isMobile}
          >
            Plan als PDF
          </Button>
        </Space>
      </Space>

      {laedtEvents ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <Spin size="large" />
        </div>
      ) : events.length === 0 ? (
        <Empty description="In diesem Zeitraum gibt es keine Messen" />
      ) : (
        <Row gutter={[12, 12]}>
          {events.map((ev) => (
            // Am Handy eine Karte pro Reihe. Vorher gingen bei xl sechs
            // Karten in eine Reihe, jede davon mit einem Mehrfach-Select
            // darin.
            <Col xs={24} sm={12} lg={8} xxl={6} key={ev.id}>
              <MesseKarte
                onBearbeiten={(m) => {
                  setBearbeiteteMesse(m)
                  setNeueMesseOffen(true)
                }}
                ev={ev}
                namenNachId={namenNachId}
                onEinteilen={oeffneEinteilen}
              />
            </Col>
          ))}
        </Row>
      )}

      <MesseSheet
        open={neueMesseOffen}
        onClose={() => {
          setNeueMesseOffen(false)
          setBearbeiteteMesse(null)
        }}
        locationList={locationList}
        namensvorschlaege={namensvorschlaege}
        messe={bearbeiteteMesse}
        onSpeichern={speichereMessen}
        onAendern={aendereMesse}
        onLoeschen={loescheMesse}
      />

      <AssignSheet
        open={aktivesEvent !== null}
        onClose={() => setAktivesEvent(null)}
        event={aktivesEvent}
        optionen={optionen}
        laedt={laedtOptionen}
        zugewiesen={zugewiesenAktiv}
        onToggle={umschalten}
        onMehrereEinteilen={mehrereEinteilen}
      />
    </div>
  )
}
