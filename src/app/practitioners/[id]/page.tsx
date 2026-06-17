import { MapPin, Clock, ChevronLeft } from 'lucide-react'
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
      availability_slots ( id, start_time, end_time, is_booked )
    `)
    .eq('id', id)
    .eq('status', 'approved')
    .single()

  if (!practitioner) notFound()

  const profileRaw = practitioner.profiles as unknown
  const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { display_name: string | null; avatar_url: string | null } | null
  const name = profile?.display_name ?? '師傅'
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <span className="font-semibold">師傅詳細資料</span>
      </div>

      {/* 師傅基本資訊 */}
      <div className="bg-gradient-to-br from-primary to-[#FF8E53] px-4 py-8 text-white">
        <div className="flex gap-4 items-start">
          <Avatar className="w-20 h-20 border-2 border-white/50">
            <AvatarImage src={avatar} />
            <AvatarFallback className="bg-white/20 text-white text-2xl font-bold">
              {name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{name}</h1>
            <div className="flex gap-1 mt-2">
              {serviceMode.map((mode) => (
                <Badge key={mode} className="bg-white/20 text-white border-white/30 text-xs">
                  {mode}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* 簡介 */}
        <Card>
          <CardContent className="p-3">
            <p className="text-sm text-muted-foreground leading-relaxed">{practitioner.bio ?? '尚未填寫簡介'}</p>
            {practitioner.shop_address && (
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span>{practitioner.shop_address}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 服務項目 — 雙欄 */}
        <div>
          <h2 className="font-semibold mb-2">服務項目</h2>
          <div className="grid grid-cols-2 gap-2">
            {services.map((service) => (
              <Card key={service.id}>
                <CardContent className="p-3">
                  <p className="font-medium text-sm leading-snug">{service.name}</p>
                  <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span className="text-xs">{service.duration_minutes} 分</span>
                  </div>
                  <span className="text-primary font-bold text-sm mt-1 block">NT${service.price}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* 可預約時段 — 日期分行 */}
        <div>
          <h2 className="font-semibold mb-2">可預約時段</h2>
          {Object.keys(groupedSlots).length === 0 ? (
            <p className="text-muted-foreground text-sm">目前沒有可預約時段</p>
          ) : (
            <div className="flex flex-col gap-2">
              {Object.entries(groupedSlots).map(([date, dateSlots]) => (
                <div key={date} className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-muted-foreground w-12 shrink-0">{date.slice(5)}</span>
                  {dateSlots.map((slot) => (
                    slot.is_booked ? (
                      <Badge key={slot.id} variant="secondary" className="text-xs px-2.5 py-1 opacity-40 cursor-not-allowed">
                        {toTaipeiTime(slot.start_time)}
                      </Badge>
                    ) : user ? (
                      <Link key={slot.id} href={`/booking?slotId=${slot.id}&practitionerId=${practitioner.id}`}>
                        <Badge variant="outline" className="text-xs px-2.5 py-1 cursor-pointer hover:bg-primary hover:text-white hover:border-primary transition-colors">
                          {toTaipeiTime(slot.start_time)}
                        </Badge>
                      </Link>
                    ) : (
                      <form key={slot.id} action={signInWithGoogle}>
                        <button type="submit">
                          <Badge variant="outline" className="text-xs px-2.5 py-1 cursor-pointer hover:bg-primary hover:text-white hover:border-primary transition-colors">
                            {toTaipeiTime(slot.start_time)}
                          </Badge>
                        </button>
                      </form>
                    )
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 底部提示 */}
      <div className="sticky bottom-0 bg-white border-t border-border px-4 py-3">
        {user ? (
          <p className="text-center text-sm text-muted-foreground">請點選上方時段開始預約</p>
        ) : (
          <form action={signInWithGoogle}>
            <Button className="w-full" size="lg" type="submit">登入以預約</Button>
          </form>
        )}
      </div>
    </div>
  )
}
