import { MapPin, Clock, ChevronLeft, Star, AtSign, Share2, Link2, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { signInWithGoogle } from '@/app/auth/actions'

const SERVICE_MODE_LABEL: Record<string, string[]> = {
  at_shop: ['到店'],
  on_site: ['到府'],
  both: ['到店', '到府'],
}

export default async function PractitionerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: practitioner } = await supabase
    .from('practitioners')
    .select(`
      id,
      bio,
      service_mode,
      shop_address,
      status,
      profiles ( display_name, avatar_url ),
      services ( id, name, description, duration_minutes, price ),
      availability_slots ( id, start_time, end_time, is_booked ),
      social_links
    `)
    .eq('id', id)
    .eq('status', 'approved')
    .single()

  if (!practitioner) notFound()

  const { data: reviews } = await supabase
    .from('reviews')
    .select('rating, comment, created_at, profiles ( display_name )')
    .eq('practitioner_id', id)
    .order('created_at', { ascending: false })

  const reviewList = reviews ?? []
  const avgRating = reviewList.length
    ? reviewList.reduce((sum, r) => sum + r.rating, 0) / reviewList.length
    : 0

  const profileRaw = practitioner.profiles as unknown
  const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { display_name: string | null; avatar_url: string | null } | null
  const name = profile?.display_name ?? '老師'
  const avatar = profile?.avatar_url ?? ''
  const serviceMode = SERVICE_MODE_LABEL[practitioner.service_mode] ?? []

  const slots = (practitioner.availability_slots as { id: string; start_time: string; end_time: string; is_booked: boolean }[])
    .filter(s => new Date(s.start_time) > new Date())
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  const toTaipei = (iso: string) => new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000)

  const toTaipeiDate = (iso: string) => {
    const d = toTaipei(iso)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }

  const toTaipeiTime = (iso: string) => {
    const d = toTaipei(iso)
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  }

  const groupedSlots = slots.reduce((acc, slot) => {
    const date = toTaipeiDate(slot.start_time)
    if (!acc[date]) acc[date] = []
    acc[date].push(slot)
    return acc
  }, {} as Record<string, typeof slots>)

  const services = practitioner.services as { id: string; name: string; description: string | null; duration_minutes: number; price: number }[]
  const socialLinks = (practitioner.social_links as { platform: string; url: string }[]) ?? []
  const PLATFORM_ICON: Record<string, typeof Globe> = {
    instagram: AtSign, facebook: Share2, line: Link2, other: Globe,
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <span className="font-semibold text-lg">老師詳細資料</span>
      </div>

      {/* 老師基本資訊 */}
      <div className="bg-gradient-to-br from-primary to-[#6FAE82] px-4 py-8 text-white">
        <div className="flex gap-4 items-start">
          <Avatar className="w-24 h-24 border-2 border-white/50">
            <AvatarImage src={avatar} />
            <AvatarFallback className="bg-white/20 text-white text-3xl font-bold">
              {name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{name}</h1>
            {reviewList.length > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-4 h-4 fill-white text-white" />
                <span className="font-semibold text-sm">{avgRating.toFixed(1)}</span>
                <span className="text-white/70 text-sm">（{reviewList.length} 則評價）</span>
              </div>
            )}
            <div className="flex gap-1 mt-2">
              {serviceMode.map((mode) => (
                <Badge key={mode} className="bg-white/20 text-white border-white/30 text-sm px-3 py-1">
                  {mode}
                </Badge>
              ))}
            </div>
            {socialLinks.length > 0 && (
              <div className="flex gap-2 mt-3">
                {socialLinks.map((link, i) => {
                  const Icon = PLATFORM_ICON[link.platform] ?? Globe
                  return (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 active:scale-90 transition-all"
                    >
                      <Icon className="w-4 h-4 text-white" />
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-5 flex flex-col gap-5">
        {/* 簡介 */}
        <Card>
          <CardContent className="p-4">
            <p className="text-base text-muted-foreground leading-relaxed">{practitioner.bio ?? '尚未填寫簡介'}</p>
            {practitioner.shop_address && (
              <div className="flex items-center gap-1.5 mt-3 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{practitioner.shop_address}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 服務項目 */}
        <div>
          <h2 className="font-bold text-lg mb-3">服務項目</h2>
          <div className="grid grid-cols-2 gap-3">
            {services.map((service) => (
              <Card key={service.id}>
                <CardContent className="p-4">
                  <p className="font-semibold text-base leading-snug">{service.name}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">{service.duration_minutes} 分鐘</span>
                  </div>
                  <span className="text-primary font-bold text-lg mt-1.5 block">NT${service.price}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* 可預約時段 */}
        <div>
          <h2 className="font-bold text-lg mb-3">可預約時段</h2>
          {Object.keys(groupedSlots).length === 0 ? (
            <p className="text-muted-foreground text-base">目前沒有可預約時段</p>
          ) : (
            <div className="flex flex-col gap-5">
              {Object.entries(groupedSlots).map(([date, dateSlots]) => {
                const weekdays = ['日', '一', '二', '三', '四', '五', '六']
                const wd = weekdays[new Date(date + 'T00:00:00+08:00').getDay()]
                const [, m, day] = date.split('-')
                return (
                  <div key={date}>
                    <p className="text-base font-bold mb-2.5">{m}/{day}（{wd}）</p>
                    <div className="grid grid-cols-3 gap-2.5">
                      {dateSlots.map((slot) => (
                        slot.is_booked ? (
                          <div key={slot.id} className="rounded-xl border border-border bg-muted/40 px-3 py-4 text-center opacity-40 cursor-not-allowed">
                            <p className="text-base font-medium text-muted-foreground">{toTaipeiTime(slot.start_time)}</p>
                            <p className="text-sm text-muted-foreground mt-1">已預約</p>
                          </div>
                        ) : user ? (
                          <Link key={slot.id} href={`/booking?slotId=${slot.id}&practitionerId=${practitioner.id}`}>
                            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 px-3 py-4 text-center hover:bg-primary hover:border-primary active:scale-95 transition-all duration-150 cursor-pointer group">
                              <p className="text-base font-bold text-primary group-hover:text-white">{toTaipeiTime(slot.start_time)}</p>
                              <p className="text-sm text-primary/70 group-hover:text-white/80 mt-1">點擊預約</p>
                            </div>
                          </Link>
                        ) : (
                          <form key={slot.id} action={signInWithGoogle}>
                            <button type="submit" className="w-full rounded-xl border-2 border-primary/30 bg-primary/5 px-3 py-4 text-center hover:bg-primary hover:border-primary active:scale-95 transition-all duration-150 cursor-pointer group">
                              <p className="text-base font-bold text-primary group-hover:text-white">{toTaipeiTime(slot.start_time)}</p>
                              <p className="text-sm text-primary/70 group-hover:text-white/80 mt-1">登入預約</p>
                            </button>
                          </form>
                        )
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {/* 評價 */}
        <div>
          <h2 className="font-bold text-lg mb-3">
            學員評價 {reviewList.length > 0 && `（${reviewList.length}）`}
          </h2>
          {reviewList.length === 0 ? (
            <p className="text-muted-foreground text-base">尚無評價</p>
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
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 底部提示 */}
      <div className="sticky bottom-0 bg-white border-t border-border px-4 py-4">
        {user ? (
          <p className="text-center text-base text-muted-foreground">請點選上方時段開始預約</p>
        ) : (
          <form action={signInWithGoogle}>
            <Button className="w-full" size="lg" type="submit">登入以預約</Button>
          </form>
        )}
      </div>
    </div>
  )
}
