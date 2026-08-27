import { render, screen } from '@testing-library/react'
import { Form } from 'antd'
import { describe, expect, it } from 'vitest'
import AppProviders from '../AppProviders'
import UserGeneralForm from './UserGeneralForm'

const ROLLEN = [
  { id: 1, name: 'Ministrant' },
  { id: 2, name: 'Ministrantenrat' },
  { id: 3, name: 'Admin' },
]

// Die Komponente erwartet eine Form-Instanz von aussen (UserEditModal haelt
// sie, weil auch das Speichern dort liegt).
function Huelle(props) {
  const [form] = Form.useForm()
  return (
    <AppProviders>
      <UserGeneralForm
        form={form}
        handleSave={() => {}}
        onOpenPassword={() => {}}
        rollen={ROLLEN}
        speichert={false}
        {...props}
      />
    </AppProviders>
  )
}

describe('UserGeneralForm', () => {
  it('zeigt die Bemerkung nur dem Ministrantenrat', () => {
    // Der Server liefert sie einem Ministranten gar nicht aus. Ein leeres Feld
    // in der Maske wuerde nur suggerieren, dass man dort etwas eintragen kann.
    render(<Huelle istPlaner={false} editorRoleId={1} eigenesKonto />)
    expect(screen.queryByLabelText('Bemerkung')).not.toBeInTheDocument()
  })

  it('gibt dem Ministrantenrat das Bemerkungsfeld', () => {
    render(<Huelle istPlaner editorRoleId={2} eigenesKonto={false} />)
    expect(screen.getByLabelText('Bemerkung')).toBeInTheDocument()
  })

  it('sperrt die eigene Rolle auch für einen Planer', () => {
    // Vorher hing das disabled nur an istPlaner: ein Planer sah bei "Meine
    // Einstellungen" ein offenes Feld, das der Server mit 403 ablehnt.
    render(<Huelle istPlaner editorRoleId={2} eigenesKonto />)

    expect(screen.getByLabelText('Rolle')).toBeDisabled()
    expect(
      screen.getByText('Die eigene Rolle kann nicht geändert werden')
    ).toBeInTheDocument()
  })

  it('lässt einen Planer die Rolle eines anderen ändern', () => {
    render(<Huelle istPlaner editorRoleId={2} eigenesKonto={false} />)
    expect(screen.getByLabelText('Rolle')).not.toBeDisabled()
  })

  it('sperrt Rolle, Weihrauch und Aktiv für einen Ministranten', () => {
    render(<Huelle istPlaner={false} editorRoleId={1} eigenesKonto />)

    expect(screen.getByLabelText('Rolle')).toBeDisabled()
    expect(screen.getByLabelText('Weihrauch')).toBeDisabled()
    expect(screen.getByLabelText('Aktiv')).toBeDisabled()
  })

  it('bietet Telefon und E-Mail auch dem Ministranten', () => {
    // Die eigenen Kontaktdaten darf jeder pflegen - das ist der Punkt, an dem
    // sie aktuell bleiben.
    render(<Huelle istPlaner={false} editorRoleId={1} eigenesKonto />)

    expect(screen.getByLabelText('Telefon')).not.toBeDisabled()
    expect(screen.getByLabelText('E-Mail')).not.toBeDisabled()
  })
})
