/*
 * Selbstheilung für Installationen der alten Anwendung.
 *
 * Die alte Fassung (Create React App) lud ihre Dateien aus /static/. Diese
 * Pfade gibt es nicht mehr. Hängt bei jemandem noch die alte index.html im
 * Cache, fordert sie sie weiter an - nginx liefert dann diese Datei aus (siehe
 * ui-nginx.conf).
 *
 * Aufgabe: alles wegräumen, was die alte Fassung festhält, und die Seite unter
 * einer neuen Adresse frisch laden. Aufschaukeln ist nicht möglich, weil die
 * neue Fassung nie aus /static/ lädt - und weil der Versuch nur einmal pro
 * Sitzung stattfindet.
 */
(function () {
  var SCHLUESSEL = 'minis-reparatur-versucht'

  function neuLaden() {
    // Neue Adresse, damit der Cache sie nicht beantworten kann.
    location.replace('/?v=' + Date.now())
  }

  function meldung() {
    // Zweiter Versuch in derselben Sitzung: dann hilft Neuladen offensichtlich
    // nicht, und eine endlose Schleife würde die Anwendung nur unerreichbar
    // machen. Stattdessen eine Anleitung, die ohne Vorwissen umsetzbar ist.
    var d = document.createElement('div')
    d.setAttribute(
      'style',
      'font:17px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;' +
        'padding:24px;max-width:34em;margin:0 auto;color:#1f1f1f'
    )

    var h = document.createElement('h2')
    h.textContent = 'Neue Version verfügbar'
    d.appendChild(h)

    var p1 = document.createElement('p')
    p1.textContent =
      'Diese Verknüpfung zeigt noch auf eine alte Fassung der Anwendung und ' +
      'lässt sich nicht automatisch aktualisieren.'
    d.appendChild(p1)

    var p2 = document.createElement('p')
    p2.textContent =
      'Bitte das Symbol vom Startbildschirm entfernen und die Seite über den ' +
      'Browser erneut zum Startbildschirm hinzufügen. Die Anmeldedaten bleiben ' +
      'gültig.'
    d.appendChild(p2)

    document.body.innerHTML = ''
    document.body.appendChild(d)
  }

  var schonVersucht = false
  try {
    schonVersucht = sessionStorage.getItem(SCHLUESSEL) === '1'
    sessionStorage.setItem(SCHLUESSEL, '1')
  } catch {
    // Privater Modus oder gesperrte Websitedaten: dann ohne Schleifenschutz,
    // aber der Versuch soll trotzdem stattfinden.
  }

  if (schonVersucht) {
    if (document.body) {
      meldung()
    } else {
      document.addEventListener('DOMContentLoaded', meldung)
    }
    return
  }

  var aufgaben = []

  // Ein Service Worker aus einer früheren Fassung würde die alten Dateien
  // weiter ausliefern und jeden Serverwechsel überstehen.
  if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
    aufgaben.push(
      navigator.serviceWorker.getRegistrations().then(function (registrierungen) {
        return Promise.all(
          registrierungen.map(function (r) {
            return r.unregister()
          })
        )
      })
    )
  }

  if (window.caches && caches.keys) {
    aufgaben.push(
      caches.keys().then(function (namen) {
        return Promise.all(
          namen.map(function (name) {
            return caches.delete(name)
          })
        )
      })
    )
  }

  if (aufgaben.length === 0) {
    neuLaden()
    return
  }

  // Auch bei einem Fehler neu laden - das Aufräumen ist Beiwerk, das Laden der
  // neuen Fassung ist der Zweck. Zusätzlich ein Zeitlimit, damit ein hängendes
  // Versprechen nicht in einem weissen Bildschirm endet.
  var erledigt = false
  function einmalNeuLaden() {
    if (erledigt) return
    erledigt = true
    neuLaden()
  }

  setTimeout(einmalNeuLaden, 3000)
  Promise.all(aufgaben).then(einmalNeuLaden, einmalNeuLaden)
})()
