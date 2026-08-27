import { describe, expect, it } from 'vitest'
import { activePath, istPlaner, navItemsFor } from './navigation'

const pfade = (roleId) => navItemsFor(roleId).map((i) => i.path)

describe('navItemsFor', () => {
  it('gibt einem Ministranten seine drei Punkte', () => {
    // Eigene Einsätze, eigene Sperrtage - und der Gesamtplan, der in der
    // Kirche ohnehin aushängt.
    expect(pfade(1)).toEqual(['/', '/sperrtage', '/plan'])
  })

  it('gibt dem Ministrantenrat zusätzlich die Planung', () => {
    expect(pfade(2)).toContain('/einteilung')
    expect(pfade(2)).toContain('/stammdaten')
  })

  it('sperrt den Admin nicht aus', () => {
    // Der Fall, den ein Vergleich auf Gleichheit statt auf "mindestens"
    // stillschweigend aussperren würde. Es gibt drei Rollen, nicht zwei.
    expect(pfade(3)).toEqual(pfade(2))
  })

  it('zeigt ohne bekannte Rolle nur, was jeder hat', () => {
    // Solange checkToken noch läuft. Sonst blitzen Menüpunkte auf, die gleich
    // wieder verschwinden.
    expect(pfade(undefined)).toEqual(['/', '/sperrtage', '/plan'])
  })
})

describe('istPlaner', () => {
  it.each([
    [1, false],
    [2, true],
    [3, true],
    [undefined, false],
  ])('Rolle %s ergibt %s', (rolle, erwartet) => {
    expect(istPlaner(rolle)).toBe(erwartet)
  })
})

describe('activePath', () => {
  it('hebt den passenden Punkt hervor', () => {
    expect(activePath('/plan')).toBe('/plan')
    expect(activePath('/sperrtage')).toBe('/sperrtage')
  })

  it('fällt für unbekannte Pfade auf die Startseite zurück', () => {
    // '/' würde sonst auf jeden Pfad passen und immer mit hervorgehoben.
    expect(activePath('/')).toBe('/')
    expect(activePath('/gibtsnicht')).toBe('/')
  })
})
