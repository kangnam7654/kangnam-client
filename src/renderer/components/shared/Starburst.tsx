/**
 * Shared Starburst SVG component
 * Used in ChatView (WelcomeScreen) and AssistantThread (EmptyState).
 */

interface StarburstProps {
  size?: number
  color?: string
  animated?: boolean
}

export function Starburst({ size = 20, color = 'var(--accent)', animated = false }: StarburstProps) {
  const c = size / 2
  const spokes = 16
  const outerR = c * 0.92
  const innerR = c * 0.38
  let d = ''
  for (let i = 0; i < spokes; i++) {
    const outerAngle = (Math.PI * 2 * i) / spokes - Math.PI / 2
    const innerAngle = (Math.PI * 2 * (i + 0.5)) / spokes - Math.PI / 2
    const ox = c + outerR * Math.cos(outerAngle)
    const oy = c + outerR * Math.sin(outerAngle)
    const ix = c + innerR * Math.cos(innerAngle)
    const iy = c + innerR * Math.sin(innerAngle)
    d += (i === 0 ? 'M' : 'L') + `${ox.toFixed(1)},${oy.toFixed(1)}L${ix.toFixed(1)},${iy.toFixed(1)}`
  }
  d += 'Z'
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      aria-hidden="true"
      style={animated ? { animation: 'starburstPulse 0.8s ease-in-out infinite' } : undefined}
    >
      <path d={d} fill={color} />
    </svg>
  )
}
