import { Form } from 'antd'

// Eigener Hook fuer das Benutzerformular.
//
// Hing vorher als statische Eigenschaft an der Komponente
// (UserGeneralForm.useUserForm = () => Form.useForm()). Das verstoesst gegen
// die Hook-Regeln, ist fuer Werkzeuge nicht als Hook erkennbar, und neben
// einer Komponente exportiert haette es Fast Refresh ausgehebelt.
export default function useUserForm() {
  return Form.useForm()
}
