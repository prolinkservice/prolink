'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'

export function SubmitBookingButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      className="w-full h-13 text-base font-semibold rounded-xl shadow-md active:scale-[0.97] transition-transform duration-150"
      size="lg"
      type="submit"
      disabled={pending}
    >
      {pending ? '處理中...' : '確認預約'}
    </Button>
  )
}
