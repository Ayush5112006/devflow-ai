import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import { App } from './App'
import { loadSettings, applyAllPreferences } from './settings/useSettingsStore'

// Apply ALL persisted preferences (theme, text size, motion, density)
// synchronously before the first paint — zero flash.
applyAllPreferences(loadSettings())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
