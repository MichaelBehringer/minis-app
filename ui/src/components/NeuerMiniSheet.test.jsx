import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppProviders from '../AppProviders'

vi.mock('../helper/RequestHelper', () => ({
  doPostRequestAuth: vi.fn(),
}))

const { doPostRequestAuth } = await import('../helper/RequestHelper')
const NeuerMiniSheet = (await import('./NeuerMiniSheet')).default

const ROLLEN = [
  { id: 1, name: 'Ministrant' },
  { id: 2, name: 'Ministrantenrat' },
  { id: 3, name: 'Admin' },
]

function zeige(props = {}) {
  const onCreated = vi.fn()
  const onClose = vi.fn()
  render(
    <AppProviders>
      <NeuerMiniSheet
        open
        onClose={onClose}
        onCreated={onCreated}
        token="t"
        rollen={ROLLEN}
        editorRoleId={2}
        {...props}
      />
    </AppProviders>
  )
  return { onCreated, onClose }
}

async function ausfuellen(nutzer, { vorname = 'Anna', nachname = 'Adler' } = {}) {
  await nutzer.type(screen.getByLabelText('Vorname'), vorname)
  await nutzer.type(screen.getByLabelText('Nachname'), nachname)
  await nutzer.type(screen.getByLabelText('Passwort'), 'start123')
}

beforeEach(() => {
  doPostRequestAuth.mockReset()
  doPostRequestAuth.mockResolvedValue({ data: { id: 62 } })
})

describe('NeuerMiniSheet', () => {
  it('schlägt den Benutzernamen aus den Namen vor', async () => {
    const nutzer = userEvent.setup()
    zeige()

    await ausfuellen(nutzer, { vorname: 'Stephan', nachname: 'Bodenmüller' })

    // Muster des Bestands: Nachname klein, Umlaute ausgeschrieben, dann der
    // erste Buchstabe des Vornamens.
    expect(screen.getByLabelText('Benutzername')).toHaveValue('bodenmuellers')
  })

  it('lässt einen selbst getippten Benutzernamen in Ruhe', async () => {
    const nutzer = userEvent.setup()
    zeige()

    await nutzer.type(screen.getByLabelText('Benutzername'), 'eigenername')
    await nutzer.type(screen.getByLabelText('Vorname'), 'Anna')
    await nutzer.type(screen.getByLabelText('Nachname'), 'Adler')

    expect(screen.getByLabelText('Benutzername')).toHaveValue('eigenername')
  })

  it('legt den Ministranten an und meldet es weiter', async () => {
    const nutzer = userEvent.setup()
    const { onCreated } = zeige()

    await ausfuellen(nutzer)
    await nutzer.click(screen.getByRole('button', { name: 'Anlegen' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce())
    expect(doPostRequestAuth).toHaveBeenCalledWith(
      'user',
      {
        firstname: 'Anna',
        lastname: 'Adler',
        username: 'adlera',
        password: 'start123',
        roleId: 1,
        active: 1,
        incense: 0,
        phone: '',
        email: '',
      },
      't'
    )
  })

  it('schickt Telefon und E-Mail mit', async () => {
    const nutzer = userEvent.setup()
    zeige()

    await ausfuellen(nutzer)
    await nutzer.type(screen.getByLabelText('Telefon'), '09092 12345')
    await nutzer.type(screen.getByLabelText('E-Mail'), 'eltern@example.org')
    await nutzer.click(screen.getByRole('button', { name: 'Anlegen' }))

    await waitFor(() => expect(doPostRequestAuth).toHaveBeenCalledOnce())
    expect(doPostRequestAuth.mock.calls[0][1]).toMatchObject({
      phone: '09092 12345',
      email: 'eltern@example.org',
    })
  })

  it('weist eine unbrauchbare E-Mail-Adresse ab', async () => {
    const nutzer = userEvent.setup()
    zeige()

    await ausfuellen(nutzer)
    await nutzer.type(screen.getByLabelText('E-Mail'), 'keine-adresse')
    await nutzer.click(screen.getByRole('button', { name: 'Anlegen' }))

    expect(doPostRequestAuth).not.toHaveBeenCalled()
    expect(
      await screen.findByText('Das sieht nicht wie eine E-Mail-Adresse aus')
    ).toBeInTheDocument()
  })

  it('legt ohne Pflichtangaben nichts an', async () => {
    const nutzer = userEvent.setup()
    const { onCreated } = zeige()

    await nutzer.click(screen.getByRole('button', { name: 'Anlegen' }))

    expect(doPostRequestAuth).not.toHaveBeenCalled()
    expect(onCreated).not.toHaveBeenCalled()
    expect(await screen.findByText('Bitte Vornamen angeben')).toBeInTheDocument()
  })

  it('nennt den Grund, wenn der Benutzername vergeben ist', async () => {
    // Der häufigste Fall bei 61 vorhandenen Namen - und kein Serverfehler.
    doPostRequestAuth.mockRejectedValue({
      response: { status: 409, data: { error: 'Dieser Benutzername ist schon vergeben' } },
    })
    const nutzer = userEvent.setup()
    const { onCreated } = zeige()

    await ausfuellen(nutzer)
    await nutzer.click(screen.getByRole('button', { name: 'Anlegen' }))

    expect(
      await screen.findByText('Dieser Benutzername ist schon vergeben')
    ).toBeInTheDocument()
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('bietet keine höhere Rolle an als die eigene', async () => {
    const nutzer = userEvent.setup()
    zeige({ editorRoleId: 2 })

    await nutzer.click(screen.getByLabelText('Rolle'))

    expect(await screen.findByTitle('Ministrantenrat')).toBeInTheDocument()
    expect(screen.queryByTitle('Admin')).not.toBeInTheDocument()
  })
})
