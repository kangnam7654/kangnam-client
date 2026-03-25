# ADR-010: Zustand 스토어 슬라이스 분할

- **Status**: Accepted
- **Date**: 2026-03-25

## Context

`src/renderer/stores/app-store.ts`는 319줄, 60+ 필드(상태 + setter)를 단일 `create<AppState>()` 호출에 정의한다. 인터페이스 `AppState`에 주석으로 8개 도메인 그룹이 표시되어 있으나 런타임에서는 구분이 없다:

1. Auth (2 필드)
2. Provider + Model (6 필드)
3. Conversations (4 필드)
4. Messages + Streaming (14 필드)
5. Tool call log (6 필드)
6. Search + Prompts + Sidebar + Settings + Theme + Dev mode (14 필드)
7. Eval (10 필드)
8. Cowork (8 필드)

문제:
- 어떤 필드를 변경해도 모든 구독자에게 알림 발생 (Zustand의 기본 shallow compare로 완화되지만, selector 없이 전체 store를 구독하는 컴포넌트가 불필요한 리렌더)
- 파일이 커서 도메인별 상태 로직 파악이 어려움
- `localStorage` 영속화가 `theme`과 `devMode`에만 적용되는데, 이 로직이 전체 store에 산재

## Decision

**Zustand 슬라이스 패턴 (slice pattern)으로 도메인별 분할**한다.

### 슬라이스 구조

```
src/renderer/stores/
  index.ts              # 통합 store re-export
  app-store.ts          # createBoundStore: 모든 슬라이스 결합
  slices/
    auth-slice.ts        # AuthSlice: authStatuses, provider, model, reasoningEffort
    conversation-slice.ts # ConversationSlice: conversations, activeConversationId
    chat-slice.ts        # ChatSlice: messages, streaming, thinkingText, chatError, contextUsage, toolCallLog
    ui-slice.ts          # UISlice: showSearch, showSettings, settingsTab, sidebarCollapsed, theme, devMode, pendingAttachments
    prompt-slice.ts      # PromptSlice: prompts, activePromptId
    eval-slice.ts        # EvalSlice: showEval, evalSelectedSkillId, evalActiveTab, ...
    cowork-slice.ts      # CoworkSlice: coworkIsRunning, coworkStreamText, coworkSteps, coworkToolCalls
```

### 슬라이스 정의 패턴

```typescript
// slices/auth-slice.ts
import { StateCreator } from 'zustand'
import type { AppState } from '../app-store'

export interface AuthSlice {
  authStatuses: AuthStatus[]
  setAuthStatuses: (statuses: AuthStatus[]) => void
  activeProvider: string
  setActiveProvider: (provider: string) => void
  activeModel: string
  setActiveModel: (model: string) => void
  activeReasoningEffort: 'low' | 'medium' | 'high'
  setActiveReasoningEffort: (effort: 'low' | 'medium' | 'high') => void
  activeView: 'chat' | 'cowork'
  setActiveView: (view: 'chat' | 'cowork') => void
}

export const createAuthSlice: StateCreator<AppState, [], [], AuthSlice> = (set) => ({
  authStatuses: [],
  setAuthStatuses: (statuses) => set({ authStatuses: statuses }),
  // ...
})
```

### 통합 store

```typescript
// app-store.ts
import { create } from 'zustand'
import { createAuthSlice, type AuthSlice } from './slices/auth-slice'
import { createChatSlice, type ChatSlice } from './slices/chat-slice'
// ...

export type AppState = AuthSlice & ConversationSlice & ChatSlice & UISlice & PromptSlice & EvalSlice & CoworkSlice

export const useAppStore = create<AppState>()((...a) => ({
  ...createAuthSlice(...a),
  ...createConversationSlice(...a),
  ...createChatSlice(...a),
  ...createUISlice(...a),
  ...createPromptSlice(...a),
  ...createEvalSlice(...a),
  ...createCoworkSlice(...a),
}))
```

### persist 미들웨어

`UISlice`에만 `persist` 미들웨어를 적용하여 `theme`과 `devMode`의 `localStorage` 로직을 선언적으로 교체한다.

```typescript
// slices/ui-slice.ts 내에서
import { persist } from 'zustand/middleware'

// ui-slice에서 persist 적용할 필드만 partialize
export const createUISlice: StateCreator<AppState, [], [], UISlice> =
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (t) => set({ theme: t }),
      devMode: false,
      setDevMode: (v) => set({ devMode: v }),
      // ...
    }),
    {
      name: 'kangnam-ui',
      partialize: (state) => ({ theme: state.theme, devMode: state.devMode }),
    }
  )
```

이렇게 하면 현재 `localStorage.getItem`/`setItem` 수동 호출을 제거할 수 있다.

### 분할 기준

| 슬라이스 | 필드 수 | 분할 근거 |
|---------|--------|----------|
| auth | 10 | 인증/프로바이더 도메인. 변경 빈도 낮음 |
| conversation | 4 | 대화 목록. sidebar에서만 구독 |
| chat | 14 | 스트리밍/메시지. 채팅 UI에서만 구독. 가장 변경 빈도 높음 |
| ui | 10 | UI 상태 (모달, 사이드바, 테마). persist 대상 포함 |
| prompt | 4 | 스킬 관리. 설정 패널에서만 구독 |
| eval | 10 | 평가 기능. eval 패널에서만 구독 |
| cowork | 8 | Cowork 모드. cowork 뷰에서만 구독 |

## Alternatives Rejected

1. **별도 store 생성 (create() 다중 호출)**: `useAuthStore`, `useChatStore` 등 독립 store 생성. 기각 이유: 슬라이스 간 상태 참조가 필요한 경우(예: chat에서 activeProvider 참조) cross-store 구독이 복잡해진다. Zustand 공식 문서가 권장하는 슬라이스 패턴이 단일 store의 이점(원자적 업데이트, 단일 구독 포인트)을 유지하면서 코드 분할을 달성한다.
2. **현재 상태 유지 + selector 최적화만**: 모든 컴포넌트에 `useAppStore(s => s.specificField)` selector를 적용. 기각 이유: 리렌더 문제는 해결하지만 코드 구조(319줄 단일 파일)와 도메인 분리 문제는 해결하지 않는다.

## Consequences

- `app-store.ts` 319줄 -> `app-store.ts` ~40줄 + 7개 슬라이스 파일(각 30-60줄).
- 기존 `useAppStore` 훅은 그대로 동작. import 경로 변경 불필요 (index.ts 배럴 유지).
- `localStorage` 수동 관리 코드 제거. persist 미들웨어로 선언적 관리.
- 슬라이스 간 상태 접근: `StateCreator<AppState, ...>` 타입으로 `get()`을 통해 전체 store 접근 가능.
- 향후 특정 슬라이스에 `devtools`, `immer` 등 미들웨어를 선택적으로 적용 가능.
- 영향 파일: `src/renderer/stores/app-store.ts` (재구성), 7개 새 슬라이스 파일 생성. import 측 변경 없음.
