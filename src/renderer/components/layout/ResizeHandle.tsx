import { useCallback, useEffect, useRef } from 'react'

interface ResizeHandleProps {
  side: 'left' | 'right' | 'bottom'
  onResize: (delta: number) => void
  onDoubleClick?: () => void
}

export function ResizeHandle({ side, onResize, onDoubleClick }: ResizeHandleProps) {
  const dragging = useRef(false)
  const lastPos = useRef(0)
  const isHorizontal = side === 'bottom'

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    lastPos.current = isHorizontal ? e.clientY : e.clientX
    document.body.style.cursor = isHorizontal ? 'row-resize' : 'col-resize'
    document.body.style.userSelect = 'none'
  }, [isHorizontal])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      if (isHorizontal) {
        const delta = e.clientY - lastPos.current
        lastPos.current = e.clientY
        onResize(delta)
      } else {
        const delta = e.clientX - lastPos.current
        lastPos.current = e.clientX
        onResize(side === 'left' ? delta : -delta)
      }
    }
    const onMouseUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onResize, side, isHorizontal])

  if (isHorizontal) {
    return (
      <div
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        style={{
          height: 4,
          cursor: 'row-resize',
          background: 'transparent',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 1,
            height: 2,
            background: 'var(--border)',
            transition: 'background 0.15s',
          }}
          className="hover:!bg-[var(--accent)]"
        />
      </div>
    )
  }

  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      style={{
        width: 4,
        cursor: 'col-resize',
        background: 'transparent',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 1,
          width: 2,
          background: 'var(--border)',
          transition: 'background 0.15s',
        }}
        className="hover:!bg-[var(--accent)]"
      />
    </div>
  )
}
