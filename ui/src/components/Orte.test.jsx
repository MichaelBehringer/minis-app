import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppProviders from '../AppProviders'

vi.mock('../helper/RequestHelper', () => ({
  doGetRequestAuth: vi.fn(),
  doPostRequestAuth: vi.fn(),
  doPatchRequestAuth: vi.fn(),
  doDeleteRequestAuth: vi.fn(),
}))

const helper = await import('../helper/RequestHelper')
const Orte = (await import('./Orte')).default

// Der Bestand: dazu gehört location 5 mit einem Namen aus einem Leerzeichen.
const ORTE = [
  { id: 1, name: 'Stadtpfarrkirche' },
  { id: 5, name: ' ' },
]

async function rueckfrage() {
  return waitFor(() => {
    const el = document.querySelector('.ant-modal-confirm')
    if (!el) throw new Error('Rueckfrage nicht offen')
    return el
  })
}

function zeige() {
  render(
    <AppProviders>
      <Orte token="t" />
    </AppProviders>
  )
}

beforeEach(() => {
  for (const fn of Object.values(helper)) fn.mockReset()
  helper.doGetRequestAuth.mockResolvedValue({ data: ORTE })
  helper.doPostRequestAuth.mockResolvedValue({ data: { id: 7 } })
  helper.doPatchRequestAuth.mockResolvedValue({ data: {} })
  helper.doDeleteRequestAuth.mockResolvedValue({ data: {} })
})

describe('Orte', () => {
  it('macht einen Ort ohne Namen sichtbar', async () => {
    // Genau der Fall, der behoben werden soll: location 5 heißt ' ' und sieht
    // in einer Liste wie eine leere Zeile aus.
    zeige()

    expect(await screen.findByText('Stadtpfarrkirche')).toBeInTheDocument()
    expect(screen.getByText(/ohne Namen — bitte umbenennen/)).toBeInTheDocument()
  })

  it('legt einen Ort an', async () => {
    const nutzer = userEvent.setup()
    zeige()
    await screen.findByText('Stadtpfarrkirche')

    await nutzer.type(screen.getByLabelText('Neuer Ort'), '  Wallfahrtskirche  ')
    await nutzer.click(screen.getByRole('button', { name: 'Anlegen' }))

    // Getrimmt: ein Name aus Leerzeichen ist genau der Fehler im Bestand.
    await waitFor(() =>
      expect(helper.doPostRequestAuth).toHaveBeenCalledWith(
        'location',
        { name: 'Wallfahrtskirche' },
        't'
      )
    )
  })

  it('legt ohne Namen nichts an', async () => {
    zeige()
    await screen.findByText('Stadtpfarrkirche')

    expect(screen.getByRole('button', { name: 'Anlegen' })).toBeDisabled()
  })

  it('benennt einen Ort um', async () => {
    const nutzer = userEvent.setup()
    zeige()
    await screen.findByText('Stadtpfarrkirche')

    await nutzer.click(screen.getByRole('button', { name: /Ort ohne Namen umbenennen/ }))
    await nutzer.type(screen.getByLabelText('Name des Ortes'), 'Kloster')
    await nutzer.click(screen.getByRole('button', { name: 'Speichern' }))

    await waitFor(() =>
      expect(helper.doPatchRequestAuth).toHaveBeenCalledWith(
        'location/5',
        { name: 'Kloster' },
        't'
      )
    )
  })

  it('fragt vor dem Löschen und nennt den Grund bei Belegung', async () => {
    helper.doDeleteRequestAuth.mockRejectedValue({
      response: { status: 409, data: { error: 'An diesem Ort hängen noch Messen (113)' } },
    })
    const nutzer = userEvent.setup()
    zeige()
    await screen.findByText('Stadtpfarrkirche')

    await nutzer.click(screen.getByRole('button', { name: /Stadtpfarrkirche löschen/ }))
    const dialog = await rueckfrage()
    expect(helper.doDeleteRequestAuth).not.toHaveBeenCalled()

    await nutzer.click(within(dialog).getByRole('button', { name: 'Löschen' }))

    expect(
      await screen.findByText('An diesem Ort hängen noch Messen (113)')
    ).toBeInTheDocument()
  })
})
