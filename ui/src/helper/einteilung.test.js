import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import {
  MAX_SERIENTERMINE,
  WOCHENTAGE,
  abstandText,
  gruppiereOptionen,
  serienTermine,
  vergleicheOptionen,
} from './einteilung'

const tag = (key) => WOCHENTAGE.find((w) => w.key === key).dayjsTag
const alsText = (termine) => termine.map((t) => t.format('YYYY-MM-DD'))

describe('serienTermine', () => {
  it('findet alle Sonntage in einem Monat', () => {
    // August 2026: Sonntage sind der 2., 9., 16., 23. und 30.
    const termine = serienTermine('2026-08-01', '2026-08-31', tag('SUN'))

    expect(alsText(termine)).toEqual([
      '2026-08-02',
      '2026-08-09',
      '2026-08-16',
      '2026-08-23',
      '2026-08-30',
    ])
  })

  it('nimmt den Starttag mit, wenn er passt', () => {
    // Der 2026-08-02 ist selbst ein Sonntag.
    const termine = serienTermine('2026-08-02', '2026-08-10', tag('SUN'))
    expect(alsText(termine)).toEqual(['2026-08-02', '2026-08-09'])
  })

  it('nimmt den Endtag mit, wenn er passt', () => {
    const termine = serienTermine('2026-08-24', '2026-08-30', tag('SUN'))
    expect(alsText(termine)).toEqual(['2026-08-30'])
  })

  it('ergibt nichts, wenn der Wochentag im Zeitraum nicht vorkommt', () => {
    // Montag bis Freitag enthaelt keinen Sonntag.
    const termine = serienTermine('2026-08-24', '2026-08-28', tag('SUN'))
    expect(termine).toEqual([])
  })

  it('vertraegt einen umgekehrten Zeitraum', () => {
    expect(serienTermine('2026-08-31', '2026-08-01', tag('SUN'))).toEqual([])
  })

  it('vertraegt fehlende Angaben', () => {
    expect(serienTermine(null, '2026-08-31', tag('SUN'))).toEqual([])
    expect(serienTermine('2026-08-01', undefined, tag('SUN'))).toEqual([])
  })

  it('nimmt dayjs-Objekte genauso wie Zeichenketten', () => {
    const termine = serienTermine(
      dayjs('2026-08-01'),
      dayjs('2026-08-16'),
      tag('SAT')
    )
    expect(alsText(termine)).toEqual(['2026-08-01', '2026-08-08', '2026-08-15'])
  })

  it('bleibt bei der Obergrenze stehen', () => {
    // Zehn Jahre Sonntage waeren rund 520 Termine - der Server nimmt
    // hoechstens MAX_SERIENTERMINE an, die Vorschau darf also nicht mehr
    // zeigen, als angelegt werden kann.
    const termine = serienTermine('2026-01-01', '2036-01-01', tag('SUN'))
    expect(termine).toHaveLength(MAX_SERIENTERMINE)
  })

  it('trifft jeden Wochentag richtig', () => {
    for (const w of WOCHENTAGE) {
      const termine = serienTermine('2026-08-01', '2026-08-31', w.dayjsTag)
      expect(termine.length).toBeGreaterThan(0)
      for (const t of termine) {
        expect(t.day()).toBe(w.dayjsTag)
      }
    }
  })
})

describe('vergleicheOptionen', () => {
  const p = (nachname, tage) => ({
    firstname: 'A',
    lastname: nachname,
    lastAssignmentDaysBefore: tage,
  })

  it('stellt den laengsten Abstand nach vorn', () => {
    const sortiert = [p('Kurz', 3), p('Lang', 40), p('Mittel', 14)]
      .sort(vergleicheOptionen)
      .map((x) => x.lastname)

    expect(sortiert).toEqual(['Lang', 'Mittel', 'Kurz'])
  })

  it('stellt "noch nie eingeteilt" ganz nach vorn', () => {
    // Mit -1 als Ersatzwert - so stand es vorher im Code - waere null der
    // kleinste Abstand gewesen und damit ganz hinten gelandet. Genau
    // umgekehrt: wer noch nie dran war, ist am ehesten fällig.
    const sortiert = [p('Lang', 40), p('Nie', null), p('Kurz', 3)]
      .sort(vergleicheOptionen)
      .map((x) => x.lastname)

    expect(sortiert).toEqual(['Nie', 'Lang', 'Kurz'])
  })

  it('sortiert bei gleichem Abstand alphabetisch', () => {
    const sortiert = [p('Zeller', 7), p('Bauer', 7), p('Müller', 7)]
      .sort(vergleicheOptionen)
      .map((x) => x.lastname)

    expect(sortiert).toEqual(['Bauer', 'Müller', 'Zeller'])
  })
})

describe('gruppiereOptionen', () => {
  it('ordnet nach Verfuegbarkeit und laesst leere Gruppen weg', () => {
    const gruppen = gruppiereOptionen([
      { id: 1, firstname: 'A', lastname: 'Eins', status: 'banned' },
      { id: 2, firstname: 'B', lastname: 'Zwei', status: 'ok' },
      { id: 3, firstname: 'C', lastname: 'Drei', status: 'ok' },
    ])

    expect(gruppen.map((g) => g.status)).toEqual(['ok', 'banned'])
    expect(gruppen[0].eintraege).toHaveLength(2)
  })

  it('ergibt eine leere Liste ohne Eintraege', () => {
    expect(gruppiereOptionen([])).toEqual([])
  })
})

describe('abstandText', () => {
  it('benennt die Sonderfaelle', () => {
    expect(abstandText({ lastAssignmentDaysBefore: null })).toBe('noch nie eingeteilt')
    expect(abstandText({})).toBe('noch nie eingeteilt')
    expect(abstandText({ lastAssignmentDaysBefore: 0 })).toBe('heute schon eingeteilt')
    expect(abstandText({ lastAssignmentDaysBefore: 1 })).toBe('zuletzt gestern')
    expect(abstandText({ lastAssignmentDaysBefore: 14 })).toBe('zuletzt vor 14 Tagen')
  })
})
