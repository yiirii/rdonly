/** A flat, dark tint taken from a cover's average colour (for the Continue card). */
export async function coverTint(dataUrl: string | undefined): Promise<{ bg: string; deep: string; accent: string; shape: string }> {
  const fallback = { bg: '#22324a', deep: '#1a2638', accent: '#9fb4e6', shape: '#2b3d59' }
  if (!dataUrl) return fallback
  try {
    const img = new Image(); img.src = dataUrl; await img.decode()
    const c = document.createElement('canvas'); c.width = 12; c.height = 18
    const g = c.getContext('2d')!; g.drawImage(img, 0, 0, 12, 18)
    const d = g.getImageData(0, 0, 12, 18).data
    let r = 0, gr = 0, b = 0
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gr += d[i + 1]; b += d[i + 2] }
    const n = d.length / 4
    const [h, s] = rgbToHsl(r / n, gr / n, b / n)
    const sat = Math.min(s, 0.42)
    return { bg: hsl(h, sat, 0.2), deep: hsl(h, sat, 0.14), accent: hsl(h, Math.min(0.7, sat + 0.2), 0.74), shape: hsl(h, sat, 0.26) }
  } catch { return fallback }
}
const hsl = (h: number, s: number, l: number) => `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
  if (max === min) return [220, 0.15, l]
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}
