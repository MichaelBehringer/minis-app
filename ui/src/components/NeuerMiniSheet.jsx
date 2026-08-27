import { useState } from 'react'
import { Button, Form, Input, Select, Space, Switch, Typography } from 'antd'
import { benutzernameVorschlag } from '../helper/benutzer'
import { doPostRequestAuth } from '../helper/RequestHelper'
import { myToastError, myToastSuccess } from '../helper/ToastHelper'
import Sheet from './Sheet'

// Einen Ministranten anlegen.
//
// Das war bisher über die Anwendung nicht möglich: es gab weder eine Route noch
// ein INSERT im Backend. Jeder der 61 Zugänge ist von Hand in der Datenbank
// entstanden.
export default function NeuerMiniSheet({
  open,
  onClose,
  onCreated,
  token,
  rollen,
  editorRoleId,
}) {
  const [form] = Form.useForm()
  const [speichert, setSpeichert] = useState(false)
  // Solange niemand selbst im Benutzernamen getippt hat, folgt er den Namen.
  const [nameGetippt, setNameGetippt] = useState(false)

  // Niemand kann eine höhere Rolle vergeben als die eigene - der Server prüft
  // das ebenfalls, hier bleibt sie gleich aus der Auswahl heraus.
  const waehlbareRollen = rollen.filter((r) => r.id <= editorRoleId)

  const namenGeaendert = () => {
    if (nameGetippt) return
    const { firstname, lastname } = form.getFieldsValue(['firstname', 'lastname'])
    form.setFieldValue('username', benutzernameVorschlag(firstname, lastname))
  }

  const schliessen = () => {
    form.resetFields()
    setNameGetippt(false)
    onClose()
  }

  const speichern = async () => {
    let werte
    try {
      werte = await form.validateFields()
    } catch {
      return
    }

    setSpeichert(true)
    try {
      await doPostRequestAuth(
        'user',
        {
          firstname: werte.firstname,
          lastname: werte.lastname,
          username: werte.username,
          password: werte.password,
          roleId: werte.roleId,
          active: werte.active ? 1 : 0,
          incense: werte.incense ? 1 : 0,
          phone: werte.phone ?? '',
          email: werte.email ?? '',
        },
        token
      )
      myToastSuccess(`${werte.firstname} ${werte.lastname} angelegt`)
      form.resetFields()
      setNameGetippt(false)
      onCreated()
    } catch (fehler) {
      // Der Server nennt den Grund verwertbar, etwa "Dieser Benutzername ist
      // schon vergeben" - das ist die häufigste Ursache und kein Serverfehler.
      myToastError(
        fehler?.response?.data?.error ?? 'Ministrant konnte nicht angelegt werden'
      )
    } finally {
      setSpeichert(false)
    }
  }

  return (
    <Sheet open={open} onClose={schliessen} title="Ministrant anlegen" width={520}>
      <Form
        layout="vertical"
        form={form}
        initialValues={{ roleId: 1, active: true, incense: false }}
      >
        <Form.Item
          label="Vorname"
          name="firstname"
          rules={[{ required: true, message: 'Bitte Vornamen angeben' }]}
        >
          <Input onChange={namenGeaendert} autoCapitalize="words" />
        </Form.Item>

        <Form.Item
          label="Nachname"
          name="lastname"
          rules={[{ required: true, message: 'Bitte Nachnamen angeben' }]}
        >
          <Input onChange={namenGeaendert} autoCapitalize="words" />
        </Form.Item>

        <Form.Item
          label="Benutzername"
          name="username"
          extra="Vorschlag nach dem bisherigen Muster: Nachname und der erste Buchstabe des Vornamens"
          rules={[{ required: true, message: 'Bitte Benutzernamen angeben' }]}
        >
          <Input
            onChange={() => setNameGetippt(true)}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </Form.Item>

        <Form.Item
          label="Passwort"
          name="password"
          rules={[{ required: true, message: 'Bitte Passwort angeben' }]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>

        <Form.Item label="Telefon" name="phone" extra="In der Regel die Nummer der Eltern">
          <Input type="tel" autoComplete="tel" />
        </Form.Item>

        <Form.Item
          label="E-Mail"
          name="email"
          rules={[{ type: 'email', message: 'Das sieht nicht wie eine E-Mail-Adresse aus' }]}
        >
          <Input type="email" autoCapitalize="none" autoCorrect="off" />
        </Form.Item>

        <Form.Item label="Rolle" name="roleId">
          <Select
            aria-label="Rolle"
            options={waehlbareRollen.map((r) => ({ value: r.id, label: r.name }))}
          />
        </Form.Item>

        <Form.Item label="Weihrauch" name="incense" valuePropName="checked">
          <Switch aria-label="Weihrauch" />
        </Form.Item>

        <Form.Item
          label="Aktiv"
          name="active"
          valuePropName="checked"
          extra="Inaktive Ministranten werden beim Einteilen nicht vorgeschlagen"
        >
          <Switch aria-label="Aktiv" />
        </Form.Item>

        <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
          <Button type="primary" block loading={speichert} onClick={speichern}>
            Anlegen
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Sperrtage, Wochentage und Wunschpartner werden danach im
            Bearbeiten-Fenster gepflegt.
          </Typography.Text>
        </Space>
      </Form>
    </Sheet>
  )
}
