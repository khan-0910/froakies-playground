import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import HoloCard from './HoloCard'
import { getCard, marketUsd, money, priceRows } from './api'

gsap.registerPlugin(ScrollTrigger)

// A grid of cards with captions and lazily fetched market prices.
export default function CardGrid({ cards, openCard, showPrice = true, className = '', isDim, extra, note }) {
  const root = useRef(null)
  const ids = cards.map((c) => c.lang + c.id).join('|') // re-animate only when the list itself changes

  useGSAP(
    () => {
      if (!cards.length) return
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.set('.grid-slot', { y: 50, opacity: 0, rotate: () => gsap.utils.random(-5, 5) })
        ScrollTrigger.batch('.grid-slot', {
          start: 'top 95%',
          once: true,
          onEnter: (els) => gsap.to(els, { y: 0, opacity: 1, rotate: 0, duration: 0.7, ease: 'expo.out', stagger: 0.04 }),
        })
      })
      ScrollTrigger.refresh()
    },
    { scope: root, dependencies: [ids] },
  )

  return (
    <ol ref={root} className={`card-grid ${className}`}>
      {cards.map((c) => (
        <li key={c.lang + c.id} id={`card-${c.id}`} className="grid-slot" data-dim={isDim ? isDim(c) : undefined}>
          <HoloCard card={c} onClick={() => openCard(c)} label={`${c.name}, open prices`} tilt={10} />
          <div className="slot-cap">
            <b className={c.lang === 'ja' ? 'jp' : ''}>{c.name}</b>
            <small>
              <span className={`lang-chip lang-chip--${c.lang}`}>{c.lang === 'ja' ? 'JP' : 'EN'}</span>
              {c.setName ? `${c.setName} · ` : ''}#{c.localId}
            </small>
            {showPrice && <LazyPrice card={c} />}
            {extra?.(c)}
            {note?.(c) && <small className="slot-note">{note(c)}</small>}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function LazyPrice({ card }) {
  const ref = useRef(null)
  const [p, setP] = useState(undefined)
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        getCard(card.id, card.lang)
          .then((full) => setP({ usd: marketUsd(priceRows(full)[0]) }))
          .catch(() => setP(null))
      },
      { rootMargin: '300px' },
    )
    io.observe(ref.current)
    return () => io.disconnect()
  }, [card.id, card.lang])
  return (
    <span ref={ref} className="slot-price" data-state={p === undefined ? 'loading' : p?.usd ? 'ok' : 'none'}>
      {p === undefined ? 'pricing…' : p?.usd ? money(p.usd) : 'no recent sales'}
    </span>
  )
}
