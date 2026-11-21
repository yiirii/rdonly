import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

/** Whole-window drag-and-drop for the laptop. */
export function DropZone({ onFiles }: { onFiles: (f: File[]) => void }) {
  const [over, setOver] = useState(false)
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const enter = (e: DragEvent) => { if (hasFiles(e)) { depth++; setOver(true) } }
    const leave = () => { depth = Math.max(0, depth - 1); if (!depth) setOver(false) }
    const overH = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault() }
    const drop = (e: DragEvent) => {
      e.preventDefault(); depth = 0; setOver(false)
      const fs = Array.from(e.dataTransfer?.files ?? [])
      if (fs.length) onFiles(fs)
    }
    window.addEventListener('dragenter', enter); window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', overH); window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter); window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', overH); window.removeEventListener('drop', drop)
    }
  }, [onFiles])
  return (
    <AnimatePresence>
      {over && (
        <motion.div className="dropzone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="dropzone-card" initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
            Drop to add to your library
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
