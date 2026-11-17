import { forwardRef, useImperativeHandle, useRef } from 'react'
import gsap from 'gsap'
import { TYPES } from './types'
import { art, attackerFor } from './pokemon'

// Page transitions: the destination type's Pokémon uses its move across the
// screen. wipe(type, swap) covers the screen, calls swap() while covered, then reveals.
//   Fire       Charizard  · Flamethrower   (flame stream from its mouth)
//   Water      Greninja   · Water Shuriken (spinning shuriken bursts into water)
//   Grass      Sceptile   · Leaf Blade     (leaf storm, green slashes, the cut)
//   Lightning  Pikachu    · Thunderbolt    (bolts drop, the screen flashes)
//   Psychic +  a Psychic Pokémon · Psybeam (pulsing rings from the Pokémon)

const rnd = gsap.utils.random

// horizontal flame stream with a ragged leading (right) edge; viewBox 0..140 x 0..100
const flameStream = () => {
  let d = 'M0 0 L112 0'
  const n = 9
  for (let i = 0; i < n; i++) {
    const y0 = (i / n) * 100
    const y1 = ((i + 0.5) / n) * 100
    const y2 = ((i + 1) / n) * 100
    d += ` Q ${116 + rnd(0, 4)} ${y0 + 2} ${124 + rnd(4, 14)} ${y1} Q ${116 + rnd(0, 4)} ${y2 - 2} 112 ${y2}`
  }
  return d + ' L0 100 Z'
}
const boltEdge = () => {
  let d = 'M0 0 L100 0 L100 118'
  const n = 7
  for (let i = n - 1; i >= 0; i--) {
    const x = (i / n) * 100
    d += ` L ${x + 100 / n / 2} ${132 + (i % 2 ? -4 : 8)} L ${x} ${116 + rnd(0, 6)}`
  }
  return d + ' Z'
}
const svg = (vb, path, fill, cls = '') =>
  `<svg class="mw-layer ${cls}" viewBox="${vb}" preserveAspectRatio="none" aria-hidden="true"><path d="${path}" fill="${fill}"/></svg>`
const leaf = (fill) =>
  `<svg class="mw-leaf" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21C3 10 10 3 21 3c0 11-7 18-18 18z" fill="${fill}"/><path d="M3 21 15 9" stroke="rgba(0,0,0,.28)" stroke-width="1.4"/></svg>`
const shuriken = `<svg class="mw-shuriken" viewBox="-50 -50 100 100" aria-hidden="true">
  <g fill="#7fd8ff"><path d="M0-48 9-9 48 0 9 9 0 48-9 9-48 0-9-9Z"/></g>
  <g fill="#e9fbff" opacity=".85"><path d="M0-40 5-5 0 0Z M40 0 5 5 0 0Z M0 40-5 5 0 0Z M-40 0-5-5 0 0Z"/></g>
  <circle r="11" fill="#1a6fe0"/><circle r="5" fill="#e9fbff"/></svg>`
const poke = (id, cls) => `<img class="mw-poke ${cls}" src="${art(id)}" alt="" draggable="false">`

const MoveWipe = forwardRef(function MoveWipe(_, ref) {
  const root = useRef(null)
  const busy = useRef(false)

  useImperativeHandle(ref, () => ({
    async wipe(type, swap) {
      const el = root.current
      if (busy.current || !el) return swap()
      const t = TYPES[type] || TYPES.Lightning
      busy.current = true
      el.style.display = 'block'

      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.innerHTML = `<div class="mw-fill" style="background:${t.field}"></div>`
        await gsap.fromTo(el.firstChild, { opacity: 0 }, { opacity: 1, duration: 0.18 })
        await swap()
        await gsap.to(el.firstChild, { opacity: 0, duration: 0.25 })
        return finish()
      }

      const tl = gsap.timeline()
      ;(MOVES[type] || MOVES.beam)(el, t, tl, attackerFor(type))
      gsap.set(el.querySelectorAll('.mw-center'), { xPercent: -50, yPercent: -50 }) // GSAP owns transforms, so centre here
      await new Promise((res) => tl.addPause('covered', res))
      await swap()
      tl.resume()
      await tl
      finish()

      function finish() {
        el.innerHTML = ''
        el.style.display = 'none'
        busy.current = false
      }
    },
  }))

  return <div ref={root} className="move-wipe" aria-hidden="true" />
})

const MOVES = {
  // Charizard rears up bottom-left and breathes a widening flame stream across.
  Fire(el, t, tl, id) {
    el.innerHTML =
      ['#c22a12', t.field, '#ffb22e', '#ffe066'].map((c, i) => svg('0 0 140 100', flameStream(), c, `mw-wide f${i}`)).join('') +
      poke(id, 'mw-left')
    const flames = el.querySelectorAll('.mw-layer')
    const zard = el.querySelector('.mw-poke')
    gsap.set(flames, { xPercent: -100, scaleY: 0.12, transformOrigin: '0% 50%' })
    gsap.set(zard, { scaleX: -1 }) // artwork faces left; turn him to breathe across the screen
    tl.fromTo(zard, { x: '-60vw', y: '20vh', rotate: -18 }, { x: 0, y: 0, rotate: 0, duration: 0.4, ease: 'back.out(1.4)' })
    tl.to(zard, { rotate: 6, scaleY: 1.05, duration: 0.14, ease: 'power2.out' })
    tl.to(flames, { xPercent: -10, scaleY: 1.25, duration: 0.55, ease: 'power2.in', stagger: 0.06 }, '<')
    tl.to(flames, { y: () => rnd(-14, 14), duration: 0.07, repeat: 3, yoyo: true }, '<0.3')
    tl.addLabel('covered')
    tl.to(zard, { x: '-50vw', y: '-30vh', rotate: -25, duration: 0.45, ease: 'power2.in' }, 'covered+=0.01')
    tl.to(flames, { xPercent: 100, duration: 0.6, ease: 'power3.in', stagger: 0.05 }, 'covered+=0.06')
  },

  // Greninja springs in, hurls a spinning shuriken that bursts into a wall of water.
  Water(el, t, tl, id) {
    el.innerHTML =
      ['#0d3fae', t.field, '#35d3ff'].map((c) => `<div class="mw-ring" style="background:${c}"></div>`).join('') +
      poke(id, 'mw-right') +
      shuriken
    const water = el.querySelectorAll('.mw-ring')
    const gren = el.querySelector('.mw-poke')
    const star = el.querySelector('.mw-shuriken')
    gsap.set(water, { clipPath: 'circle(0% at 50% 50%)' })
    gsap.set(star, { xPercent: -50, yPercent: -50, left: '72%', top: '38%', scale: 0.4 })
    tl.fromTo(gren, { x: '50vw', y: '-40vh', rotate: 20 }, { x: 0, y: 0, rotate: 0, duration: 0.4, ease: 'power3.out' })
    tl.to(gren, { rotate: -10, x: '-2vw', duration: 0.12, ease: 'power2.out' })
    tl.to(star, { left: '50%', top: '50%', scale: 3.2, rotate: 900, duration: 0.5, ease: 'power2.in' }, '<')
    tl.to(water, { clipPath: 'circle(80% at 50% 50%)', duration: 0.45, ease: 'power3.in', stagger: 0.07 }, '>-0.12')
    tl.to(star, { rotate: '+=360', duration: 0.4, ease: 'none' }, '<')
    tl.addLabel('covered')
    tl.to(gren, { x: '45vw', y: '-30vh', duration: 0.35, ease: 'power2.in' }, 'covered+=0.01')
    tl.to(star, { scale: 0, rotate: '+=540', duration: 0.4, ease: 'back.in(2)' }, 'covered+=0.01')
    tl.to([...water].reverse(), { yPercent: 110, duration: 0.6, ease: 'power3.in', stagger: 0.06 }, 'covered+=0.12')
  },

  // Sceptile lunges in with a leaf storm; green blades slash shut, then a white cut splits them.
  Grass(el, t, tl, id) {
    const greens = [t.deep, t.field, '#1f9e4a', '#7fdc5a', t.deep]
    const bands = greens.map((c, i) => `<div class="mw-band" style="background:${c};top:${i * 30 - 34}%"></div>`).join('')
    const leaves = Array.from({ length: 16 }, (_, i) => leaf(['#2fbf4a', '#137a3a', '#7fdc5a'][i % 3])).join('')
    el.innerHTML = bands + leaves + poke(id, 'mw-center') + `<div class="mw-cut"></div>`
    const b = el.querySelectorAll('.mw-band')
    const lv = el.querySelectorAll('.mw-leaf')
    const sce = el.querySelector('.mw-poke')
    const cut = el.querySelector('.mw-cut')
    gsap.set(b, { xPercent: (i) => (i % 2 ? 120 : -120) })
    gsap.set(lv, { x: () => -100 - rnd(0, 300), y: () => rnd(0, innerHeight), rotate: () => rnd(0, 360), scale: () => rnd(0.8, 1.8) })
    tl.fromTo(sce, { x: '-70vw', rotate: -12 }, { x: 0, rotate: 0, duration: 0.42, ease: 'expo.out' }, 0)
    tl.to(lv, { x: () => innerWidth + 200, rotate: '+=720', duration: 0.85, ease: 'power1.in', stagger: 0.025 }, 0)
    tl.to(b, { xPercent: 0, duration: 0.4, ease: 'expo.out', stagger: 0.06 }, 0.12)
    tl.addLabel('covered')
    tl.fromTo(cut, { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.16, ease: 'power4.out' }, 'covered+=0.01')
    tl.to(sce, { x: '80vw', rotate: 10, duration: 0.4, ease: 'power3.in' }, 'covered+=0.05')
    tl.to(b, { xPercent: (i) => (i % 2 ? -130 : 130), duration: 0.5, ease: 'expo.in', stagger: 0.04 }, 'covered+=0.12')
    tl.to(cut, { opacity: 0, duration: 0.2 }, '<0.25')
  },

  // Pikachu pops up; bolts slam down and the screen flashes.
  Lightning(el, t, tl, id) {
    el.innerHTML = svg('0 0 100 140', boltEdge(), t.field, 'l0') + svg('0 0 100 140', boltEdge(), t.deep, 'l1') + poke(id, 'mw-center') + `<div class="mw-flash"></div>`
    const layers = el.querySelectorAll('.mw-layer')
    const pika = el.querySelector('.mw-poke')
    const flash = el.querySelector('.mw-flash')
    gsap.set(layers, { yPercent: -110 })
    tl.fromTo(pika, { y: '60vh', scale: 0.6 }, { y: 0, scale: 1, duration: 0.35, ease: 'back.out(2)' })
    tl.to(pika, { x: () => rnd(-6, 6), duration: 0.04, repeat: 5, yoyo: true })
    tl.to(layers, { yPercent: 0, duration: 0.3, ease: 'power4.in', stagger: 0.06 }, '<')
    tl.fromTo(flash, { opacity: 0 }, { opacity: 0.85, duration: 0.05, yoyo: true, repeat: 3 }, '>-0.05')
    tl.addLabel('covered')
    tl.to(pika, { y: '70vh', duration: 0.35, ease: 'power2.in' }, 'covered+=0.01')
    tl.to(layers, { yPercent: 115, duration: 0.45, ease: 'power3.in', stagger: 0.05 }, 'covered+=0.06')
  },

  // Psybeam (and every other type): the Pokémon rises, rings pulse out of it.
  beam(el, t, tl, id) {
    const cols = t === TYPES.Psychic ? ['#7a1c9c', '#ff7ac8', '#6a5cff', '#d34ee6', '#ffd1f7', '#d34ee6'] : [t.deep, t.field, t.pop, t.field, t.deep, t.field]
    el.innerHTML = cols.map((c) => `<div class="mw-ring" style="background:${c}"></div>`).join('') + poke(id, 'mw-center')
    const r = el.querySelectorAll('.mw-ring')
    const mon = el.querySelector('.mw-poke')
    gsap.set(r, { clipPath: 'circle(0% at 50% 50%)' })
    tl.fromTo(mon, { scale: 0, rotate: -20 }, { scale: 1, rotate: 0, duration: 0.4, ease: 'back.out(2)' })
    tl.to(mon, { y: -14, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '<0.2')
    tl.to(r, { clipPath: 'circle(78% at 50% 50%)', duration: 0.5, ease: 'power2.in', stagger: 0.07 }, 0.2)
    tl.addLabel('covered')
    tl.to(mon, { scale: 0, rotate: 30, duration: 0.3, ease: 'back.in(2)' }, 'covered+=0.01')
    tl.to([...r].reverse(), { clipPath: 'circle(0% at 50% 50%)', duration: 0.5, ease: 'power3.out', stagger: 0.05 }, 'covered+=0.1')
  },
}

export default MoveWipe
