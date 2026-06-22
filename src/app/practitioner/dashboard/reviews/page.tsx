import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export default async function PractitionerReviewsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'practitioner' && profile?.role !== 'admin') redirect('/')

  const { data: practitioner } = await supabase
    .from('practitioners')
    .select('status, id')
    .eq('user_id', user.id)
    .single()

  if (!practitioner || practitioner.status !== 'approved') {
    redirect('/practitioner/pending')
  }

  const { data: reviews } = await supabase
    .from('reviews')
    .select('rating, comment, created_at, profiles ( display_name )')
    .eq('practitioner_id', practitioner.id)
    .order('created_at', { ascending: false })

  const reviewList = reviews ?? []
  const avgRating = reviewList.length
    ? reviewList.reduce((sum, r) => sum + r.rating, 0) / reviewList.length
    : 0

  const toTaipeiDateTime = (iso: string) => {
    const d = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/practitioner/dashboard">
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <span className="font-semibold text-lg">我的評價</span>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto flex flex-col gap-5">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
              <span className="text-3xl font-bold text-foreground">{avgRating.toFixed(1)}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              共 {reviewList.length} 則評價
            </div>
          </CardContent>
        </Card>

        {reviewList.length === 0 ? (
          <p className="text-muted-foreground text-base text-center py-8">尚無評價</p>
        ) : (
          <div className="flex flex-col gap-3">
            {reviewList.map((r, i) => {
              const revProfRaw = r.profiles as unknown
              const revProf = (Array.isArray(revProfRaw) ? revProfRaw[0] : revProfRaw) as { display_name: string | null } | null
              return (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-sm">{revProf?.display_name ?? '匿名學員'}</span>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <Star key={j} className={`w-4 h-4 ${j < r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
                        ))}
                      </div>
                    </div>
                    {r.comment && <p className="text-sm text-muted-foreground leading-relaxed">{r.comment}</p>}
                    <p className="text-xs text-muted-foreground mt-2">{toTaipeiDateTime(r.created_at)}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
