// Benutzernamen folgen im Bestand durchgehend einem Muster: Nachname in
// Kleinbuchstaben, Umlaute ausgeschrieben, danach der erste Buchstabe des
// Vornamens.
//
//   Michael Behringer   -> behringerm
//   Stephan Bodenmüller -> bodenmuellers
//   Jannik Rösch        -> roeschj
//
// Der Vorschlag hält das Muster, ohne es zu erzwingen: das Feld bleibt
// änderbar, und der Vorschlag greift nur, solange niemand selbst getippt hat.
const UMLAUTE = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  Ä: 'ae',
  Ö: 'oe',
  Ü: 'ue',
  ß: 'ss',
}

function vereinfachen(text) {
  return (text ?? '')
    .replace(/[äöüÄÖÜß]/g, (z) => UMLAUTE[z])
    .toLowerCase()
    // Akzente wie in "Réne" zerlegen und die Zeichen entfernen. Umlaute sind
    // vorher schon ersetzt, weil sie ausgeschrieben werden und nicht als "u".
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // Bindestriche und Leerzeichen fallen weg: "Meier-Schmidt" -> meierschmidt
    .replace(/[^a-z0-9]/g, '')
}

export function benutzernameVorschlag(vorname, nachname) {
  const nach = vereinfachen(nachname)
  const vor = vereinfachen(vorname)
  if (!nach) return vor
  return nach + vor.slice(0, 1)
}
