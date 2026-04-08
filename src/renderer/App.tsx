import { useEffect } from 'react'
import { Sidebar } from './components/sidebar/Sidebar'
import { ChatView } from './components/chat/ChatView'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { SearchOverlay } from './components/sidebar/SearchPanel'
import { useAppStore } from './stores/app-store'
import { cliApi } from './lib/cli-api'

export default function App() {
  const { theme, currentProvider, setCurrentProvider, setSetupComplete } = useAppStore()

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Auto-detect CLI providers on startup
  useEffect(() => {
    if (currentProvider) return // already set
    cliApi.listProviders()
      .then(async (metas) => {
        for (const meta of metas) {
          try {
            const status = await cliApi.checkInstalled(meta.name)
            if (status.installed) {
              setCurrentProvider(meta.name)
              setSetupComplete(true)
              return
            }
          } catch { /* ignore */ }
        }
        // No CLI found — open settings so user can install
        useAppStore.getState().setSettingsTab('providers')
        useAppStore.getState().setShowSettings(true)
      })
      .catch(() => { /* WS not ready yet, will retry on reconnect */ })
  }, [currentProvider, setCurrentProvider, setSetupComplete])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        useAppStore.getState().toggleDevMode()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault()
        useAppStore.getState().toggleSidebar()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg-main, #2b2b2b)' }}>
      <Sidebar />
      <ChatView />
      <SettingsPanel />
      <SearchOverlay />
    </div>
  )
}
