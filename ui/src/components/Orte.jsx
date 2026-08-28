import { useCallback, useEffect, useState } from 'react'
import {
  App as AntApp,
  Button,
  Empty,
  Input,
  List,
  Space,
  Spin,
  Typography,
} from 'antd'
import { CheckOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import {
  doDeleteRequestAuth,
  doGetRequestAuth,
  doPatchRequestAuth,
  doPostRequestAuth,
} from '../helper/RequestHelper'
import { myToastError, myToastSuccess } from '../helper/ToastHelper'

// Die Kirchen und Kapellen, in denen Messen stattfinden.
//
// Bisher waren sie nur lesbar - es gab keine Route zum Anlegen oder Ändern. In
// den Daten heißt einer davon ' ' (ein Leerzeichen) und erscheint in der
// Auswahl beim Anlegen einer Messe als leerer Eintrag; zwei Messen hängen
// daran. Ohne diese Seite ist das nur in der Datenbank zu beheben.
export default function Orte({ token }) {
  const { modal } = AntApp.useApp()
  const [orte, setOrte] = useState([])
  const [laedt, setLaedt] = useState(true)
  const [neuerName, setNeuerName] = useState('')
  // Id des Ortes, der gerade umbenannt wird, und der Text dazu.
  const [bearbeiteId, setBearbeiteId] = useState(null)
  const [bearbeiteName, setBearbeiteName] = useState('')
  const [arbeitet, setArbeitet] = useState(false)

  const laden = useCallback(async () => {
    const res = await doGetRequestAuth('location', token)
    setOrte(res.data || [])
  }, [token])

  useEffect(() => {
    async function ersteAnzeige() {
      setLaedt(true)
      try {
        await laden()
      } catch {
        myToastError('Orte konnten nicht geladen werden')
      } finally {
        setLaedt(false)
      }
    }
    ersteAnzeige()
  }, [laden])

  const fehlerMelden = (fehler, ersatz) =>
    myToastError(fehler?.response?.data?.error ?? ersatz)

  const anlegen = async () => {
    const name = neuerName.trim()
    if (!name) return

    setArbeitet(true)
    try {
      await doPostRequestAuth('location', { name }, token)
      setNeuerName('')
      await laden()
      myToastSuccess(`${name} angelegt`)
    } catch (fehler) {
      fehlerMelden(fehler, 'Ort konnte nicht angelegt werden')
    } finally {
      setArbeitet(false)
    }
  }

  const umbenennen = async () => {
    const name = bearbeiteName.trim()
    if (!name) return

    setArbeitet(true)
    try {
      await doPatchRequestAuth(`location/${bearbeiteId}`, { name }, token)
      setBearbeiteId(null)
      await laden()
      myToastSuccess('Ort gespeichert')
    } catch (fehler) {
      fehlerMelden(fehler, 'Ort konnte nicht gespeichert werden')
    } finally {
      setArbeitet(false)
    }
  }

  const loeschen = (ort) => {
    modal.confirm({
      title: 'Ort löschen?',
      content: `${ort.name?.trim() || 'Der Ort ohne Namen'} wird gelöscht. Das geht nur, wenn keine Messe mehr daran hängt.`,
      okText: 'Löschen',
      okButtonProps: { danger: true },
      cancelText: 'Abbrechen',
      onOk: async () => {
        try {
          await doDeleteRequestAuth(`location/${ort.id}`, undefined, token)
          await laden()
          myToastSuccess('Ort gelöscht')
        } catch (fehler) {
          // Der Server nennt die Zahl der Messen, die daran hängen - bei der
          // Stadtpfarrkirche sind das 113.
          fehlerMelden(fehler, 'Ort konnte nicht gelöscht werden')
        }
      },
    })
  }

  if (laedt) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
        <Input
          placeholder="Neuer Ort, z. B. Spitalkirche"
          aria-label="Neuer Ort"
          value={neuerName}
          onChange={(e) => setNeuerName(e.target.value)}
          onPressEnter={anlegen}
        />
        <Button
          type="primary"
          icon={<PlusOutlined aria-hidden />}
          loading={arbeitet}
          disabled={!neuerName.trim()}
          onClick={anlegen}
        >
          Anlegen
        </Button>
      </Space.Compact>

      {orte.length === 0 ? (
        <Empty description="Noch keine Orte" />
      ) : (
        <List
          dataSource={orte}
          rowKey="id"
          renderItem={(ort) =>
            bearbeiteId === ort.id ? (
              <List.Item>
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    autoFocus
                    aria-label="Name des Ortes"
                    value={bearbeiteName}
                    onChange={(e) => setBearbeiteName(e.target.value)}
                    onPressEnter={umbenennen}
                  />
                  <Button
                    type="primary"
                    icon={<CheckOutlined aria-hidden />}
                    loading={arbeitet}
                    disabled={!bearbeiteName.trim()}
                    onClick={umbenennen}
                  >
                    Speichern
                  </Button>
                  <Button onClick={() => setBearbeiteId(null)}>Abbrechen</Button>
                </Space.Compact>
              </List.Item>
            ) : (
              <List.Item
                actions={[
                  <Button
                    key="edit"
                    type="text"
                    icon={<EditOutlined aria-hidden />}
                    aria-label={`${ort.name?.trim() || 'Ort ohne Namen'} umbenennen`}
                    onClick={() => {
                      setBearbeiteId(ort.id)
                      setBearbeiteName(ort.name ?? '')
                    }}
                  />,
                  <Button
                    key="del"
                    type="text"
                    danger
                    icon={<DeleteOutlined aria-hidden />}
                    aria-label={`${ort.name?.trim() || 'Ort ohne Namen'} löschen`}
                    onClick={() => loeschen(ort)}
                  />,
                ]}
              >
                {/* Ein Name aus Leerzeichen sieht sonst wie eine leere Zeile
                    aus - genau das ist der Fall, der behoben werden soll. */}
                {ort.name?.trim() ? (
                  ort.name
                ) : (
                  <Typography.Text type="warning">
                    (ohne Namen — bitte umbenennen)
                  </Typography.Text>
                )}
              </List.Item>
            )
          }
        />
      )}
    </div>
  )
}
