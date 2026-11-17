import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { PER_PAGE, binder, useBinder, useBinderName } from './binder'
import { getCard, marketUsd, money, priceRows } from './api'
import PocketDrawer from './PocketDrawer'
import { CardFace } from './HoloCard'

const useWide = () => {
  const q = '(min-width: 900px)'
  const [w, setW] = useState(() => matchMedia(q).matches)
  useEffect(() => {
    const m = matchMedia(q)
    const f = () => setW(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return w
}

export default function BinderBook({ openCard, focusSlot }) {
  const items = useBinder()
  const name = useBinderName()
  const wide = useWide()
  const root = useRef(null)
  const leafEls = useRef([])
  const busy = useRef(false)
  const [drawer, setDrawer] = useState(null) // pocket index or null
  const [refreshing, setRefreshing] = useState(false)
  const placed = useRef(null)

  const bySlot = new Map(items.map((i) => [i.slot, i]))
  const maxSlot = items.reduce((m, i) => Math.max(m, i.slot), -1)
  // always one blank page past the last filled one: the book grows as you fill it
  let pages = Math.max(Math.floor(maxSlot / PER_PAGE) + 2, 2)
  if (wide && pages % 2) pages++
  const leaves = wide ? pages / 2 : pages
  const maxSpread = wide ? leaves : leaves - 1

  const pageOfSlot = (s) => Math.floor(s / PER_PAGE)
  const spreadOfPage = (p) => (wide ? Math.floor((p + 1) / 2) : p)
  const [spread, setSpread] = useState(() => (focusSlot != null ? spreadOfPage(pageOfSlot(focusSlot)) : 0))
  const s = Math.min(spread, maxSpread)

  const total = items.reduce((a, i) => a + (i.price || 0) * i.qty, 0)
  const copies = items.reduce((a, i) => a + i.qty, 0)

  // keep every leaf's resting rotation in sync with the open spread
  useLayoutEffect(() => {
    leafEls.current.forEach((el, k) => el && gsap.set(el, { rotationY: k < s ? -180 : 0 }))
  }, [s, leaves, wide])

  // when the layout switches between one page and two, keep the same page open
  const lastWide = useRef(wide)
  useEffect(() => {
    if (lastWide.current === wide) return
    const page = lastWide.current ? Math.max(0, 2 * s - 1) : s
    lastWide.current = wide
    setSpread(spreadOfPage(page))
  }, [wide])

  function turn(dir) {
    if (busy.current) return
    const k = dir > 0 ? s : s - 1
    if (k < 0 || k >= leaves || (dir > 0 && s >= maxSpread)) return
    const el = leafEls.current[k]
    busy.current = true
    gsap.set(el, { zIndex: 500, visibility: 'visible' })
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    gsap.to(el, {
      rotationY: dir > 0 ? -180 : 0,
      duration: reduce ? 0.01 : 0.9,
      ease: 'power2.inOut',
      onComplete() {
        gsap.set(el, { clearProps: 'zIndex,visibility' })
        busy.current = false
        setSpread(s + dir)
      },
    })
    if (!reduce) {
      gsap.fromTo(el.querySelectorAll('.shade'), { opacity: 0 }, { opacity: 0.55, duration: 0.45, yoyo: true, repeat: 1, ease: 'sine.inOut' })
      gsap.fromTo(el, { scaleY: 1 }, { scaleY: 1.015, duration: 0.45, yoyo: true, repeat: 1, ease: 'sine.inOut' })
    }
  }

  // keyboard + swipe
  useEffect(() => {
    const onKey = (e) => {
      if (drawer != null || /input|select|textarea/i.test(document.activeElement?.tagName)) return
      if (e.key === 'ArrowRight') turn(1)
      if (e.key === 'ArrowLeft') turn(-1)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })
  const swipe = useRef(null)

  // ---------- drag a card from one pocket to another ----------
  const ghost = useRef(null)
  const bookEl = useRef(null)
  const dragged = useRef(false) // swallows the click/swipe that ends a drag
  const turnRef = useRef(turn)
  turnRef.current = turn

  function lift(e, slot, it) {
    if (e.button > 0) return
    const touch = e.pointerType === 'touch'
    const x0 = e.clientX
    const y0 = e.clientY
    let active = false
    let ready = !touch // touch needs a short hold so swipes still turn pages
    let over = null
    let edge = null
    const src = e.currentTarget.closest('li')
    const hold = touch ? setTimeout(() => (ready = true, start(x0, y0), navigator.vibrate?.(12)), 260) : null

    function start(x, y) {
      active = true
      dragged.current = true
      src.classList.add('is-lifted')
      const g = ghost.current
      const img = src.querySelector('.holo-low')?.src
      g.innerHTML = img ? `<img src="${img}" alt="">` : `<span>${it.name}</span>`
      g.style.display = 'block'
      place(x, y)
      gsap.fromTo(g, { scale: 0.9, rotate: 0 }, { scale: 1.12, rotate: -6, duration: 0.3, ease: 'back.out(2)' })
    }
    function place(x, y) {
      ghost.current.style.transform = `translate(${x}px, ${y}px)`
    }
    function edgeCheck(x) {
      const r = bookEl.current.getBoundingClientRect()
      const dir = x < r.left + 46 ? -1 : x > r.right - 46 ? 1 : 0
      if (dir === (edge?.dir ?? 0)) return
      clearInterval(edge?.timer)
      edge = dir ? { dir, timer: setInterval(() => turnRef.current(dir), 900) } : null
    }
    function move(ev) {
      if (!active) {
        const far = Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8
        if (!far) return
        if (!ready) return end() // moved before the hold finished: it's a swipe
        start(ev.clientX, ev.clientY)
      }
      ev.preventDefault()
      place(ev.clientX, ev.clientY)
      const li = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-slot]')
      if (li !== over) {
        over?.classList.remove('is-over')
        over = li && li !== src ? li : null
        over?.classList.add('is-over')
      }
      edgeCheck(ev.clientX)
    }
    function up() {
      if (active && over) {
        const to = Number(over.dataset.slot)
        placed.current = to
        binder.move(slot, to)
      }
      end()
    }
    function end() {
      clearTimeout(hold)
      clearInterval(edge?.timer)
      over?.classList.remove('is-over')
      src.classList.remove('is-lifted')
      if (ghost.current) ghost.current.style.display = 'none'
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', up)
      removeEventListener('pointercancel', end)
      setTimeout(() => (dragged.current = false), 0)
    }
    addEventListener('pointermove', move, { passive: false })
    addEventListener('pointerup', up)
    addEventListener('pointercancel', end)
  }

  // a freshly placed card drops into its pocket
  useEffect(() => {
    if (placed.current == null) return
    const el = root.current?.querySelector(`[data-slot="${placed.current}"] .pocket-card`)
    placed.current = null
    if (el && !matchMedia('(prefers-reduced-motion: reduce)').matches)
      gsap.from(el, { y: -120, scale: 1.35, rotate: -12, opacity: 0, duration: 0.8, ease: 'back.out(1.6)' })
  }, [items])

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.book', { y: 80, rotationX: 18, opacity: 0, duration: 1.1, ease: 'expo.out', transformPerspective: 1600 })
        gsap.from('.binder-head > *', { y: 24, opacity: 0, duration: 0.7, stagger: 0.06, ease: 'expo.out' })
        const el = root.current.querySelector('.binder-total')
        const n = { v: 0 }
        gsap.to(n, { v: total, duration: 1.4, ease: 'expo.out', onUpdate: () => (el.textContent = money(n.v)) })
      })
    },
    { scope: root },
  )

  async function refresh() {
    setRefreshing(true)
    for (const i of items) {
      try {
        const rows = priceRows(await getCard(i.id, i.lang))
        const row = rows.find((r) => r.label === i.variant) || rows[0]
        binder.setPrice(i.slot, marketUsd(row))
      } catch {
        /* keep the old snapshot */
      }
    }
    setRefreshing(false)
  }

  const page = (p) => (
    <Page key={p} p={p} bySlot={bySlot} live={Math.abs(spreadOfPage(p) - s) <= 1} onPocket={(slot) => !dragged.current && setDrawer(slot)} onLift={lift} />
  )

  const leftLabel = wide ? (s === 0 ? null : 2 * s) : null
  const rightLabel = wide ? (s >= leaves ? null : 2 * s + 1) : s + 1

  return (
    <main ref={root} className="binder wrap">
      <header className="binder-head">
        <label className="binder-name">
          <span className="sr-only">Binder name</span>
          <input value={name} onChange={(e) => binder.rename(e.target.value)} spellCheck="false" />
        </label>
        <p className="binder-total" aria-live="polite">{money(total)}</p>
        <p className="binder-sub">
          {copies} {copies === 1 ? 'card' : 'cards'} · {pages} pages
          {items.length > 0 && (
            <button className="linkish" onClick={refresh} disabled={refreshing}>
              {refreshing ? 'Updating prices…' : 'Update prices'}
            </button>
          )}
        </p>
      </header>

      <div className="book-stage">
        <button className="turn turn--prev" onClick={() => turn(-1)} disabled={s === 0} aria-label="Previous page">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg>
        </button>

        <div
          ref={bookEl}
          className={`book ${wide ? 'book--spread' : 'book--single'}`}
          onPointerDown={(e) => (swipe.current = e.clientX)}
          onPointerUp={(e) => {
            if (swipe.current == null || dragged.current) return (swipe.current = null)
            const dx = e.clientX - swipe.current
            swipe.current = null
            if (Math.abs(dx) > 60) turn(dx < 0 ? 1 : -1)
          }}
        >
          {wide && (
            <div className="cover cover--inside" aria-hidden={s !== 0}>
              <span className="cover-name">{name}</span>
              <span className="cover-hint">Tap any empty pocket to file a card. The binder adds pages as it fills.</span>
              <span className="rings" aria-hidden="true"><i /><i /><i /></span>
            </div>
          )}
          {wide && (
            <div className="cover cover--back" aria-hidden={s !== leaves}>
              <span className="cover-hint">That's the end, for now. Every card you add opens a fresh page.</span>
            </div>
          )}

          {Array.from({ length: leaves }, (_, k) => {
            const flipped = k < s
            return (
              <div
                key={k}
                ref={(el) => (leafEls.current[k] = el)}
                className="leaf"
                data-flipped={flipped}
                style={{ zIndex: flipped ? k + 1 : leaves * 2 - k }}
              >
                <div className="face face--front">
                  {page(wide ? 2 * k : k)}
                  <span className="shade" />
                </div>
                <div className="face face--back">
                  {wide ? page(2 * k + 1) : <div className="page page--blank" />}
                  <span className="shade" />
                </div>
              </div>
            )
          })}
        </div>

        <button className="turn turn--next" onClick={() => turn(1)} disabled={s >= maxSpread} aria-label="Next page">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
        </button>
      </div>

      <div ref={ghost} className="drag-ghost" aria-hidden="true" />
      <p className="book-hint">{matchMedia('(pointer: coarse)').matches ? 'Hold a card to move it. Swipe to turn pages.' : 'Drag a card onto any pocket to move or swap it. Hold it at the edge to turn the page.'}</p>

      <p className="book-where" aria-live="polite">
        {[leftLabel, rightLabel].filter(Boolean).length
          ? `Page ${[leftLabel, rightLabel].filter(Boolean).join('–')} of ${pages}`
          : 'Back cover'}
      </p>

      {drawer != null && (
        <PocketDrawer
          slot={drawer}
          item={bySlot.get(drawer)}
          onClose={() => setDrawer(null)}
          onPlaced={(slot) => (placed.current = slot)}
          openCard={openCard}
        />
      )}
    </main>
  )
}

function Page({ p, bySlot, live, onPocket, onLift }) {
  return (
    <div className="page">
      <ol className="pockets">
        {Array.from({ length: PER_PAGE }, (_, i) => {
          const slot = p * PER_PAGE + i
          const it = bySlot.get(slot)
          return (
            <li key={slot} data-slot={slot}>
              {it ? (
                <button className="pocket pocket--full" onClick={() => onPocket(slot)} onPointerDown={(e) => onLift(e, slot, it)} aria-label={`${it.name}, ${money(it.price)}${it.qty > 1 ? `, ${it.qty} copies` : ''}`}>
                  <span className="pocket-card">
                    {live ? <CardFace card={it} /> : <span className="pocket-name">{it.name}</span>}
                  </span>
                  <span className="sticker">
                    {it.qty > 1 && <em>×{it.qty}</em>}
                    {it.price ? money(it.price * it.qty) : '—'}
                  </span>
                </button>
              ) : (
                <button className="pocket pocket--empty" onClick={() => onPocket(slot)} aria-label={`Empty pocket ${slot + 1}, add a card`}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg>
                </button>
              )}
            </li>
          )
        })}
      </ol>
      <span className="page-no">{p + 1}</span>
    </div>
  )
}
