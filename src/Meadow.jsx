import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { FROAKIE, ROSTER, cry, walker } from './pokemon'
import { useThemeType } from './Playmat'

// A strip of ground above the footer where little Pokémon of the current type
// wander about. Tap one: it hops, says its name, and plays its cry.
export default function Meadow() {
  const type = useThemeType()
  const root = useRef(null)
  const [crew, setCrew] = useState([])

  useEffect(() => {
    const mates = [...(ROSTER[type] || ROSTER.Colorless)].sort(() => Math.random() - 0.5)
    const n = innerWidth < 600 ? 2 : 3
    setCrew([[FROAKIE, 'Froakie'], ...mates.slice(0, n)])
  }, [type])

  useEffect(() => {
    if (!crew.length) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      const W = () => root.current.clientWidth
      root.current.querySelectorAll('.mon').forEach((mon, i) => {
        const body = mon.querySelector('.mon-body')
        let x = ((i + 0.5) / crew.length) * W() * 0.9
        gsap.set(mon, { x })
        if (reduce) return
        const stroll = () => {
          const nx = gsap.utils.clamp(0, W() - 70, x + gsap.utils.random(-260, 260))
          gsap.set(body, { scaleX: nx > x ? -1 : 1 }) // sprites face left; mirror to walk right
          const dur = Math.abs(nx - x) / gsap.utils.random(45, 80)
          x = nx
          gsap.to(mon, {
            x: nx,
            duration: Math.max(0.6, dur),
            ease: 'none',
            onComplete: () => {
              if (Math.random() < 0.3) gsap.to(body, { y: -18, duration: 0.22, yoyo: true, repeat: 1, ease: 'power2.out' })
              gsap.delayedCall(gsap.utils.random(0.8, 3.5), stroll)
            },
          })
        }
        gsap.delayedCall(gsap.utils.random(0.2, 1.5), stroll)
      })
    }, root)
    return () => ctx.revert()
  }, [crew])

  const poke = (e, id, name) => {
    const mon = e.currentTarget
    const body = mon.querySelector('.mon-body')
    const bubble = mon.querySelector('.mon-say')
    gsap.timeline()
      .to(body, { y: -54, scaleY: 1.1, duration: 0.25, ease: 'power2.out' })
      .to(body, { y: 0, scaleY: 0.85, duration: 0.22, ease: 'power2.in' })
      .to(body, { scaleY: 1, duration: 0.25, ease: 'elastic.out(1, 0.4)' })
    gsap.fromTo(bubble, { opacity: 0, y: 10, scale: 0.6 }, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'back.out(3)' })
    gsap.to(bubble, { opacity: 0, delay: 1.6, duration: 0.3 })
    try {
      const a = new Audio(cry(id))
      a.volume = 0.3
      a.play().catch(() => {})
    } catch {
      /* no audio */
    }
  }

  return (
    <div ref={root} className="meadow">
      {crew.map(([id, name]) => (
        <button key={`${type}-${id}`} className="mon" onClick={(e) => poke(e, id, name)} aria-label={`${name}: tap to say hi`}>
          <span className="mon-say" aria-hidden="true">{name}!</span>
          <span className="mon-body">
            <img src={walker(id)} alt="" draggable="false" />
          </span>
        </button>
      ))}
    </div>
  )
}
