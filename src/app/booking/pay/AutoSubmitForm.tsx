'use client'

import { useEffect, useRef } from 'react'

export function AutoSubmitForm({ action, params }: { action: string; params: Record<string, string> }) {
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    formRef.current?.submit()
  }, [])

  return (
    <form ref={formRef} method="POST" action={action}>
      {Object.entries(params).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
    </form>
  )
}
