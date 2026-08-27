import { Card } from 'antd'
import UserBanDates from './UserBanDates'

// Eigene Seite fuer die Sperrtage.
//
// Sie stecken zwar auch als Reiter im Bearbeiten-Sheet, aber dorthin kommt man
// nur ueber das Profilmenue. Fuer einen Ministranten ist das neben "wann bin
// ich dran" die eigentliche Aufgabe in dieser Anwendung - sie gehoert also in
// die Navigation und nicht zwei Ebenen tief.
export default function Sperrtage({ userId, token }) {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <Card size="small">
        <UserBanDates userId={userId} token={token} />
      </Card>
    </div>
  )
}
