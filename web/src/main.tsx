import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ErrorBoundary } from '@ui/components/shared/ErrorBoundary'
import { setTransport } from '@ui/transport'
import { BrowserTransport } from './transport/BrowserTransport'

// Override the desktop transport singleton so shared components
// (Header, SettingsPage) that call getTransport() get BrowserTransport.
setTransport(new BrowserTransport())

document.documentElement.classList.add('dark')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
