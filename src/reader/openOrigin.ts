/** Where the tapped cover was, so the reader can grow out of it. */
let origin: DOMRect | null = null
export const setOpenOrigin = (r: DOMRect | null) => { origin = r }
export const takeOpenOrigin = () => { const r = origin; origin = null; return r }
