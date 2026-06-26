import { MapPin, ChevronLeft, Star, Share2, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { signInWithGoogle } from '@/app/auth/actions'
import { parseCityDistrict } from '@/lib/address'
import { resolveLayout, type PageBlock } from '@/lib/pageBlocks'
import { AboutBlock, CertificatesBlock, ServicesBlock, ReviewsBlock, SocialBlock, MapBlock, TextBlock, ImageBlock } from './Blocks'

const SERVICE_MODE_LABEL: Record<string, string[]> = {
  at_shop: ['到店'],
  on_site: ['到府'],
  both: ['到店', '到府'],
}

export default async function PractitionerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const [{ data: { user } }, { data: practitioner }, { data: reviews }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('practitioners')
      .select(`
        id,
        bio,
        service_mode,
        shop_address,
        latitude,
        longitude,
        status,
        years_experience,
        certificates,
        specialty_tags,
        cover_image_url,
        cover_image_position,
        brand_color,
        page_blocks,
        profiles ( display_name, avatar_url ),
        services ( id, name, description, duration_minutes, price ),
        availability_slots ( id, start_time, end_time, is_booked ),
        social_links
      `)
      .eq('id', id)
      .eq('status', 'approved')
      .single(),
    supabase
      .from('reviews')
      .select('rating, comment, created_at, profiles ( display_name ), bookings ( services ( name, price ) )')
      .eq('practitioner_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!practitioner) notFound()
  const pr = practitioner

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
  const specialtyTags = (practitioner.specialty_tags as string[]) ?? []
  const certificates = (practitioner.certificates as { name: string; year: number | null }[]) ?? []
  const district = parseCityDistrict(practitioner.shop_address as string | null)
  // 老師自訂品牌主色：只套用在這個公開頁面內的封面疊色與預約按鈕，不動全站 CSS 變數
  const brandColor = (practitioner.brand_color as string | null) || '#4A7C59'

  const layout = resolveLayout(practitioner.page_blocks).filter((b) => b.visible)

  function renderBlock(block: PageBlock) {
    switch (block.type) {
      case 'about':
        return <AboutBlock bio={pr.bio} specialtyTags={specialtyTags} />
      case 'certificates':
        return <CertificatesBlock yearsExperience={pr.years_experience} certificates={certificates} />
      case 'services':
        return <ServicesBlock services={services} />
      case 'reviews':
        return (
          <ReviewsBlock
            avgRating={avgRating}
            reviews={reviewList.map((r) => {
              const revProfRaw = r.profiles as unknown
              const revProf = (Array.isArray(revProfRaw) ? revProfRaw[0] : revProfRaw) as { display_name: string | null } | null
              const bookingRaw = r.bookings as unknown
              const booking = (Array.isArray(bookingRaw) ? bookingRaw[0] : bookingRaw) as { services: unknown } | null
              const serviceRaw = booking?.services as unknown
              const service = (Array.isArray(serviceRaw) ? serviceRaw[0] : serviceRaw) as { name: string; price: number } | null
              return {
                rating: r.rating,
                comment: r.comment,
                reviewerName: revProf?.display_name ?? '匿名學員',
                serviceName: service?.name ?? null,
                servicePrice: service?.price ?? null,
              }
            })}
          />
        )
      case 'social':
        return <SocialBlock socialLinks={socialLinks} />
      case 'map':
        return <MapBlock practitionerId={pr.id} practitionerName={name} lat={pr.latitude} lng={pr.longitude} shopAddress={pr.shop_address} />
      case 'text':
        return <TextBlock data={block.data} />
      case 'image':
        return <ImageBlock data={block.data} />
      default:
        return null
    }
  }

  // cover / availability 是版面頭尾兩個特殊位置，維持目前固定的視覺位置，不參與中段區塊排序
  const middleBlocks = layout.filter((b) => b.type !== 'cover' && b.type !== 'availability')

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <span className="font-semibold text-lg">老師詳細資料</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto">

      {/* 封面照：無封面照時用老師自訂品牌主色疊加漸層，有封面照則用品牌主色做半透明疊色，並套用老師自選的裁切位置 */}
      <div
        className="relative h-40 bg-cover bg-no-repeat"
        style={
          practitioner.cover_image_url
            ? {
                backgroundImage: `linear-gradient(to bottom right, ${brandColor}99, ${brandColor}4D), url(${practitioner.cover_image_url})`,
                backgroundPosition: (practitioner.cover_image_position as string | null) || '50% 50%',
              }
            : { backgroundImage: `linear-gradient(to bottom right, ${brandColor}, #E0935D)` }
        }
      >
        <Avatar className="absolute left-4 -bottom-8 w-20 h-20 border-[3px] border-white shadow-sm">
          <AvatarImage src={avatar} />
          <AvatarFallback className="bg-accent text-foreground text-2xl font-bold">{name[0]}</AvatarFallback>
        </Avatar>
      </div>

      {/* 老師基本資訊 */}
      <div className="px-4 pt-10 pb-2">
        <div className="flex items-start justify-between">
          <h1 className="text-xl font-bold">{name}</h1>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Share2 className="w-4 h-4" />
            <MessageCircle className="w-4 h-4" />
          </div>
        </div>
        {district && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <MapPin className="w-3.5 h-3.5 text-[#E0935D]" />
            <span>{district}</span>
          </div>
        )}
        {reviewList.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-sm">{avgRating.toFixed(1)}/5.0</span>
            <span className="text-muted-foreground text-sm">（{reviewList.length} 則評價）</span>
          </div>
        )}
        {serviceMode.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {serviceMode.map((mode) => (
              <span key={mode} className="text-xs px-2.5 py-1 border border-border rounded-full text-muted-foreground">
                {mode}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 flex flex-col gap-6 py-4">
        {middleBlocks.map((block) => (
          <div key={block.id}>{renderBlock(block)}</div>
        ))}
      </div>

      <div className="px-4 py-5 flex flex-col gap-5">
        {/* 可預約時段 */}
        <div>
          <h2 className="font-bold text-lg mb-3">可預約時段</h2>
          {Object.keys(groupedSlots).length === 0 ? (
            <p className="text-muted-foreground text-base">目前沒有可預約時段</p>
          ) : (
            <div className="flex flex-col gap-5">
              {Object.entries(groupedSlots).map(([date, dateSlots]) => {
                const weekdays = ['日', '一', '二', '三', '四', '五', '六']
                const [y, m, day] = date.split('-')
                const wd = weekdays[new Date(Date.UTC(Number(y), Number(m) - 1, Number(day))).getUTCDay()]
                return (
                  <div key={date}>
                    <p className="text-sm font-bold mb-2">{m}/{day}（{wd}）</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {dateSlots.map((slot) => (
                        slot.is_booked ? (
                          <div key={slot.id} className="rounded-lg border border-border bg-muted/40 px-1.5 py-2 text-center opacity-40 cursor-not-allowed">
                            <p className="text-sm font-medium text-muted-foreground">{toTaipeiTime(slot.start_time)}</p>
                          </div>
                        ) : user ? (
                          <Link key={slot.id} href={`/booking?slotId=${slot.id}&practitionerId=${practitioner.id}`}>
                            <div className="rounded-lg border border-primary/30 bg-primary/5 px-1.5 py-2 text-center hover:bg-primary hover:border-primary active:scale-95 transition-all duration-150 cursor-pointer group">
                              <p className="text-sm font-bold text-primary group-hover:text-white">{toTaipeiTime(slot.start_time)}</p>
                            </div>
                          </Link>
                        ) : (
                          <form key={slot.id} action={signInWithGoogle}>
                            <button type="submit" className="w-full rounded-lg border border-primary/30 bg-primary/5 px-1.5 py-2 text-center hover:bg-primary hover:border-primary active:scale-95 transition-all duration-150 cursor-pointer group">
                              <p className="text-sm font-bold text-primary group-hover:text-white">{toTaipeiTime(slot.start_time)}</p>
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
      </div>

      </div>

      {/* 底部提示 */}
      <div className="sticky bottom-0 bg-white border-t border-border">
        <div className="max-w-lg mx-auto px-4 py-4">
          {user ? (
            <p className="text-center text-base text-muted-foreground">請點選上方時段開始預約</p>
          ) : (
            <form action={signInWithGoogle}>
              <Button className="w-full" size="lg" type="submit" style={{ backgroundColor: brandColor }}>登入以預約</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
