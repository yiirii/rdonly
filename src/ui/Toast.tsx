import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { settle } from './motion'

export function Toast({ message, tone, onDone }: { message: string | null; tone: 'ok' | 'warn'; onDone: () => void }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, 4200)
    return () => clearTimeout(t)
  }, [message, onDone])
  return (
    <div className="toast-host" role="status" aria-live="polite">
      <AnimatePresence>
        {message && (
          <motion.div key={message} className={`toast ${tone}`} onClick={onDone}
            initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} transition={settle}>
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
