import { useEffect } from 'react'
import { Sidebar } from './components/sidebar/Sidebar'
import { ChatView } from './components/chat/ChatView'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { SearchOverlay } from './components/sidebar/SearchPanel'
import { EvalWorkbench } from './components/eval/EvalWorkbench'
import { useAppStore, type AuthStatus, type Conversation } from './stores/app-store'

export default function App() {
  const { setAuthStatuses, theme, showEval } = useAppStore()

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

  useEffect(() => {
    // Load initial auth status
    window.api.auth.status().then(r => setAuthStatuses(r as AuthStatus[])).catch(console.error)

    // Listen for auth changes
    const unsubConnected = window.api.auth.onConnected(async () => {
      const statuses = await window.api.auth.status() as AuthStatus[]
      setAuthStatuses(statuses)
    })

    const unsubDisconnected = window.api.auth.onDisconnected(async () => {
      const statuses = await window.api.auth.status() as AuthStatus[]
      setAuthStatuses(statuses)
    })

    // Listen for smart title updates (LLM-generated conversation titles)
    const unsubTitle = window.api.conv.onTitleUpdated?.(async () => {
      const convs = await window.api.conv.list() as Conversation[]
      useAppStore.getState().setConversations(convs)
    })

    return () => {
      unsubConnected()
      unsubDisconnected()
      unsubTitle?.()
    }
  }, [setAuthStatuses])

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg-main, #2b2b2b)' }}>
      <Sidebar />
      <ChatView />
      <SettingsPanel />
      <SearchOverlay />
      {showEval && <EvalWorkbench />}
    </div>
  )
}
