import { useEffect, useState } from 'react'
import { GLYPHS, TYPES, TYPE_ORDER } from './types'

export function useThemeType() {
  const [type, setType] = useState(() => window.__type || 'Lightning')
  useEffect(() => {
    const f = (e) => setType(e.detail)
    addEventListener('theme', f)
    return () => removeEventListener('theme', f)
  }, [])
  return type
}

// The page ground: a TCG playmat. Energy badges of the current type (plus a
// neighbour) tile the field and drift slowly, like a mat sliding under cards.
function tile(type) {
  const ink = TYPES[type].ink
  const other = TYPE_ORDER[(TYPE_ORDER.indexOf(type) + 3) % TYPE_ORDER.length]
  const badge = (x, y, r, g, rot) =>
    `<g transform="translate(${x} ${y}) rotate(${rot})"><circle r="${r}" fill="none" stroke="${ink}" stroke-width="3"/>` +
    `<g transform="scale(${r / 22}) translate(-12 -12)"><path d="${GLYPHS[g]}" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g></g>`
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220">` +
    badge(55, 55, 26, type, -10) +
    badge(165, 165, 26, type, 12) +
    badge(165, 55, 15, other, 0) +
    badge(55, 165, 15, other, 0) +
    `</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

export default function Playmat() {
  const type = useThemeType()
  return <div className="playmat" aria-hidden="true" style={{ '--tile': tile(type) }} />
}
