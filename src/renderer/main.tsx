import { createRoot } from 'react-dom/client'
import App from './App'
import '@fontsource/pretendard/400.css'
import '@fontsource/pretendard/500.css'
import '@fontsource/pretendard/600.css'
import '@fontsource/pretendard/700.css'
import '@fontsource/noto-serif-kr/400.css'
import '@fontsource/noto-serif-kr/700.css'
import './styles/globals.css'

async function init() {
  await import('./lib/tauri-api')
  createRoot(document.getElementById('root')!).render(<App />)
}

init()

