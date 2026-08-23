import { Layout, Menu, theme } from 'antd'
import { useLocation, useNavigate } from 'react-router'
import useIsMobile from '../hooks/useIsMobile'
import { activePath, navItemsFor } from '../navigation'

const { Sider } = Layout

export const SIDER_WIDTH = 208
export const BOTTOM_NAV_HEIGHT = 60

// Bottom-Navigation fuer das Handy. antd hat dafuer keine Komponente, also von
// Hand - aber ausschliesslich mit Theme-Tokens, damit Dunkelmodus und
// Markenfarbe automatisch mitgehen.
function BottomNav({ items, current, onSelect }) {
  const { token } = theme.useToken()

  return (
    <nav
      style={{
        position: 'fixed',
        insetInline: 0,
        bottom: 0,
        zIndex: 100,
        display: 'flex',
        background: token.colorBgContainer,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        // Beim iPhone liegt unten der Home-Indicator - ohne dieses Padding
        // waeren die Tabs teilweise davon verdeckt.
        paddingBottom: 'var(--safe-bottom)',
      }}
    >
      {items.map((item) => {
        const Icon = item.icon
        const active = item.path === current
        return (
          <button
            key={item.path}
            type="button"
            onClick={() => onSelect(item.path)}
            aria-current={active ? 'page' : undefined}
            // Ohne dieses Label steuert der aria-label des antd-Icons
            // ("calendar") zum zugaenglichen Namen bei, und Screenreader lesen
            // "calendar Einsaetze" vor.
            aria-label={item.label}
            style={{
              flex: 1,
              // Die ganze Flaeche ist das Ziel, nicht nur das Symbol.
              minHeight: BOTTOM_NAV_HEIGHT,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: '6px 4px',
              color: active ? token.colorPrimary : token.colorTextSecondary,
              fontWeight: active ? 600 : 400,
            }}
          >
            <Icon aria-hidden style={{ fontSize: 22 }} />
            <span style={{ fontSize: 11, lineHeight: 1.2 }}>
              {item.labelShort ?? item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

export default function AppNav({ roleId }) {
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()

  const items = navItemsFor(roleId)
  const current = activePath(location.pathname)

  if (isMobile) {
    // Bei nur einem Punkt braucht es keine Leiste - ein Ministrant hat nichts
    // zu wechseln, und 60px Hoehe waeren am Handy verschenkt.
    if (items.length < 2) return null
    return <BottomNav items={items} current={current} onSelect={navigate} />
  }

  return (
    <Sider
      width={SIDER_WIDTH}
      style={{
        position: 'fixed',
        insetInlineStart: 0,
        top: 0,
        bottom: 0,
        height: '100dvh',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          color: '#fff',
          fontWeight: 700,
          fontSize: 16,
          padding: '18px 20px',
          whiteSpace: 'nowrap',
        }}
      >
        Ministranten
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[current]}
        onClick={(e) => navigate(e.key)}
        items={items.map((item) => {
          const Icon = item.icon
          return { key: item.path, icon: <Icon />, label: item.label }
        })}
      />
    </Sider>
  )
}
