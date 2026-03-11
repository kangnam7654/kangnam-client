import { useEffect } from 'react'
import { Sidebar } from './components/sidebar/Sidebar'
import { ChatView } from './components/chat/ChatView'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { useAppStore } from './stores/app-store'

export default function App() {
  const { setAuthStatuses } = useAppStore()

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

    return () => {
      unsubConnected()
      unsubDisconnected()
    }
  }, [setAuthStatuses])

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <ChatView />
      <SettingsPanel />
    </div>
  )
}
