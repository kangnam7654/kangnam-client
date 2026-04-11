import { useAppStore } from '../../stores/app-store'
import { StudioDashboard } from './StudioDashboard'
import { StudioEditor } from './StudioEditor'

export function StudioView() {
  // Subscribe to individual fields to ensure re-render
  const studioType = useAppStore((s) => s.studioState?.type)
  const studioName = useAppStore((s) => s.studioState?.name)
  const activeView = useAppStore((s) => s.studioState?.activeView)

  // No studio state or dashboard mode → show dashboard
  if (!activeView || activeView === 'dashboard') {
    return <StudioDashboard />
  }

  // Editor mode
  return (
    <StudioEditor
      key={`${studioType}-${studioName || 'new'}`}
      type={studioType!}
      name={studioName}
    />
  )
}
