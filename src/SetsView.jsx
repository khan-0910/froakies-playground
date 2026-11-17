import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { getSet, isPlaceholder, listSeries, logoSources, featureCard } from './api'
import { CardFace } from './HoloCard'
import { useBinder } from './binder'
import { TYPES, TYPE_ORDER } from './types'

const BLOBS = TYPE_ORDER.filter((t) => t !== 'Darkness' && t !== 'Colorless').map((t) => TYPES[t])

export default function SetsView({ lang, setLang, openSet }) {
  const root = useRef(null)
  const [series, setSeries] = useState(null)
  const [err, setErr] = useState(null)
  const items = useBinder()
  // unique cards owned per set, from card ids like "base1-4" / "SV2a-201"
  const ownedBySet = new Map()
  for (const id of new Set(items.filter((i) => i.lang === lang).map((i) => i.id))) {
    const sid = id.slice(0, id.lastIndexOf('-'))
    ownedBySet.set(sid, (ownedBySet.get(sid) || 0) + 1)
  }

  useEffect(() => {
    setSeries(null)
    setErr(null)
    listSeries(lang).then(setSeries).catch((e) => setErr(e.message))
  }, [lang])

  useGSAP(
    () => {
      if (!series) return
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.set-tile', { y: 40, opacity: 0, scale: 0.9, duration: 0.6, ease: 'expo.out', stagger: { each: 0.012, from: 'start' } })
      })
    },
    { scope: root, dependencies: [series] },
  )

  let n = 0
  return (
    <main ref={root} className="sets wrap">
      <header className="page-head">
        <h1>Every set, every card</h1>
        <p>Pick a set to see its full list with prices. Newest first.</p>
        <div className="lang" role="radiogroup" aria-label="Catalogue language">
          {[
            ['en', 'English sets'],
            ['ja', '日本のセット'],
          ].map(([v, l]) => (
            <button key={v} role="radio" aria-checked={lang === v} onClick={() => setLang(v)}>
              {l}
            </button>
          ))}
        </div>
      </header>

      {err && <p className="note">Couldn't load the set list ({err}). Check your connection and reload.</p>}
      {!series && !err && <p className="note">Opening the archive…</p>}

      {series?.map((s) => (
        <section key={s.id} className="series">
          <h2 className={lang === 'ja' ? 'jp' : ''}>{s.name}</h2>
          <ul className="set-row">
            {s.sets.map((set) => {
              const c = BLOBS[n++ % BLOBS.length]
              return (
                <li key={set.id}>
                  <button className="set-tile" onClick={() => openSet(set.id)} style={{ '--b1': c.field, '--b2': c.pop }}>
                    <span className="set-blob">
                      {ownedBySet.get(set.id) ? (
                        <span className="set-have" data-full={ownedBySet.get(set.id) >= (set.cardCount?.total || Infinity)}>
                          {ownedBySet.get(set.id)}/{set.cardCount?.total ?? '?'}
                        </span>
                      ) : null}
                      <SetLogo set={set} lang={lang} />
                    </span>
                    <b className={lang === 'ja' ? 'jp' : ''}>{set.name}</b>
                    <small>
                      {set.cardCount?.total ?? '?'} cards · {set.id}
                    </small>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </main>
  )
}

// Set logo (pokemontcg.io, then TCGdex). No logo anywhere → the set's featured
// card, small and tilted inside the bubble. The name badge shows until either lands.
export function SetLogo({ set, lang }) {
  const srcs = logoSources(set, lang)
  const [i, setI] = useState(0)
  const [ok, setOk] = useState(false)
  const noLogo = i >= srcs.length
  return (
    <>
      <span className="set-word" data-hidden={ok}>
        <b className={lang === 'ja' ? 'jp' : ''}>{set.name}</b>
        <small>{set.id}</small>
      </span>
      {noLogo ? (
        <SetFeature set={set} lang={lang} onReady={() => setOk(true)} />
      ) : (
        <img
          className="set-img"
          data-ok={ok}
          src={srcs[i]}
          alt=""
          loading="lazy"
          onLoad={(e) => (isPlaceholder(e.currentTarget) ? setI(i + 1) : setOk(true))}
          onError={() => setI(i + 1)}
        />
      )}
    </>
  )
}

function SetFeature({ set, lang, onReady }) {
  const ref = useRef(null)
  const [card, setCard] = useState(null)
  useEffect(() => {
    // only fetch the set's card list once its bubble scrolls near view
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      getSet(set.id, lang).then((full) => setCard(featureCard(full.cards))).catch(() => {})
    }, { rootMargin: '300px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [set.id, lang])
  return (
    <span ref={ref} className="set-feature" data-ready={!!card}>
      {card && <CardFace card={{ ...card, lang }} onReady={onReady} />}
    </span>
  )
}
