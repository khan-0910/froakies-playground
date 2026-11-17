import { useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { getCard, getSet, imageSources, marketUsd, money, priceRows } from './api'
import { binder } from './binder'
import { entryFrom } from './PocketDrawer'
import { GLYPHS, TYPES } from './types'
import { FROAKIE, still } from './pokemon'

// "Rip a pack": choose a booster, tear it open, flip the cards one by one.
// The pulls are real cards from that set with today's prices; the most
// valuable of the batch is always saved for last.
const PACKS = [
  { id: 'base1', lang: 'en', name: 'Base Set', foil: TYPES.Fire },
  { id: 'neo1', lang: 'en', name: 'Neo Genesis', foil: TYPES.Grass },
  { id: 'swsh7', lang: 'en', name: 'Evolving Skies', foil: TYPES.Water },
  { id: 'sv03.5', lang: 'en', name: '151', foil: TYPES.Psychic },
  { id: 'SV2a', lang: 'ja', name: 'ポケモンカード151', foil: TYPES.Lightning },
]
const PULLS = 5

async function pull(pack) {
  const set = await getSet(pack.id, pack.lang)
  const pool = (set.cards || []).filter((c) => c.image)
  const picks = gsap.utils.shuffle([...pool]).slice(0, 9)
  const full = await Promise.all(picks.map((c) => getCard(c.id, pack.lang).catch(() => null)))
  const priced = full.filter(Boolean).map((c) => ({ card: c, row: priceRows(c)[0] })).map((p) => ({ ...p, usd: marketUsd(p.row) || 0 }))
  priced.sort((a, b) => a.usd - b.usd)
  const hit = priced.pop()
  return [...gsap.utils.shuffle(priced).slice(0, PULLS - 1), hit]
}

export default function PackRip() {
  const root = useRef(null)
  const [phase, setPhase] = useState('choose') // choose | ready | open | done
  const [pack, setPack] = useState(null)
  const [cards, setCards] = useState([])
  const [shown, setShown] = useState(0)
  const [err, setErr] = useState(null)
  const [saved, setSaved] = useState(false)
  const pending = useRef(null)

  useGSAP(
    () => {
      gsap.from('.pack-choice', {
        y: 60, rotate: () => gsap.utils.random(-14, 14), opacity: 0, duration: 0.8, ease: 'back.out(1.6)', stagger: 0.07,
        scrollTrigger: { trigger: root.current, start: 'top 75%' },
      })
    },
    { scope: root },
  )

  function choose(p, e) {
    setErr(null)
    setSaved(false)
    pending.current = pull(p)
    const others = [...root.current.querySelectorAll('.pack-choice')].filter((b) => b !== e.currentTarget)
    gsap.to(others, { y: 80, opacity: 0, duration: 0.35, ease: 'power2.in', stagger: 0.04 })
    gsap.to(e.currentTarget, { scale: 1.15, rotate: 0, duration: 0.35, ease: 'power2.out', onComplete: () => (setPack(p), setPhase('ready')) })
  }

  async function tear() {
    const p = root.current
    const top = p.querySelector('.pack-top')
    const body = p.querySelector('.stage-pack')
    gsap.timeline()
      .to(body, { x: -6, duration: 0.05, repeat: 5, yoyo: true })
      .to(top, { y: -90, x: 60, rotate: 28, opacity: 0, duration: 0.5, ease: 'power2.out' })
      .to(body, { y: 160, opacity: 0, duration: 0.5, ease: 'power2.in' }, '<0.15')
    try {
      const got = await pending.current
      got.forEach((g) => (new Image().src = imageSources(g.card, 'high')[0]))
      setCards(got)
      setShown(0)
      setPhase('open')
    } catch (e) {
      setErr(`Couldn't open that pack (${e.message}).`)
      setPhase('choose')
    }
  }

  function flip() {
    if (shown >= cards.length) return
    const el = root.current.querySelector('.deck .pull:last-child')
    const isHit = shown === cards.length - 1
    gsap.timeline({ onComplete: () => setShown((n) => n + 1) })
      .to(el, { y: -30, duration: 0.15, ease: 'power2.out' })
      .to(el, { rotationY: 180, duration: 0.45, ease: 'power2.inOut' })
      .to(el, { scale: isHit ? 1.12 : 1, duration: 0.2 }, '<0.2')
    if (isHit) gsap.fromTo(root.current.querySelectorAll('.spark'), { scale: 0, opacity: 1 }, { scale: 1.6, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.03, delay: 0.4 })
  }

  function again() {
    setPhase('choose')
    setPack(null)
    setCards([])
    setShown(0)
  }

  function saveAll() {
    for (const { card, row } of cards) binder.add(entryFrom(card, row, 'Near Mint', 1))
    setSaved(true)
  }

  const total = cards.slice(0, shown).reduce((a, c) => a + c.usd, 0)
  const revealed = cards.slice(0, shown)
  const deck = cards.slice(shown).reverse() // next card on top (last child)

  return (
    <section ref={root} className="rip wrap" aria-labelledby="rip-h">
      <h2 id="rip-h">Rip a pack</h2>
      <p className="rip-lede">Real cards from real sets, priced right now. The best pull always comes last.</p>
      {err && <p className="rip-lede">{err}</p>}

      {phase === 'choose' && (
        <div className="pack-row">
          {PACKS.map((p, i) => (
            <button key={p.id} className="pack-choice" onClick={(e) => choose(p, e)} style={{ rotate: `${(i - 2) * 4}deg` }}>
              <Pack p={p} />
            </button>
          ))}
        </div>
      )}

      {phase === 'ready' && pack && (
        <div className="rip-stage">
          <button className="stage-pack" onClick={tear} aria-label={`Tear open the ${pack.name} pack`}>
            <Pack p={pack} big />
          </button>
          <p className="rip-hint">Tap the pack to tear it open</p>
        </div>
      )}

      {(phase === 'open' || phase === 'done') && (
        <div className="rip-open">
          <div className="pulled">
            {revealed.map(({ card, usd }, i) => (
              <div key={card.id} className={`pulled-card ${i === cards.length - 1 ? 'is-hit' : ''}`}>
                <img src={imageSources(card, 'high')[0]} alt={card.name} />
                <b>{usd ? money(usd) : 'no sales yet'}</b>
              </div>
            ))}
          </div>

          {deck.length > 0 ? (
            <button className="deck" onClick={flip} aria-label={`Flip the next card, ${deck.length} left`}>
              {deck.map(({ card }, i) => (
                <span key={card.id} className="pull" style={{ '--i': deck.length - 1 - i }}>
                  <span className="pull-back"><CardBack /></span>
                  <span className="pull-front"><img src={imageSources(card, 'high')[0]} alt="" /></span>
                </span>
              ))}
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className="spark" style={{ '--a': `${i * 45}deg` }} aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d={GLYPHS.Fairy} /></svg>
                </span>
              ))}
              <span className="deck-left">{deck.length} left · tap to flip</span>
            </button>
          ) : (
            <div className="rip-total">
              <p>This pack pulled <b>{money(total)}</b></p>
              <div className="rip-actions">
                <button className="chunky chunky--big" onClick={saveAll} disabled={saved}>{saved ? 'All 5 are in your binder' : 'Put all 5 in my binder'}</button>
                <button className="chunky chunky--alt" onClick={again}>Rip another</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function Pack({ p, big }) {
  return (
    <span className={`pack ${big ? 'pack--big' : ''}`} style={{ '--f1': p.foil.field, '--f2': p.foil.pop, '--f3': p.foil.deep }}>
      <span className="pack-top" />
      <span className="pack-face">
        {p.lang === 'en' ? (
          <img src={`https://assets.tcgdex.net/en/${p.id === 'base1' ? 'base' : p.id === 'neo1' ? 'neo' : p.id.startsWith('swsh') ? 'swsh' : 'sv'}/${p.id}/logo.webp`} alt="" />
        ) : (
          <span className="pack-word jp">{p.name}</span>
        )}
        <span className="pack-name">{p.lang === 'ja' ? 'Japanese booster' : `${p.name} booster`}</span>
      </span>
      <span className="pack-bottom" />
    </span>
  )
}

export function CardBack() {
  return (
    <span className="card-back">
      <img src={still(FROAKIE)} alt="" />
      <span>Froakie's Playground</span>
    </span>
  )
}

