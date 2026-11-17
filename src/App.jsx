import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import MoveWipe from './MoveWipe'
import Home from './Home'
import CardView from './CardView'
import BinderBook from './BinderBook'
import SetsView from './SetsView'
import SetView from './SetView'
import Playmat from './Playmat'
import Meadow from './Meadow'
import { FROAKIE, preloadAttackers, still } from './pokemon'
import { getCard, money } from './api'
import { useBinder } from './binder'
import { applyTheme, typeOf } from './types'

gsap.registerPlugin(ScrollTrigger)

const parse = (h) => {
  const [, page = '', a, b] = h.replace(/^#/, '').split('/')
  if (page === 'card' || page === 'set') return { page, lang: a, id: decodeURIComponent(b || '') }
  if (page === 'binder') return { page, slot: a ? Number(a) : null }
  if (page === 'sets') return { page }
  return { page: 'home' }
}
const ROUTE_TYPE = { home: 'Lightning', binder: 'Psychic', sets: 'Grass', set: 'Fire' }

export default function App() {
  const wipe = useRef(null)
  const lenis = useRef(null)
  const nextType = useRef(null)
  const [route, setRoute] = useState(() => parse(location.hash))
  const [search, setSearch] = useState({ q: '', lang: 'all', type: null, results: [], loading: false, error: null, ran: false })
  const [setsLang, setSetsLang] = useState('en')
  const items = useBinder()
  const total = items.reduce((s, i) => s + (i.price || 0) * i.qty, 0)

  // smooth scroll, driven by GSAP's ticker so ScrollTrigger stays in sync
  useEffect(() => {
    const l = new Lenis({ autoRaf: false, lerp: 0.11 })
    lenis.current = l
    l.on('scroll', ScrollTrigger.update)
    const tick = (t) => l.raf(t * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(tick)
      l.destroy()
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(preloadAttackers, 1200)
    return () => clearTimeout(t)
  }, [])

  // first paint: theme for the landing route (cards fetch their own type)
  useEffect(() => {
    const r = parse(location.hash)
    if (r.page === 'card') getCard(r.id, r.lang).then((c) => applyTheme(typeOf(c))).catch(() => applyTheme('Lightning'))
    else applyTheme(ROUTE_TYPE[r.page])
  }, [])

  useEffect(() => {
    const onHash = async () => {
      const r = parse(location.hash)
      let type = nextType.current
      nextType.current = null
      if (!type) {
        if (r.page === 'card') type = await getCard(r.id, r.lang).then(typeOf).catch(() => 'Colorless')
        else type = r.page === 'home' && search.type ? search.type : ROUTE_TYPE[r.page]
      }
      wipe.current.wipe(type, () => {
        setRoute(r)
        applyTheme(type)
        lenis.current?.scrollTo(0, { immediate: true })
      })
    }
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [search.type])

  const go = (hash, type) => {
    if (location.hash === hash || (!location.hash && hash === '#/')) return
    nextType.current = type || null
    location.hash = hash
  }

  const openCard = async (c) => {
    const full = await getCard(c.id, c.lang).catch(() => null)
    go(`#/card/${c.lang}/${encodeURIComponent(c.id)}`, typeOf(full))
  }

  const openSet = (id, lang = setsLang) => go(`#/set/${lang}/${encodeURIComponent(id)}`)
  const goBinder = (slot) => go(slot != null ? `#/binder/${slot}` : '#/binder')

  const retheme = (type, after) => wipe.current.wipe(type, () => (applyTheme(type), after()))

  return (
    <>
      <Playmat />
      <a href="#main" className="skip">Skip to content</a>
      <nav className="top">
        <a href="#/" className="mark" onClick={(e) => (e.preventDefault(), go('#/'))}>
          <img className="mark-mon" src={still(FROAKIE)} alt="" width="48" height="48" />
          Froakie's Playground
        </a>
        <div className="top-links">
          <a href="#/" aria-current={route.page === 'home' || route.page === 'card' ? 'page' : undefined} onClick={(e) => (e.preventDefault(), go('#/'))}>Search</a>
          <a href="#/sets" aria-current={route.page === 'sets' || route.page === 'set' ? 'page' : undefined} onClick={(e) => (e.preventDefault(), go('#/sets'))}>Sets</a>
          <a href="#/binder" aria-current={route.page === 'binder' ? 'page' : undefined} onClick={(e) => (e.preventDefault(), go('#/binder'))}>
            Binder <span className="top-total">{money(total)}</span>
          </a>
        </div>
      </nav>

      <div id="main">
        {route.page === 'home' && <Home search={search} setSearch={setSearch} openCard={openCard} retheme={retheme} goSets={() => go('#/sets')} />}
        {route.page === 'card' && <CardView id={route.id} lang={route.lang} back={() => history.back()} goBinder={goBinder} openSet={openSet} />}
        {route.page === 'sets' && <SetsView lang={setsLang} setLang={setSetsLang} openSet={(id) => openSet(id, setsLang)} />}
        {route.page === 'set' && <SetView id={route.id} lang={route.lang} openCard={openCard} back={() => go('#/sets')} />}
        {route.page === 'binder' && <BinderBook key={route.slot ?? 'b'} openCard={openCard} focusSlot={route.slot} />}
      </div>

      <Meadow />
      <footer className="foot">
        <p>Card data and prices from TCGdex, sourced from TCGplayer (USD) and Cardmarket (EUR). Your binder is saved in this browser only.</p>
        <p>Fan-made, personal project. Pokémon and card art © Nintendo, Creatures, Game Freak and The Pokémon Company; sprites and cries via PokeAPI. Not affiliated.</p>
      </footer>

      <MoveWipe ref={wipe} />
    </>
  )
}
