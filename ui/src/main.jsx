import ReactDOM from 'react-dom/client'
import './index.css'
import { HashRouter } from 'react-router'
import AppProviders from './AppProviders'
import PwaUpdatePrompt from './components/PwaUpdatePrompt'
import TokenContainer from './TokenContainer'

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <AppProviders>
    <PwaUpdatePrompt />
    <HashRouter>
      <TokenContainer />
    </HashRouter>
  </AppProviders>
)
