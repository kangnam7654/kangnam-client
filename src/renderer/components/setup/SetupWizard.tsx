import { useEffect, useState } from 'react'
import { useAppStore } from '../../stores/app-store'
import { cliApi, type ProviderMeta } from '../../lib/cli-api'
import type { CliStatus } from '../../stores/app-store'
import { CliCard } from './CliCard'

export function SetupWizard() {
  const { setSetupComplete } = useAppStore()
  const [providers, setProviders] = useState<ProviderMeta[]>([])
  const [statuses, setStatuses] = useState<Record<string, CliStatus>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [installing, setInstalling] = useState<string | null>(null)

  // Load providers and check install status
  useEffect(() => {
    cliApi.listProviders().then(async (metas) => {
      setProviders(metas)
      const statusMap: Record<string, CliStatus> = {}
      for (const meta of metas) {
        statusMap[meta.name] = await cliApi.checkInstalled(meta.name)
      }
      setStatuses(statusMap)

      // Auto-select installed providers
      const installedSet = new Set<string>()
      for (const [name, status] of Object.entries(statusMap)) {
        if (status.installed) installedSet.add(name)
      }
      setSelected(installedSet)
    })
  }, [])

  const handleInstall = async (provider: string) => {
    setInstalling(provider)
    try {
      await cliApi.install(provider)
      const status = await cliApi.checkInstalled(provider)
      setStatuses((prev) => ({ ...prev, [provider]: status }))
      if (status.installed) {
        setSelected((prev) => new Set([...prev, provider]))
      }
    } catch (e) {
      console.error('Install failed:', e)
    }
    setInstalling(null)
  }

  const handleToggle = (provider: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(provider)) next.delete(provider)
      else next.add(provider)
      return next
    })
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--bg-main)]">
      <div className="w-full max-w-lg px-6">
        <h1 className="mb-2 text-center text-xl font-bold text-[var(--text-primary)]">
          사용할 AI 도구를 선택하세요
        </h1>
        <p className="mb-8 text-center text-sm text-[var(--text-tertiary)]">
          설치되지 않은 도구는 설치를 도와드립니다
        </p>

        <div className="mb-8 flex gap-4">
          {providers.map((meta) => (
            <CliCard
              key={meta.name}
              meta={meta}
              status={statuses[meta.name] ?? null}
              selected={selected.has(meta.name)}
              onToggle={() => handleToggle(meta.name)}
              onInstall={() => handleInstall(meta.name)}
              installing={installing === meta.name}
            />
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={() => {
              if (selected.size > 0) {
                setSetupComplete(true)
              }
            }}
            disabled={selected.size === 0}
            className="rounded-lg bg-[var(--accent-primary)] px-8 py-3 font-bold text-[var(--bg-main)] disabled:opacity-40"
          >
            시작하기
          </button>
        </div>
      </div>
    </div>
  )
}
