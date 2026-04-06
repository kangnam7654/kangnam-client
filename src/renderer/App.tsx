import { useEffect } from 'react'
import { Sidebar } from './components/sidebar/Sidebar'
import { ChatView } from './components/chat/ChatView'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { SearchOverlay } from './components/sidebar/SearchPanel'
import { SetupWizard } from './components/setup/SetupWizard'
import { useAppStore } from './stores/app-store'

export default function App() {
  const { theme, setupComplete } = useAppStore()

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Secret dev mode toggle: Ctrl+Shift+D (Cmd+Shift+D on Mac)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        const store = useAppStore.getState()
        store.toggleDevMode()
        const next = useAppStore.getState().devMode
        console.log(`[Dev Mode] ${next ? 'ENABLED' : 'DISABLED'}`)
      }
      // Toggle sidebar: Cmd+\ (Mac) / Ctrl+\ (Windows/Linux)
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault()
        useAppStore.getState().toggleSidebar()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!setupComplete) {
    return <SetupWizard />
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg-main, #2b2b2b)' }}>
      <Sidebar />
      <ChatView />
      <SettingsPanel />
      <SearchOverlay />
    </div>
  )
}
