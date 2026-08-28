import { useEffect, useState } from 'react'
import { Alert, Button, Space, Spin } from 'antd'
import { CheckOutlined } from '@ant-design/icons'
import { myToastError, myToastSuccess } from '../helper/ToastHelper'
import { doGetRequestAuth, doPatchRequestAuth } from '../helper/RequestHelper'
import { WOCHENTAGE } from '../helper/einteilung'

export default function UserPreferredWeekdays({ userId, token }) {
  const [loading, setLoading] = useState(true)
  const [gewaehlt, setGewaehlt] = useState([])

  useEffect(() => {
    async function laden() {
      setLoading(true)
      try {
        const res = await doGetRequestAuth(`user/${userId}/weekday`, token)
        setGewaehlt(res.data || [])
      } catch {
        myToastError('Wochentage konnten nicht geladen werden')
      } finally {
        setLoading(false)
      }
    }
    laden()
  }, [userId, token])

  const umschalten = async (wd) => {
    const aktiv = gewaehlt.includes(wd)
    const alt = gewaehlt
    const neu = aktiv ? gewaehlt.filter((d) => d !== wd) : [...gewaehlt, wd]

    setGewaehlt(neu)

    try {
      await doPatchRequestAuth(
        `user/${userId}/weekday`,
        { weekday: wd, add: !aktiv },
        token
      )
      myToastSuccess('Änderung gespeichert')
    } catch {
      setGewaehlt(alt)
      myToastError('Änderung konnte nicht gespeichert werden')
    }
  }

  if (loading) return <Spin />

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Wochentage, an denen du eingeteilt werden möchtest."
      />

      {/* Volle Breite statt einer 140px-Spalte in der Mitte: die Knoepfe sind
          die einzige Aktion in diesem Reiter und duerfen die Flaeche nutzen.
          Farben ueber die antd-Typen, damit der Dunkelmodus mitgeht - die
          vorherige CSS-Datei hatte #1677ff und #d9d9d9 fest verdrahtet. */}
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {WOCHENTAGE.map((d) => {
          const aktiv = gewaehlt.includes(d.key)
          return (
            <Button
              key={d.key}
              block
              type={aktiv ? 'primary' : 'default'}
              icon={aktiv ? <CheckOutlined aria-hidden /> : null}
              onClick={() => umschalten(d.key)}
              aria-pressed={aktiv}
              style={{ justifyContent: 'flex-start' }}
            >
              {d.label}
            </Button>
          )
        })}
      </Space>
    </div>
  )
}
