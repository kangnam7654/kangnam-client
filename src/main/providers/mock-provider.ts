import { LLMProvider, ChatMessage, ToolDefinition, ToolCall, StreamCallbacks } from './base-provider'

const MOCK_RESPONSES = [
  `안녕하세요! 무엇을 도와드릴까요?

저는 **Mock 모드**로 동작 중이에요. UI 테스트용으로 다양한 마크다운 요소를 보여드릴게요.

## 코드 예시

\`\`\`typescript
function fibonacci(n: number): number {
  if (n <= 1) return n
  return fibonacci(n - 1) + fibonacci(n - 2)
}

console.log(fibonacci(10)) // 55
\`\`\`

## 리스트

- 첫 번째 항목
- 두 번째 항목
  - 중첩된 항목
- 세 번째 항목

> 이것은 인용문입니다. Mock 응답이지만 실제 LLM처럼 보이죠?

일반 텍스트도 자연스럽게 표시되는지 확인해보세요. \`인라인 코드\`도 잘 보이나요?`,

  `좋은 질문이네요! 아래에 설명해드릴게요.

### 테이블 예시

| 기능 | 상태 | 비고 |
|------|------|------|
| 채팅 | ✅ 완료 | 스트리밍 지원 |
| 첨부파일 | ✅ 완료 | 이미지/파일 |
| MCP | 🔧 진행중 | 도구 연동 |

### 순서가 있는 리스트

1. 먼저 이것을 합니다
2. 그 다음 이것을 합니다
3. 마지막으로 확인합니다

---

**볼드**, *이탤릭*, ~~취소선~~ 모두 잘 보이시나요?

\`\`\`python
def hello(name: str) -> str:
    """인사 함수"""
    return f"Hello, {name}!"

print(hello("World"))
\`\`\`

더 궁금한 점이 있으면 물어보세요!`,

  `네, 그 부분에 대해 자세히 설명해드리겠습니다.

## 핵심 개념

이 시스템은 크게 세 가지 레이어로 구성됩니다:

1. **프레젠테이션 레이어** - React 컴포넌트, UI 상태 관리
2. **비즈니스 로직 레이어** - IPC 핸들러, 프로바이더 라우팅
3. **데이터 레이어** - SQLite DB, 파일시스템

\`\`\`
┌─────────────────┐
│   Renderer      │  ← React + Zustand
├─────────────────┤
│   IPC Bridge    │  ← Preload scripts
├─────────────────┤
│   Main Process  │  ← Node.js + Electron
├─────────────────┤
│   Storage       │  ← sql.js (WASM SQLite)
└─────────────────┘
\`\`\`

각 레이어는 명확하게 분리되어 있어서 독립적으로 테스트할 수 있습니다.

> **팁**: \`contextIsolation: true\`를 사용하면 보안이 강화됩니다.

도움이 되었나요? 추가 질문 환영합니다! 😊`,

  `짧은 답변: 네, 맞습니다.`,

  `여기에 여러 언어의 코드 블록을 보여드릴게요:

\`\`\`javascript
// JavaScript
const greet = (name) => \`Hello, \${name}!\`
\`\`\`

\`\`\`rust
// Rust
fn main() {
    println!("Hello, world!");
}
\`\`\`

\`\`\`sql
-- SQL
SELECT u.name, COUNT(m.id) as msg_count
FROM users u
LEFT JOIN messages m ON m.user_id = u.id
GROUP BY u.id
ORDER BY msg_count DESC
LIMIT 10;
\`\`\`

\`\`\`json
{
  "name": "kangnam-client",
  "version": "1.0.0",
  "description": "Desktop LLM chat client"
}
\`\`\`

다양한 구문 강조가 제대로 보이는지 확인해보세요!`
]

export class MockProvider implements LLMProvider {
  readonly name = 'mock'
  readonly displayName = 'Mock (UI Test)'

  private abortController: AbortController | null = null

  async sendMessage(
    messages: ChatMessage[],
    _tools: ToolDefinition[],
    _accessToken: string,
    callbacks: StreamCallbacks
  ): Promise<{ stopReason: 'end_turn' | 'tool_use'; toolCalls?: ToolCall[] }> {
    this.abortController = new AbortController()
    const signal = this.abortController.signal

    // Pick a response based on message count for variety
    const idx = (messages.filter(m => m.role === 'user').length - 1) % MOCK_RESPONSES.length
    const response = MOCK_RESPONSES[idx]

    // Simulate streaming: emit chunks with delays
    const words = response.split(/(?<=\s)/)
    const chunkSize = 3 // words per chunk

    for (let i = 0; i < words.length; i += chunkSize) {
      if (signal.aborted) break
      const chunk = words.slice(i, i + chunkSize).join('')
      callbacks.onToken(chunk)
      await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 40))
    }

    callbacks.onComplete()
    this.abortController = null

    return { stopReason: 'end_turn' }
  }

  formatTools(tools: ToolDefinition[]): unknown[] {
    return tools
  }

  abort(): void {
    this.abortController?.abort()
    this.abortController = null
  }
}
