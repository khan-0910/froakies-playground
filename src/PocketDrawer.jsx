import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import HoloCard from './HoloCard'
import { getCard, marketUsd, money, priceRows, searchCards } from './api'
import { PER_PAGE, binder } from './binder'
import { typeOf } from './types'

export const CONDITIONS = ['Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged']

export function entryFrom(card, row, condition, qty) {
  return {
    id: card.id,
    lang: card.lang,
    name: card.name,
    image: card.image || null,
    set: card.set?.name,
    localId: card.localId,
    type: typeOf(card),
    variant: row?.label || 'Standard',
    condition,
    qty,
    price: marketUsd(row),
    priced: Date.now(),
  }
}

// Side drawer for one pocket: file a new card into it, or manage the card in it.
export default function PocketDrawer({ slot, item, onClose, onPlaced, openCard }) {
  const root = useRef(null)
  const where = `Pocket ${(slot % PER_PAGE) + 1} · page ${Math.floor(slot / PER_PAGE) + 1}`

  useGSAP(
    () => {
      gsap.from('.drawer-veil', { opacity: 0, duration: 0.3 })
      gsap.from('.drawer', { xPercent: 100, duration: 0.55, ease: 'expo.out' })
    },
    { scope: root },
  )

  const close = () => {
    gsap.to(root.current.querySelector('.drawer'), { xPercent: 100, duration: 0.3, ease: 'power2.in' })
    gsap.to(root.current.querySelector('.drawer-veil'), { opacity: 0, duration: 0.3, onComplete: onClose })
  }

  useEffect(() => {
    const k = (e) => e.key === 'Escape' && close()
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  })

  return (
    <div ref={root} className="drawer-root">
      <div className="drawer-veil" onClick={close} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={where} data-lenis-prevent>
        <header className="drawer-head">
          <p>{where}</p>
          <button className="drawer-x" onClick={close} aria-label="Close">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>
        {item ? (
          <Manage item={item} slot={slot} close={close} openCard={openCard} />
        ) : (
          <AddFlow slot={slot} close={close} onPlaced={onPlaced} />
        )}
      </aside>
    </div>
  )
}

function Manage({ item, slot, close, openCard }) {
  return (
    <div className="drawer-body manage">
      <HoloCard card={{ ...item, types: [item.type] }} size="high" tilt={12} eager />
      <h2 className={item.lang === 'ja' ? 'jp' : ''}>{item.name}</h2>
      <p className="drawer-meta">{item.set} · #{item.localId} · {item.variant} · {item.condition}</p>
      <p className="drawer-value">
        {money(item.price ? item.price * item.qty : null)}
        <small>{item.price ? `${money(item.price)} each, near-mint market` : 'No recent sales recorded'}</small>
      </p>
      <div className="drawer-row">
        <div className="stepper" aria-label={`${item.qty} copies`}>
          <button onClick={() => binder.setQty(slot, item.qty - 1)} aria-label="One fewer">−</button>
          <span>{item.qty}</span>
          <button onClick={() => binder.setQty(slot, item.qty + 1)} aria-label="One more">+</button>
        </div>
        <button className="chunky" onClick={() => (close(), openCard(item))}>All prices</button>
      </div>
      <button className="linkish danger" onClick={() => (binder.remove(slot), close())}>Take it out of the binder</button>
    </div>
  )
}

function AddFlow({ slot, close, onPlaced }) {
  const [q, setQ] = useState('')
  const [lang, setLang] = useState('all')
  const [results, setResults] = useState([])
  const [state, setState] = useState('idle')
  const [pick, setPick] = useState(null)
  const input = useRef(null)
  const seq = useRef(0)

  useEffect(() => input.current?.focus(), [])
  useEffect(() => {
    if (q.trim().length < 2) return setResults([])
    const n = ++seq.current
    setState('loading')
    const t = setTimeout(() => {
      searchCards(q, { lang })
        .then((r) => n === seq.current && (setResults(r.slice(0, 36)), setState('idle')))
        .catch(() => n === seq.current && setState('error'))
    }, 380)
    return () => clearTimeout(t)
  }, [q, lang])

  if (pick) return <Confirm card={pick} back={() => setPick(null)} slot={slot} close={close} onPlaced={onPlaced} />

  return (
    <div className="drawer-body">
      <h2>What's going in?</h2>
      <label className="seek seek--small">
        <span className="sr-only">Card name, Japanese name, or number</span>
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, リザードン, or 4/102" autoComplete="off" />
      </label>
      <div className="lang lang--small" role="radiogroup" aria-label="Language">
        {[
          ['all', 'EN + JP'],
          ['en', 'English'],
          ['ja', '日本語'],
        ].map(([v, l]) => (
          <button key={v} role="radio" aria-checked={lang === v} onClick={() => setLang(v)}>
            {l}
          </button>
        ))}
      </div>
      {state === 'loading' && <p className="drawer-note">Searching…</p>}
      {state === 'error' && <p className="drawer-note">The card catalogue didn't answer. Try again in a moment.</p>}
      {state === 'idle' && q.trim().length >= 2 && !results.length && <p className="drawer-note">No match. Try the number printed bottom-left, like 4/102.</p>}
      <ol className="pick-grid">
        {results.map((c) => (
          <li key={c.lang + c.id}>
            <HoloCard card={c} tilt={0} onClick={() => setPick(c)} label={`${c.name} ${c.lang === 'ja' ? 'Japanese' : 'English'} #${c.localId}`} />
            <small className={c.lang === 'ja' ? 'jp' : ''}>
              {c.lang === 'ja' ? 'JP' : 'EN'} · #{c.localId}
            </small>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Confirm({ card, back, slot, close, onPlaced }) {
  const [full, setFull] = useState(null)
  const [variant, setVariant] = useState(0)
  const [condition, setCondition] = useState(CONDITIONS[0])
  const [qty, setQty] = useState(1)

  useEffect(() => {
    getCard(card.id, card.lang).then(setFull).catch(() => setFull({ ...card, failed: true }))
  }, [card])

  const rows = full ? priceRows(full) : []
  const row = rows[variant]

  const put = () => {
    onPlaced(slot)
    binder.place(slot, entryFrom(full, row, condition, qty))
    close()
  }

  return (
    <div className="drawer-body">
      <button className="back" onClick={back}>← Different card</button>
      <HoloCard card={card} size="high" tilt={12} eager />
      <h2 className={card.lang === 'ja' ? 'jp' : ''}>{card.name}</h2>
      {!full ? (
        <p className="drawer-note">Pulling prices…</p>
      ) : (
        <>
          <p className="drawer-meta">{full.set?.name} · #{full.localId}</p>
          <p className="drawer-value">
            {money(marketUsd(row))}
            <small>{row ? 'Near-mint market' : 'No recent sales recorded'}</small>
          </p>
          <div className="drawer-form">
            {rows.length > 1 && (
              <label>
                Printing
                <select value={variant} onChange={(e) => setVariant(Number(e.target.value))}>
                  {rows.map((r, i) => <option key={i} value={i}>{r.label}</option>)}
                </select>
              </label>
            )}
            <label>
              Condition
              <select value={condition} onChange={(e) => setCondition(e.target.value)}>
                {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>
              Copies
              <input type="number" min="1" max="999" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
            </label>
          </div>
          <button className="chunky chunky--big" onClick={put}>Slide it into the pocket</button>
        </>
      )}
    </div>
  )
}
