import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AppProviders from '../AppProviders'
import AssignSheet from './AssignSheet'

const EVENT = { id: 7, name: 'Vorabendmesse', minimalUser: 3 }

const OPTIONEN = [
  {
    id: 1,
    firstname: 'Anna',
    lastname: 'Adler',
    status: 'ok',
    lastAssignmentDaysBefore: 21,
    preferredWith: [2],
  },
  {
    id: 2,
    firstname: 'Ben',
    lastname: 'Bauer',
    status: 'ok',
    lastAssignmentDaysBefore: null,
    preferredWith: [],
  },
  {
    id: 3,
    firstname: 'Clara',
    lastname: 'Christ',
    status: 'banned',
    lastAssignmentDaysBefore: 5,
    preferredWith: [],
  },
  {
    id: 4,
    firstname: 'Dora',
    lastname: 'Dorn',
    status: 'inactive',
    lastAssignmentDaysBefore: 200,
    preferredWith: [],
  },
]

function zeige(props = {}) {
  const onToggle = vi.fn()
  const onClose = vi.fn()

  render(
    <AppProviders>
      <AssignSheet
        open
        onClose={onClose}
        event={EVENT}
        optionen={OPTIONEN}
        laedt={false}
        zugewiesen={[]}
        onToggle={onToggle}
        {...props}
      />
    </AppProviders>
  )

  return { onToggle, onClose }
}

describe('AssignSheet', () => {
  it('zeigt die Abschnitte nach Verfuegbarkeit', () => {
    zeige()

    expect(screen.getByText(/^Kann \(2\)$/)).toBeInTheDocument()
    expect(screen.getByText(/^Gesperrt \(1\)$/)).toBeInTheDocument()
    expect(screen.getByText(/^Inaktiv \(1\)$/)).toBeInTheDocument()
  })

  it('stellt "noch nie eingeteilt" vor den laengsten Abstand', () => {
    zeige()

    // Ben war noch nie dran, Anna vor 21 Tagen - Ben gehoert nach oben.
    const zeilen = screen.getAllByRole('button', { name: /Adler|Bauer/ })
    expect(zeilen[0]).toHaveAccessibleName(/Bauer/)
    expect(zeilen[1]).toHaveAccessibleName(/Adler/)
  })

  it('meldet ein Antippen mit der Id des Ministranten', async () => {
    const nutzer = userEvent.setup()
    const { onToggle } = zeige()

    await nutzer.click(screen.getByRole('button', { name: /Anna Adler/ }))

    expect(onToggle).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('zeigt bereits Eingeteilte als gedrueckt', () => {
    zeige({ zugewiesen: [1] })

    expect(screen.getByRole('button', { name: /Anna Adler/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: /Ben Bauer/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('loest die Ids der Wunschpartner in Namen auf', () => {
    // Das Backend liefert nur Ids; die Namen stehen in derselben Liste.
    zeige()

    const annaZeile = screen.getByRole('button', { name: /Anna Adler/ })
    expect(within(annaZeile).getByText(/gern mit Ben Bauer/)).toBeInTheDocument()
  })

  it('nennt den Stand gegenueber der vorgesehenen Anzahl', () => {
    zeige({ zugewiesen: [1] })
    expect(screen.getByText(/1 von 3 eingeteilt/)).toBeInTheDocument()
    expect(screen.getByText(/noch 2 nötig/)).toBeInTheDocument()
  })

  it('behandelt mehr als vorgesehen nicht als Fehler', () => {
    // In den echten Daten wird die vorgesehene Anzahl bei 29 von 122 Messen
    // ueberschritten - das darf nicht wie ein Problem aussehen.
    zeige({ zugewiesen: [1, 2, 3, 4] })
    expect(screen.getByText(/mehr als vorgesehen/)).toBeInTheDocument()
  })

  it('filtert ueber die Suche', async () => {
    const nutzer = userEvent.setup()
    zeige()

    await nutzer.type(
      screen.getByRole('searchbox', { name: /nach Namen suchen/i }),
      'clara'
    )

    expect(screen.getByRole('button', { name: /Clara Christ/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Anna Adler/ })).not.toBeInTheDocument()
  })

  it('fragt nach, bevor eine Sperrung uebergangen wird', async () => {
    // Im Bestand liegen 26 Einteilungen auf einem selbst gesperrten Tag.
    // Blockiert wird nichts, aber es soll eine Entscheidung sein.
    const nutzer = userEvent.setup()
    const { onToggle } = zeige()

    await nutzer.click(screen.getByRole('button', { name: /Clara Christ/ }))

    expect(onToggle).not.toHaveBeenCalled()
    // antd rendert den Titel zweimal (sichtbar und fuer Screenreader).
    expect(
      await screen.findAllByText(/Clara Christ hat diesen Tag gesperrt/)
    ).not.toHaveLength(0)

    await nutzer.click(screen.getByRole('button', { name: 'Trotzdem einteilen' }))
    expect(onToggle).toHaveBeenCalledExactlyOnceWith(3)
  })

  it('teilt nach Abbrechen der Rueckfrage nicht ein', async () => {
    const nutzer = userEvent.setup()
    const { onToggle } = zeige()

    await nutzer.click(screen.getByRole('button', { name: /Clara Christ/ }))
    await nutzer.click(screen.getByRole('button', { name: 'Abbrechen' }))

    expect(onToggle).not.toHaveBeenCalled()
  })

  it('fragt auch bei einem inaktiven Ministranten nach', async () => {
    const nutzer = userEvent.setup()
    const { onToggle } = zeige()

    await nutzer.click(screen.getByRole('button', { name: /Dora Dorn/ }))

    expect(onToggle).not.toHaveBeenCalled()
    expect(await screen.findAllByText(/Dora Dorn ist als inaktiv/)).not.toHaveLength(0)
  })

  it('fragt beim Entfernen nicht nach', async () => {
    // Eine Sperrung ist ein Grund, jemanden NICHT einzuteilen - beim
    // Austragen waere die Rueckfrage nur im Weg.
    const nutzer = userEvent.setup()
    const { onToggle } = zeige({ zugewiesen: [3] })

    await nutzer.click(screen.getByRole('button', { name: /Clara Christ/ }))

    expect(onToggle).toHaveBeenCalledExactlyOnceWith(3)
  })

  it('fragt beim Wochentag nicht nach', async () => {
    // Der Wochentag ist ein Wunsch, keine Absage. Im Bestand widersprechen ihm
    // rund 40 Einteilungen - eine Rueckfrage bei jeder waere nur im Weg.
    const nutzer = userEvent.setup()
    const { onToggle } = zeige({
      optionen: [
        {
          id: 9,
          firstname: 'Emil',
          lastname: 'Egger',
          status: 'weekday_inactive',
          lastAssignmentDaysBefore: 30,
          preferredWith: [],
        },
      ],
    })

    await nutzer.click(screen.getByRole('button', { name: /Emil Egger/ }))

    expect(onToggle).toHaveBeenCalledExactlyOnceWith(9)
  })
})
