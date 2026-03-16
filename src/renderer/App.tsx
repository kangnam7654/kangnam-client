import { useEffect } from 'react'
import { Sidebar } from './components/sidebar/Sidebar'
import { ChatView } from './components/chat/ChatView'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { SearchOverlay } from './components/sidebar/SearchPanel'
import { EvalWorkbench } from './components/eval/EvalWorkbench'
import { useAppStore } from './stores/app-store'

export default function App() {
  const { setAuthStatuses, theme } = useAppStore()

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    // Load initial auth status
    window.api.auth.status().then(setAuthStatuses)

    // Listen for auth changes
    const unsubConnected = window.api.auth.onConnected(async () => {
      const statuses = await window.api.auth.status()
      setAuthStatuses(statuses)
    })

    const unsubDisconnected = window.api.auth.onDisconnected(async () => {
      const statuses = await window.api.auth.status()
      setAuthStatuses(statuses)
    })

    // Listen for smart title updates (LLM-generated conversation titles)
    const unsubTitle = window.api.conv.onTitleUpdated?.(async () => {
      const convs = await window.api.conv.list()
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
      <EvalWorkbench />
    </div>
  )
}
