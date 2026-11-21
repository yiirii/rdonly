import type { Transition } from 'framer-motion'
export const settle: Transition = { type: 'spring', stiffness: 420, damping: 26, mass: 0.8 }
export const sheet: Transition = { type: 'spring', stiffness: 380, damping: 36 }
export const TAG_COLOURS = { novel: '#c8a96a', manga: '#e06c75', webtoon: '#56b6c2', comic: '#e5c07b', document: '#8d8a84' } as const
export const TAG_LABELS = { novel: 'Novel', manga: 'Manga', webtoon: 'Webtoon', comic: 'Comic', document: 'Document' } as const
