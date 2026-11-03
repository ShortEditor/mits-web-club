import { useEffect, useState } from 'react'
import { mediaUrl } from '../lib/api'

// Event poster shown before the title, with an accessible enlarged view on
// click. Local absolute paths (demo fixtures) render directly; Storage paths
// get a short-lived signed URL (private bucket).
export default function PosterImage({ path, alt, className }) {
  const local = path && path.startsWith('/')
  const [url, setUrl] = useState(local ? path : null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let live = true
    if (path && !path.startsWith('/')) {
      setUrl(null)
      mediaUrl(path).then((u) => { if (live) setUrl(u) })
    }
    return () => { live = false }
  }, [path])
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  if (!path || (!local && !url)) {
    return <div className={`poster-thumb poster-placeholder ${className || ''}`} aria-hidden="true"><span>Poster</span></div>
  }
  return (
    <>
      <button type="button" className={`poster-thumb ${className || ''}`} onClick={() => setOpen(true)} aria-label={`Enlarge poster: ${alt}`}>
        <img src={url} alt={alt} loading="lazy" />
      </button>
      {open && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Poster: ${alt}`} onClick={() => setOpen(false)}>
          <button type="button" className="lightbox-close" aria-label="Close enlarged poster" onClick={() => setOpen(false)}>×</button>
          <img src={url} alt={alt} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  )
}
