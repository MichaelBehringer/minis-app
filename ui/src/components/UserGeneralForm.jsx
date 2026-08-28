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

      {/* Kontaktdaten. Bis hierher standen in der Tabelle user nur Namen,
          Zugang, Rolle, Aktiv und Weihrauch - fuer jeden Anruf brauchte der
          Ministrantenrat eine zweite Liste ausserhalb der Anwendung. */}
      <Form.Item
        label="Telefon"
        name="phone"
      >
        <Input type="tel" autoComplete="tel" />
      </Form.Item>

      <Form.Item
        label="E-Mail"
        name="email"
        rules={[{ type: 'email', message: 'Das sieht nicht wie eine E-Mail-Adresse aus' }]}
      >
        <Input
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
        />
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
      >
        <Switch disabled={!istPlaner} aria-label="Aktiv" />
      </Form.Item>

      {/* Nur fuer den Ministrantenrat: der Server liefert die Bemerkung einem
          Ministranten gar nicht aus und nimmt sie von ihm auch nicht an. Ohne
          diese Bedingung stuende hier ein leeres Feld, das beim Speichern
          nichts tut. */}
      {istPlaner && (
        <Form.Item
          label="Bemerkung"
          name="note"
          extra="Nur für den Ministrantenrat sichtbar"
        >
          <Input.TextArea rows={3} maxLength={2000} showCount />
        </Form.Item>
      )}

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
