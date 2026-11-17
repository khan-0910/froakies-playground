import { useSyncExternalStore } from 'react'

// The binder lives in this browser (localStorage). Every entry sits in one
// pocket (`slot`, 9 per page). Each entry snapshots its near-mint market price.
const KEY = 'holo-ledger:binder:v1'
const NAME_KEY = 'holo-ledger:binder-name'
export const PER_PAGE = 9

let items = load()
let name = loadName()
const subs = new Set()

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY)) || []
    // older entries had no pocket: file them in order
    let next = 0
    const used = new Set(raw.filter((i) => Number.isInteger(i.slot)).map((i) => i.slot))
    return raw.map((i) => {
      if (Number.isInteger(i.slot)) return i
      while (used.has(next)) next++
      used.add(next)
      return { ...i, slot: next }
    })
  } catch {
    return []
  }
}
function loadName() {
  try {
    return localStorage.getItem(NAME_KEY) || 'My binder'
  } catch {
    return 'My binder'
  }
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
    localStorage.setItem(NAME_KEY, name)
  } catch {
    /* storage blocked: binder stays in memory for this visit */
  }
  snapshot = { items, name }
  subs.forEach((f) => f())
}
let snapshot = { items, name }

const keyOf = (e) => `${e.lang}:${e.id}:${e.variant}:${e.condition}`
export const firstFree = (list = items) => {
  const used = new Set(list.map((i) => i.slot))
  let s = 0
  while (used.has(s)) s++
  return s
}

export const binder = {
  /** Add from a card page: same printing+condition stacks, else first empty pocket. */
  add(entry) {
    const key = keyOf(entry)
    const found = items.find((i) => i.key === key)
    if (found) {
      items = items.map((i) => (i.key === key ? { ...i, qty: i.qty + entry.qty, price: entry.price } : i))
      save()
      return found.slot
    }
    const slot = firstFree()
    items = [...items, { ...entry, key, slot, added: Date.now() }]
    save()
    return slot
  },
  /** Put a card into a specific pocket (replaces whatever was there). */
  place(slot, entry) {
    items = [...items.filter((i) => i.slot !== slot), { ...entry, key: keyOf(entry), slot, added: Date.now() }]
    save()
  },
  /** Drag-and-drop: move a card to another pocket, swapping if it's taken. */
  move(from, to) {
    if (from === to) return
    items = items.map((i) => (i.slot === from ? { ...i, slot: to } : i.slot === to ? { ...i, slot: from } : i))
    save()
  },
  remove(slot) {
    items = items.filter((i) => i.slot !== slot)
    save()
  },
  setQty(slot, qty) {
    if (qty <= 0) return binder.remove(slot)
    items = items.map((i) => (i.slot === slot ? { ...i, qty } : i))
    save()
  },
  setPrice(slot, price) {
    items = items.map((i) => (i.slot === slot ? { ...i, price, priced: Date.now() } : i))
    save()
  },
  rename(n) {
    name = n.slice(0, 40) || 'My binder'
    save()
  },
}

export function useBinder() {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => snapshot,
  ).items
}
export function useBinderName() {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => snapshot,
  ).name
}
