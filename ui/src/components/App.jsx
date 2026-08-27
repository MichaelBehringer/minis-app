import { lazy, Suspense, useEffect, useState } from 'react'
import { Route, Routes } from 'react-router'
import {
  Avatar,
  Button,
  Dropdown,
  Layout,
  Segmented,
  Spin,
  Typography,
  theme,
} from 'antd'
import {
  LogoutOutlined,
  MoonOutlined,
  SettingOutlined,
  SunOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { doGetRequestAuth, istTokenUngueltig } from '../helper/RequestHelper'
import { myToastError } from '../helper/ToastHelper'
import { useColorSchemeSetting } from '../colorScheme'
import useIsMobile from '../hooks/useIsMobile'
import { istPlaner, navItemsFor } from '../navigation'
import AppNav, { BOTTOM_NAV_HEIGHT, SIDER_WIDTH } from './AppNav'
import Home from './Home'

// Die beiden Planungsseiten kommen erst beim Aufruf. Ein Ministrant - die
// Mehrheit der Nutzer - laedt sie damit nie.
const Stammdaten = lazy(() => import('./Stammdaten'))
const Einteilung = lazy(() => import('./Einteilung'))

// Ebenso der Bearbeiten-Bereich: vier Reiter mit Formular, Kalender und
// Auswahllisten, die erst beim Oeffnen gebraucht werden.
const UserEditModal = lazy(() => import('./UserEditModal'))

// Die Sperrtage bringen antds Calendar mit - dieselbe Datumsmaschinerie, die
// auch die Kalenderansicht der Startseite nachlaedt.
const Sperrtage = lazy(() => import('./Sperrtage'))

const { Content, Header } = Layout

function Ladeanzeige({ text = 'Wird geladen' }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        minHeight: '60dvh',
      }}
    >
      <Spin size="large" />
      <Typography.Text type="secondary">{text}</Typography.Text>
    </div>
  )
}

// Umschalter fuer das Farbschema im Profilmenue.
function FarbschemaWahl() {
  const { preference, setPreference } = useColorSchemeSetting()

  return (
    <div style={{ padding: '4px 12px 8px' }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Darstellung
      </Typography.Text>
      <Segmented
        block
        size="small"
        style={{ marginTop: 6 }}
        value={preference}
        onChange={setPreference}
        options={[
          {
            value: 'light',
            // Sonne und Mond sind ohne Wort verstaendlich, "System" nicht -
            // deshalb bleibt der dritte Punkt beschriftet.
            //
            // aria-label und title am Wrapper, aria-hidden am Symbol: sonst
            // liest ein Screenreader den Namen des Icons ("sun") vor, und am
            // PC gibt es keinen Hinweis, was das Symbol bedeutet.
            label: (
              <span role="img" aria-label="Helle Darstellung" title="Hell">
                <SunOutlined aria-hidden style={{ fontSize: 16 }} />
              </span>
            ),
          },
          {
            value: 'dark',
            label: (
              <span role="img" aria-label="Dunkle Darstellung" title="Dunkel">
                <MoonOutlined aria-hidden style={{ fontSize: 16 }} />
              </span>
            ),
          },
          { value: 'system', label: 'System' },
        ]}
      />
    </div>
  )
}

function App(props) {
  const isMobile = useIsMobile()
  const { token } = theme.useToken()

  const [userId, setUserId] = useState()
  const [roleId, setRoleId] = useState()
  const [name, setName] = useState('')
  const [editUserId, setEditUserId] = useState(null)
  const [userSheetOpen, setUserSheetOpen] = useState(false)

  useEffect(() => {
    doGetRequestAuth('checkToken', props.token)
      .then((res) => {
        setName(res.data.name ?? '')
        setUserId(res.data.id)
        setRoleId(res.data.roleId)
      })
      .catch((fehler) => {
        // Vorher gab es hier keinen Fehlerzweig: schlug checkToken fehl, blieb
        // dauerhaft "Daten werden geladen" stehen, ohne jeden Hinweis.
        //
        // Bei einem ungueltigen Token meldet sich schon der Interceptor mit
        // "Sitzung abgelaufen" und beendet die Sitzung. Ohne diese Ausnahme
        // stuenden beim Umstieg auf die neue Fassung zwei Meldungen
        // uebereinander - alte Tokens werden dabei alle abgewiesen.
        if (istTokenUngueltig(fehler)) return
        myToastError('Benutzerdaten konnten nicht geladen werden')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const initialen = name
    .split(' ')
    .filter(Boolean)
    .map((wort) => wort[0])
    .join('')

  const profilMenu = {
    items: [
      { key: 'schema', label: <FarbschemaWahl />, type: 'group' },
      { type: 'divider' },
      {
        key: 'settings',
        icon: <SettingOutlined />,
        label: 'Meine Einstellungen',
        onClick: () => {
          setEditUserId(null)
          setUserSheetOpen(true)
        },
      },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Abmelden',
        danger: true,
        onClick: props.removeToken,
      },
      { type: 'divider' },
      {
        // Die Versionsnummer stand bisher nur im Build (__APP_VERSION__ aus
        // vite.config.js) und war nirgends zu sehen. Sichtbar ist sie die
        // Antwort auf "ist das Update angekommen?" - gerade bei einer App, die
        // vom Startbildschirm gestartet wird.
        key: 'version',
        disabled: true,
        label: (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Version {__APP_VERSION__}
          </Typography.Text>
        ),
      },
    ],
  }

  if (!userId || !roleId) {
    return <Ladeanzeige text="Anmeldedaten werden geprüft" />
  }

  // Die Bottom-Navigation erscheint ab zwei Punkten. Seit die Sperrtage
  // dazugehoeren, ist das fuer jede Rolle der Fall - der Inhalt braucht also
  // immer Platz darunter.
  const mehrAlsEinMenuepunkt = navItemsFor(roleId).length >= 2

  return (
    <Layout style={{ minHeight: '100dvh' }}>
      <AppNav roleId={roleId} />

      <Layout
        style={{
          // Platz fuer die feste Seitenleiste am PC.
          marginInlineStart: isMobile ? 0 : SIDER_WIDTH,
        }}
      >
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingInline: 16,
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            // Notch der installierten App.
            paddingTop: 'var(--safe-top)',
            height: 'auto',
            minHeight: 56,
            position: 'sticky',
            top: 0,
            zIndex: 50,
          }}
        >
          <Typography.Text
            strong
            style={{ fontSize: 17, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            Ministrantenplan
          </Typography.Text>

          <Dropdown menu={profilMenu} placement="bottomRight" trigger={['click']}>
            <Button
              type="text"
              aria-label={`Profil und Einstellungen von ${name}`}
              style={{ display: 'flex', alignItems: 'center', gap: 8, paddingInline: 8 }}
            >
              <Avatar size={32} style={{ backgroundColor: token.colorPrimary }}>
                {initialen || <UserOutlined aria-hidden />}
              </Avatar>
              {!isMobile && <span>{name}</span>}
            </Button>
          </Dropdown>
        </Header>

        <Content
          style={{
            padding: isMobile ? '12px 12px 0' : 24,
            // Damit der letzte Eintrag nicht unter der Bottom-Navigation
            // verschwindet.
            paddingBottom: isMobile && mehrAlsEinMenuepunkt
              ? `calc(${BOTTOM_NAV_HEIGHT}px + var(--safe-bottom) + 16px)`
              : `calc(16px + var(--safe-bottom))`,
          }}
        >
          <Suspense fallback={<Ladeanzeige />}>
            <Routes>
              <Route
                path="/"
                element={<Home userId={userId} token={props.token} />}
              />
              <Route
                path="/sperrtage"
                element={<Sperrtage userId={userId} token={props.token} />}
              />
              {istPlaner(roleId) && (
                <>
                  <Route
                    path="/stammdaten"
                    element={
                      <Stammdaten
                        token={props.token}
                        onEditUser={(id) => {
                          setEditUserId(id)
                          setUserSheetOpen(true)
                        }}
                      />
                    }
                  />
                  <Route
                    path="/einteilung"
                    element={<Einteilung token={props.token} />}
                  />
                </>
              )}
              {/* Ein unbekannter Pfad - etwa eine alte Verknuepfung auf
                  /einteilung ohne Berechtigung - landet auf der Startseite
                  statt auf einer leeren Seite. */}
              <Route
                path="*"
                element={<Home userId={userId} token={props.token} />}
              />
            </Routes>
          </Suspense>
        </Content>
      </Layout>

      {userSheetOpen && (
      <Suspense fallback={null}>
      <UserEditModal
        userId={editUserId ?? userId}
        // Ob der Bearbeiter Planer ist, entscheidet ueber die schreibbaren
        // Felder - nicht die Rolle des bearbeiteten Benutzers.
        editorRoleId={roleId}
        eigenesKonto={editUserId === null || editUserId === userId}
        token={props.token}
        open={userSheetOpen}
        onClose={() => {
          setUserSheetOpen(false)
          setEditUserId(null)
        }}
        onSaved={() => {
          // Der eigene Name kann sich geaendert haben.
          if (editUserId === null || editUserId === userId) {
            doGetRequestAuth('checkToken', props.token)
              .then((res) => setName(res.data.name ?? ''))
              .catch(() => {})
          }
        }}
      />
      </Suspense>
      )}
    </Layout>
  )
}

export default App
