import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  App as AntApp,
  Button,
  Input,
  Space,
  Spin,
  Typography,
} from 'antd'
import {
  CalendarOutlined,
  CopyOutlined,
  GoogleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { doGetRequestAuth, doPostRequestAuth } from '../helper/RequestHelper'
import { myToastError, myToastInfo, myToastSuccess } from '../helper/ToastHelper'

// Das persönliche Kalender-Abo.
//
// Einmal im Handy-Kalender abonniert, stehen die Einsätze im Familienkalender -
// mit der Erinnerung, die der Kalender ohnehin kann, und sichtbar auch für die
// Eltern, ohne dass die die App installieren müssen.
//
// Der Link ist ein Zugangsmittel: wer ihn hat, sieht die Einsätze dieser Person
// ohne Anmeldung. Deshalb liest und schreibt ihn nur die Person selbst (der
// Server prüft das über AllowSelfOnly), und deshalb lässt er sich neu erzeugen.

// Der Pfad hinter dem Vite-Proxy bzw. hinter nginx - derselbe in Entwicklung
// und Produktion.
function abschnittUrl(token) {
  return `${window.location.origin}/server/ical/${token}`
}

// webcal:// öffnet auf iOS, macOS, Outlook und Thunderbird direkt den
// Abonnieren-Dialog.
//
// Auf Android führt dieser Weg nie zum Ziel: kein Android-Kalender meldet sich
// für das Schema an, der Klick verpufft dann ohne jede Meldung. Deshalb steht
// daneben der Weg über Google.
function webcalUrl(token) {
  return abschnittUrl(token).replace(/^https?:/, 'webcal:')
}

// Google Kalender abonniert eine Adresse nur über die Weboberfläche - die
// Android-App hat dafür keine Funktion. Dieser Link springt direkt in deren
// Bestätigungsdialog und erspart das Kopieren und Einfügen am PC.
//
// In cid muss die webcal-Adresse stehen, nicht die https-Adresse. Mit https
// antwortet Google mit "Hinzufügen nicht möglich - URL überprüfen" und legt
// nichts an. Das gilt nur für diesen Link: im Formular unter "Per URL" von
// Hand ist umgekehrt die https-Adresse richtig.
//
// Der angelegte Eintrag zeigt danach webcal:// als Adresse. Das ist richtig so
// - Google holt den Feed intern über https.
function googleUrl(token) {
  const ziel = encodeURIComponent(webcalUrl(token))
  return `https://calendar.google.com/calendar/render?cid=${ziel}`
}

// Auf Android ist der Google-Weg der einzige, der mit einem Druck funktioniert,
// sonst ist webcal:// der direktere. Der jeweils andere Knopf bleibt sichtbar:
// wer auf Android einen anderen Kalender nutzt oder am PC Google will, käme
// sonst nicht weiter.
function bevorzugtGoogle() {
  return /Android/i.test(navigator.userAgent)
}

export default function KalenderAbo({ userId, token }) {
  const { modal } = AntApp.useApp()
  const [laedt, setLaedt] = useState(true)
  const [arbeitet, setArbeitet] = useState(false)
  const [feedToken, setFeedToken] = useState('')

  const laden = useCallback(async () => {
    const res = await doGetRequestAuth(`user/${userId}/calendar`, token)
    setFeedToken(res.data?.token ?? '')
  }, [userId, token])

  useEffect(() => {
    async function ersteAnzeige() {
      setLaedt(true)
      try {
        await laden()
      } catch {
        myToastError('Kalender-Link konnte nicht geladen werden')
      } finally {
        setLaedt(false)
      }
    }
    ersteAnzeige()
  }, [laden])

  const erzeugen = async () => {
    setArbeitet(true)
    try {
      const res = await doPostRequestAuth(`user/${userId}/calendar`, {}, token)
      setFeedToken(res.data?.token ?? '')
      myToastSuccess('Kalender-Link erzeugt')
    } catch {
      myToastError('Kalender-Link konnte nicht erzeugt werden')
    } finally {
      setArbeitet(false)
    }
  }

  const neuErzeugen = () => {
    modal.confirm({
      title: 'Neuen Link erzeugen?',
      content:
        'Der bisherige Link hört sofort auf zu funktionieren. Ein Kalender, ' +
        'der ihn abonniert hat, muss neu eingerichtet werden.',
      okText: 'Neuen Link erzeugen',
      cancelText: 'Abbrechen',
      onOk: erzeugen,
    })
  }

  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(abschnittUrl(feedToken))
      myToastSuccess('Adresse kopiert')
    } catch {
      // Die Zwischenablage gibt es nur in einem sicheren Kontext. Am Handy im
      // WLAN läuft die Entwicklungsfassung über http, dort schlägt das fehl.
      myToastInfo('Bitte die Adresse von Hand markieren und kopieren')
    }
  }

  if (laedt) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
        <Spin />
      </div>
    )
  }

  // Der passende Weg zuerst und hervorgehoben, der andere darunter.
  const googleZuerst = bevorzugtGoogle()
  const knoepfe = [
    <Button
      key="webcal"
      type={googleZuerst ? 'default' : 'primary'}
      block
      size="large"
      icon={<CalendarOutlined aria-hidden />}
      href={webcalUrl(feedToken)}
    >
      Im Kalender abonnieren
    </Button>,
    <Button
      key="google"
      type={googleZuerst ? 'primary' : 'default'}
      block
      size="large"
      icon={<GoogleOutlined aria-hidden />}
      href={googleUrl(feedToken)}
      // Ohne das ersetzt Google die App im selben Tab - aus einer installierten
      // PWA heraus gäbe es dann keinen Weg zurück.
      target="_blank"
      rel="noreferrer"
    >
      Im Google Kalender abonnieren
    </Button>,
  ]
  if (googleZuerst) knoepfe.reverse()

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        Die eigenen Einsätze im Handy-Kalender. Der Kalender holt sich Änderungen
        selbst und erinnert an den Termin.
      </Typography.Paragraph>

      {!feedToken ? (
        <Button
          type="primary"
          block
          size="large"
          icon={<CalendarOutlined aria-hidden />}
          loading={arbeitet}
          onClick={erzeugen}
        >
          Kalender-Link erzeugen
        </Button>
      ) : (
        <>
          {knoepfe}

          <Typography.Text type="secondary" style={{ display: 'block' }}>
            Google holt sich Änderungen nur etwa einmal am Tag. Apple Kalender
            und die meisten anderen sind schneller.
          </Typography.Text>

          <div>
            <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
              Oder die Adresse von Hand eintragen
            </Typography.Text>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                readOnly
                value={abschnittUrl(feedToken)}
                aria-label="Adresse des Kalender-Abos"
                onFocus={(e) => e.target.select()}
              />
              <Button icon={<CopyOutlined aria-hidden />} onClick={kopieren}>
                Kopieren
              </Button>
            </Space.Compact>
          </div>

          <Alert
            type="warning"
            showIcon
            message="Der Link ist wie ein Schlüssel"
            description={
              'Wer ihn hat, sieht deine Einsätze ohne Anmeldung. Nicht ' +
              'weitergeben — und wenn er doch irgendwo gelandet ist, hier einen ' +
              'neuen erzeugen.'
            }
          />

          <Button
            block
            icon={<ReloadOutlined aria-hidden />}
            loading={arbeitet}
            onClick={neuErzeugen}
          >
            Neuen Link erzeugen
          </Button>
        </>
      )}
    </Space>
  )
}
