import dayjs from 'dayjs'

// Verfügbarkeit eines Ministranten für einen Termin. Die Schlüssel kommen so
// aus dem Backend (eventController.go, availability_status).
export const AVAILABILITY_META = {
  ok: {
    groupLabel: 'Kann',
    tagText: 'OK',
    tagColor: 'green',
  },
  weekday_inactive: {
    groupLabel: 'Wochentag nicht aktiv',
    tagText: 'Wochentag',
    tagColor: 'orange',
  },
  banned: {
    groupLabel: 'Gesperrt',
    tagText: 'Sperrung',
    tagColor: 'red',
  },
  inactive: {
    groupLabel: 'Inaktiv',
    tagText: 'Inaktiv',
    tagColor: 'default',
  },
}

// Reihenfolge der Abschnitte: was am ehesten passt, steht oben.
export const AVAILABILITY_ORDER = ['ok', 'weekday_inactive', 'banned', 'inactive']

export function metaFuer(status) {
  return AVAILABILITY_META[status] ?? AVAILABILITY_META.ok
}

export function nameVon(u) {
  return `${u.firstname} ${u.lastname}`
}

// Wer am längsten nicht eingeteilt war, steht oben - das ist der Kern der
// Verteilung von Hand. Bei gleichem Abstand alphabetisch.
//
// null bedeutet "noch nie eingeteilt" und muss ganz nach oben, nicht nach
// unten: -1 als Ersatzwert waere der kleinste Abstand und damit das Gegenteil.
export function vergleicheOptionen(a, b) {
  const aLast = a.lastAssignmentDaysBefore ?? Number.POSITIVE_INFINITY
  const bLast = b.lastAssignmentDaysBefore ?? Number.POSITIVE_INFINITY

  if (aLast !== bLast) return bLast - aLast

  const aNach = (a.lastname || '').toLowerCase()
  const bNach = (b.lastname || '').toLowerCase()
  if (aNach !== bNach) return aNach.localeCompare(bNach)

  return (a.firstname || '').toLowerCase().localeCompare((b.firstname || '').toLowerCase())
}

// "zuletzt vor 14 Tagen" - oder der Hinweis, dass es noch nie vorkam.
export function abstandText(u) {
  const tage = u.lastAssignmentDaysBefore
  if (tage === undefined || tage === null) return 'noch nie eingeteilt'
  if (tage === 0) return 'heute schon eingeteilt'
  if (tage === 1) return 'zuletzt gestern'
  return `zuletzt vor ${tage} Tagen`
}

// Die nächste Einteilung nach diesem Termin, falls es eine gibt. Verhindert,
// dass jemand zwei Tage hintereinander dran ist, ohne dass es auffällt.
export function naechsterText(u) {
  const tage = u.nextAssignmentDaysAfter
  if (tage === undefined || tage === null) return null
  if (tage === 0) return 'am selben Tag nochmal'
  if (tage === 1) return 'schon morgen wieder'
  return `wieder in ${tage} Tagen`
}

export function gruppiereOptionen(optionen) {
  return AVAILABILITY_ORDER.map((status) => ({
    status,
    meta: AVAILABILITY_META[status],
    eintraege: optionen
      .filter((u) => u.status === status)
      .sort(vergleicheOptionen),
  })).filter((g) => g.eintraege.length > 0)
}

// Vorschlag fuer die offenen Plaetze einer Messe.
//
// Bewusst klein gehalten und ausdruecklich NICHT die frueher vorhandene
// Vollautomatik: die war 603 Zeilen, wurde nie benutzt, und die Daten zeigen,
// dass die Verteilung von Hand gut funktioniert - unter den 33 aktiven
// Ministranten hat jeder Einsaetze, der Grossteil zwischen 22 und 28.
//
// Vorgeschlagen wird nur, wer laut Backend "kann" (Status ok): eine Sperrung
// oder ein nicht passender Wochentag ist eine Entscheidung des Planers, kein
// Vorschlag. Sortiert wird nach derselben Regel wie die Liste - wer am
// laengsten nicht dran war, steht oben.
//
// Es entscheidet weiter der Mensch: die Rueckgabe ist eine Auswahl, die
// bestaetigt werden muss.
export function vorschlagFuerOffenePlaetze(optionen, zugewiesen, soll) {
  const offen = (soll ?? 0) - zugewiesen.length
  if (offen <= 0) return []

  return optionen
    .filter((o) => o.status === 'ok' && !zugewiesen.includes(o.id))
    .sort(vergleicheOptionen)
    .slice(0, offen)
    .map((o) => o.id)
}

// Wochentage in der Schreibweise der Tabelle user_weekday (MON..SUN),
// zusammen mit der Nummerierung von dayjs (0 = Sonntag).
export const WOCHENTAGE = [
  { key: 'MON', label: 'Montag', kurz: 'Mo', dayjsTag: 1 },
  { key: 'TUE', label: 'Dienstag', kurz: 'Di', dayjsTag: 2 },
  { key: 'WED', label: 'Mittwoch', kurz: 'Mi', dayjsTag: 3 },
  { key: 'THU', label: 'Donnerstag', kurz: 'Do', dayjsTag: 4 },
  { key: 'FRI', label: 'Freitag', kurz: 'Fr', dayjsTag: 5 },
  { key: 'SAT', label: 'Samstag', kurz: 'Sa', dayjsTag: 6 },
  { key: 'SUN', label: 'Sonntag', kurz: 'So', dayjsTag: 0 },
]

// Obergrenze, die der Server ebenfalls durchsetzt (putEvents in main.go).
export const MAX_SERIENTERMINE = 200

// Alle Termine eines Wochentags in einem Zeitraum, einschliesslich der
// Randtage.
//
// Wird fuer die Vorschau und fuer das Anlegen benutzt - dieselbe Funktion,
// damit angelegt wird, was der Nutzer gesehen hat.
export function serienTermine(von, bis, dayjsTag) {
  if (!von || !bis) return []

  const start = dayjs(von).startOf('day')
  const ende = dayjs(bis).startOf('day')
  if (!start.isValid() || !ende.isValid() || ende.isBefore(start)) return []

  // Vom Start zum ersten passenden Wochentag vorruecken.
  const versatz = (dayjsTag - start.day() + 7) % 7
  let aktuell = start.add(versatz, 'day')

  const termine = []
  while (!aktuell.isAfter(ende) && termine.length < MAX_SERIENTERMINE) {
    termine.push(aktuell)
    aktuell = aktuell.add(7, 'day')
  }
  return termine
}
