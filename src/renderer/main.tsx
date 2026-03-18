import { createRoot } from 'react-dom/client'
import App from './App'
import '@fontsource/pretendard/400.css'
import '@fontsource/pretendard/500.css'
import '@fontsource/pretendard/600.css'
import '@fontsource/pretendard/700.css'
import './styles/globals.css'

async function init() {
  // In Tauri, load the API adapter (sets window.api)
  // In Electron, preload/contextBridge already sets window.api
  if ('__TAURI_INTERNALS__' in window) {
    await import('./lib/tauri-api')
  }
  createRoot(document.getElementById('root')!).render(<App />)
}

init()

