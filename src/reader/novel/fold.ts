/** "Fold" page turn: a flat sheet in the page colour, with a hard crease edge, sweeps over the page and away. Transform-only. */
export function createFold(container: () => HTMLElement | null, colours: () => { bg: string; crease: string; edge: string }, reduceMotion: () => boolean) {
  let token = 0
  let current: HTMLElement | null = null
  return async function fold(dir: 1 | -1, turn: () => Promise<unknown> | unknown) {
    const box = container()
    current?.remove(); current = null
    if (!box) { await turn(); return }
    const my = ++token
    const c = colours()
    const sheet = document.createElement('div')
    sheet.className = 'fold-overlay'
    sheet.dataset.testid = 'fold-overlay'
    sheet.style.background = c.bg
    // the crease sits on the leading edge of the sheet
    const crease = document.createElement('div')
    crease.className = 'fold-crease'
    crease.style.background = c.crease
    crease.style.boxShadow = `inset ${dir > 0 ? 1 : -1}px 0 0 ${c.edge}`
    crease.style[dir > 0 ? 'left' : 'right'] = '0'
    sheet.append(crease)
    box.append(sheet)
    current = sheet
    const reduce = reduceMotion()
    try {
      const cover = reduce
        ? sheet.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, fill: 'forwards' })
        : sheet.animate([{ transform: `translateX(${dir * 100}%)` }, { transform: 'translateX(0)' }], { duration: 190, easing: 'cubic-bezier(.45,0,.75,.4)', fill: 'forwards' })
      await cover.finished.catch(() => {})
      await turn()
      if (my !== token) return
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      if (my !== token) return
      const away = reduce
        ? sheet.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' })
        : sheet.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-dir * 100}%)` }], { duration: 230, easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'forwards' })
      await away.finished.catch(() => {})
    } finally {
      sheet.remove()
      if (current === sheet) current = null
    }
  }
}
