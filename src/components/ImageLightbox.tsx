'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

export function ImageLightbox({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <img src={src} alt={alt} className={className} onClick={() => setOpen(true)} />
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setOpen(false)}
            aria-label="關閉"
          >
            <X className="w-7 h-7" />
          </button>
          <img src={src} alt={alt} className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  )
}
