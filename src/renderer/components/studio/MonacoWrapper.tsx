import Editor, { type OnMount, loader } from '@monaco-editor/react'
import { useRef, useCallback } from 'react'
import type { editor as MonacoEditor } from 'monaco-editor'
import * as monaco from 'monaco-editor'

// Use local monaco-editor bundle instead of CDN (CSP blocks cdn.jsdelivr.net)
loader.config({ monaco })

interface MonacoWrapperProps {
  value: string
  onChange: (value: string) => void
  language?: string
  readOnly?: boolean
}

export function MonacoWrapper({ value, onChange, language = 'markdown', readOnly = false }: MonacoWrapperProps) {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)

  const handleMount: OnMount = useCallback((editor, monacoInstance) => {
    editorRef.current = editor

    // Define custom dark theme matching app
    monacoInstance.editor.defineTheme('kangnam-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6b7280' },
        { token: 'keyword', foreground: '818cf8' },
        { token: 'string', foreground: '34d399' },
      ],
      colors: {
        'editor.background': '#0d0d14',
        'editor.foreground': '#e0e0e0',
        'editor.lineHighlightBackground': '#1a1a2e',
        'editor.selectionBackground': '#3b3b5c',
        'editorLineNumber.foreground': '#4b5563',
        'editorLineNumber.activeForeground': '#9ca3af',
        'editor.inactiveSelectionBackground': '#2a2a4a',
        'editorCursor.foreground': '#818cf8',
        'editorWidget.background': '#131320',
        'editorWidget.border': '#2a2a4a',
      },
    })

    monacoInstance.editor.defineTheme('kangnam-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#1a1a2e',
        'editor.lineHighlightBackground': '#f5f5f5',
        'editor.selectionBackground': '#c7d2fe',
        'editorLineNumber.foreground': '#9ca3af',
        'editorCursor.foreground': '#6366f1',
      },
    })

    // Detect theme from document
    const theme = document.documentElement.getAttribute('data-theme')
    monacoInstance.editor.setTheme(theme === 'light' ? 'kangnam-light' : 'kangnam-dark')

    editor.focus()
  }, [])

  // Watch for theme changes
  const theme = document.documentElement.getAttribute('data-theme')
  const monacoTheme = theme === 'light' ? 'kangnam-light' : 'kangnam-dark'

  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      theme={monacoTheme}
      onChange={(v) => onChange(v || '')}
      onMount={handleMount}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        lineHeight: 20,
        padding: { top: 12 },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        lineNumbers: 'on',
        renderLineHighlight: 'line',
        bracketPairColorization: { enabled: true },
        automaticLayout: true,
        tabSize: 2,
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        folding: true,
        links: true,
      }}
    />
  )
}
