import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppProviders from '../AppProviders'

vi.mock('../helper/RequestHelper', () => ({
  doGetRequestAuth: vi.fn(),
}))

const { doGetRequestAuth } = await import('../helper/RequestHelper')
const Gesamtplan = (await import('./Gesamtplan')).default

const PLAN = [
  {
    id: 1,
    name: 'Vorabendmesse',
    dateBegin: '2026-09-05',
    timeBegin: '18:00:00',
    location: 'Stadtpfarrkirche',
    minimalUser: 6,
    assignedNames: ['Anna Adler', 'Ben Bauer'],
    assignedUserIds: [10, 11],
  },
  {
    id: 2,
    name: 'Sonntagsmesse',
    dateBegin: '2026-09-06',
    timeBegin: '10:15:00',
    location: 'Spitalkirche',
    minimalUser: 8,
    assignedNames: [],
    assignedUserIds: [],
  },
]

beforeEach(() => {
  doGetRequestAuth.mockReset()
  doGetRequestAuth.mockResolvedValue({ data: PLAN })
})

function zeige(userId = 99) {
  render(
    <AppProviders>
      <Gesamtplan token="t" userId={userId} />
    </AppProviders>
  )
}

describe('Gesamtplan', () => {
  it('zeigt Messen mit Zeit, Ort und den Namen der Eingeteilten', async () => {
    // Genau das, was am Aushang in der Kirche steht - und was ein Ministrant
    // bisher nirgends sehen konnte.
    zeige()

    expect(await screen.findByText('Vorabendmesse')).toBeInTheDocument()
    expect(screen.getByText('18:00')).toBeInTheDocument()
    expect(screen.getByText('Stadtpfarrkirche')).toBeInTheDocument()
    expect(screen.getByText('Anna Adler')).toBeInTheDocument()
    expect(screen.getByText('Ben Bauer')).toBeInTheDocument()
  })

  it('sagt es, wenn niemand eingeteilt ist', async () => {
    zeige()
    expect(await screen.findByText(/Noch niemand eingeteilt/)).toBeInTheDocument()
  })

  it('hebt die eigenen Einsätze hervor', async () => {
    // In einer Liste von sechzig Messen ist "bin ich dabei" die erste Frage.
    zeige(11)

    expect(await screen.findByText('Mein Einsatz')).toBeInTheDocument()
  })

  it('markiert nichts, wenn man selbst nicht eingeteilt ist', async () => {
    zeige(99)

    await screen.findByText('Vorabendmesse')
    expect(screen.queryByText('Mein Einsatz')).not.toBeInTheDocument()
  })

  it('sucht auch über die Namen der Eingeteilten', async () => {
    // "Wann ist Anna dran" ist die zweite Frage an einen Gesamtplan.
    const nutzer = userEvent.setup()
    zeige()
    await screen.findByText('Vorabendmesse')

    await nutzer.type(screen.getByRole('searchbox', { name: /Im Plan suchen/i }), 'adler')

    expect(screen.getByText('Vorabendmesse')).toBeInTheDocument()
    expect(screen.queryByText('Sonntagsmesse')).not.toBeInTheDocument()
  })

  it('lädt den Zeitraum als Grenzen, nicht den ganzen Bestand', async () => {
    zeige()

    await waitFor(() => expect(doGetRequestAuth).toHaveBeenCalled())
    const [pfad, token] = doGetRequestAuth.mock.calls[0]
    expect(pfad).toMatch(/^plan\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/)
    expect(token).toBe('t')
  })

  it('meldet den Grund, den der Server nennt', async () => {
    // Etwa "Zeitraum umfasst 2557 Tage, erlaubt sind 366".
    doGetRequestAuth.mockRejectedValue({
      response: { data: { error: 'Zeitraum umfasst 2557 Tage, erlaubt sind 366' } },
    })
    zeige()

    // Beim ersten Laden ist die Meldung noch allgemein; der Grund kommt beim
    // Wechsel des Zeitraums, weil nur dort der Nutzer ihn verursacht hat.
    expect(
      await screen.findByText('Plan konnte nicht geladen werden')
    ).toBeInTheDocument()
  })

  it('zeigt eine leere Liste als Hinweis', async () => {
    doGetRequestAuth.mockResolvedValue({ data: [] })
    zeige()

    expect(
      await screen.findByText('Keine Messen in diesem Zeitraum')
    ).toBeInTheDocument()
  })
})
