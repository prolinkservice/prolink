import { MapPin, Search, SlidersHorizontal, LogOut, Star, Clock } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { signOut } from '@/app/auth/actions'
import GoogleMap from '@/components/GoogleMap'
import { parseCityDistrict } from '@/lib/address'

const SERVICE_MODE_LABEL: Record<string, string[]> = {
  at_shop: ['到店'],
  on_site: ['到府'],
  both: ['到店', '到府'],
}

export default async function Home() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: practitioners }] = await Promise.all([
    user
      ? supabase.from('profiles').select('role').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('practitioners')
      .select(`
        id,
        service_mode,
        shop_address,
        latitude,
        longitude,
        status,
        specialty_tags,
        years_experience,
        profiles ( display_name, avatar_url ),
        services ( id, price )
      `)
      .eq('status', 'approved')
      .order('created_at', { ascending: false }),
  ])

  const practitionerIds = (practitioners ?? []).map((p) => p.id)
  const { data: allReviews } = practitionerIds.length
    ? await supabase.from('reviews').select('practitioner_id, rating').in('practitioner_id', practitionerIds)
    : { data: [] }

  const ratingMap = new Map<string, { sum: number; count: number }>()
  for (const r of allReviews ?? []) {
    const entry = ratingMap.get(r.practitioner_id) ?? { sum: 0, count: 0 }
    entry.sum += r.rating
    entry.count += 1
    ratingMap.set(r.practitioner_id, entry)
  }

  const list = (practitioners ?? []).map((p) => {
    const services = p.services as { id: string; price: number }[]
    const prices = services.map(s => s.price)
    const minPrice = prices.length ? Math.min(...prices) : 0
    const profileRaw = p.profiles as unknown
    const prof = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { display_name: string | null; avatar_url: string | null } | null
    const ratingEntry = ratingMap.get(p.id)
    const avgRating = ratingEntry ? ratingEntry.sum / ratingEntry.count : 0
    return {
      id: p.id,
      name: prof?.display_name ?? '老師',
      avatar: prof?.avatar_url ?? '',
      serviceMode: SERVICE_MODE_LABEL[p.service_mode] ?? [],
      price: minPrice,
      serviceCount: services.length,
      lat: p.latitude as number | null,
      lng: p.longitude as number | null,
      avgRating,
      reviewCount: ratingEntry?.count ?? 0,
      specialtyTags: (p.specialty_tags as string[] | null) ?? [],
      district: parseCityDistrict(p.shop_address as string | null),
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
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-2 shadow-sm">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <span className="font-bold text-xl text-foreground">ProLink</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto flex-nowrap ml-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {user ? (
            <>
              {profile?.role === 'customer' && (
                <>
                  <Button asChild size="sm" variant="outline" className="shrink-0">
                    <Link href="/my-bookings">我的預約</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="shrink-0">
                    <Link href="/account">我的帳戶</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="shrink-0">
                    <Link href="/practitioner/register">職人入駐</Link>
                  </Button>
                </>
              )}
              {profile?.role === 'practitioner' && (
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link href="/practitioner/dashboard">職人後台</Link>
                </Button>
              )}
              {profile?.role === 'admin' && (
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link href="/admin">管理後台</Link>
                </Button>
              )}
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarImage src={user.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-accent text-xs">
                  {user.user_metadata?.full_name?.[0] ?? user.email?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <form action={signOut} className="shrink-0">
                <Button variant="ghost" size="sm" type="submit">
                  <LogOut className="w-4 h-4" />
                </Button>
              </form>
            </>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <Button asChild size="sm">
                <Link href="/auth">登入／註冊</Link>
              </Button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div className="relative bg-secondary px-5 pt-9 pb-7 overflow-hidden">
        {/* 便條紙貼紙 */}
        <svg className="absolute top-4 left-3 w-12 h-14 -rotate-[8deg]" viewBox="0 0 64 78">
          <rect x="2" y="2" width="60" height="74" rx="3" fill="white" stroke="#3D2F26" strokeWidth="1.5" />
          <circle cx="14" cy="2" r="3" fill="white" stroke="#3D2F26" strokeWidth="1.2" />
          <circle cx="32" cy="2" r="3" fill="white" stroke="#3D2F26" strokeWidth="1.2" />
          <circle cx="50" cy="2" r="3" fill="white" stroke="#3D2F26" strokeWidth="1.2" />
          <rect x="10" y="20" width="8" height="8" rx="1.5" fill="none" stroke="#C96F35" strokeWidth="1.5" />
          <path d="M11.5 24l1.5 1.5l3-3.5" fill="none" stroke="#C96F35" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M24 24h28" stroke="#3D2F26" strokeWidth="1.3" strokeLinecap="round" />
          <rect x="10" y="36" width="8" height="8" rx="1.5" fill="none" stroke="#C96F35" strokeWidth="1.5" />
          <path d="M11.5 40l1.5 1.5l3-3.5" fill="none" stroke="#C96F35" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M24 40h28" stroke="#3D2F26" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        {/* 30秒完成貼紙 */}
        <span className="absolute top-4 right-4 flex items-center gap-1.5 rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl bg-foreground text-background text-xs font-medium px-3.5 py-2.5 rotate-[4deg]">
          <Clock className="w-3.5 h-3.5 text-[#F5C9A0]" />30 秒完成
        </span>
        {/* 愛心貼紙 */}
        <svg className="absolute top-[88px] left-2 w-9 h-9 -rotate-[10deg]" viewBox="0 0 54 54">
          <path d="M27 46C18 40 6 31 6 19C6 11 12 6 19 6C23 6 26 8 27 11C28 8 31 6 35 6C42 6 48 11 48 19C48 31 36 40 27 46Z" fill="#F5C9A0" stroke="#3D2F26" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        {/* 星星貼紙 */}
        <svg className="absolute top-[96px] right-3 w-8 h-8 rotate-[12deg]" viewBox="0 0 50 50">
          <path d="M25 3 L30 18 L46 18 L33 28 L38 44 L25 34 L12 44 L17 28 L4 18 L20 18 Z" fill="#FAC775" stroke="#3D2F26" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>

        <div className="relative text-center pt-9">
          <p className="text-xs font-medium tracking-wide text-primary mb-2">高雄 · 按摩 · 瑜伽 · 個人教練</p>
          <h1 className="font-heading font-bold text-[28px] leading-tight text-foreground">不用等LINE<br />直接約老師</h1>
        </div>

        <p className="relative text-center text-sm text-muted-foreground mt-7 mb-4">一鍵預約・到府或到店・平台保障雙方權益</p>

        <div className="relative flex gap-2 max-w-md mx-auto">
          <div className="flex-1 relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="搜尋地區或捷運站" className="pl-9 bg-white text-foreground" />
          </div>
          <Button variant="secondary" size="icon"><Search className="w-4 h-4" /></Button>
          <Button variant="secondary" size="icon"><SlidersHorizontal className="w-4 h-4" /></Button>
        </div>

        {/* 平台保障貼紙 */}
        <span className="absolute bottom-3 left-0 bg-foreground text-background text-[11px] font-medium pl-4 pr-3 py-1.5 rounded-r-2xl">
          平台保障
        </span>
      </div>

      <div className="max-w-2xl mx-auto">
      {/* 困擾篩選標籤 */}
      <div className="px-4 py-3">
        <p className="text-xs text-muted-foreground mb-2">想解決什麼困擾？</p>
        <div className="flex gap-2 overflow-x-auto">
          {['肩頸痠痛', '運動傷害', '產後修復', '放鬆紓壓'].map((tag, i) => (
            <Badge key={tag} variant={i === 0 ? 'default' : 'outline'} className="cursor-pointer whitespace-nowrap text-xs shrink-0">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Google Map */}
      <div className="mx-4 rounded-xl border border-border overflow-hidden h-72 sm:h-96">
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
        <h2 className="font-heading font-semibold text-base mb-3">精選老師</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {featured.map((p, i) => (
            <Link key={p.id} href={`/practitioners/${p.id}`} className="shrink-0">
              <Card className="w-[180px] cursor-pointer hover:shadow-md active:scale-95 transition-all duration-150 rounded-2xl relative">
                {i === 0 && (
                  <div className="absolute top-2.5 left-2.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center z-10">
                    <Star className="w-3 h-3 fill-white text-white" />
                  </div>
                )}
                <CardContent className="px-3.5 pt-5 pb-4 flex flex-col items-center text-center">
                  <Avatar className={`w-[76px] h-[76px] mb-3 border-[3px] ${i === 0 ? 'border-[#E0935D]' : 'border-border'}`}>
                    <AvatarImage src={p.avatar} />
                    <AvatarFallback className="bg-accent text-foreground text-2xl font-semibold">{p.name[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-base font-semibold truncate w-full">{p.name}</span>
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-1 h-4">
                    {p.district && (
                      <>
                        <MapPin className="w-3 h-3 text-[#E0935D]" />
                        <span className="truncate">{p.district}</span>
                      </>
                    )}
                  </div>
                  <span className="text-sm text-foreground mt-1 truncate w-full">{p.specialtyTags[0] ?? ' '}</span>
                  <span className="text-xs text-muted-foreground mb-3.5">{p.serviceCount} 個服務項目</span>
                  <div className="flex items-center justify-between w-full">
                    <span className="flex items-center gap-1 text-sm font-semibold">
                      {p.reviewCount > 0 ? (
                        <>
                          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                          {p.avgRating.toFixed(1)}/5.0
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground font-normal">尚無評價</span>
                      )}
                    </span>
                    <span className="text-xs font-medium text-primary border border-[#E0935D] rounded-full px-3 py-1">查看</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* 附近所有老師 */}
      <div className="px-4 pt-3 pb-6">
        <h2 className="font-heading font-semibold text-sm mb-2">附近老師</h2>
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
                    <span className="flex items-center gap-0.5 text-[10px] text-amber-500 mt-0.5 h-3.5">
                      {p.reviewCount > 0 && (
                        <>
                          <Star className="w-2.5 h-2.5 fill-amber-500" />
                          {p.avgRating.toFixed(1)}
                        </>
                      )}
                    </span>
                    <span className="text-primary font-bold text-xs mt-0.5">NT${p.price}</span>
                    {p.district && (
                      <span className="flex items-center gap-0.5 text-muted-foreground text-[10px] mt-0.5 truncate w-full justify-center">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{p.district}</span>
                      </span>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
