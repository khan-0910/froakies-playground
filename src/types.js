// Every screen is drenched in one energy type. `field` owns the page,
// `deep` is its shadow side, `ink` is text on the field, `pop` the accent.
export const TYPES = {
  Fire:      { field: '#ff6a2b', deep: '#c22a12', ink: '#2a0b05', pop: '#ffd23f', flow: ['#ff6a2b', '#ffb22e', '#ff2e6e', '#b65cff'], move: 'Flamethrower' },
  Water:     { field: '#2c8cff', deep: '#0d3fae', ink: '#04163d', pop: '#9ff0ff', flow: ['#2c8cff', '#35d3ff', '#7a5cff', '#7dffc4'], move: 'Surf' },
  Grass:     { field: '#3ccf5a', deep: '#137a3a', ink: '#062612', pop: '#e4ff5c', flow: ['#3ccf5a', '#b5f04a', '#2fb8ff', '#ffe14d'], move: 'Razor Leaf' },
  Lightning: { field: '#ffcf1f', deep: '#e08a00', ink: '#2b1a00', pop: '#ffffff', flow: ['#ffcf1f', '#ff9f1c', '#ff6fa8', '#5fd4ff'], move: 'Thunderbolt' },
  Psychic:   { field: '#d34ee6', deep: '#7a1c9c', ink: '#24052e', pop: '#ffd1f7', flow: ['#d34ee6', '#ff7ac8', '#6a5cff', '#ffd36e'], move: 'Psybeam' },
  Fighting:  { field: '#d9783a', deep: '#8a3a14', ink: '#2a1004', pop: '#ffe0b8', flow: ['#d9783a', '#f2a65a', '#e0435a', '#ffd36e'], move: 'Rock Smash' },
  Darkness:  { field: '#2e2550', deep: '#140f28', ink: '#f4ecff', pop: '#ffcf1f', flow: ['#2e2550', '#55308a', '#13325a', '#8a3d8f'], move: 'Night Slash' },
  Metal:     { field: '#9fb3c6', deep: '#566b80', ink: '#101b26', pop: '#ffffff', flow: ['#9fb3c6', '#c9d6e3', '#7d8fe0', '#9ff0e0'], move: 'Flash Cannon' },
  Dragon:    { field: '#d7a928', deep: '#7c5a07', ink: '#251a00', pop: '#fff3c4', flow: ['#d7a928', '#f2cf5a', '#e0602a', '#5fbf8a'], move: 'Dragon Pulse' },
  Fairy:     { field: '#ff85c0', deep: '#c23c80', ink: '#33061c', pop: '#fff0f7', flow: ['#ff85c0', '#ffc2dd', '#a98bff', '#7fe0ff'], move: 'Moonblast' },
  Colorless: { field: '#efe2c6', deep: '#b9a57a', ink: '#2a2214', pop: '#ff6a2b', flow: ['#efe2c6', '#ffc58f', '#9fe0c4', '#ffa8bd'], move: 'Swift' },
}

export const TYPE_ORDER = ['Fire', 'Water', 'Grass', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Dragon', 'Fairy', 'Colorless']

export const typeOf = (card) => (card?.types?.[0] && TYPES[card.types[0]] ? card.types[0] : 'Colorless')

export function applyTheme(type) {
  const t = TYPES[type] || TYPES.Lightning
  const r = document.documentElement.style
  r.setProperty('--field', t.field)
  r.setProperty('--deep', t.deep)
  r.setProperty('--ink', t.ink)
  r.setProperty('--pop', t.pop)
  window.__type = TYPES[type] ? type : 'Lightning'
  window.dispatchEvent(new CustomEvent('theme', { detail: window.__type }))
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.field)
}

// Small authored energy glyphs, one stroke family.
export const GLYPHS = {
  Fire: 'M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z',
  Water: 'M12 2c3 5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7 6-12z',
  Grass: 'M5 19C5 9 11 4 20 4c0 9-5 15-15 15zm0 0 9-9',
  Lightning: 'M13 2 5 14h6l-1 8 8-12h-6z',
  Psychic: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
  Fighting: 'M6 10V7a2 2 0 0 1 4 0v3m0-1V6a2 2 0 0 1 4 0v4m0-1V7a2 2 0 0 1 4 0v6a6 6 0 0 1-12 0v-3a2 2 0 0 1 0-4',
  Darkness: 'M15 3a9 9 0 1 0 6 13A8 8 0 0 1 15 3z',
  Metal: 'M12 2 20 7v10l-8 5-8-5V7z',
  Dragon: 'M4 18 12 3l8 15-8-4z',
  Fairy: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
  Colorless: 'M12 4l2.4 5 5.6.8-4 3.9.9 5.5L12 16.6 7.1 19.2 8 13.7 4 9.8l5.6-.8z',
}
