'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBrowserSupabaseClient } from '@/lib/supabase'

export default function PractitionerLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

      if (profile?.role === 'practitioner') {
        const { data: prac } = await supabase.from('practitioners').select('status').eq('user_id', user.id).single()
        if (prac?.status === 'approved') router.push('/practitioner/dashboard')
        else router.push('/practitioner/pending')
      } else {
        router.push('/practitioner/register')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '登入失敗，請確認帳密是否正確')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <h1 className="text-xl font-bold">職人登入</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="password">密碼</Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button type="submit" size="lg" disabled={loading} className="mt-2 active:scale-95 transition-transform">
          {loading ? '登入中...' : '登入'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        還沒有帳號？
        <Link href="/practitioner/signup" className="text-primary font-medium ml-1">立即註冊</Link>
      </p>
    </div>
  )
}
