import { MotionConfig } from 'framer-motion'
import { LibraryScreen } from './ui/LibraryScreen'

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <main className="app">
        <LibraryScreen />
      </main>
    </MotionConfig>
  )
}
