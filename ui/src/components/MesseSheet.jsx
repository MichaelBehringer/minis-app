import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App as AntApp,
  AutoComplete,
  Button,
  Checkbox,
  DatePicker,
  Form,
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
import dayjs from 'dayjs'
import Sheet from './Sheet'
import ZeitraumWahl from './ZeitraumWahl'

// Anlegen, Bearbeiten und Löschen einer Messe.
//
// Beim Anlegen ist die Serie der Regelfall: von 122 Messen liegen 113 in
// derselben Kirche, und die Wochentage sind fast ausschließlich Samstag und
// Sonntag. Jeden Termin einzeln einzutragen war entsprechend viel Wiederholung.
//
// Beim Bearbeiten fällt die Serie weg - es geht um genau diesen einen Termin.
// Dieselbe Maske für beides, weil die Felder identisch sind: eine zweite wäre
// eine Kopie, die auseinanderläuft.
export default function MesseSheet({
  open,
  onClose,
  locationList,
  onSpeichern,
  onAendern,
  onLoeschen,
  messe,
  namensvorschlaege = [],
}) {
  const bearbeiten = Boolean(messe)
  const [modus, setModus] = useState('einzel')
  const [speichert, setSpeichert] = useState(false)
  const [form] = Form.useForm()
  const { modal } = AntApp.useApp()

  // Beim Öffnen die Werte der Messe eintragen. Ohne open in den Abhängigkeiten
  // stünden nach einem Wechsel der Messe die alten Werte in der Maske.
  useEffect(() => {
    // Nur Werte eintragen, keinen Zustand setzen: der Modus wird beim
    // Bearbeiten ohnehin nicht aus dem State gelesen (siehe effektiverModus),
    // und das Leeren erledigt schliessen() auf jedem Schliessweg.
    if (!open || !messe) return

    form.setFieldsValue({
      name: messe.name,
      date: messe.dateBegin ? dayjs(messe.dateBegin) : null,
      // Die Zeit kommt als HH:mm:ss - ohne Format ergibt dayjs damit ein
      // ungültiges Datum.
      time: messe.timeBegin ? dayjs(messe.timeBegin, 'HH:mm:ss') : null,
      locationId: messe.locationId,
      minimalUser: messe.minimalUser ?? 0,
      ignoreWeekday: Boolean(messe.ignoreWeekday),
    })
    // form ist stabil, messe.id genügt als Auslöser.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, messe?.id])

  // Fuer die Vorschau der Serie mitlesen.
  const zeitraum = Form.useWatch('zeitraum', form)
  const wochentag = Form.useWatch('weekday', form)

  // Beim Bearbeiten geht es um genau diesen einen Termin - eine Serie gibt es
  // dort nicht, und die Umschaltung ist ausgeblendet.
  const effektiverModus = bearbeiten ? 'einzel' : modus

  const termine = useMemo(() => {
    if (effektiverModus !== 'serie' || !wochentag) return []
    const tag = WOCHENTAGE.find((w) => w.key === wochentag)
    if (!tag) return []
    return serienTermine(zeitraum?.[0], zeitraum?.[1], tag.dayjsTag)
  }, [effektiverModus, wochentag, zeitraum])

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

    setSpeichert(true)
    try {
      if (bearbeiten) {
        const erfolg = await onAendern(messe.id, {
          ...basis,
          dateBegin: werte.date.format('YYYY-MM-DD'),
        })
        if (erfolg) schliessen()
        return
      }

      const events =
        effektiverModus === 'einzel'
          ? [{ ...basis, dateBegin: werte.date.format('YYYY-MM-DD') }]
          : termine.map((t) => ({ ...basis, dateBegin: t.format('YYYY-MM-DD') }))

      const erfolg = await onSpeichern(events)
      if (erfolg) schliessen()
    } finally {
      setSpeichert(false)
    }
  }

  const loeschen = () => {
    const eingeteilt = messe?.assignedUserIds?.length ?? 0

    modal.confirm({
      title: 'Messe löschen?',
      // Die Zahl gehört in die Frage: eine Messe mit acht Einteilungen zu
      // löschen ist etwas anderes als eine leere.
      content:
        eingeteilt === 0
          ? `${messe.name} am ${dayjs(messe.dateBegin).format('DD.MM.YYYY')} wird gelöscht.`
          : `${messe.name} am ${dayjs(messe.dateBegin).format('DD.MM.YYYY')} wird gelöscht. ` +
            `${eingeteilt} ${eingeteilt === 1 ? 'Einteilung' : 'Einteilungen'} ` +
            'werden mit entfernt.',
      okText: 'Löschen',
      okButtonProps: { danger: true },
      cancelText: 'Abbrechen',
      onOk: async () => {
        const erfolg = await onLoeschen(messe.id)
        if (erfolg) schliessen()
      },
    })
  }

  const zuViele = termine.length >= MAX_SERIENTERMINE
  const serieUnvollstaendig = effektiverModus === 'serie' && termine.length === 0

  return (
    <Sheet
      open={open}
      onClose={schliessen}
      title={bearbeiten ? 'Messe bearbeiten' : 'Messe anlegen'}
      footer={
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          {/* Löschen links und mit Abstand zum Speichern: der Knopf soll nicht
              dort liegen, wo der Daumen ohnehin hinzielt. */}
          {bearbeiten ? (
            <Button danger onClick={loeschen}>
              Löschen
            </Button>
          ) : (
            <span />
          )}
          <Space>
            <Button onClick={schliessen}>Abbrechen</Button>
            <Button
              type="primary"
              loading={speichert}
              disabled={serieUnvollstaendig}
              onClick={speichern}
            >
              {bearbeiten
                ? 'Speichern'
                : effektiverModus === 'einzel'
                  ? 'Anlegen'
                  : `${termine.length} Termine anlegen`}
            </Button>
          </Space>
        </Space>
      }
    >
      {!bearbeiten && (
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
      )}

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
          {/* Vorschlagsliste aus den bisher verwendeten Namen, die häufigsten
              zuerst - Freitext bleibt möglich. Im Bestand stehen 46
              verschiedene Werte bei 122 Messen, darunter "Sontagsmesse"
              achtmal neben "Sonntagsmesse". */}
          <AutoComplete
            placeholder="z. B. Vorabendmesse"
            options={namensvorschlaege.map((n) => ({ value: n }))}
            filterOption={(eingabe, option) =>
              option.value.toLowerCase().includes(eingabe.toLowerCase())
            }
          />
        </Form.Item>

        {effektiverModus === 'einzel' ? (
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
      {effektiverModus === 'serie' && (
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
