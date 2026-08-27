import {
  CalendarOutlined,
  ScheduleOutlined,
  StopOutlined,
  TeamOutlined,
} from '@ant-design/icons'

// Eine einzige Quelle fuer die Navigation. Bottom-Tabs am Handy und Sider am
// PC lesen daraus, damit sie nicht auseinanderlaufen koennen.
//
// minRole ist eine Untergrenze, kein exakter Wert. Es gibt drei Rollen -
// 1 Ministrant, 2 Ministrantenrat, 3 Admin - und die Rechte im Backend haengen
// ebenfalls an "mindestens" (AllowMinRole(2)). Ein Vergleich auf Gleichheit
// wuerde den Admin aus der Planung aussperren.
const NAV_ITEMS = [
  {
    path: '/',
    label: 'Meine Einsätze',
    labelShort: 'Einsätze',
    icon: CalendarOutlined,
    minRole: 1,
  },
  {
    // Neben "wann bin ich dran" die eigentliche Aufgabe eines Ministranten.
    // Steckt zwar auch im Bearbeiten-Sheet, aber dorthin kommt man nur ueber
    // das Profilmenue.
    path: '/sperrtage',
    label: 'Meine Sperrtage',
    labelShort: 'Sperrtage',
    icon: StopOutlined,
    minRole: 1,
  },
  {
    path: '/einteilung',
    label: 'Einteilung',
    labelShort: 'Einteilung',
    icon: ScheduleOutlined,
    minRole: 2,
  },
  {
    path: '/stammdaten',
    label: 'Ministranten',
    labelShort: 'Minis',
    icon: TeamOutlined,
    minRole: 2,
  },
]

export function navItemsFor(roleId) {
  // Solange die Rolle noch nicht geladen ist, nur den Punkt zeigen, den jeder
  // hat - sonst blitzen Menuepunkte auf, die gleich wieder verschwinden.
  const rolle = typeof roleId === 'number' ? roleId : 1
  return NAV_ITEMS.filter((item) => rolle >= item.minRole)
}

export function istPlaner(roleId) {
  return typeof roleId === 'number' && roleId >= 2
}

// Welcher Navigationspunkt ist zum aktuellen Pfad hervorzuheben.
export function activePath(pathname) {
  const treffer = NAV_ITEMS.filter(
    (item) => item.path !== '/' && pathname.startsWith(item.path)
  )
  return treffer.length > 0 ? treffer[0].path : '/'
}
