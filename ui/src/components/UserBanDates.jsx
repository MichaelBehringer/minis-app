import { useEffect, useMemo, useState } from 'react'
import { Alert, Calendar, Spin, Tag, Typography, theme } from 'antd'
import dayjs from 'dayjs'
import { myToastError, myToastSuccess } from '../helper/ToastHelper'
import { doGetRequestAuth, doPatchRequestAuth } from '../helper/RequestHelper'

export default function UserBanDates({ userId, token }) {
  const { token: t } = theme.useToken()
  const [loading, setLoading] = useState(true)
  const [banDates, setBanDates] = useState([])

  useEffect(() => {
    async function laden() {
      setLoading(true)
      try {
        const res = await doGetRequestAuth(`user/${userId}/ban`, token)
        setBanDates(res.data || [])
      } catch {
        myToastError('Sperrtage konnten nicht geladen werden')
      } finally {
        setLoading(false)
      }
    }
    laden()
  }, [userId, token])

  // Die meisten Sperrtage liegen in der Vergangenheit - im Bestand rund vier
  // Fuenftel. Fuer die Bedienung zaehlt, was noch kommt.
  const kuenftige = useMemo(() => {
    const heute = dayjs().format('YYYY-MM-DD')
    return banDates.filter((d) => d >= heute).length
  }, [banDates])

  const umschalten = async (wert) => {
    const datum = wert.format('YYYY-MM-DD')
    const gesperrt = banDates.includes(datum)

    const alt = banDates
    const neu = gesperrt
      ? banDates.filter((d) => d !== datum)
      : [...banDates, datum]

    // Sofort anzeigen, damit das Antippen nicht auf den Server wartet.
    setBanDates(neu)

    try {
      await doPatchRequestAuth(
        `user/${userId}/ban`,
        { date: datum, add: !gesperrt },
        token
      )
      myToastSuccess(gesperrt ? 'Sperrung entfernt' : 'Tag gesperrt')
    } catch {
      // Vorher blieb die Anzeige auf dem neuen Stand, auch wenn der Server
      // nichts gespeichert hat.
      setBanDates(alt)
      myToastError('Änderung konnte nicht gespeichert werden')
    }
  }

  const zelleRendern = (wert) => {
    if (!banDates.includes(wert.format('YYYY-MM-DD'))) return null
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

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Tage antippen, an denen du nicht ministrieren kannst."
      />

      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        <Tag color="red">{kuenftige}</Tag> künftige Sperrungen
        {banDates.length > kuenftige && (
          <span> · {banDates.length - kuenftige} in der Vergangenheit</span>
        )}
      </Typography.Text>

      <Calendar
        // Kompakte Form und im aktuellen Monat beginnen. Bei bis zu 339
        // Eintraegen pro Person darf der Einstieg nicht irgendwo in der
        // Historie liegen.
        fullscreen={false}
        defaultValue={dayjs()}
        cellRender={zelleRendern}
        onSelect={(wert, info) => {
          if (info?.source === 'date') umschalten(wert)
        }}
      />
    </div>
  )
}
