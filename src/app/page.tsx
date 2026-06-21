import { MapPin, Search, SlidersHorizontal, LogOut } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { signInWithGoogle, signOut } from '@/app/auth/actions'
import GoogleMap from '@/components/GoogleMap'

const SERVICE_MODE_LABEL: Record<string, string[]> = {
  at_shop: ['到店'],
  on_site: ['到府'],
  both: ['到店', '到府'],
}

export default async function Home() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).single()
    : { data: null }

  const { data: practitioners } = await supabase
    .from('practitioners')
    .select(`
      id,
      service_mode,
      shop_address,
      latitude,
      longitude,
      status,
      profiles ( display_name, avatar_url ),
      services ( price )
    `)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  const list = (practitioners ?? []).map((p) => {
    const prices = (p.services as { price: number }[]).map(s => s.price)
    const minPrice = prices.length ? Math.min(...prices) : 0
    const profileRaw = p.profiles as unknown
    const prof = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { display_name: string | null; avatar_url: string | null } | null
    return {
      id: p.id,
      name: prof?.display_name ?? '老師',
      avatar: prof?.avatar_url ?? '',
      serviceMode: SERVICE_MODE_LABEL[p.service_mode] ?? [],
      price: minPrice,
      lat: p.latitude as number | null,
      lng: p.longitude as number | null,
    }
  })

  const featured = list.slice(0, 5)
  const mapPractitioners = list.filter(p => p.lat && p.lng).map(p => ({
    id: p.id,
    name: p.name,
    lat: p.lat!,
    lng: p.lng!,
  }))

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <span className="font-bold text-xl text-foreground">ProLink</span>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              {profile?.role === 'customer' && (
                <>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/my-bookings">我的預約</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/practitioner/register">職人入駐</Link>
                  </Button>
                </>
              )}
              {profile?.role === 'practitioner' && (
                <Button asChild size="sm" variant="outline">
                  <Link href="/practitioner/dashboard">職人後台</Link>
                </Button>
              )}
              {profile?.role === 'admin' && (
                <Button asChild size="sm" variant="outline">
                  <Link href="/admin">管理後台</Link>
                </Button>
              )}
              <Avatar className="w-8 h-8">
                <AvatarImage src={user.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-accent text-xs">
                  {user.user_metadata?.full_name?.[0] ?? user.email?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <form action={signOut}>
                <Button variant="ghost" size="sm" type="submit">
                  <LogOut className="w-4 h-4" />
                </Button>
              </form>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/signup?next=${encodeURIComponent('/practitioner/register')}`}>職人入駐</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/login">登入</Link>
              </Button>
              <form action={signInWithGoogle}>
                <Button size="sm" type="submit">Google 登入</Button>
              </form>
            </div>
          )}
        </div>
      </nav>

      {/* Hero + Search */}
      <div className="bg-gradient-to-br from-primary to-[#6FAE82] px-4 py-8 text-white">
        <h1 className="text-xl font-bold mb-0.5">找到你的專屬健康老師</h1>
        <p className="text-white/80 text-sm mb-4">按摩・瑜伽・個人教練，一鍵預約到府或到店</p>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="搜尋地區或捷運站" className="pl-9 bg-white text-foreground" />
          </div>
          <Button variant="secondary" size="icon"><Search className="w-4 h-4" /></Button>
          <Button variant="secondary" size="icon"><SlidersHorizontal className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* 篩選標籤 */}
      <div className="px-4 py-2.5 flex gap-2 overflow-x-auto">
        {['全部', '按摩', '瑜伽', '個人教練', '到店', '到府'].map((tag) => (
          <Badge key={tag} variant={tag === '全部' ? 'default' : 'outline'} className="cursor-pointer whitespace-nowrap text-xs">
            {tag}
          </Badge>
        ))}
      </div>

      {/* Google Map */}
      <div className="mx-4 rounded-xl border border-border overflow-hidden h-48">
        {mapPractitioners.length > 0 ? (
          <GoogleMap practitioners={mapPractitioners} />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-xs gap-2">
            <MapPin className="w-4 h-4" />
            尚無老師位置資料
          </div>
        )}
      </div>

      {/* 精選老師橫捲 */}
      <div className="px-4 pt-4">
        <h2 className="font-semibold text-base mb-3">精選老師</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {featured.map((p) => (
            <Link key={p.id} href={`/practitioners/${p.id}`} className="shrink-0">
              <Card className="w-36 cursor-pointer hover:shadow-md active:scale-95 transition-all duration-150">
                <CardContent className="p-3 flex flex-col items-center text-center">
                  <Avatar className="w-16 h-16 mb-2">
                    <AvatarImage src={p.avatar} />
                    <AvatarFallback className="bg-accent text-foreground text-xl font-semibold">{p.name[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-semibold truncate w-full">{p.name}</span>
                  <span className="text-primary text-sm font-bold mt-1">NT${p.price}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* 附近所有老師 */}
      <div className="px-4 pt-3 pb-6">
        <h2 className="font-semibold text-sm mb-2">附近老師</h2>
        {list.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">目前尚無老師上架</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {list.map((p) => (
              <Link key={p.id} href={`/practitioners/${p.id}`}>
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-2 flex flex-col items-center text-center">
                    <Avatar className="w-9 h-9 mb-1">
                      <AvatarImage src={p.avatar} />
                      <AvatarFallback className="bg-accent text-foreground text-xs font-semibold">{p.name[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-semibold truncate w-full">{p.name}</span>
                    <span className="text-primary font-bold text-xs mt-0.5">NT${p.price}</span>
                    <span className="text-muted-foreground text-[10px] mt-0.5">{p.serviceMode.join(' ')}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
