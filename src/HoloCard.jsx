import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { getCard, imageSources, isPlaceholder } from './api'
import { GLYPHS, TYPES, typeOf } from './types'
import { art } from './pokemon'

// A real card face that tilts toward the pointer with a moving foil glare.
export default function HoloCard({ card, size = 'low', className = '', style, onClick, tilt = 14, label, eager = false }) {
  const el = useRef(null)
  const q = useRef({})

  useGSAP(() => {
    gsap.set(el.current, { transformPerspective: 900 })
    q.current.rx = gsap.quickTo(el.current, 'rotationX', { duration: 0.5, ease: 'power3.out' })
    q.current.ry = gsap.quickTo(el.current, 'rotationY', { duration: 0.5, ease: 'power3.out' })
  }, { scope: el })

  const move = (e) => {
    if (e.pointerType === 'touch' || !tilt) return
    const r = el.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    q.current.ry(gsap.utils.mapRange(0, 1, -tilt, tilt, x))
    q.current.rx(gsap.utils.mapRange(0, 1, tilt, -tilt, y))
    el.current.style.setProperty('--mx', `${x * 100}%`)
    el.current.style.setProperty('--my', `${y * 100}%`)
    el.current.style.setProperty('--glare', '1')
  }
  const leave = () => {
    q.current.rx?.(0)
    q.current.ry?.(0)
    el.current?.style.setProperty('--glare', '0')
  }

  const t = TYPES[typeOf(card)]
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      ref={el}
      className={`holo ${className}`}
      style={{ '--t1': t.field, '--t2': t.pop, ...style }}
      onPointerMove={move}
      onPointerLeave={leave}
      onClick={onClick}
      aria-label={label || card?.name}
      type={onClick ? 'button' : undefined}
    >
      <CardFace card={card} size={size} eager={eager} />
      <span className="holo-glare" aria-hidden="true" />
    </Tag>
  )
}

// Tries each known scan in turn (shimmer while loading); a sharp scan fades
// over the small one for size="high". With no scan anywhere, draws a stand-in.
// A new card remounts the face (key) instead of resetting state in an effect:
// that effect ran after a cached image's onLoad and hid pictures that had loaded.
export function CardFace(props) {
  return <Face key={`${props.card?.lang}:${props.card?.id}`} {...props} />
}

function Face({ card, size = 'low', eager = false, onReady }) {
  const low = imageSources(card, 'low')
  const high = size === 'high' ? imageSources(card, 'high') : []
  const [i, setI] = useState(0)
  const [ok, setOk] = useState(false)
  const [hi, setHi] = useState(false)

  const standIn = i >= low.length
  useEffect(() => {
    if (standIn) onReady?.()
  }, [standIn])
  if (standIn) return <StandIn card={card} />
  const load = eager ? 'eager' : 'lazy'
  return (
    <>
      <img className="holo-low" data-ok={ok} src={low[i]} alt={card.name} loading={load} decoding="async" draggable="false" onLoad={(e) => (isPlaceholder(e.currentTarget) ? setI(i + 1) : (setOk(true), onReady?.()))} onError={() => (setOk(false), setI(i + 1))} />
      {ok && high[i] && <img className="holo-high" data-ready={hi} src={high[i]} alt="" decoding="async" draggable="false" onLoad={(e) => setHi(!isPlaceholder(e.currentTarget))} />}
    </>
  )
}

// No scan exists (most older Japanese cards): the card's own Pokémon artwork
// in its type colour, clearly labelled as a stand-in.
function StandIn({ card }) {
  const [full, setFull] = useState(card?.dexId ? card : null)
  const [byName, setByName] = useState(null)
  useEffect(() => {
    if (!full && card?.id) getCard(card.id, card.lang).then(setFull).catch(() => setFull({}))
  }, [card?.id, card?.lang])
  // some entries carry no Pokédex number: ask PokeAPI by the English name ("Koraidon ex" → koraidon)
  useEffect(() => {
    if (!full || full.dexId?.length || card?.lang !== 'en' || full.category === 'Trainer') return
    const slug = card.name.replace(/\b(ex|EX|GX|V|VMAX|VSTAR|BREAK|LV\.X|δ|Prime)\b/g, '').replace(/^.*'s\s+/, '').replace(/^(Dark|Light|Shining|Radiant|Mega|M)\s+/, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    fetch(`https://pokeapi.co/api/v2/pokemon-species/${slug}`).then((r) => (r.ok ? r.json() : null)).then((d) => d?.id && setByName(d.id)).catch(() => {})
  }, [full])
  const dex = full?.dexId?.[0] || byName
  const type = typeOf(full?.types ? full : card)
  const t = TYPES[type]
  const jp = /[぀-ヿ一-龯]/.test(card?.name || '')
  return (
    <span className="stand-in" style={{ '--s1': t.field, '--s2': t.pop, '--s-ink': t.ink }}>
      <b className={jp ? 'jp' : ''}>{card?.name}</b>
      <span className="stand-art">
        {dex ? (
          <img src={art(dex)} alt="" loading="lazy" draggable="false" />
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={GLYPHS[type] || GLYPHS.Colorless} /></svg>
        )}
      </span>
      <small>#{card?.localId} · no scan yet</small>
    </span>
  )
}
