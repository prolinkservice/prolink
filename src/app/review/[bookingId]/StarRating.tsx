'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'

export default function StarRating() {
  const [rating, setRating] = useState(5)

  return (
    <div className="flex justify-center gap-2">
      <input type="hidden" name="rating" value={rating} />
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => setRating(n)}
          className="active:scale-90 transition-transform"
        >
          <Star
            className={`w-9 h-9 transition-colors ${
              n <= rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'
            }`}
          />
        </button>
      ))}
    </div>
  )
}
