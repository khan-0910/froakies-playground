import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import HoloCard from './HoloCard'
import CardGrid from './CardGrid'
import Glyph from './Glyph'
import PackRip from './PackRip'
import { FROAKIE, walker } from './pokemon'
import { SHOWCASE, getCard, searchCards } from './api'
import { GLYPHS, TYPES, TYPE_ORDER } from './types'

export default function Home({ search, setSearch, openCard, retheme, goSets }) {
  const root = useRef(null)
  const [hand, setHand] = useState([])
  const { q, lang, type, results, loading, error, ran } = search

  useEffect(() => {
    Promise.all(SHOWCASE.map((s) => getCard(s.id, s.lang).catch(() => null))).then((c) => setHand(c.filter(Boolean)))
  }, [])

  async function run(next = {}) {
    const s = { ...search, ...next }
    setSearch({ ...s, loading: true, error: null })
    try {
      const results = await searchCards(s.q, { lang: s.lang, type: s.type })
      setSearch({ ...s, results, loading: false, error: null, ran: true })
      requestAnimationFrame(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (e) {
      setSearch({ ...s, loading: false, error: e.message, ran: true })
    }
  }

  const pickType = (t) => {
    const next = type === t ? null : t
    retheme(next || 'Lightning', () => run({ type: next }))
  }

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.hero-line > span', { yPercent: 115, rotate: 4, duration: 1, ease: 'expo.out', stagger: 0.09 })
        gsap.from('.hero-tools > *', { y: 24, opacity: 0, duration: 0.8, ease: 'expo.out', stagger: 0.07, delay: 0.35 })
        gsap.from('.energy', { scale: 0, duration: 0.6, ease: 'back.out(2.4)', stagger: { each: 0.035, from: 'center' }, delay: 0.6 })
      })
    },
    { scope: root },
  )

  // the hand is dealt up from below, then breathes
  useGSAP(
    () => {
      if (!hand.length) return
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.fan-card', { yPercent: 80, rotation: 0, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08, delay: 0.3 })
        gsap.to('.fan-card', { y: -10, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: { each: 0.35, from: 'center' }, delay: 1.6 })
      })
    },
    { scope: root, dependencies: [hand.length] },
  )

  const mid = (hand.length - 1) / 2
  return (
    <main ref={root} className="home">
      <section className="hero">
        <h1>
          <span className="hero-line"><span>Every card since 1996.</span></span>
          <span className="hero-line hero-line--alt"><span>What's it worth today?</span></span>
        </h1>

        <div className="hero-tools">
          <form
            className="seek"
            onSubmit={(e) => {
              e.preventDefault()
              gsap.timeline().to('.seek-froakie', { y: -46, duration: 0.25, ease: 'power2.out' }).to('.seek-froakie', { y: 0, duration: 0.35, ease: 'bounce.out' })
              run()
            }}
          >
            <img className="seek-froakie" src={walker(FROAKIE)} alt="" draggable="false" />
            <label htmlFor="seek" className="sr-only">Card name, Japanese name, or number like 4/102</label>
            <input
              id="seek"
              value={q}
              onChange={(e) => setSearch({ ...search, q: e.target.value })}
              placeholder="Charizard, リザードン, 4/102…"
              autoComplete="off"
              spellCheck="false"
            />
            <button type="submit" disabled={loading}>{loading ? 'Searching' : 'Search'}</button>
          </form>

          <div className="lang" role="radiogroup" aria-label="Card language">
            {[
              ['all', 'EN + JP'],
              ['en', 'English'],
              ['ja', '日本語'],
            ].map(([v, l]) => (
              <button key={v} role="radio" aria-checked={lang === v} onClick={() => (ran ? run({ lang: v }) : setSearch({ ...search, lang: v }))}>
                {l}
              </button>
            ))}
          </div>

          <div className="energies" aria-label="Filter by type">
            {TYPE_ORDER.map((t) => (
              <button
                key={t}
                className="energy"
                aria-pressed={type === t}
                onClick={() => pickType(t)}
                style={{ '--e': TYPES[t].field, '--e-ink': TYPES[t].ink }}
                title={`${t} · ${TYPES[t].move}`}
              >
                <Glyph d={GLYPHS[t]} />
                <span>{t}</span>
              </button>
            ))}
          </div>

          <button className="linkish browse" onClick={goSets}>or browse every set →</button>
        </div>

        <div className="fan" aria-label="Chase cards">
          {hand.map((c, i) => (
            <div key={c.lang + c.id} className="fan-arm" style={{ '--r': `${(i - mid) * 11}deg`, zIndex: 10 - Math.abs(i - mid) }}>
              <HoloCard card={c} size="high" eager className="fan-card" onClick={() => openCard(c)} label={`${c.name}, open prices`} tilt={10} />
            </div>
          ))}
        </div>
      </section>

      <section id="results" className="results wrap" aria-live="polite">
        {error && <p className="note">Couldn't reach the card catalogue ({error}). Check your connection and search again.</p>}
        {ran && !loading && !error && !results.length && (
          <p className="note">Nothing matched “{q}”. Try the English name, the Japanese name, or the number printed bottom-left, like 4/102.</p>
        )}
        {results.length > 0 && (
          <>
            <h2 className="results-title">
              {results.length} {results.length === 1 ? 'printing' : 'printings'}
              {q ? <> of <em>{q}</em></> : null}
              {type ? <> · {type}</> : null}
            </h2>
            <CardGrid cards={results} openCard={openCard} />
          </>
        )}
      </section>
      <PackRip />
    </main>
  )
}
