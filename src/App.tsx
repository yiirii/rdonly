import { AnimatePresence, MotionConfig } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { ReaderScreen } from './reader/ReaderScreen'
import { registerModes } from './reader/registry'
import { useRoute } from './state/route'
import { LibraryScreen } from './ui/LibraryScreen'

registerModes()

export function App() {
  const route = useRoute()
  const reading = route.name === 'reader'
  const main = useRef<HTMLElement>(null)
  // The library stays mounted under the reader (keeps scroll position) but can't be reached.
  useEffect(() => { main.current?.toggleAttribute('inert', reading) }, [reading])
  return (
    <MotionConfig reducedMotion="user">
      <main ref={main} className="app" aria-hidden={reading || undefined}>
        <LibraryScreen />
      </main>
      <AnimatePresence>{reading && <ReaderScreen key={route.bookId} bookId={route.bookId} />}</AnimatePresence>
    </MotionConfig>
  )
}
