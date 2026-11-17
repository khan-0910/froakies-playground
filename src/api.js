// Card data + prices come from TCGdex (free, no key): English and Japanese,
// with TCGplayer (USD) and Cardmarket (EUR) pricing per printing.
const BASE = 'https://api.tcgdex.net/v2'
const cache = new Map()

async function get(path) {
  if (cache.has(path)) return cache.get(path)
  // TCGdex sometimes drops a request under load: retry twice with a short backoff
  const once = () =>
    fetch(BASE + path).then((r) => {
      if (!r.ok) throw new Error(`TCGdex answered ${r.status}`)
      return r.json()
    })
  const wait = (ms) => new Promise((res) => setTimeout(res, ms))
  const p = once()
    .catch(() => wait(600).then(once))
    .catch(() => wait(1800).then(once))
  cache.set(path, p)
  p.catch(() => cache.delete(path))
  return p
}

const isJapanese = (s) => /[぀-ヿ一-龯]/.test(s)

export const imageUrl = (card, size = 'low') =>
  card?.image ? `${card.image}/${size}.webp` : null

// pokemontcg.io's image CDN uses near-identical set codes and fills many of
// TCGdex's English gaps (promos, e-Card, logos). It has no Japanese cards.
// shortcut: set-code mapping is a guess list (sv03.5→sv3pt5, sm3.5→sm35, sv01→sv1); add cases if a set still misses.
export const ptcgSets = (id) => [
  ...new Set([
    id.replace(/^(sv|swsh)0?(\d+)\.5$/, '$1$2pt5').replace(/^sm(\d+)\.5$/, 'sm$15').replace(/^sv0(\d)$/, 'sv$1'),
    id.replace('.', ''),
  ]),
  ...(/^20\d\d(sv|swsh|sm|xy|bw)$/.test(id) ? [`mcd${id.slice(2, 4)}`] : []), // McDonald's: 2021swsh → mcd21
]
const PTCG = 'https://images.pokemontcg.io'

/** Every URL worth trying for a card face, best first. Empty → draw a stand-in. */
// English: pokemontcg.io first (~0.3s) — TCGdex's image server takes 2-3s per file.
export function imageSources(card, size = 'low') {
  const out = []
  if (card?.lang === 'en' && card.id?.includes('-')) {
    const set = card.id.slice(0, card.id.lastIndexOf('-'))
    const num = /^\d+$/.test(card.localId) ? String(Number(card.localId)) : card.localId
    for (const s of ptcgSets(set)) out.push(`${PTCG}/${s}/${num}${size === 'high' ? '_hires' : ''}.png`)
  }
  if (card?.image) out.push(`${card.image}/${size}.webp`)
  return out
}

// pokemontcg.io first: it answers in ~0.3s where TCGdex logos often take seconds
// pokemontcg.io answers a missing file with a 404 that still carries a 640x892
// card-back picture, which browsers display instead of firing onError.
export const isPlaceholder = (img) => img.src.includes('images.pokemontcg.io') && img.naturalWidth === 640 && img.naturalHeight === 892

/** The card that stands for a set without a logo: its last ex/V/GX-style card, else a middle card. */
export function featureCard(cards = []) {
  const scanned = cards.filter((c) => c.image)
  const shown = scanned.length ? scanned : cards // no scans at all → CardFace draws the Pokémon stand-in
  const big = shown.filter((c) => /(\bex|EX|GX|VMAX|VSTAR|\bV|BREAK|LV\.X)$/.test(c.name))
  return big.at(-1) || shown[Math.floor(shown.length / 2)] || null
}

export const logoSources = (set, lang) => [
  ...(lang === 'en' ? ptcgSets(set.id).map((s) => `${PTCG}/${s}/logo.png`) : []),
  ...(set.logo ? [`${set.logo}.webp`] : []),
]

// "4/102", "#4", "base1-4" style input
function parseNumber(q) {
  const m = q.match(/^#?(\d{1,3})\s*\/\s*(\d{1,3})$/)
  return m ? { local: m[1], total: m[2] } : null
}

async function enSearch(q, type) {
  const params = new URLSearchParams({ 'pagination:itemsPerPage': '48' })
  if (q) params.set('name', q)
  if (type) params.set('types', `eq:${type}`)
  const list = await get(`/en/cards?${params}`)
  return list.map((c) => ({ ...c, lang: 'en' }))
}

async function jaByName(name, type) {
  const params = new URLSearchParams({ 'pagination:itemsPerPage': '48' })
  if (name) params.set('name', name)
  if (type) params.set('types', `eq:${type}`)
  const list = await get(`/ja/cards?${params}`)
  return list.map((c) => ({ ...c, lang: 'ja' }))
}

// English query → Japanese cards: find the Pokédex number from an English
// card, then ask the Japanese catalogue for that dex number.
async function jaFromEnglish(enList, type) {
  const probe = enList.find((c) => c.image) || enList[0]
  if (!probe) return []
  const full = await get(`/en/cards/${probe.id}`).catch(() => null)
  const dex = full?.dexId?.[0]
  if (!dex) return []
  const params = new URLSearchParams({ dexId: `eq:${dex}`, 'pagination:itemsPerPage': '48' })
  if (type) params.set('types', `eq:${type}`)
  const list = await get(`/ja/cards?${params}`)
  return list.map((c) => ({ ...c, lang: 'ja' }))
}

export async function searchCards(query, { lang = 'all', type = null } = {}) {
  const q = query.trim()
  const num = parseNumber(q)
  if (num) return searchByNumber(num, lang)
  if (!q && !type) return []

  if (isJapanese(q)) return lang === 'en' ? [] : jaByName(q, type)

  const en = await enSearch(q, type)
  if (lang === 'en') return withArtFirst(en)
  const ja = q ? await jaFromEnglish(en, type).catch(() => []) : await jaByName('', type)
  if (lang === 'ja') return withArtFirst(ja)
  return withArtFirst(interleave(en, ja))
}

// Cards the catalogue has scans for lead; text-only entries go last.
const withArtFirst = (list) => [...list.filter((c) => c.image), ...list.filter((c) => !c.image)]

async function searchByNumber({ local, total }, lang) {
  // Sets whose printed count matches, then the card at that slot.
  const langs = lang === 'all' ? ['en', 'ja'] : [lang]
  const out = []
  for (const l of langs) {
    const sets = await get(`/${l}/sets`)
    const hits = sets.filter((s) => String(s.cardCount?.official) === String(Number(total)))
    for (const s of hits.slice(0, 8)) {
      const set = await get(`/${l}/sets/${encodeURIComponent(s.id)}`).catch(() => null)
      const c = set?.cards?.find((c) => Number(c.localId) === Number(local))
      if (c) out.push({ ...c, lang: l, setName: set.name })
    }
  }
  return out
}

function interleave(a, b) {
  const out = []
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) out.push(a[i])
    if (b[i]) out.push(b[i])
  }
  return out
}

// ---------- sets ----------
/** Every series with its sets, newest first. */
export async function listSeries(lang) {
  const series = await get(`/${lang}/series`)
  const full = await Promise.all(series.map((s) => get(`/${lang}/series/${encodeURIComponent(s.id)}`).catch(() => null)))
  const out = full
    .filter((s) => s?.sets?.length && !/pocket/i.test(s.name) && s.id !== 'tcgp') // Pocket is the phone game, not printed cards
    .map((s) => ({ id: s.id, name: s.name, logo: s.logo, releaseDate: s.releaseDate, sets: [...s.sets].reverse() }))
    .reverse()
  // "Miscellaneous" reads better at the end than at the top
  return [...out.filter((s) => s.id !== 'misc'), ...out.filter((s) => s.id === 'misc')]
}

export const getSet = (id, lang) => get(`/${lang}/sets/${encodeURIComponent(id)}`)

export const getCard = (id, lang) => get(`/${lang}/cards/${encodeURIComponent(id)}`).then((c) => ({ ...c, lang }))

// ---------- prices ----------
const TCG_KEYS = {
  normal: 'Normal',
  holofoil: 'Holo',
  reverseHolofoil: 'Reverse holo',
  '1stEditionHolofoil': '1st Ed. holo',
  '1stEditionNormal': '1st Ed.',
  unlimitedHolofoil: 'Unlimited holo',
}

function variantLabel(v) {
  const bits = []
  if (v.stamp?.includes('1st-edition')) bits.push('1st Edition')
  if (v.subtype && v.subtype !== 'unlimited') bits.push(v.subtype.replace(/-/g, ' '))
  bits.push(v.type === 'holo' ? 'Holo' : v.type === 'reverse' ? 'Reverse holo' : v.type === 'normal' ? 'Normal' : v.type)
  return bits.join(' · ')
}

/** Flatten every printing's price into rows: { label, usd, usdLow, eur, eur30 } */
export function priceRows(card) {
  const rows = []
  const push = (label, pricing) => {
    if (!pricing) return
    const cm = pricing.cardmarket
    const tp = pricing.tcgplayer
    const tpEntries = tp ? Object.entries(tp).filter(([, v]) => v && typeof v === 'object') : []
    if (tpEntries.length) {
      for (const [k, v] of tpEntries) {
        rows.push({
          label: tpEntries.length > 1 ? `${label} · ${TCG_KEYS[k] || k}` : label,
          usd: v.marketPrice ?? v.midPrice ?? null,
          usdLow: v.lowPrice ?? null,
          eur: cm?.trend || cm?.avg || null,
          eur30: cm?.avg30 || null,
        })
      }
    } else if (cm) {
      rows.push({ label, usd: null, usdLow: null, eur: cm.trend || cm.avg || null, eur30: cm.avg30 || null })
    }
  }
  for (const v of card.variants_detailed || []) push(variantLabel(v), v.pricing)
  if (!rows.length && card.pricing) push('Standard', card.pricing)
  // collapse identical duplicates (TCGdex repeats shared listings)
  const seen = new Set()
  return rows.filter((r) => {
    const k = `${r.usd}|${r.eur}`
    if (seen.has(k)) return false
    seen.add(k)
    return r.usd || r.eur
  })
}

let eurUsd = 1.08
fetch('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD')
  .then((r) => r.json())
  .then((d) => d?.rates?.USD && (eurUsd = d.rates.USD))
  .catch(() => {})

/** Single headline market price in USD (TCGplayer market, else Cardmarket trend converted). */
export function marketUsd(row) {
  if (!row) return null
  if (row.usd) return row.usd
  if (row.eur) return row.eur * eurUsd
  return null
}

export const money = (n, cur = 'USD') =>
  n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: n >= 1000 ? 0 : 2 }).format(n)

// Chase cards for the opening hand (real IDs in TCGdex).
export const SHOWCASE = [
  { id: 'base1-4', lang: 'en' },
  { id: 'swsh7-215', lang: 'en' },
  { id: 'sv03.5-199', lang: 'en' },
  { id: 'SV2a-201', lang: 'ja' },
  { id: 'base1-58', lang: 'en' },
]
