# ADR-001: SettingsPanel.tsx 분할

- **Status**: Accepted
- **Date**: 2026-03-25

## Context

`src/renderer/components/settings/SettingsPanel.tsx`는 1816줄 단일 파일에 5개 함수 컴포넌트(`SettingsPanel`, `ProvidersTab`, `MCPTab`, `PromptsTab`, `GeneralTab`)가 혼재한다. 각 탭은 독립적 도메인 로직(OAuth 연결, MCP 서버 관리, 스킬 CRUD, 앱 설정)을 갖고 있어 단일 파일이 인지 부하를 높이고 병렬 작업을 방해한다. 현재 `src/renderer/components/settings/` 디렉토리에는 `SettingsPanel.tsx` 외 다른 파일이 없다.

## Decision

**디렉토리 기반 분할 + 배럴 export 패턴**을 채택한다.

```
src/renderer/components/settings/
  index.ts              # re-export SettingsPanel
  SettingsPanel.tsx      # 셸: 모달, 탭 네비게이션, 공통 state (< 150줄)
  tabs/
    ProvidersTab.tsx     # OAuth 연결/해제 UI
    MCPTab.tsx           # MCP 서버 추가/삭제/상태
    PromptsTab.tsx       # 스킬 CRUD (가장 큰 단위, ~880줄)
    GeneralTab.tsx       # 테마, 버전, dev mode
  types.ts               # MCPServerStatus 등 공유 인터페이스
```

**공유 상태 관리**: 탭 간 공유 상태(`authStatuses`, `mcpServers`)는 `SettingsPanel`(셸)에서 관리하고 props로 내려준다. 현재 이미 이 패턴을 사용 중이므로 변경 없음. 탭 내부 로컬 상태(`newServerJson`, `connecting`, `copilotCode` 등)는 각 탭 컴포넌트로 이동한다.

**`PROVIDER_INFO`와 `TABS` 상수**: `SettingsPanel.tsx` 상단에 유지. 탭 정의는 셸이 소유하므로.

## Alternatives Rejected

1. **파일별 분할 (플랫 구조)**: `settings/ProvidersTab.tsx`처럼 디렉토리 없이 나란히 배치. 기각 이유: 5개 파일이 동일 레벨에 존재하면 settings 디렉토리가 혼잡해지고, 향후 탭별 하위 컴포넌트(예: ProviderCard) 추가 시 다시 디렉토리를 만들어야 한다.
2. **Zustand 슬라이스로 공유 상태 이동**: 탭 간 상태를 별도 settings 슬라이스에 저장. 기각 이유: settings 패널은 모달이고 열릴 때만 데이터를 fetch하므로 글로벌 상태에 올리면 불필요한 지속성이 생긴다. 현재 props 패턴이 적절하다.

## Consequences

- 파일당 150-880줄로 축소. 가장 큰 PromptsTab도 독립 파일이면 스크롤 부담 감소.
- 5개 파일 생성, 1개 파일(SettingsPanel.tsx) 대폭 축소.
- import 경로 변경 없음: 기존 `import { SettingsPanel } from '../../components/settings/SettingsPanel'` -> `index.ts` 배럴이 동일 경로 유지.
- PromptsTab이 880줄로 여전히 크므로, 향후 추가 분할(PromptEditor, PromptList 등) 후보이나 이 ADR 범위 밖.
