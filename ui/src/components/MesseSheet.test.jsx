import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AppProviders from '../AppProviders'
import MesseSheet from './MesseSheet'

const ORTE = [
  { id: 1, name: 'Stadtpfarrkirche' },
  { id: 2, name: 'Spitalkirche' },
]

const MESSE = {
  id: 42,
  name: 'Vorabendmesse',
  dateBegin: '2026-09-05',
  timeBegin: '18:30:00',
  locationId: 1,
  minimalUser: 8,
  ignoreWeekday: false,
  assignedUserIds: [1, 2, 3],
}

// Das Sheet selbst ist ebenfalls ein dialog (antd Drawer). Die Rueckfrage ist
// die einzige mit der Klasse ant-modal-confirm.
async function rueckfrage() {
  return waitFor(() => {
    const el = document.querySelector('.ant-modal-confirm')
    if (!el) throw new Error('Rueckfrage nicht offen')
    return el
  })
}

function zeige(props = {}) {
  const onSpeichern = vi.fn().mockResolvedValue(true)
  const onAendern = vi.fn().mockResolvedValue(true)
  const onLoeschen = vi.fn().mockResolvedValue(true)
  const onClose = vi.fn()

  render(
    <AppProviders>
      <MesseSheet
        open
        onClose={onClose}
        locationList={ORTE}
        onSpeichern={onSpeichern}
        onAendern={onAendern}
        onLoeschen={onLoeschen}
        messe={null}
        {...props}
      />
    </AppProviders>
  )
  return { onSpeichern, onAendern, onLoeschen, onClose }
}

describe('MesseSheet', () => {
  it('traegt beim Bearbeiten die Werte der Messe ein', () => {
    zeige({ messe: MESSE })

    expect(screen.getByLabelText('Name')).toHaveValue('Vorabendmesse')
    expect(screen.getByLabelText('Datum')).toHaveValue('05.09.2026')
    // Die Zeit kommt als HH:mm:ss - ohne Formatangabe ergibt dayjs daraus ein
    // ungueltiges Datum und das Feld bliebe leer.
    expect(screen.getByLabelText('Uhrzeit')).toHaveValue('18:30')
    expect(screen.getByLabelText('Vorgesehene Anzahl Ministranten')).toHaveValue('8')
  })

  it('bietet beim Bearbeiten keine Serie an', () => {
    // Es geht um genau diesen einen Termin.
    zeige({ messe: MESSE })

    expect(screen.queryByText('Serie')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeInTheDocument()
  })

  it('bietet beim Anlegen die Serie an und kein Loeschen', () => {
    zeige()

    expect(screen.getByText('Serie')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Löschen' })).not.toBeInTheDocument()
  })

  it('meldet die Aenderung mit der Id der Messe', async () => {
    const nutzer = userEvent.setup()
    const { onAendern } = zeige({ messe: MESSE })

    await nutzer.clear(screen.getByLabelText('Name'))
    await nutzer.type(screen.getByLabelText('Name'), 'Hochamt')
    await nutzer.click(screen.getByRole('button', { name: 'Speichern' }))

    await waitFor(() => expect(onAendern).toHaveBeenCalledOnce())
    const [id, daten] = onAendern.mock.calls[0]
    expect(id).toBe(42)
    expect(daten).toMatchObject({
      name: 'Hochamt',
      dateBegin: '2026-09-05',
      timeBegin: '18:30:00',
      locationId: 1,
      minimalUser: 8,
    })
  })

  it('nennt beim Loeschen die Zahl der Einteilungen und loescht erst danach', async () => {
    // Eine Messe mit Einteilungen zu loeschen ist etwas anderes als eine leere
    // - die Zahl gehoert in die Rueckfrage.
    const nutzer = userEvent.setup()
    const { onLoeschen } = zeige({ messe: MESSE })

    await nutzer.click(screen.getByRole('button', { name: 'Löschen' }))

    const dialog = await rueckfrage()
    expect(
      within(dialog).getByText(/3 Einteilungen werden mit entfernt/)
    ).toBeInTheDocument()
    expect(onLoeschen).not.toHaveBeenCalled()

    await nutzer.click(within(dialog).getByRole('button', { name: 'Löschen' }))
    await waitFor(() => expect(onLoeschen).toHaveBeenCalledExactlyOnceWith(42))
  })

  it('sagt bei einer leeren Messe nichts von Einteilungen', async () => {
    const nutzer = userEvent.setup()
    zeige({ messe: { ...MESSE, assignedUserIds: [] } })

    await nutzer.click(screen.getByRole('button', { name: 'Löschen' }))

    const dialog = await rueckfrage()
    expect(within(dialog).queryByText(/Einteilung/)).not.toBeInTheDocument()
  })

  it('loescht nicht, wenn die Rueckfrage abgebrochen wird', async () => {
    const nutzer = userEvent.setup()
    const { onLoeschen } = zeige({ messe: MESSE })

    await nutzer.click(screen.getByRole('button', { name: 'Löschen' }))
    const dialog = await rueckfrage()
    await nutzer.click(within(dialog).getByRole('button', { name: 'Abbrechen' }))

    expect(onLoeschen).not.toHaveBeenCalled()
  })
})
