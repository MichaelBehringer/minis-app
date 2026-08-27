# ui

Frontend des Ministrantenplans. React 19, antd 6, react-router 8, gebaut mit
Vite 8. Ausgeliefert als installierbare PWA.

## Entwickeln

```bash
npm ci
npm run dev
```

Der Dev-Server lauscht auf **allen** Netzwerkschnittstellen (`host: true` in
`vite.config.js`), nicht nur auf localhost. Beim Start nennt er neben
`localhost:3000` auch die Adresse im lokalen Netz — darüber lässt sich die
Anwendung vom Handy im gleichen WLAN öffnen. Das ist der wichtigere Weg, weil
die App überwiegend am Handy bedient wird.

Das Backend muss dafür lokal laufen (`cd ../server && go run .`). Der Dev-Proxy
leitet `/server/` dorthin weiter — dieselbe Regel, die in Produktion nginx
umsetzt. Der API-Pfad ist damit in beiden Welten identisch, und es muss vor dem
Deployen keine Zeile mehr von Hand geändert werden.

## Befehle

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver auf Port 3000 |
| `npm run build` | Produktionsbuild nach `dist/` |
| `npm run preview` | den Produktionsbuild lokal ansehen |
| `npm run lint` | ESLint |
| `npm test` | Vitest, einmalig |
| `npm run test:watch` | Vitest, mitlaufend |

## Aufbau

| Ort | Inhalt |
|---|---|
| `src/theme.js` | Markenfarbe und antd-Tokens. `controlHeight: 44` für das iOS-Minimum bei Trefferflächen, `fontSize: 16` damit Safari beim Fokussieren nicht hineinzoomt |
| `src/AppProviders.jsx` | ConfigProvider, deutsche Locale, dayjs-Einrichtung, Toast-Brücke |
| `src/navigation.js` | die einzige Quelle für die Navigation, mit Rollenfilter |
| `src/hooks/useIsMobile.js` | eine Stelle entscheidet Handy oder PC (Schwelle `lg`) |
| `src/hooks/useCloseOnBack.js` | die Zurück-Geste schließt ein Overlay statt die App |
| `src/helper/RequestHelper.js` | axios-Instanz samt Interceptor für abgelaufene Tokens |
| `src/helper/einteilung.js` | Fachlogik der Einteilung: Sortierung, Gruppierung, Serientermine |
| `src/components/Sheet.jsx` | Overlay über die ganze Höhe am Handy, Panel am PC |

## Worauf zu achten ist

**dayjs braucht `customParseFormat`.** Ohne das Plugin ignoriert dayjs das
Formatargument und `dayjs('18:30:00', 'HH:mm:ss')` ergibt `Invalid Date`. Es
wird zentral in `AppProviders` geladen, zusammen mit `dayjs.locale('de')` — die
Locale-Datei zu importieren registriert sie nur, aktiv wird sie erst durch den
Aufruf.

**`build.target` ist ausdrücklich gesetzt.** Vite 8 hebt den Standard auf Safari
16.4. Ältere iPads bekommen keine neuere iPadOS-Version mehr und könnten das
Bundle dann nicht mehr einlesen — in der Anwendung wäre das ein weißer
Bildschirm ohne jede Meldung.

**Safe-Area nur im Standalone-Modus.** `env(safe-area-inset-bottom)` ändert im
normalen Browser seinen Wert, während die Adressleiste beim Scrollen ein- und
ausfährt. Die Bottom-Navigation würde dadurch mitten im Scrollen ihre Höhe
ändern. Deshalb stehen die Insets in `src/index.css` hinter
`@media (display-mode: standalone)`.

**Farben gehören in `theme.js`, nicht in CSS.** Sonst gehen sie im Dunkelmodus
nicht mit. Die drei früheren Stylesheets hatten `#1677ff`, `#f5f5f5` und
Platzhalterfarben in `rgba(0,0,0,…)` fest verdrahtet.

**Höhen mit `dvh`, nicht `vh`.** `vh` rechnet mit der ausgefahrenen
Adressleiste; die Kopfzeile eines Sheets wäre nach dem Scrollen abgeschnitten.

## Symbole der PWA

`public/app-icon.svg` ist die Vorlage. Das Motiv sitzt bewusst nur im mittleren
Drittel: Android schneidet maskierbare Symbole zu Kreisen oder Rundrechtecken zu
und garantiert nur die inneren 80 %.

Neu erzeugen, wenn sich die Vorlage ändert:

```bash
npm i -D @vite-pwa/assets-generator
npx pwa-assets-generator --preset minimal public/app-icon.svg
cp public/pwa-512x512.png public/maskable-icon-512x512.png
npm uninstall @vite-pwa/assets-generator && npm prune
```

Die letzten beiden Schritte sind wichtig. Das Werkzeug versieht das maskierbare
Symbol mit einem transparenten Rand, was als Quadrat mit abgeschnittenen Ecken
erscheint — das randlose Bild ist das richtige. Und es zieht `sharp` mit, das
libvips-CVEs meldet und nur zur Bauzeit gebraucht wird.
