import { Button, Form, Input, Select, Space, Switch, Typography } from 'antd'

export default function UserGeneralForm({
  form,
  handleSave,
  onOpenPassword,
  rollen,
  istPlaner,
  speichert,
}) {
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

      <Form.Item label="Rolle" name="roleId">
        {/* Vorher ein Textfeld mit der rohen Zahl und der Beschriftung
            "Rollen-ID". Die Namen kommen aus der Tabelle role. Aendern darf
            die Rolle nur ein Planer - und der Server prueft das ebenfalls. */}
        <Select
          disabled={!istPlaner}
          aria-label="Rolle"
          options={rollen.map((r) => ({ value: r.id, label: r.name }))}
        />
      </Form.Item>

      <Form.Item
        label="Weihrauch"
        name="incense"
        valuePropName="checked"
        extra="Darf das Weihrauchfass tragen"
      >
        <Switch aria-label="Weihrauch" />
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
