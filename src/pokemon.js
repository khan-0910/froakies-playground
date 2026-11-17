// Pokémon sprites, artwork and cries come from PokeAPI's public asset repos.
// Pokémon are © Nintendo / Creatures / Game Freak; this is a personal fan project.
const RAW = 'https://raw.githubusercontent.com/PokeAPI'
export const art = (id) => `${RAW}/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
export const walker = (id) => `${RAW}/sprites/master/sprites/pokemon/other/showdown/${id}.gif`
export const still = (id) => `${RAW}/sprites/master/sprites/pokemon/${id}.png`
export const cry = (id) => `${RAW}/cries/main/cries/pokemon/latest/${id}.ogg`

export const FROAKIE = 656

// Who shows up on each type's pages: [dex number, name]
export const ROSTER = {
  Fire: [[4, 'Charmander'], [155, 'Cyndaquil'], [909, 'Fuecoco'], [6, 'Charizard']],
  Water: [[7, 'Squirtle'], [54, 'Psyduck'], [657, 'Frogadier'], [658, 'Greninja']],
  Grass: [[252, 'Treecko'], [1, 'Bulbasaur'], [906, 'Sprigatito'], [254, 'Sceptile']],
  Lightning: [[25, 'Pikachu'], [172, 'Pichu'], [921, 'Pawmi'], [135, 'Jolteon']],
  Psychic: [[63, 'Abra'], [151, 'Mew'], [196, 'Espeon'], [150, 'Mewtwo']],
  Fighting: [[447, 'Riolu'], [66, 'Machop'], [448, 'Lucario']],
  Darkness: [[570, 'Zorua'], [215, 'Sneasel'], [197, 'Umbreon']],
  Metal: [[81, 'Magnemite'], [304, 'Aron'], [957, 'Tinkatink']],
  Dragon: [[147, 'Dratini'], [443, 'Gible'], [149, 'Dragonite']],
  Fairy: [[35, 'Clefairy'], [926, 'Fidough'], [700, 'Sylveon']],
  Colorless: [[133, 'Eevee'], [39, 'Jigglypuff'], [143, 'Snorlax']],
}

// The Pokémon that performs each type's page transition
export const ATTACKER = {
  Fire: 6, // Charizard: Flamethrower
  Water: 658, // Greninja: Water Shuriken
  Grass: 254, // Sceptile: Leaf Blade / Razor Leaf
  Lightning: 25, // Pikachu: Thunderbolt
  Psychic: [150, 196, 65, 151], // any Psychic Pokémon: Psybeam
  Fighting: 448,
  Darkness: 197,
  Metal: 376,
  Dragon: 149,
  Fairy: 700,
  Colorless: 143,
}

export const attackerFor = (type) => {
  const a = ATTACKER[type] ?? 133
  return Array.isArray(a) ? a[Math.floor(Math.random() * a.length)] : a
}

// warm the browser cache so attacks never pop in late
export function preloadAttackers() {
  const ids = new Set(Object.values(ATTACKER).flat())
  for (const id of ids) {
    const i = new Image()
    i.src = art(id)
  }
}
