import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import { describe, expect, it, vi } from 'vitest'
import AppProviders from '../AppProviders'

// In jsdom liefert matchMedia keine Treffer, useIsMobile ergibt damit true -
// die Handy-Variante ist also der Standardfall in den Tests. Fuer die
// PC-Variante wird der Hook ersetzt.
vi.mock('../hooks/useIsMobile', () => ({ default: vi.fn(() => true) }))

const useIsMobile = (await import('../hooks/useIsMobile')).default
const ZeitraumWahl = (await import('./ZeitraumWahl')).default

const monat = dayjs().format('YYYY-MM')
const tag = (n) => `${monat}-${String(n).padStart(2, '0')}`

function zeige(props = {}) {
  const onChange = vi.fn()
  render(
    <AppProviders>
      <ZeitraumWahl onChange={onChange} {...props} />
    </AppProviders>
  )
  return { onChange }
}

// antd rendert im offenen Panel je Tag ein <td title="YYYY-MM-DD">.
async function tagImPanelWaehlen(nutzer, n) {
  const zelle = document.querySelector(`td[title="${tag(n)}"]`)
  if (!zelle) throw new Error(`Zelle fuer ${tag(n)} nicht gefunden`)
  await nutzer.click(zelle)
}

describe('ZeitraumWahl', () => {
  it('zeigt am Handy zwei einzelne Datumsfelder', () => {
    // Das Panel des RangePickers ist mit zwei Monaten rund 580px breit und
    // passt auf 390px nicht - der linke Monat lag ausserhalb des Bildschirms.
    zeige()

    expect(screen.getByRole('textbox', { name: 'Zeitraum von' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Zeitraum bis' })).toBeInTheDocument()
  })

  it('meldet das Paar, sobald der Anfang gewaehlt ist', async () => {
    const nutzer = userEvent.setup()
    const { onChange } = zeige()

    await nutzer.click(screen.getByRole('textbox', { name: 'Zeitraum von' }))
    await tagImPanelWaehlen(nutzer, 10)

    expect(onChange).toHaveBeenCalledOnce()
    const [paar] = onChange.mock.calls[0]
    expect(paar[0].format('YYYY-MM-DD')).toBe(tag(10))
    expect(paar[1]).toBeNull()
  })

  it('ergaenzt das Ende zum vorhandenen Anfang', async () => {
    const nutzer = userEvent.setup()
    const { onChange } = zeige({ value: [dayjs(tag(10)), null] })

    await nutzer.click(screen.getByRole('textbox', { name: 'Zeitraum bis' }))
    await tagImPanelWaehlen(nutzer, 20)

    const [paar] = onChange.mock.calls[0]
    expect(paar[0].format('YYYY-MM-DD')).toBe(tag(10))
    expect(paar[1].format('YYYY-MM-DD')).toBe(tag(20))
  })

  it('sperrt im Bis-Feld die Tage vor dem Anfang', async () => {
    const nutzer = userEvent.setup()
    zeige({ value: [dayjs(tag(15)), null] })

    await nutzer.click(screen.getByRole('textbox', { name: 'Zeitraum bis' }))

    // Ein Ende vor dem Anfang waere nur eine Fehlermeldung wert - besser gar
    // nicht anwaehlbar.
    const davor = document.querySelector(`td[title="${tag(10)}"]`)
    const danach = document.querySelector(`td[title="${tag(20)}"]`)
    expect(davor.className).toMatch(/ant-picker-cell-disabled/)
    expect(danach.className).not.toMatch(/ant-picker-cell-disabled/)
  })

  it('sperrt im Von-Feld die Tage nach dem Ende', async () => {
    const nutzer = userEvent.setup()
    zeige({ value: [null, dayjs(tag(15))] })

    await nutzer.click(screen.getByRole('textbox', { name: 'Zeitraum von' }))

    const danach = document.querySelector(`td[title="${tag(20)}"]`)
    expect(danach.className).toMatch(/ant-picker-cell-disabled/)
  })

  it('meldet null, wenn beide Seiten geleert werden', () => {
    const { onChange } = zeige({ value: [dayjs(tag(10)), null] })

    // Das Leeren-Kreuz des Von-Feldes. Mit fireEvent statt userEvent, weil
    // antd es bis zum Ueberfahren auf pointer-events: none stellt - und
    // jsdom berechnet kein Hover.
    const feld = screen.getByRole('textbox', { name: 'Zeitraum von' })
    const leeren = feld.closest('.ant-picker').querySelector('.ant-picker-clear')
    fireEvent.click(leeren)

    // So verhaelt sich der RangePicker beim Leeren ebenfalls - die Aufrufer
    // pruefen auf value?.[0].
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('nutzt am PC den RangePicker', () => {
    useIsMobile.mockReturnValue(false)
    zeige()

    // Dort ist Platz fuer zwei Monate nebeneinander, und die Bedienung mit
    // einem Feld ist bequemer.
    expect(screen.getByPlaceholderText('Startdatum')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enddatum')).toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: 'Zeitraum von' })
    ).not.toBeInTheDocument()

    useIsMobile.mockReturnValue(true)
  })
})
