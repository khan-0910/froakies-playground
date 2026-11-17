import { useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import CardGrid from './CardGrid'
import { SetLogo } from './SetsView'
import { getCard, getSet, money, priceRows } from './api'
import { PER_PAGE, binder, useBinder } from './binder'
import { entryFrom } from './PocketDrawer'

export default function SetView({ id, lang, openCard, back }) {
  const root = useRef(null)
  const [set, setSet] = useState(null)
  const [err, setErr] = useState(null)
  const [filter, setFilter] = useState('')
  const [show, setShow] = useState('all') // all | have | missing
  const [adding, setAdding] = useState({}) // card id -> 'busy' | pocket number
  const items = useBinder()

  useEffect(() => {
    setSet(null)
    getSet(id, lang).then(setSet).catch((e) => setErr(e.message))
  }, [id, lang])

  // copies owned per card in this set (any printing / condition)
  const owned = useMemo(() => {
    const m = new Map()
    for (const i of items) if (i.lang === lang) m.set(i.id, (m.get(i.id) || 0) + i.qty)
    return m
  }, [items, lang])

  const all = useMemo(() => (set?.cards || []).map((c) => ({ ...c, lang, setName: set.name })), [set, lang])
  const have = all.filter((c) => owned.has(c.id)).length
  const ownedValue = items.filter((i) => i.lang === lang && all.some((c) => c.id === i.id)).reduce((a, i) => a + (i.price || 0) * i.qty, 0)

  const cards = useMemo(() => {
    const f = filter.trim().toLowerCase()
    return all.filter(
      (c) =>
        (!f || c.name.toLowerCase().includes(f) || Number(c.localId) === Number(f)) &&
        (show === 'all' || (show === 'have') === owned.has(c.id)),
    )
  }, [all, filter, show, owned])

  useGSAP(
    () => {
      if (!set) return
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo('.dex-cell', { scale: 0 }, { scale: 1, duration: 0.4, ease: 'back.out(2)', stagger: { each: 0.004, from: 'start' }, delay: 0.2 })
        const el = root.current.querySelector('.complete-num')
        const n = { v: 0 }
        gsap.to(n, { v: have, duration: 1.2, ease: 'expo.out', delay: 0.2, onUpdate: () => (el.textContent = Math.round(n.v)) })
      })
    },
    { scope: root, dependencies: [set] },
  )

  async function quickAdd(c) {
    setAdding((a) => ({ ...a, [c.id]: 'busy' }))
    try {
      const full = await getCard(c.id, lang)
      const slot = binder.add(entryFrom(full, priceRows(full)[0], 'Near Mint', 1))
      setAdding((a) => ({ ...a, [c.id]: slot }))
    } catch {
      setAdding((a) => ({ ...a, [c.id]: 'error' }))
    }
  }

  const jump = (cid) => {
    setShow('all')
    setFilter('')
    requestAnimationFrame(() => document.getElementById(`card-${cid}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  if (err) return <main className="wrap"><p className="note">Couldn't open this set ({err}). <button className="linkish" onClick={back}>All sets</button></p></main>
  if (!set) return <main className="wrap"><p className="note">Opening the set…</p></main>

  const c = set.cardCount || {}
  const pct = all.length ? Math.round((have / all.length) * 100) : 0
  return (
    <main ref={root} className="set-view wrap">
      <button className="back" onClick={back}>← All sets</button>
      <header className="page-head">
        <span className="set-logo"><SetLogo key={set.id} set={set} lang={lang} /></span>
        <h1 className={lang === 'ja' ? 'jp' : ''}>{set.name}</h1>
        <p>
          {set.serie?.name}
          {set.releaseDate ? ` · released ${new Date(set.releaseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
          {` · ${c.official ?? c.total} cards`}
          {c.total > c.official ? ` + ${c.total - c.official} secret` : ''}
        </p>
      </header>

      <section className="complete" aria-label="Set completion">
        <p className="complete-count">
          <span className="complete-num">{have}</span>
          <span className="complete-of">/ {all.length}</span>
        </p>
        <p className="complete-words">
          {have === 0
            ? 'None of this set in your binder yet.'
            : have === all.length
              ? 'Set complete. Every card is in your binder.'
              : `${pct}% collected · ${all.length - have} to go · your copies are worth ${money(ownedValue)}`}
        </p>
        <ol className="dex-strip" aria-label="Every card in the set, filled when you own it">
          {all.map((card) => (
            <li key={card.id}>
              <button
                className="dex-cell"
                data-owned={owned.has(card.id)}
                onClick={() => jump(card.id)}
                title={`#${card.localId} ${card.name}${owned.has(card.id) ? ' · owned' : ''}`}
                aria-label={`#${card.localId} ${card.name}, ${owned.has(card.id) ? 'owned' : 'missing'}`}
              />
            </li>
          ))}
        </ol>
      </section>

      <div className="set-tools">
        <div className="lang" role="radiogroup" aria-label="Show">
          {[
            ['all', `All ${all.length}`],
            ['have', `Have ${have}`],
            ['missing', `Missing ${all.length - have}`],
          ].map(([v, l]) => (
            <button key={v} role="radio" aria-checked={show === v} onClick={() => setShow(v)}>
              {l}
            </button>
          ))}
        </div>
        <label className="seek seek--small">
          <span className="sr-only">Find in this set</span>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find: name or number" />
        </label>
      </div>

      {cards.length === 0 ? (
        <p className="note">{show === 'have' ? 'Nothing from this set in your binder yet.' : show === 'missing' ? 'Nothing missing. Set complete.' : 'No card matches that.'}</p>
      ) : (
        <CardGrid
          cards={cards}
          openCard={openCard}
          isDim={(card) => !owned.has(card.id)}
          extra={(card) => {
            const n = owned.get(card.id)
            const a = adding[card.id]
            if (n) return <span className="own-chip">In binder{n > 1 ? ` ×${n}` : ''}</span>
            if (a === 'busy') return <span className="own-chip own-chip--ghost">Adding…</span>
            if (a === 'error') return <button className="add-chip" onClick={() => quickAdd(card)}>Retry add</button>
            return (
              <button className="add-chip" onClick={() => quickAdd(card)} aria-label={`Add ${card.name} to binder`}>
                + I have this
              </button>
            )
          }}
          note={(card) => (typeof adding[card.id] === 'number' ? `Pocket ${(adding[card.id] % PER_PAGE) + 1}, page ${Math.floor(adding[card.id] / PER_PAGE) + 1}` : null)}
        />
      )}
    </main>
  )
}
