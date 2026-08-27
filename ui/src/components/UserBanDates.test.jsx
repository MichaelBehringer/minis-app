import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppProviders from '../AppProviders'

// Die Aufrufe zum Server ersetzen. Geprueft wird die Bedienung, nicht axios.
vi.mock('../helper/RequestHelper', () => ({
  doGetRequestAuth: vi.fn(),
  doPatchRequestAuth: vi.fn(),
}))

const { doGetRequestAuth, doPatchRequestAuth } = await import(
  '../helper/RequestHelper'
)
const UserBanDates = (await import('./UserBanDates')).default

// Der Kalender startet im aktuellen Monat, die Tage darin sind also die, die
// sich antippen lassen.
const monat = dayjs().format('YYYY-MM')
const tag = (n) => `${monat}-${String(n).padStart(2, '0')}`

// antd rendert je Tag ein <td title="YYYY-MM-DD"> ohne eigene Rolle - der
// title ist damit der zuverlaessige Zugriff.
function zelleAntippen(nutzer, n) {
  const zelle = document.querySelector(`td[title="${tag(n)}"]`)
  if (!zelle) throw new Error(`Zelle fuer ${tag(n)} nicht gefunden`)
  return nutzer.click(zelle)
}

function zeige() {
  render(
    <AppProviders>
      <UserBanDates userId={9} token="test-token" />
    </AppProviders>
  )
}

async function geladen() {
  await waitFor(() => expect(doGetRequestAuth).toHaveBeenCalled())
  await waitFor(() =>
    expect(screen.getByText(/künftige Sperrungen/)).toBeInTheDocument()
  )
}

describe('UserBanDates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    doGetRequestAuth.mockResolvedValue({ data: [] })
    doPatchRequestAuth.mockResolvedValue({ data: { status: 'ok', count: 11 } })
  })

  it('trennt kuenftige von vergangenen Sperrungen', async () => {
    doGetRequestAuth.mockResolvedValue({
      data: [dayjs().add(1, 'day').format('YYYY-MM-DD'), '2020-01-01'],
    })

    zeige()
    await geladen()

    // Der Bestand hat im Schnitt 63 Sperrtage pro Person, davon rund vier
    // Fuenftel in der Vergangenheit - die Trennung ist der Grund, warum die
    // Zahl ueberhaupt dasteht.
    const zeile = screen.getByText(/künftige Sperrungen/).closest('span')
    expect(zeile.textContent).toMatch(/1\s*künftige Sperrungen/)
    expect(zeile.textContent).toMatch(/1 in der Vergangenheit/)
  })

  it('sperrt im Einzelmodus einen Tag mit einem Tippen', async () => {
    const nutzer = userEvent.setup()
    zeige()
    await geladen()

    await zelleAntippen(nutzer, 15)

    expect(doPatchRequestAuth).toHaveBeenCalledExactlyOnceWith(
      'user/9/ban',
      { date: tag(15), add: true },
      'test-token'
    )
  })

  it('hebt im Einzelmodus eine bestehende Sperrung wieder auf', async () => {
    const nutzer = userEvent.setup()
    doGetRequestAuth.mockResolvedValue({ data: [tag(15)] })
    zeige()
    await geladen()

    await zelleAntippen(nutzer, 15)

    expect(doPatchRequestAuth).toHaveBeenCalledExactlyOnceWith(
      'user/9/ban',
      { date: tag(15), add: false },
      'test-token'
    )
  })

  it('sperrt im Bereichsmodus mit zwei Tippen den ganzen Zeitraum', async () => {
    const nutzer = userEvent.setup()
    zeige()
    await geladen()

    await nutzer.click(screen.getByText('Bereich'))

    // Erstes Tippen setzt nur den Anfang - noch keine Anfrage.
    await zelleAntippen(nutzer, 10)
    expect(doPatchRequestAuth).not.toHaveBeenCalled()
    expect(screen.getByText(/Anfang: 10\./)).toBeInTheDocument()

    // Zweites Tippen schliesst den Bereich ab: eine Anfrage fuer elf Tage,
    // nicht elf Anfragen.
    await zelleAntippen(nutzer, 20)

    expect(doPatchRequestAuth).toHaveBeenCalledExactlyOnceWith(
      'user/9/ban/range',
      { from: tag(10), to: tag(20), add: true },
      'test-token'
    )
  })

  it('vertraegt einen Bereich, der rueckwaerts angetippt wird', async () => {
    const nutzer = userEvent.setup()
    zeige()
    await geladen()

    await nutzer.click(screen.getByText('Bereich'))
    await zelleAntippen(nutzer, 20)
    await zelleAntippen(nutzer, 10)

    // Die Grenzen gehen so raus, wie sie angetippt wurden - der Server dreht
    // sie um. Hier zaehlt, dass es genau eine Anfrage ist.
    expect(doPatchRequestAuth).toHaveBeenCalledExactlyOnceWith(
      'user/9/ban/range',
      { from: tag(20), to: tag(10), add: true },
      'test-token'
    )
  })

  it('verwirft einen halb gesetzten Bereich beim Moduswechsel', async () => {
    const nutzer = userEvent.setup()
    zeige()
    await geladen()

    await nutzer.click(screen.getByText('Bereich'))
    await zelleAntippen(nutzer, 10)
    expect(screen.getByText(/Anfang: 10\./)).toBeInTheDocument()

    await nutzer.click(screen.getByText('Einzeln'))

    // Ohne das Zuruecksetzen haette ein spaeterer Wechsel zurueck in den
    // Bereichsmodus vom alten Anfang aus gesperrt.
    expect(screen.queryByText(/Anfang: 10\./)).not.toBeInTheDocument()
  })

  it('meldet den Grund, den der Server nennt', async () => {
    const nutzer = userEvent.setup()
    doPatchRequestAuth.mockRejectedValue({
      response: {
        data: { error: 'Zeitraum umfasst 400 Tage, erlaubt sind 366' },
      },
    })
    zeige()
    await geladen()

    await nutzer.click(screen.getByText('Bereich'))
    await zelleAntippen(nutzer, 10)
    await zelleAntippen(nutzer, 20)

    await waitFor(() =>
      expect(screen.getByText(/erlaubt sind 366/)).toBeInTheDocument()
    )
  })

  it('hat keine Jahresansicht, dafuer Monatspfeile', async () => {
    zeige()
    await geladen()

    // Die eingebaute Kopfzeile haette einen Umschalter Monat/Jahr und zwei
    // Auswahlfelder - genau die, die untereinander umgebrochen sind.
    expect(screen.queryByText('Jahr')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Vorheriger Monat' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Nächster Monat' })
    ).toBeInTheDocument()
  })

  it('blaettert mit den Pfeilen durch die Monate', async () => {
    const nutzer = userEvent.setup()
    zeige()
    await geladen()

    const aktuell = dayjs().format('MMMM YYYY')
    expect(screen.getByText(aktuell)).toBeInTheDocument()

    await nutzer.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    expect(
      screen.getByText(dayjs().add(1, 'month').format('MMMM YYYY'))
    ).toBeInTheDocument()

    // Heute ist im aktuellen Monat gesperrt und wird erst hier benutzbar.
    await nutzer.click(screen.getByRole('button', { name: 'Heute' }))
    expect(screen.getByText(aktuell)).toBeInTheDocument()
  })
})
