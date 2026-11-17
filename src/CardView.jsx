import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import HoloCard from './HoloCard'
import Glyph from './Glyph'
import { getCard, marketUsd, money, priceRows } from './api'
import { PER_PAGE, binder } from './binder'
import { CONDITIONS, entryFrom } from './PocketDrawer'
import { GLYPHS, typeOf } from './types'

export default function CardView({ id, lang, back, goBinder, openSet }) {
  const root = useRef(null)
  const [card, setCard] = useState(null)
  const [err, setErr] = useState(null)
  const [variant, setVariant] = useState(0)
  const [condition, setCondition] = useState(CONDITIONS[0])
  const [qty, setQty] = useState(1)
  const [filed, setFiled] = useState(null)

  useEffect(() => {
    setCard(null)
    setFiled(null)
    getCard(id, lang).then(setCard).catch((e) => setErr(e.message))
  }, [id, lang])

  const rows = card ? priceRows(card) : []
  const row = rows[variant]
  const headline = marketUsd(row)
  const type = typeOf(card)

  useGSAP(
    () => {
      if (!card) return
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.cv-art .holo', { rotationY: -80, y: 60, opacity: 0, duration: 1.2, ease: 'expo.out' })
        gsap.from('.cv-info > *', { y: 30, opacity: 0, duration: 0.7, ease: 'expo.out', stagger: 0.05, delay: 0.1 })
        const el = root.current.querySelector('.cv-value')
        if (headline && el) {
          const n = { v: 0 }
          gsap.to(n, { v: headline, duration: 1.2, ease: 'expo.out', delay: 0.2, onUpdate: () => (el.textContent = money(n.v)) })
        }
      })
    },
    { scope: root, dependencies: [card] },
  )

  const add = () => {
    const slot = binder.add(entryFrom(card, row, condition, qty))
    setFiled(slot)
    gsap.fromTo('.cv-add', { scale: 0.9 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.4)' })
  }

  if (err) return <main className="wrap"><p className="note">Couldn't load this card ({err}). <button className="linkish" onClick={back}>Back</button></p></main>
  if (!card) return <main className="wrap"><p className="note">Pulling the card…</p></main>

  return (
    <main ref={root} className="cv wrap">
      <button className="back" onClick={back}>← Back</button>
      <div className="cv-art">
        <HoloCard card={card} size="high" tilt={18} eager />
      </div>

      <div className="cv-info">
        <p className="cv-type">
          <Glyph d={GLYPHS[type]} size={22} />
          {card.types?.join(' / ') || card.category}
          {card.hp ? <> · {card.hp} HP</> : null}
          <span className={`lang-chip lang-chip--${card.lang}`}>{card.lang === 'ja' ? 'Japanese' : 'English'}</span>
        </p>
        <h1 className={card.lang === 'ja' ? 'jp' : ''}>{card.name}</h1>
        <p className="cv-meta">
          <button className="linkish" onClick={() => openSet(card.set.id, card.lang)}>{card.set?.name}</button>
          {' '}· #{card.localId}
          {card.set?.cardCount?.official ? `/${card.set.cardCount.official}` : ''}
          {card.rarity && card.rarity !== 'None' ? ` · ${card.rarity}` : ''}
          {card.illustrator ? ` · art by ${card.illustrator}` : ''}
        </p>

        <div className="cv-market">
          <span className="cv-value">{money(headline)}</span>
          <span className="cv-source">
            {row?.usd ? 'TCGplayer market, near mint' : row?.eur ? 'Cardmarket trend, converted from EUR' : 'No recent sales recorded for this printing'}
          </span>
        </div>

        {rows.length > 0 && (
          <table className="prices">
            <caption className="sr-only">Prices by printing</caption>
            <thead>
              <tr><th scope="col">Printing</th><th scope="col">TCGplayer</th><th scope="col">Low</th><th scope="col">Cardmarket</th><th scope="col">30-day</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} aria-selected={i === variant} onClick={() => setVariant(i)}>
                  <th scope="row">{r.label}</th>
                  <td>{money(r.usd)}</td>
                  <td>{money(r.usdLow)}</td>
                  <td>{money(r.eur, 'EUR')}</td>
                  <td>{money(r.eur30, 'EUR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="cv-add-row">
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
          <label className="qty">
            Copies
            <input type="number" min="1" max="999" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
          </label>
          <button className="cv-add chunky chunky--big" onClick={add}>Add to binder</button>
        </div>
        {filed != null ? (
          <p className="fine">
            Filed in pocket {(filed % PER_PAGE) + 1} on page {Math.floor(filed / PER_PAGE) + 1}.{' '}
            <button className="linkish" onClick={() => goBinder(filed)}>Open the binder</button>
          </p>
        ) : (
          <p className="fine">Binder values use near-mint market prices. Played copies usually sell for less.</p>
        )}
      </div>
    </main>
  )
}
