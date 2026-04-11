import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { codeToHtml } from 'shiki'

interface MarkdownPreviewProps {
  content: string
  className?: string
}

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  return (
    <div className={`aui-markdown selectable ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ code: CodeBlock }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function CodeBlock({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const lang = className?.replace('language-', '') || ''
  const code = String(children).replace(/\n$/, '')
  const isInline = !className

  if (isInline) {
    return (
      <code
        style={{
          background: 'var(--bg-code-inline)',
          borderRadius: 5,
          padding: '0.2em 0.4em',
          fontSize: '0.85em',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-code-inline)',
        }}
        {...props}
      >
        {children}
      </code>
    )
  }

  return <ShikiCodeBlock code={code} lang={lang} />
}

function ShikiCodeBlock({ code, lang }: { code: string; lang: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    codeToHtml(code, { lang: lang || 'text', theme: 'vitesse-dark' })
      .then((html) => {
        if (!cancelled && ref.current) ref.current.innerHTML = html
      })
      .catch(() => {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = `<pre style="margin:0;padding:16px;overflow-x:auto;font-size:12px;line-height:1.6;font-family:var(--font-mono);color:var(--text-primary)">${escapeHtml(code)}</pre>`
        }
      })
    return () => { cancelled = true }
  }, [code, lang])

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ position: 'relative', marginBottom: 12, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-code)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
        <span>{lang || 'text'}</span>
        <button
          onClick={handleCopy}
          style={{ background: 'none', border: 'none', color: copied ? 'var(--success)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-mono)' }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div ref={ref} className="shiki-block" style={{ fontSize: 12, lineHeight: 1.6, overflow: 'auto' }}>
        <pre style={{ margin: 0, padding: 16, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}><code>{code}</code></pre>
      </div>
    </div>
  )
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
