# Claude.ai UI Redesign - LLM 설계문서

## 목적

kangnam-client 데스크톱 앱의 UI를 Claude.ai의 디자인 시스템(색상, 타이포그래피, 컴포넌트 스타일, 레이아웃)으로 리디자인한다.

**완료 조건:**
1. 다크 모드에서 모든 CSS 커스텀 프로퍼티가 아래 "색상 스펙" 섹션의 Dark Mode 값과 일치한다
2. 라이트 모드에서 모든 CSS 커스텀 프로퍼티가 아래 "색상 스펙" 섹션의 Light Mode 값과 일치한다
3. `@fontsource/noto-serif-kr`이 설치되고 어시스턴트 응답 본문에 serif 폰트가 적용된다
4. 유저 메시지 버블이 `rounded-2xl rounded-br-md` 스타일로 표시된다
5. 어시스턴트 메시지에 버블 배경이 없다 (직접 페이지 배경 위에 렌더링)
6. Send 버튼 배경색이 `#d97757`이다
7. Welcome 화면 greeting이 시간대별로 표시되고, composer가 중앙에 위치한다
8. Chat content와 Composer의 `maxWidth`가 768px이다
9. 기존 기능(MCP, 에이전트, 스킬, cowork, 테마 전환)이 모두 정상 동작한다

---

## 범위

### 범위 내 (IN SCOPE)
- CSS 커스텀 프로퍼티 값 변경 (`globals.css`)
- 컴포넌트 인라인 스타일 및 className 변경 (`AssistantThread.tsx`, `WelcomeScreen.tsx`, `CoworkView.tsx`)
- 폰트 패키지 추가 및 import (`@fontsource/noto-serif-kr`)
- `maxWidth` 수치 일괄 변경 (680 → 768)
- `.aui-markdown` heading에 sans-serif 오버라이드 추가

### 범위 밖 (OUT OF SCOPE) -- 아래 항목을 변경하지 마라
- 컴포넌트 파일 생성/삭제/이동 (새 컴포넌트를 만들지 마라)
- React 컴포넌트 props 인터페이스 변경
- 라우팅 구조 (`App.tsx`의 라우팅 로직)
- 상태 관리 로직 (`stores/`, hooks, Context)
- Tauri 백엔드 (`src-tauri/`)
- IPC 통신 코드 (`src/renderer/lib/tauri-api.ts`의 함수 시그니처)
- 빌드 설정 (`vite.config.ts`, `tauri.conf.json`, `tsconfig.*.json`)
- `package.json`의 scripts 변경 (`@fontsource/noto-serif-kr` 의존성 추가만 허용)
- Settings 패널 UI (`src/renderer/components/settings/`)
- Eval 벤치마크 UI (`src/renderer/components/eval/`)

---

## 색상 스펙

### Dark Mode (`:root`)

| CSS Variable | 현재값 | 변경값 |
|---|---|---|
| `--bg-main` | `#2b2b2b` | `#2b2a27` |
| `--bg-sidebar` | `#191919` | `#1f1e1b` |
| `--bg-surface` | `#363636` | `#353432` |
| `--bg-hover` | `#404040` | `#3d3c39` |
| `--border` | `#333333` | `rgba(255,255,255,0.08)` |
| `--border-light` | `#4a4a4a` | `rgba(255,255,255,0.15)` |
| `--text-primary` | `#ececec` | `#eeeeee` |
| `--text-secondary` | `#b0b0b0` | `#b0aea5` |
| `--text-muted` | `#9a9a9a` | `#9a9893` |
| `--accent` | `#e08060` | `#d97757` |
| `--accent-hover` | `#c96a4c` | `#c4633a` |
| `--accent-soft` | `rgba(217,119,87,0.15)` | `rgba(217,119,87,0.12)` |
| `--bg-code` | `#1e1e1e` | `#1e1d1b` |
| `--bg-code-inline` | `rgba(255,255,255,0.08)` | `rgba(255,255,255,0.07)` |
| `--bg-user-bubble` | `rgba(255,255,255,0.08)` | `#393937` |
| `--sidebar-bg` | `#2a2a2a` | `#1f1e1b` |
| `--sidebar-item-bg` | `#333` | `#2b2a27` |
| `--border-subtle` | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.08)` |
| `--border-subtle-hover` | `rgba(255,255,255,0.12)` | `rgba(255,255,255,0.15)` |
| `--scrollbar-thumb` | `rgba(255,255,255,0.1)` | `rgba(255,255,255,0.08)` |

### Light Mode (`[data-theme="light"]`)

| CSS Variable | 현재값 | 변경값 |
|---|---|---|
| `--bg-main` | `#f5f5f0` | `#faf9f5` |
| `--bg-sidebar` | `#e8e8e3` | `#f0ede3` |
| `--bg-surface` | `#ffffff` | `#ffffff` (유지) |
| `--bg-hover` | `#ebebeb` | `#eae8df` |
| `--border` | `#d5d5d0` | `rgba(0,0,0,0.08)` |
| `--border-light` | `#c5c5c0` | `rgba(0,0,0,0.15)` |
| `--text-primary` | `#1a1a1a` | `#141413` |
| `--text-secondary` | `#555555` | `#6b6962` |
| `--text-muted` | `#767676` | `#b0aea5` |
| `--accent` | `#b85e42` | `#d97757` |
| `--accent-hover` | `#a35538` | `#c4633a` |
| `--accent-soft` | `rgba(201,106,76,0.12)` | `rgba(217,119,87,0.10)` |
| `--bg-code` | `#f0ede8` | `#f0ede3` |
| `--bg-code-inline` | `rgba(0,0,0,0.06)` | `rgba(0,0,0,0.05)` |
| `--bg-user-bubble` | `rgba(0,0,0,0.05)` | `#DDD9CE` |
| `--sidebar-bg` | `#eaeae5` | `#f0ede3` |
| `--sidebar-item-bg` | `#f0f0eb` | `#faf9f5` |
| `--border-subtle` | `rgba(0,0,0,0.08)` | `rgba(0,0,0,0.08)` (유지) |
| `--border-subtle-hover` | `rgba(0,0,0,0.15)` | `rgba(0,0,0,0.15)` (유지) |
| `--scrollbar-thumb` | `rgba(0,0,0,0.12)` | `rgba(0,0,0,0.10)` |
| `--light-gray-divider` | (없음) | `#e8e6dc` |

### 새로 추가하는 CSS Variable (양 모드 공통)

| Variable | Dark Mode 값 | Light Mode 값 | 용도 |
|---|---|---|---|
| `--font-serif` | (공통) `'Noto Serif KR', ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif` | 동일 | 어시스턴트 응답 본문 |
| `--composer-shadow` | `0 0.25rem 1.25rem rgba(0,0,0,0.12)` | `0 0.25rem 1.25rem rgba(0,0,0,0.035)` | Composer box-shadow |
| `--bg-composer` | `#353432` | `#ffffff` | Composer 배경 |
| `--transition-ease` | (공통) `300ms cubic-bezier(0.165,0.85,0.45,1)` | 동일 | 표준 이징 |

---

## 타이포그래피 스펙

### 폰트 전략

- **UI 전체 (body):** `'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, 'Apple SD Gothic Neo', sans-serif` (현재와 동일, 변경 없음)
- **어시스턴트 응답 본문:** `var(--font-serif)` = `'Noto Serif KR', ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif`
- **코드:** `'SF Mono', 'JetBrains Mono', 'Fira Code', Monaco, Menlo, Consolas, monospace` (현재와 동일, 변경 없음)

### 어시스턴트 응답 타이포그래피 상세

| 속성 | 값 |
|---|---|
| font-family | `var(--font-serif)` |
| font-size | `15.5px` |
| line-height | `1.8` |
| font-weight | `400` |
| letter-spacing | `0.01em` |

### Noto Serif KR 로드 weight

400 (regular), 700 (bold) -- 이 두 개만 로드한다.

---

## 컴포넌트 스타일 스펙

### User Message Bubble

| 속성 | 현재 | 변경 |
|---|---|---|
| background | `var(--bg-user-bubble)` | `var(--bg-user-bubble)` (값이 변경됨: dark `#393937`, light `#DDD9CE`) |
| border-radius | `20px` (rounded-[20px]) | `16px 16px 4px 16px` (rounded-2xl rounded-br-md) |
| padding | `12px 16px` | `12px 16px` (유지) |
| font-family | inherit (sans-serif) | inherit (sans-serif) (유지 -- 유저 메시지는 sans) |
| max-width | `85%` | `85%` (유지) |
| 정렬 | 우측 (`justifyContent: 'flex-end'`) | 우측 (유지) |

### Assistant Message

| 속성 | 현재 | 변경 |
|---|---|---|
| 버블 배경 | 없음 | 없음 (유지) |
| font-family | inherit (sans-serif) | `var(--font-serif)` |
| font-size | `15px` | `15.5px` |
| line-height | `1.7` | `1.8` |
| 정렬 | 좌측 | 좌측 (유지) |

### Composer

| 속성 | 현재 | 변경 |
|---|---|---|
| border-radius | `24px` | `16px` |
| background | `var(--bg-surface)` | `var(--bg-composer)` |
| box-shadow | `0 4px 16px var(--shadow-pill)` | `var(--composer-shadow)` |
| border | `1px solid rgba(255,255,255,0.06)` | `1px solid var(--border-subtle)` |
| maxWidth | `680px` | `768px` |

### Send Button

| 속성 | 현재 | 변경 |
|---|---|---|
| background | `var(--accent)` | `var(--accent)` (값이 `#d97757`로 변경됨) |
| hover background | `var(--accent-hover)` | `var(--accent-hover)` (값이 `#c4633a`로 변경됨) |
| border-radius | `10px` | `8px` (rounded-lg) |
| active transform | 없음 | `scale(0.98)` |

### Chat Content Area

| 속성 | 현재 | 변경 |
|---|---|---|
| maxWidth | `680px` | `768px` |

### Sidebar

| 속성 | 현재 | 변경 |
|---|---|---|
| width | `260px` | `260px` (유지) |
| background | `var(--bg-sidebar)` | `var(--bg-sidebar)` (값이 변경됨) |
| hover 배경 (sidebar-item) | dark: `rgba(255,255,255,0.06)` / light: `rgba(0,0,0,0.04)` | dark: `rgba(255,255,255,0.06)` / light: `rgba(0,0,0,0.04)` (유지) |

### Markdown (.aui-markdown) 어시스턴트 영역 타이포그래피

`.aui-markdown` 클래스에 serif 폰트를 적용하지 **않는다**. serif는 AssistantMessage 래퍼 div에서 설정하고, `.aui-markdown` 내부 heading(`h1`, `h2`, `h3`)은 sans-serif로 오버라이드한다.

| 요소 | font-family |
|---|---|
| `.aui-markdown` p, li, blockquote | inherited (serif from parent) |
| `.aui-markdown` h1, h2, h3 | `'Pretendard', -apple-system, system-ui, sans-serif` |
| `.aui-markdown` code (inline) | monospace (현재와 동일) |
| `.aui-markdown` pre code | monospace (현재와 동일) |

---

## 파일 변경 목록

| # | 파일 경로 | 변경 내용 |
|---|---|---|
| 1 | `src/renderer/main.tsx` | Noto Serif KR 400, 700 weight import 추가 |
| 2 | `src/renderer/styles/globals.css` | `:root` dark 모드 변수 값 변경, `[data-theme="light"]` 변수 값 변경, `--font-serif` / `--composer-shadow` / `--bg-composer` / `--transition-ease` 변수 추가, `.aui-markdown h1/h2/h3`에 sans-serif 오버라이드 추가 |
| 3 | `src/renderer/components/chat/AssistantThread.tsx` | (1) UserMessage 버블 border-radius를 `'16px 16px 4px 16px'`으로 변경, (2) AssistantMessage 래퍼 div에 `fontFamily: 'var(--font-serif)'`, `fontSize: '15.5px'`, `lineHeight: 1.8` 적용, (3) Composer border-radius `16px`, background `var(--bg-composer)`, boxShadow `var(--composer-shadow)`, maxWidth `768px`, (4) Send 버튼 border-radius `8px` + active scale, (5) 모든 `maxWidth: 680` → `768`로 변경, (6) Composer border를 `var(--border-subtle)`로 변경, (7) send/stop/imageOnlySend 버튼에 `active:scale-[0.98]` 클래스 추가 |
| 4 | `src/renderer/components/chat/WelcomeScreen.tsx` | (1) `maxWidth: 680` → `768`로 변경, (2) Composer border-radius `16px`, background `var(--bg-composer)`, boxShadow `var(--composer-shadow)`, (3) Send 버튼 border-radius `8px` + active scale, (4) greeting 텍스트 유지 (이미 시간대별), (5) Composer border를 `var(--border-subtle)` / `var(--border-subtle-hover)` 사용으로 변경 |
| 5 | `src/renderer/components/chat/ChatView.tsx` | 변경 없음 (레이아웃 구조는 유지) |
| 6 | `src/renderer/components/sidebar/Sidebar.tsx` | 변경 없음 (sidebar는 이미 `var(--bg-sidebar)` 참조, 값만 변경되면 자동 반영) |
| 7 | `src/renderer/components/cowork/CoworkView.tsx` | (1) `maxWidth: 680` → `768`로 변경 (5곳), (2) UserBubble 컴포넌트(line 519)의 `borderRadius: 20` → `'16px 16px 4px 16px'`으로 변경 |
| 8 | `src/renderer/components/InputControls.tsx` | 변경 없음 (accent 색상은 CSS variable 참조이므로 자동 반영) |

---

## 구현 순서

### 단계 1: Noto Serif KR 폰트 설치 및 import

**대상 파일:** `package.json` (npm install), `src/renderer/main.tsx`

1. `npm install @fontsource/noto-serif-kr` 실행
2. `src/renderer/main.tsx`에 아래 2줄 추가 (기존 Pretendard import 바로 아래):
   ```typescript
   import '@fontsource/noto-serif-kr/400.css'
   import '@fontsource/noto-serif-kr/700.css'
   ```

**Output:** Noto Serif KR 폰트가 번들에 포함되어 렌더링 가능한 상태

### 단계 2: CSS 커스텀 프로퍼티 업데이트

**대상 파일:** `src/renderer/styles/globals.css`

1. `:root` 블록 내 모든 변수를 위 "Dark Mode" 테이블의 "변경값" 열로 교체
2. `:root` 블록에 새 변수 4개 추가: `--font-serif`, `--composer-shadow`, `--bg-composer`, `--transition-ease`
3. `[data-theme="light"]` 블록 내 모든 변수를 위 "Light Mode" 테이블의 "변경값" 열로 교체
4. `[data-theme="light"]` 블록에 `--composer-shadow`, `--bg-composer` 라이트 모드 값 추가
5. `.aui-markdown h1, .aui-markdown h2, .aui-markdown h3` 규칙에 `font-family: 'Pretendard', -apple-system, system-ui, sans-serif;` 추가

**Output:** 테마 변수가 Claude.ai 스펙과 일치, serif 폰트 변수 사용 가능

### 단계 3: AssistantThread 컴포넌트 스타일 변경

**대상 파일:** `src/renderer/components/chat/AssistantThread.tsx`

1. **UserMessage 컴포넌트 (line ~23-35):**
   - `borderRadius: 20` → `borderRadius: '16px 16px 4px 16px'`

2. **AssistantMessage 컴포넌트 (line ~91):**
   - 래퍼 div의 `className`에서 `text-[15px]` → 제거, 대신 `style`에 `fontFamily: 'var(--font-serif)', fontSize: '15.5px', lineHeight: 1.8, letterSpacing: '0.01em'` 추가

3. **maxWidth 일괄 변경:**
   - 파일 내 모든 `maxWidth: 680` → `maxWidth: 768`로 변경 (5곳: line 22, 77, 385, 690, 823)

4. **Composer 컴포넌트 (line ~691):**
   - `borderRadius: 24` → `borderRadius: 16`
   - `background: 'var(--bg-surface)'` → `background: 'var(--bg-composer)'`
   - `boxShadow: '0 4px 16px var(--shadow-pill)'` → `boxShadow: 'var(--composer-shadow)'`
   - `border: '1px solid rgba(255,255,255,0.06)'` → `border: '1px solid var(--border-subtle)'`

5. **ComposerPrimitive.Root (line ~689):**
   - `borderTop: '1px solid var(--border-subtle)'` → `borderTop: 'none'` (Composer가 자체 border를 가지므로 separator 제거)

6. **Send 버튼, Stop 버튼, ImageOnlySend 버튼:**
   - `borderRadius: 10` → `borderRadius: 8`
   - `className`에 `active:scale-[0.98]` 추가

**Output:** UserMessage 버블, AssistantMessage serif 폰트, Composer, 버튼 스타일이 Claude.ai 스펙과 일치

### 단계 4: WelcomeScreen 컴포넌트 스타일 변경

**대상 파일:** `src/renderer/components/chat/WelcomeScreen.tsx`

1. **maxWidth 변경 (line ~156):**
   - `maxWidth: 680` → `maxWidth: 768`

2. **Composer 스타일 (line ~177-185):**
   - `borderRadius: 24` → `borderRadius: 16`
   - `background: 'var(--bg-surface)'` → `background: 'var(--bg-composer)'`
   - `boxShadow: '0 2px 20px var(--shadow-pill)'` → `boxShadow: 'var(--composer-shadow)'`

3. **Send 버튼 (line ~286-304):**
   - `borderRadius: 10` → `borderRadius: 8`
   - `className`에 `active:scale-[0.98]` 추가 (기존에 className이 없으므로 추가)

**Output:** WelcomeScreen이 Claude.ai 스펙과 일치

### 단계 5: CoworkView 스타일 변경

**대상 파일:** `src/renderer/components/cowork/CoworkView.tsx`

1. 파일 내 모든 `maxWidth: 680` → `maxWidth: 768`로 변경 (5곳: line 261, 380, 401, 514, 538)
2. **UserBubble 컴포넌트 (line ~519):**
   - `borderRadius: 20` → `borderRadius: '16px 16px 4px 16px'`

**Output:** Cowork 뷰 content width와 UserBubble 스타일이 Chat과 일치

### 단계 6: 시각적 검증 및 테스트

1. 다크 모드에서 앱 실행, 각 화면(Welcome, Chat, Cowork, Settings) 순회하며 색상/폰트/레이아웃 확인
2. 라이트 모드로 전환, 동일한 순회 수행
3. 기존 기능 동작 확인: 메시지 전송, MCP 도구 호출, 에이전트 실행, 스킬 선택, 테마 전환

**Output:** 모든 화면에서 Claude.ai 디자인 스펙이 적용되고 기존 기능이 정상 동작

---

## 함수/API 시그니처

이 리디자인은 새 함수를 추가하지 않는다. 기존 컴포넌트의 스타일 속성만 변경한다.

### 변경되는 컴포넌트 스타일 시그니처 (참고용)

**UserMessage (AssistantThread.tsx)**
```tsx
// 변경 전
<div style={{ ..., borderRadius: 20, background: 'var(--bg-user-bubble)' }}>

// 변경 후
<div style={{ ..., borderRadius: '16px 16px 4px 16px', background: 'var(--bg-user-bubble)' }}>
```

**AssistantMessage 래퍼 div (AssistantThread.tsx)**
```tsx
// 변경 전
<div className="text-[15px] text-[var(--text-primary)] leading-[1.7]">

// 변경 후
<div style={{ fontFamily: 'var(--font-serif)', fontSize: '15.5px', lineHeight: 1.8, letterSpacing: '0.01em', color: 'var(--text-primary)' }}>
```

**Composer 외부 div (AssistantThread.tsx)**
```tsx
// 변경 전
<div style={{ ..., borderRadius: 24, background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 16px var(--shadow-pill)' }}>

// 변경 후
<div style={{ ..., borderRadius: 16, background: 'var(--bg-composer)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--composer-shadow)' }}>
```

**Send 버튼 (AssistantThread.tsx, WelcomeScreen.tsx)**
```tsx
// 변경 전
style={{ ..., borderRadius: 10 }}

// 변경 후
style={{ ..., borderRadius: 8 }}
className="... active:scale-[0.98]"
```

---

## 제약 조건

1. **상용 폰트 사용 금지:** Styrene B, Tiempos Text, Galaxie Copernicus를 import/참조하지 마라. Noto Serif KR + Pretendard만 사용하라.
2. **한국어 지원 필수:** Noto Serif KR은 CJK를 포함한다. fallback에 한국어 미지원 세리프를 넣을 경우 반드시 Noto Serif KR 이후에 배치하라.
3. **@assistant-ui/react API 호환성:** `MessagePrimitive`, `ComposerPrimitive`, `ThreadPrimitive`, `ActionBarPrimitive`의 props와 children 구조를 변경하지 마라. 스타일만 변경하라.
4. **Tailwind CSS 4.2 문법 유지:** `@apply`를 새로 추가하지 마라. 기존 방식(inline style + className의 Tailwind 유틸리티 혼합)을 유지하라.
5. **data-theme 속성 기반 전환 유지:** `document.documentElement.setAttribute('data-theme', theme)` 방식을 변경하지 마라. CSS variable만 수정하라.
6. **CSS 커스텀 프로퍼티 기반 테마 시스템 유지:** 하드코딩된 색상값을 CSS variable로 교체하는 것은 허용하되, 기존 CSS variable 참조 패턴을 제거하지 마라.
7. **기존 기능 무영향:** MCP tool call UI, 에이전트 실행 UI, 스킬 칩, cowork 뷰, 검색 오버레이, 설정 패널의 동작 로직을 변경하지 마라.
8. **maxWidth 일괄 변경:** `maxWidth: 680`을 `768`로 변경할 때 CoworkView 포함 모든 곳에서 일괄 변경하라. 일부만 변경하면 레이아웃 불일치가 발생한다.
9. **Composer border-radius 통일:** WelcomeScreen과 AssistantThread의 Composer border-radius를 모두 `16px`로 설정하라.

---

## 의사결정

### 채택: 어시스턴트 응답에만 serif 적용, UI 전체는 sans-serif 유지

Claude.ai의 "UI = sans, response = serif" 전략을 따른다. `.aui-markdown` 전체가 아닌 AssistantMessage 래퍼 div에서 serif를 설정하고, heading은 sans-serif로 오버라이드한다.

**기각:** UI 전체를 serif로 변경 -- 사이드바, 버튼, 입력 필드의 가독성이 저하되고 Claude.ai 디자인과 불일치한다.

### 채택: Noto Serif KR을 @fontsource로 로컬 번들링

번들에 포함하여 네트워크 의존성을 제거한다. 데스크톱 앱이므로 오프라인 환경에서도 폰트가 로드되어야 한다.

**기각:** Google Fonts CDN 로드 -- 데스크톱 앱에서 CDN 의존성은 오프라인 시 폰트 누락을 유발한다.

### 채택: maxWidth 768px (max-w-3xl 상당)

Claude.ai의 chat content 영역이 `max-w-3xl` (~768px)을 사용한다. 현재 680px에서 768px로 확대한다.

**기각:** 680px 유지 -- Claude.ai와 시각적 일치도가 낮아진다.

### 채택: User bubble border-radius를 `16px 16px 4px 16px`로 설정

Claude.ai 유저 버블은 `rounded-2xl` (16px) 기본에 `rounded-br-md` (우하단만 4px)를 적용한다.

**기각:** 전체 border-radius를 20px로 유지 -- Claude.ai의 특징적인 꼬리 모양 버블을 재현하지 못한다.

### 채택: Composer border-radius 16px

Claude.ai Composer는 `rounded-2xl` (16px)을 사용한다.

**기각:** 24px 유지 -- Claude.ai보다 더 둥글어 시각적 불일치가 발생한다.

### 채택: CSS 커스텀 프로퍼티에 새 변수 추가 방식

`--font-serif`, `--composer-shadow`, `--bg-composer`, `--transition-ease`를 추가하여 나중에 테마별 미세조정이 가능하도록 한다.

**기각:** 하드코딩 -- 다크/라이트 모드별 다른 값이 필요한 `--composer-shadow`와 `--bg-composer`는 CSS variable 없이 조건부 처리가 복잡해진다.

---

## 에러 처리 및 엣지 케이스

### 에러 상태

| # | 에러 상황 | 탐지 방법 | 복구 행동 |
|---|----------|----------|----------|
| E1 | `npm install @fontsource/noto-serif-kr` 실패 | exit code != 0 | `npm cache clean --force` 후 재시도. 2회 실패 시 사용자에게 보고하고 중단. serif 없이 진행하지 마라 |
| E2 | Noto Serif KR CSS import 후 빌드 에러 | dev server 또는 `npm run tauri:build:frontend` 에러 출력 | import 경로가 `@fontsource/noto-serif-kr/400.css`인지 확인. `node_modules/@fontsource/noto-serif-kr/` 디렉토리 존재 여부 확인. 없으면 E1 복구 수행 |
| E3 | CSS variable 값 변경 후 스타일 미적용 | 앱에서 색상이 변경 전과 동일하게 보임 | `:root` 블록과 `[data-theme="light"]` 블록 모두에 변수가 존재하는지 확인. 오타가 없는지 위 색상 스펙 테이블과 1:1 대조 |
| E4 | `maxWidth: 680` 리터럴이 예상 라인에 없음 | 파일 내 `680` 검색 결과 0건 | 파일 전체에서 `maxWidth`를 검색하라. 이미 다른 값으로 변경되었거나 변수로 추출된 경우 해당 값을 `768`로 변경 |
| E5 | 기존 기능 회귀 | 단계 6 검증 시 다음 5개 기능 중 하나 이상 실패: (1) 메시지 전송, (2) MCP tool call, (3) 에이전트 실행, (4) 스킬 선택, (5) 테마 전환 | `git diff`로 이번 변경에서 스타일 외 로직 변경이 있는지 점검. 로직 변경이 있으면 revert 후 스타일만 재변경 |

### 모호한 상황 해소 규칙

| # | 상황 | 해소 규칙 |
|---|------|----------|
| A1 | AssistantMessage 내부 inline `<code>` 태그에 serif가 적용되는 경우 | inline code는 monospace font-family를 상속받으므로 serif가 적용되지 않는다. 만약 적용되면 `.aui-markdown code` 선택자에 `font-family: monospace`가 있는지 확인하라 |
| A2 | WelcomeScreen greeting 텍스트에 serif가 적용되어야 하는지 | 아니다. greeting은 UI 요소이므로 sans-serif를 유지한다. serif는 AssistantMessage 래퍼 div 내부에서만 적용된다 |
| A3 | Sidebar 항목 hover 배경색이 의도와 다르게 보이는 경우 | Sidebar hover 배경은 이번 변경 대상이 아니다. `--bg-sidebar` 값 변경으로 인해 상대적 대비가 달라진 것이므로, `--bg-sidebar` 값이 스펙과 일치하면 정상이다 |
| A4 | `active:scale-[0.98]`이 동작하지 않는 경우 | Tailwind CSS 4.2는 `active:` variant를 지원한다. 동작하지 않으면 해당 요소에 `className` prop이 정상 전달되는지 확인. styled-component 래핑이 className을 제거하는 경우 inline style로 `onMouseDown={() => e.currentTarget.style.transform = 'scale(0.98)'}` + `onMouseUp`으로 대체하라 |
| A5 | `--composer-shadow` 적용 후 다크 모드에서 그림자가 보이지 않는 경우 | 다크 배경에서 `rgba(0,0,0,0.12)` 그림자는 시각적으로 미약하다. 이는 의도된 동작이다. Claude.ai 다크 모드에서도 Composer 그림자는 거의 보이지 않는다 |
| A6 | CoworkView UserBubble과 AssistantThread UserMessage의 스타일 불일치 | 두 컴포넌트 모두 `borderRadius: '16px 16px 4px 16px'`을 사용해야 한다. 하나만 변경하면 Chat과 Cowork에서 유저 버블 모양이 다르게 보인다 |
