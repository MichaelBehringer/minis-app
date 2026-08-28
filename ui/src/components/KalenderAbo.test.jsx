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

// navigator.userAgent ist schreibgeschuetzt; fuer den Android-Fall wird er
// gezielt ueberschrieben und danach zurueckgesetzt.
const echterUA = navigator.userAgent

function setzeUA(wert) {
  Object.defineProperty(navigator, 'userAgent', { value: wert, configurable: true })
}

function zeige() {
  render(
    <AppProviders>
      <KalenderAbo userId={7} token="t" />
    </AppProviders>
  )
}

beforeEach(() => {
  setzeUA(echterUA)
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

  it('verlinkt zum Abonnieren über Google', async () => {
    // Google Kalender kann eine Adresse nur über die Weboberfläche abonnieren -
    // dieser Link springt direkt in deren Bestätigungsdialog.
    helper.doGetRequestAuth.mockResolvedValue({ data: { token: 'abc123' } })
    zeige()

    const knopf = await screen.findByRole('link', {
      name: /Im Google Kalender abonnieren/,
    })
    // webcal, nicht https: mit https lehnt Google den Link ab ("Hinzufügen
    // nicht möglich - URL überprüfen").
    const ziel = encodeURIComponent(`webcal://${window.location.host}/server/ical/abc123`)
    expect(knopf).toHaveAttribute(
      'href',
      `https://calendar.google.com/calendar/render?cid=${ziel}`
    )
    // Aus einer installierten PWA heraus gäbe es sonst keinen Weg zurück.
    expect(knopf).toHaveAttribute('target', '_blank')
  })

  it('stellt auf Android den Google-Weg voran', async () => {
    // Auf Android meldet sich keine Kalender-App für webcal:// an, der Klick
    // verpufft dort ohne Meldung. Deshalb steht Google oben.
    setzeUA('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/151.0.0.0')
    helper.doGetRequestAuth.mockResolvedValue({ data: { token: 'abc123' } })
    zeige()

    await screen.findByRole('link', { name: /Im Google Kalender abonnieren/ })
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAccessibleName(/Im Google Kalender abonnieren/)
  })

  it('stellt ohne Android webcal voran', async () => {
    setzeUA('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1')
    helper.doGetRequestAuth.mockResolvedValue({ data: { token: 'abc123' } })
    zeige()

    await screen.findByRole('link', { name: /Im Kalender abonnieren/ })
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAccessibleName(/Im Kalender abonnieren/)
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
