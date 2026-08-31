import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerServiceWorker } from './lib/registerSw.js'
// Imported for its side effect: captures beforeinstallprompt,
// which Chrome fires early and only once.
import './lib/installPrompt.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Registered here rather than inside a component, so it happens on
// every page including the login screen, and so a failure is
// recorded instead of disappearing.
registerServiceWorker()
