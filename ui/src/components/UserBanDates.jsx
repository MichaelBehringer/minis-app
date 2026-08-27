import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Calendar,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
  theme,
} from 'antd'
import { LockOutlined, UnlockOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { myToastError, myToastSuccess } from '../helper/ToastHelper'
import { doGetRequestAuth, doPatchRequestAuth } from '../helper/RequestHelper'
import KalenderKopf from './KalenderKopf'
import ZeitraumWahl from './ZeitraumWahl'

const iso = (d) => d.format('YYYY-MM-DD')

export default function UserBanDates({ userId, token }) {
  const { token: t } = theme.useToken()
  const [loading, setLoading] = useState(true)
  const [speichert, setSpeichert] = useState(false)
  const [banDates, setBanDates] = useState([])

  // 'einzeln': ein Tippen sperrt oder entsperrt einen Tag.
  // 'bereich': erstes Tippen setzt den Anfang, zweites das Ende.
  const [modus, setModus] = useState('einzeln')
  const [bereichStart, setBereichStart] = useState(null)

  const [zeitraum, setZeitraum] = useState(null)

  const nachladen = useCallback(async () => {
    const res = await doGetRequestAuth(`user/${userId}/ban`, token)
    setBanDates(res.data || [])
  }, [userId, token])

  useEffect(() => {
    async function laden() {
      setLoading(true)
      try {
        await nachladen()
      } catch {
        myToastError('Sperrtage konnten nicht geladen werden')
      } finally {
        setLoading(false)
      }
    }
    laden()
  }, [nachladen])

  // Die meisten Sperrtage liegen in der Vergangenheit - im Bestand rund vier
  // Fuenftel. Fuer die Bedienung zaehlt, was noch kommt.
  const kuenftige = useMemo(() => {
    const heute = iso(dayjs())
    return banDates.filter((d) => d >= heute).length
  }, [banDates])

  const gesperrt = useCallback((d) => banDates.includes(iso(d)), [banDates])

  // Einzelner Tag. Sofort anzeigen, damit das Antippen nicht auf den Server
  // wartet; bei einem Fehler zurueckdrehen.
  const einzelnUmschalten = async (wert) => {
    const datum = iso(wert)
    const war = banDates.includes(datum)

    const alt = banDates
    setBanDates(war ? banDates.filter((d) => d !== datum) : [...banDates, datum])

    try {
      await doPatchRequestAuth(
        `user/${userId}/ban`,
        { date: datum, add: !war },
        token
      )
    } catch {
      setBanDates(alt)
      myToastError('Änderung konnte nicht gespeichert werden')
    }
  }

  // Ganzer Zeitraum. Eine Anfrage, nicht eine pro Tag - der Server rechnet die
  // Tage aus den Grenzen aus.
  const zeitraumAnwenden = async (von, bis, sperren) => {
    setSpeichert(true)
    try {
      const res = await doPatchRequestAuth(
        `user/${userId}/ban/range`,
        { from: iso(von), to: iso(bis), add: sperren },
        token
      )
      const anzahl = res.data?.count ?? 0

      // Nach einer Massenaenderung frisch laden statt den neuen Stand zu
      // erraten - der Server weiss, welche Tage schon gesperrt waren.
      await nachladen()

      if (sperren) {
        myToastSuccess(
          anzahl === 0
            ? 'Diese Tage waren schon alle gesperrt'
            : `${anzahl} ${anzahl === 1 ? 'Tag' : 'Tage'} gesperrt`
        )
      } else {
        myToastSuccess(
          anzahl === 0
            ? 'In diesem Zeitraum war nichts gesperrt'
            : `${anzahl} ${anzahl === 1 ? 'Tag' : 'Tage'} freigegeben`
        )
      }
      return true
    } catch (fehler) {
      // Der Server nennt den Grund verwertbar, etwa "Zeitraum umfasst 400
      // Tage, erlaubt sind 366".
      myToastError(
        fehler?.response?.data?.error ??
          'Änderung konnte nicht gespeichert werden'
      )
      return false
    } finally {
      setSpeichert(false)
    }
  }

  const bereichTippen = async (wert) => {
    if (!bereichStart) {
      setBereichStart(wert)
      return
    }
    const von = bereichStart
    setBereichStart(null)
    await zeitraumAnwenden(von, wert, true)
  }

  const tagAntippen = (wert, info) => {
    if (info?.source !== 'date') return
    if (speichert) return
    if (modus === 'bereich') {
      bereichTippen(wert)
    } else {
      einzelnUmschalten(wert)
    }
  }

  const zelleRendern = (wert) => {
    const istStart = bereichStart && wert.isSame(bereichStart, 'day')

    if (istStart) {
      return (
        <div
          aria-label="Anfang des Bereichs"
          style={{
            height: 6,
            borderRadius: 3,
            margin: '2px 6px 0',
            background: t.colorPrimary,
          }}
        />
      )
    }

    if (!gesperrt(wert)) return null

    return (
      <div
        aria-label="gesperrt"
        style={{
          height: 6,
          borderRadius: 3,
          margin: '2px 6px 0',
          background: t.colorError,
        }}
      />
    )
  }

  if (loading) return <Spin />

  const zeitraumGewaehlt = Boolean(zeitraum?.[0] && zeitraum?.[1])
  const anzahlImZeitraum = zeitraumGewaehlt
    ? Math.abs(zeitraum[1].startOf('day').diff(zeitraum[0].startOf('day'), 'day')) + 1
    : 0

  return (
    <div>
      {/* Zeitraum. Der haeufige Fall ist "ich bin zwei Wochen weg" - den Tag
          fuer Tag anzutippen waere die eigentliche Arbeit. */}
      <Space direction="vertical" size={8} style={{ width: '100%', marginBottom: 14 }}>
        <Typography.Text strong>Zeitraum auf einmal</Typography.Text>
        <ZeitraumWahl value={zeitraum} onChange={setZeitraum} />
        <Space style={{ width: '100%' }} size={8}>
          <Button
            type="primary"
            icon={<LockOutlined aria-hidden />}
            disabled={!zeitraumGewaehlt}
            loading={speichert}
            onClick={async () => {
              if (await zeitraumAnwenden(zeitraum[0], zeitraum[1], true)) {
                setZeitraum(null)
              }
            }}
          >
            {zeitraumGewaehlt ? `${anzahlImZeitraum} Tage sperren` : 'Sperren'}
          </Button>
          <Button
            icon={<UnlockOutlined aria-hidden />}
            disabled={!zeitraumGewaehlt}
            loading={speichert}
            onClick={async () => {
              if (await zeitraumAnwenden(zeitraum[0], zeitraum[1], false)) {
                setZeitraum(null)
              }
            }}
          >
            Freigeben
          </Button>
        </Space>
      </Space>

      <Segmented
        block
        style={{ marginBottom: 10 }}
        value={modus}
        onChange={(v) => {
          setModus(v)
          // Ein halb gesetzter Bereich soll beim Wechsel nicht liegenbleiben.
          setBereichStart(null)
        }}
        options={[
          { label: 'Einzeln', value: 'einzeln' },
          { label: 'Bereich', value: 'bereich' },
        ]}
      />

      {modus === 'bereich' ? (
        bereichStart ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 10 }}
            message={`Anfang: ${bereichStart.format('DD.MM.YYYY')} — jetzt das Ende antippen`}
            action={
              <Button size="small" onClick={() => setBereichStart(null)}>
                Abbrechen
              </Button>
            }
          />
        ) : (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 10 }}
            message="Anfang antippen, dann das Ende. Alles dazwischen wird gesperrt."
          />
        )
      ) : (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 10 }}
          message="Tage antippen, an denen du nicht ministrieren kannst."
        />
      )}

      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
        <Tag color="red">{kuenftige}</Tag> künftige Sperrungen
        {banDates.length > kuenftige && (
          <span> · {banDates.length - kuenftige} in der Vergangenheit</span>
        )}
      </Typography.Text>

      <Calendar
        // Kompakte Form, eigene Kopfzeile: keine Jahresansicht, dafuer
        // Pfeile fuer den Monatswechsel. Startet im aktuellen Monat - bei bis
        // zu 339 Eintraegen pro Person darf der Einstieg nicht in der
        // Historie liegen.
        fullscreen={false}
        defaultValue={dayjs()}
        headerRender={({ value, onChange }) => (
          <KalenderKopf value={value} onChange={onChange} />
        )}
        cellRender={zelleRendern}
        onSelect={tagAntippen}
      />
    </div>
  )
}
