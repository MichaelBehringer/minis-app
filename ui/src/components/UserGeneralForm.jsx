import { Button, Form, Input, Select, Space, Switch, Typography } from 'antd'

export default function UserGeneralForm({
  form,
  handleSave,
  onOpenPassword,
  rollen,
  istPlaner,
  eigenesKonto,
  editorRoleId,
  speichert,
}) {
  // Die eigene Rolle kann niemand aendern - sonst macht sich der
  // Ministrantenrat selbst zum Admin. Vorher hing das disabled nur an
  // istPlaner: ein Planer sah bei sich selbst ein offenes Feld, das der Server
  // ablehnt.
  const rolleSperren = !istPlaner || eigenesKonto

  // Und keine hoehere Rolle als die eigene. Der Server prueft es ebenfalls.
  const waehlbareRollen = rollen.filter((r) => r.id <= (editorRoleId ?? 0))

  return (
    <Form layout="vertical" form={form}>
      <Form.Item label="Vorname" name="firstname" rules={[{ required: true }]}>
        <Input />
      </Form.Item>

      <Form.Item label="Nachname" name="lastname" rules={[{ required: true }]}>
        <Input />
      </Form.Item>

      <Form.Item label="Benutzername" name="username">
        <Input disabled />
      </Form.Item>

      <Form.Item
        label="Rolle"
        name="roleId"
        extra={eigenesKonto && istPlaner ? 'Die eigene Rolle kann nicht geändert werden' : undefined}
      >
        {/* Vorher ein Textfeld mit der rohen Zahl und der Beschriftung
            "Rollen-ID". Die Namen kommen aus der Tabelle role. */}
        <Select
          disabled={rolleSperren}
          aria-label="Rolle"
          options={(rolleSperren ? rollen : waehlbareRollen).map((r) => ({
            value: r.id,
            label: r.name,
          }))}
        />
      </Form.Item>

      <Form.Item label="Weihrauch" name="incense" valuePropName="checked">
        {/* Vorher ohne disabled: in der Maske sichtbar, aber ein Ministrant
            konnte sich damit selbst als Weihrauchtraeger eintragen. */}
        <Switch disabled={!istPlaner} aria-label="Weihrauch" />
      </Form.Item>

      <Form.Item
        label="Aktiv"
        name="active"
        valuePropName="checked"
        extra={
          istPlaner
            ? 'Inaktive Ministranten werden beim Einteilen nicht vorgeschlagen'
            : 'Kann nur vom Ministrantenrat geändert werden'
        }
      >
        <Switch disabled={!istPlaner} aria-label="Aktiv" />
      </Form.Item>

      <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
        <Button type="primary" block loading={speichert} onClick={handleSave}>
          Speichern
        </Button>
        <Button block onClick={onOpenPassword}>
          Passwort ändern
        </Button>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Sperrtage, Wochentage und Wunschpartner werden sofort gespeichert.
        </Typography.Text>
      </Space>
    </Form>
  )
}
