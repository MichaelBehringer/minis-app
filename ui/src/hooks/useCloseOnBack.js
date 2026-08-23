import { useEffect, useRef } from 'react'

// Lässt die Zurück-Geste ein offenes Sheet oder einen Dialog schließen,
// statt die Seite zu verlassen.
//
// Ohne das legt ein Overlay keinen Eintrag im Verlauf an. Ein Wischen von der
// Seite wirkt dann auf die App: als installierte PWA steht man beim ersten
// Verlaufseintrag und die App schließt sich - mitten im Abarbeiten eines
// Auftrags.
//
// Der Weg dorthin: beim Öffnen einen eigenen Verlaufseintrag anlegen. Die
// Zurück-Geste entfernt dann diesen Eintrag, wir fangen das popstate-Ereignis
// ab und schließen das Overlay. Wird stattdessen über einen Knopf geschlossen,
// liegt unser Eintrag noch im Verlauf und wird beim Aufräumen entfernt - sonst
// bräuchte man später zwei Zurück-Gesten für einen Schritt.
export default function useCloseOnBack(open, onClose) {
  // Über eine Ref, damit ein bei jedem Render neu erzeugtes onClose den Effekt
  // nicht ständig neu aufsetzt - das würde bei jedem Render einen weiteren
  // Verlaufseintrag anlegen.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    // Ohne URL-Angabe: die Adresse bleibt gleich, react-router sieht also
    // keine Navigation und rendert nichts neu.
    window.history.pushState({ minisOverlay: true }, '')
    let eigenerEintrag = true

    function handlePop() {
      // Die Zurück-Geste hat den Eintrag schon entfernt.
      eigenerEintrag = false
      onCloseRef.current?.()
    }

    window.addEventListener('popstate', handlePop)

    return () => {
      window.removeEventListener('popstate', handlePop)
      if (eigenerEintrag) {
        // Per Knopf geschlossen: unseren Eintrag wieder abräumen. Der Listener
        // ist bereits abgemeldet, das löst also keine Schleife aus.
        window.history.back()
      }
    }
  }, [open])
}
