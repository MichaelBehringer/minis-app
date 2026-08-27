import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppProviders from '../AppProviders'

vi.mock('../helper/RequestHelper', () => ({
  doGetRequestAuth: vi.fn(),
  doPostRequestAuth: vi.fn(),
}))

const helper = await import('../helper/RequestHelper')
const KalenderAbo = (await import('./KalenderAbo')).default

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
      <KalenderAbo userId={7} token="t" />
    </AppProviders>
  )
}

beforeEach(() => {
  helper.doGetRequestAuth.mockReset()
  helper.doPostRequestAuth.mockReset()
  helper.doGetRequestAuth.mockResolvedValue({ data: { token: '' } })
  helper.doPostRequestAuth.mockResolvedValue({ data: { token: 'neu-erzeugt' } })
})

describe('KalenderAbo', () => {
  it('bietet ohne Abo nur das Erzeugen an', async () => {
    zeige()

    expect(
      await screen.findByRole('button', { name: /Kalender-Link erzeugen/ })
    ).toBeInTheDocument()
    // Ohne Link gibt es nichts zu kopieren und nichts zu widerrufen.
    expect(screen.queryByLabelText('Adresse des Kalender-Abos')).not.toBeInTheDocument()
  })

  it('erzeugt den Link und zeigt danach die Adresse', async () => {
    const nutzer = userEvent.setup()
    zeige()

    await nutzer.click(
      await screen.findByRole('button', { name: /Kalender-Link erzeugen/ })
    )

    await waitFor(() =>
      expect(helper.doPostRequestAuth).toHaveBeenCalledWith('user/7/calendar', {}, 't')
    )
    expect(screen.getByLabelText('Adresse des Kalender-Abos')).toHaveValue(
      `${window.location.origin}/server/ical/neu-erzeugt`
    )
  })

  it('verlinkt zum Abonnieren über webcal', async () => {
    // Auf iOS und macOS öffnet webcal:// direkt den Abonnieren-Dialog.
    helper.doGetRequestAuth.mockResolvedValue({ data: { token: 'abc123' } })
    zeige()

    const knopf = await screen.findByRole('link', { name: /Im Kalender abonnieren/ })
    expect(knopf).toHaveAttribute('href', expect.stringContaining('webcal:'))
    expect(knopf).toHaveAttribute('href', expect.stringContaining('/server/ical/abc123'))
  })

  it('warnt, dass der Link ein Schlüssel ist', async () => {
    helper.doGetRequestAuth.mockResolvedValue({ data: { token: 'abc123' } })
    zeige()

    expect(await screen.findByText('Der Link ist wie ein Schlüssel')).toBeInTheDocument()
  })

  it('fragt nach, bevor ein neuer Link den alten ersetzt', async () => {
    // Ein Kalender, der den alten abonniert hat, muss neu eingerichtet werden -
    // das gehört gesagt, bevor es passiert.
    helper.doGetRequestAuth.mockResolvedValue({ data: { token: 'abc123' } })
    const nutzer = userEvent.setup()
    zeige()

    await nutzer.click(
      await screen.findByRole('button', { name: /Neuen Link erzeugen/ })
    )

    const dialog = await rueckfrage()
    expect(helper.doPostRequestAuth).not.toHaveBeenCalled()

    await nutzer.click(within(dialog).getByRole('button', { name: 'Neuen Link erzeugen' }))
    await waitFor(() => expect(helper.doPostRequestAuth).toHaveBeenCalledOnce())
  })

  it('behält den alten Link, wenn die Rückfrage abgebrochen wird', async () => {
    helper.doGetRequestAuth.mockResolvedValue({ data: { token: 'abc123' } })
    const nutzer = userEvent.setup()
    zeige()

    await nutzer.click(
      await screen.findByRole('button', { name: /Neuen Link erzeugen/ })
    )
    const dialog = await rueckfrage()
    await nutzer.click(within(dialog).getByRole('button', { name: 'Abbrechen' }))

    expect(helper.doPostRequestAuth).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Adresse des Kalender-Abos')).toHaveValue(
      `${window.location.origin}/server/ical/abc123`
    )
  })
})
