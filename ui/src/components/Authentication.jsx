import { useState } from 'react'
import { Button, Card, Checkbox, Form, Input, Typography } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router'
import { doPostRequest } from '../helper/RequestHelper'
import { myToastError } from '../helper/ToastHelper'

const { Title, Text } = Typography

function Authentication(props) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  async function handleLogin(values) {
    setLoading(true)
    try {
      const response = await doPostRequest('login', {
        username: values.username,
        password: values.password,
        // Entscheidet ueber die Gueltigkeitsdauer des Tokens. Vorher wirkte das
        // Haekchen nur darauf, wo das Frontend das Token ablegt - der Server
        // gab immer dieselbe Dauer aus.
        remember: Boolean(values.remember),
      })
      props.setToken(response.data.accessToken, values.remember)
      navigate('/')
    } catch (error) {
      // error.response war vorher ungeprueft: bei einem Netzwerkfehler - kein
      // WLAN, Server aus - gab es dort einen TypeError und damit gar keine
      // Meldung. Genau der Fall, in dem eine Erklaerung noetig ist.
      const status = error?.response?.status
      if (status === 401) {
        myToastError('Benutzername oder Passwort ist falsch')
      } else if (status) {
        myToastError('Anmeldung derzeit nicht möglich')
      } else {
        myToastError('Keine Verbindung zum Server')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      // login-bg statt eines Inline-Hintergrunds: das Bild wird per
      // Media-Query erst ab 768px geladen. Am Handy verdeckt die Karte es
      // ohnehin fast vollstaendig, und die Anfrage entsteht so gar nicht erst.
      //
      // 100dvh und nicht 100vh: vh rechnet mit der ausgefahrenen
      // Adressleiste, die Karte saesse dann nicht in der Mitte.
      className="login-bg"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        paddingTop: 'calc(16px + var(--safe-top))',
        paddingBottom: 'calc(16px + var(--safe-bottom))',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 380,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
        }}
      >
        <Title level={3} style={{ textAlign: 'center', marginBottom: 4 }}>
          Ministrantenplan
        </Title>
        <Text
          type="secondary"
          style={{ display: 'block', textAlign: 'center', marginBottom: 20 }}
        >
          Pfarrei Wemding
        </Text>

        <Form
          name="anmeldung"
          initialValues={{ remember: true }}
          onFinish={handleLogin}
          layout="vertical"
          requiredMark={false}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: 'Bitte Benutzernamen angeben' }]}
          >
            <Input
              prefix={<UserOutlined aria-hidden />}
              placeholder="Benutzername"
              aria-label="Benutzername"
              autoComplete="username"
              // Ohne das schlaegt iOS beim Benutzernamen einen Grossbuchstaben
              // vor und korrigiert ihn eigenmaechtig.
              autoCapitalize="none"
              autoCorrect="off"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Bitte Passwort angeben' }]}
          >
            {/* Input.Password statt type="password": damit gibt es den
                Umschalter zum Anzeigen, was am Handy den Unterschied macht. */}
            <Input.Password
              prefix={<LockOutlined aria-hidden />}
              placeholder="Passwort"
              aria-label="Passwort"
              autoComplete="current-password"
              size="large"
            />
          </Form.Item>

          <Form.Item name="remember" valuePropName="checked">
            <Checkbox>Angemeldet bleiben</Checkbox>
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={loading}
          >
            Anmelden
          </Button>
        </Form>
      </Card>
    </div>
  )
}

export default Authentication
