import ReactDOM from 'react-dom/client'
import './index.css'
import { HashRouter } from 'react-router'
import AppProviders from './AppProviders'
import TokenContainer from './TokenContainer'

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <AppProviders>
    <HashRouter>
      <TokenContainer />
    </HashRouter>
  </AppProviders>
)
