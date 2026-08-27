import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Segmented,
  Select,
  Space,
  Tag,
  TimePicker,
  Typography,
} from 'antd'
import {
  MAX_SERIENTERMINE,
  WOCHENTAGE,
  serienTermine,
} from '../helper/einteilung'
import Sheet from './Sheet'
import ZeitraumWahl from './ZeitraumWahl'

// Anlegen einer einzelnen Messe oder einer ganzen Serie.
//
// Die Serie ist der Regelfall: von 122 Messen liegen 113 in derselben Kirche,
// und die Wochentage sind fast ausschliesslich Samstag und Sonntag. Jeden
// Termin einzeln einzutragen war entsprechend viel Wiederholung.
export default function NeueMesseSheet({ open, onClose, locationList, onSpeichern }) {
  const [modus, setModus] = useState('einzel')
  const [speichert, setSpeichert] = useState(false)
  const [form] = Form.useForm()

  // Fuer die Vorschau der Serie mitlesen.
  const zeitraum = Form.useWatch('zeitraum', form)
  const wochentag = Form.useWatch('weekday', form)

  const termine = useMemo(() => {
    if (modus !== 'serie' || !wochentag) return []
    const tag = WOCHENTAGE.find((w) => w.key === wochentag)
    if (!tag) return []
    return serienTermine(zeitraum?.[0], zeitraum?.[1], tag.dayjsTag)
  }, [modus, wochentag, zeitraum])

  const schliessen = () => {
    form.resetFields()
    setModus('einzel')
    onClose()
  }

  const speichern = async () => {
    let werte
    try {
      werte = await form.validateFields()
    } catch {
      // Fehlende Angaben zeigt antd am Feld selbst an.
      return
    }

    const basis = {
      name: werte.name,
      timeBegin: werte.time.format('HH:mm:ss'),
      locationId: werte.locationId,
      minimalUser: werte.minimalUser,
      ignoreWeekday: Boolean(werte.ignoreWeekday),
    }

    const events =
      modus === 'einzel'
        ? [{ ...basis, dateBegin: werte.date.format('YYYY-MM-DD') }]
        : termine.map((t) => ({ ...basis, dateBegin: t.format('YYYY-MM-DD') }))

    setSpeichert(true)
    try {
      const erfolg = await onSpeichern(events)
      if (erfolg) schliessen()
    } finally {
      setSpeichert(false)
    }
  }

  const zuViele = termine.length >= MAX_SERIENTERMINE
  const serieUnvollstaendig = modus === 'serie' && termine.length === 0

  return (
    <Sheet
      open={open}
      onClose={schliessen}
      title="Messe anlegen"
      footer={
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={schliessen}>Abbrechen</Button>
          <Button
            type="primary"
            loading={speichert}
            disabled={serieUnvollstaendig}
            onClick={speichern}
          >
            {modus === 'einzel'
              ? 'Anlegen'
              : `${termine.length} Termine anlegen`}
          </Button>
        </Space>
      }
    >
      <Segmented
        block
        style={{ marginBottom: 16 }}
        value={modus}
        onChange={setModus}
        options={[
          { label: 'Einzelne Messe', value: 'einzel' },
          { label: 'Serie', value: 'serie' },
        ]}
      />

      <Form
        layout="vertical"
        form={form}
        initialValues={{ minimalUser: 6, ignoreWeekday: false }}
      >
        <Form.Item
          label="Name"
          name="name"
          rules={[{ required: true, message: 'Bitte einen Namen eingeben' }]}
        >
          <Input placeholder="z. B. Vorabendmesse" />
        </Form.Item>

        {modus === 'einzel' ? (
          <Form.Item
            label="Datum"
            name="date"
            rules={[{ required: true, message: 'Bitte ein Datum wählen' }]}
          >
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
        ) : (
          <>
            <Form.Item
              label="Wochentag"
              name="weekday"
              rules={[{ required: true, message: 'Bitte einen Wochentag wählen' }]}
            >
              <Select
                aria-label="Wochentag der Serie"
                placeholder="Wochentag"
                options={WOCHENTAGE.map((w) => ({ value: w.key, label: w.label }))}
              />
            </Form.Item>

            <Form.Item
              label="Zeitraum"
              name="zeitraum"
              rules={[{ required: true, message: 'Bitte einen Zeitraum wählen' }]}
            >
              <ZeitraumWahl />
            </Form.Item>
          </>
        )}

        <Form.Item
          label="Uhrzeit"
          name="time"
          rules={[{ required: true, message: 'Bitte eine Uhrzeit wählen' }]}
        >
          <TimePicker style={{ width: '100%' }} format="HH:mm" minuteStep={5} />
        </Form.Item>

        <Form.Item
          label="Ort"
          name="locationId"
          rules={[{ required: true, message: 'Bitte einen Ort wählen' }]}
        >
          <Select
            aria-label="Ort der Messe"
            options={locationList.map((loc) => ({
              value: loc.id,
              label: loc.name,
            }))}
          />
        </Form.Item>

        <Form.Item
          label="Vorgesehene Anzahl Ministranten"
          name="minimalUser"
          rules={[{ required: true, message: 'Bitte eine Anzahl eingeben' }]}
        >
          <InputNumber
            min={0}
            style={{ width: '100%' }}
            aria-label="Vorgesehene Anzahl Ministranten"
          />
        </Form.Item>

        <Form.Item name="ignoreWeekday" valuePropName="checked">
          <Checkbox>
            Wochentag der Ministranten ignorieren
            <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
              Alle gelten als verfügbar, unabhängig von ihren Wochentagen
            </Typography.Text>
          </Checkbox>
        </Form.Item>
      </Form>

      {/* Vorschau: angelegt wird genau diese Liste. Ohne sie waere eine
          falsch gesetzte Zeitraumgrenze erst nach dem Speichern zu sehen. */}
      {modus === 'serie' && (
        <div style={{ marginTop: 8 }}>
          {termine.length === 0 ? (
            <Alert
              type="info"
              showIcon
              message="Wochentag und Zeitraum wählen, dann erscheinen hier die Termine."
            />
          ) : (
            <>
              <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                {termine.length} Termine
              </Typography.Text>
              {zuViele && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 8 }}
                  message={`Es werden höchstens ${MAX_SERIENTERMINE} Termine angelegt. Bitte den Zeitraum verkleinern.`}
                />
              )}
              <div>
                {termine.map((t) => (
                  <Tag key={t.format('YYYY-MM-DD')} style={{ marginBottom: 4 }}>
                    {t.format('DD.MM.YYYY')}
                  </Tag>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}
