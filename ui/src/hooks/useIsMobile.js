import { Grid } from 'antd'

// Eine einzige Stelle entscheidet, ob die Handy- oder die PC-Ausprägung
// gerendert wird. Bewusst über antds Breakpoints statt über @media im CSS,
// damit Layoutentscheidungen dort stehen, wo die Komponenten sind.
//
// Schwelle ist lg (992px): darunter Bottom-Navigation und Kartenlisten,
// darüber Sider und Tabellen.
export default function useIsMobile() {
  const screens = Grid.useBreakpoint()

  // Beim allerersten Render ist das Ergebnis von useBreakpoint noch leer.
  // Dann gilt Mobile als Annahme - Priorität 1 ist das Handy, und ein kurz
  // aufblitzendes Desktop-Layout wäre auf dem Telefon deutlich störender
  // als umgekehrt.
  if (Object.keys(screens).length === 0) return true

  return !screens.lg
}
