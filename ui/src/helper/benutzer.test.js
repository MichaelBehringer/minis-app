import { describe, expect, it } from 'vitest'
import { benutzernameVorschlag } from './benutzer'

describe('benutzernameVorschlag', () => {
  // Die Erwartungen sind keine Erfindung: das sind die tatsächlichen
  // Benutzernamen aus dem Bestand. Wer neu angelegt wird, soll ins gleiche
  // Muster fallen.
  it.each([
    ['Michael', 'Behringer', 'behringerm'],
    ['Cosima', 'Lacker', 'lackerc'],
    ['Alexa', 'Lacker', 'lackera'],
    ['Stephan', 'Bodenmüller', 'bodenmuellers'],
    ['Jannik', 'Rösch', 'roeschj'],
    ['Lennart', 'Heider', 'heiderl'],
  ])('%s %s wird %s', (vorname, nachname, erwartet) => {
    expect(benutzernameVorschlag(vorname, nachname)).toBe(erwartet)
  })

  it('schreibt Umlaute aus statt sie zu entfernen', () => {
    // "bodenmuller" wäre der Fehler, den ein reines Entfernen der Punkte
    // erzeugt - im Bestand steht "bodenmueller".
    expect(benutzernameVorschlag('Anne', 'Bodenmüller')).toBe('bodenmuellera')
    expect(benutzernameVorschlag('Uwe', 'Käser')).toBe('kaeseru')
    // "Groß" wird "gross", dazu das S von Sepp - drei s hintereinander sind
    // richtig und kein Tippfehler.
    expect(benutzernameVorschlag('Sepp', 'Groß')).toBe('grosss')
  })

  it('lässt Bindestriche und Leerzeichen weg', () => {
    expect(benutzernameVorschlag('Anna', 'Meier-Schmidt')).toBe('meierschmidta')
    expect(benutzernameVorschlag('Anna', 'von Berg')).toBe('vonberga')
  })

  it('kommt mit fehlenden Angaben klar', () => {
    // Während des Tippens ist eines der Felder regelmäßig noch leer.
    expect(benutzernameVorschlag('Anna', '')).toBe('anna')
    expect(benutzernameVorschlag('', 'Adler')).toBe('adler')
    expect(benutzernameVorschlag(undefined, undefined)).toBe('')
  })
})
