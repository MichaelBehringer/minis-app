import { useEffect, useState } from 'react'
import { Spin, Tabs } from 'antd'
import { doGetRequestAuth, doPatchRequestAuth } from '../helper/RequestHelper'
import { myToastError, myToastSuccess } from '../helper/ToastHelper'
import { istPlaner as istPlanerRolle } from '../navigation'
import Sheet from './Sheet'
import useUserForm from '../hooks/useUserForm'
import UserGeneralForm from './UserGeneralForm'
import UserPasswordModal from './UserPasswordModal'
import UserBanDates from './UserBanDates'
import UserPreferredWeekdays from './UserPreferredWeekdays'
import UserPreferredPartners from './UserPreferredPartners'

// Bearbeiten eines Ministranten - eigenes Konto oder, als Planer, ein fremdes.
//
// Liegt jetzt in einem Sheet ueber die ganze Hoehe statt in einem Modal: vier
// Reiter mit einem Kalender darin ergaben am Handy ein Fenster im Fenster mit
// zwei Scrollbereichen.
export default function UserEditModal({
  userId,
  token,
  open,
  onClose,
  onSaved,
  editorRoleId,
  eigenesKonto,
}) {
  const [loading, setLoading] = useState(true)
  const [speichert, setSpeichert] = useState(false)
  const [user, setUser] = useState()
  const [rollen, setRollen] = useState([])
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [form] = useUserForm()

  const istPlaner = istPlanerRolle(editorRoleId)

  useEffect(() => {
    if (!open) return

    async function laden() {
      setLoading(true)
      try {
        const anfragen = [doGetRequestAuth(`user/${userId}`, token)]
        // /role ist erst ab Rolle 2 lesbar. Ein Ministrant sieht seine Rolle
        // ohnehin nur als gesperrtes Feld.
        if (istPlaner) anfragen.push(doGetRequestAuth('role', token))

        const [res, rollenRes] = await Promise.all(anfragen)
        setUser(res.data)
        setRollen(rollenRes?.data ?? [])

        form.setFieldsValue({
          firstname: res.data.firstname,
          lastname: res.data.lastname,
          username: res.data.username,
          roleId: res.data.roleId,
          active: res.data.active === 1,
          incense: res.data.incense === 1,
        })
      } catch {
        myToastError('Daten konnten nicht geladen werden')
      } finally {
        setLoading(false)
      }
    }

    laden()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId])

  async function handleSave() {
    let werte
    try {
      werte = await form.validateFields()
    } catch {
      return
    }

    setSpeichert(true)
    try {
      await doPatchRequestAuth(
        `user/${userId}`,
        {
          firstname: werte.firstname,
          lastname: werte.lastname,
          username: werte.username,
          roleId: werte.roleId,
          active: werte.active ? 1 : 0,
          incense: werte.incense ? 1 : 0,
        },
        token
      )
      myToastSuccess('Änderungen gespeichert')
      if (onSaved) onSaved()
    } catch {
      // Vorher ohne Fehlerzweig: eine nicht gespeicherte Aenderung meldete
      // trotzdem "Änderungen gespeichert".
      myToastError('Änderungen konnten nicht gespeichert werden')
    } finally {
      setSpeichert(false)
    }
  }

  const titel = eigenesKonto
    ? 'Meine Einstellungen'
    : user
      ? `${user.firstname} ${user.lastname}`
      : 'Ministrant bearbeiten'

  return (
    <>
      <Sheet open={open} onClose={onClose} title={titel} width={560}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Spin size="large" />
          </div>
        ) : (
          <Tabs
            items={[
              {
                key: 'general',
                label: 'Allgemein',
                children: (
                  <UserGeneralForm
                    form={form}
                    handleSave={handleSave}
                    onOpenPassword={() => setPasswordModalOpen(true)}
                    rollen={rollen}
                    istPlaner={istPlaner}
                    speichert={speichert}
                  />
                ),
              },
              {
                key: 'blockdates',
                label: 'Sperrtage',
                children: <UserBanDates userId={userId} token={token} />,
              },
              {
                key: 'weekdays',
                label: 'Wochentage',
                children: <UserPreferredWeekdays userId={userId} token={token} />,
              },
              {
                key: 'partners',
                label: 'Wunschpartner',
                children: <UserPreferredPartners userId={userId} token={token} />,
              },
            ]}
          />
        )}
      </Sheet>

      <UserPasswordModal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        userId={userId}
        token={token}
        onSaved={onSaved}
      />
    </>
  )
}
