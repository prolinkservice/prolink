'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MapPin, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function SearchBox() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get('q') ?? '')

  function submit() {
    const params = new URLSearchParams(searchParams)
    if (value.trim()) {
      params.set('q', value.trim())
    } else {
      params.delete('q')
    }
    router.push(`/?${params.toString()}`)
  }

  return (
    <div className="relative flex-1">
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        placeholder="搜尋地區或捷運站"
        className="pl-9 bg-white text-foreground"
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={submit}
        className="absolute right-0 top-0 h-full"
        aria-label="搜尋"
      >
        <Search className="w-4 h-4" />
      </Button>
    </div>
  )
}
