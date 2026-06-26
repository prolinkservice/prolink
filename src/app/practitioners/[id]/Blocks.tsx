import { Clock, Star, CheckCircle2, Award, BadgeCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import GoogleMap from '@/components/GoogleMap'
import type { PageBlock } from '@/lib/pageBlocks'
import { getSocialIcon } from '@/lib/socialPlatforms'

type Service = { id: string; name: string; description: string | null; duration_minutes: number; price: number }
type Review = {
  rating: number
  comment: string | null
  reviewerName: string
  serviceName: string | null
  servicePrice: number | null
}
type SocialLink = { platform: string; url: string }
type Certificate = { name: string; year: number | null }

export function AboutBlock({ bio, specialtyTags }: { bio: string | null; specialtyTags: string[] }) {
  return (
    <div>
      <h2 className="font-bold text-lg mb-3">關於我們</h2>
      <p className="text-base text-muted-foreground leading-relaxed">{bio ?? '尚未填寫簡介'}</p>
      {specialtyTags.length > 0 && (
        <div className="flex flex-col gap-2 mt-3">
          {specialtyTags.map((tag, i) => (
            <div key={i} className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span className="text-base text-muted-foreground">{tag}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function CertificatesBlock({ yearsExperience, certificates }: { yearsExperience: number | null; certificates: Certificate[] }) {
  const list = certificates.filter(c => c.name?.trim())
  if (!yearsExperience && list.length === 0) return null
  return (
    <div>
      <h2 className="font-bold text-lg mb-3">經歷／相關證照</h2>
      <div className="flex flex-wrap gap-1.5">
        {yearsExperience && (
          <Badge className="bg-accent text-primary border-none text-xs px-2.5 py-1 rounded-full">
            <Award className="w-3 h-3 mr-1" />
            {yearsExperience} 年經驗
          </Badge>
        )}
        {list.map((cert, i) => (
          <Badge key={i} className="bg-accent text-primary border-none text-xs px-2.5 py-1 rounded-full">
            <BadgeCheck className="w-3 h-3 mr-1" />
            {cert.name}{cert.year ? `（${cert.year}）` : ''}
          </Badge>
        ))}
      </div>
    </div>
  )
}

export function ServicesBlock({ services }: { services: Service[] }) {
  return (
    <div>
      <h2 className="font-bold text-lg mb-3">服務項目</h2>
      <div className="grid grid-cols-2 gap-3">
        {services.length === 0 ? (
          <p className="text-muted-foreground text-base col-span-2">尚未新增服務項目</p>
        ) : (
          services.map((service) => (
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
          ))
        )}
      </div>
    </div>
  )
}

export function ReviewsBlock({ reviews, avgRating }: { reviews: Review[]; avgRating: number }) {
  return (
    <div>
      <h2 className="font-bold text-lg mb-3">學員評價{reviews.length > 0 ? `（${reviews.length}）` : ''}</h2>
      {reviews.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          <span className="font-semibold text-sm">{avgRating.toFixed(1)}/5.0</span>
          <span className="text-muted-foreground text-sm">（{reviews.length} 則評價）</span>
        </div>
      )}
      {reviews.length === 0 ? (
        <p className="text-muted-foreground text-base">尚無評價</p>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((r, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-sm">{r.reviewerName}</span>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className={`w-4 h-4 ${j < r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
                    ))}
                  </div>
                </div>
                {r.serviceName && (
                  <p className="text-sm font-medium text-primary underline mb-0.5">
                    {r.serviceName}{r.servicePrice != null && <span className="ml-1.5 text-foreground no-underline">NT${r.servicePrice}</span>}
                  </p>
                )}
                {r.comment && <p className="text-sm text-muted-foreground leading-relaxed mt-1">{r.comment}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function SocialBlock({ socialLinks }: { socialLinks: SocialLink[] }) {
  if (socialLinks.length === 0) return null
  return (
    <div>
      <h2 className="font-bold text-lg mb-3">社群連結</h2>
      <div className="flex gap-2">
        {socialLinks.map((link, i) => {
          const Icon = getSocialIcon(link.platform)
          return (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-accent flex items-center justify-center hover:bg-accent/70 active:scale-90 transition-all"
            >
              <Icon className="w-4 h-4 text-primary" />
            </a>
          )
        })}
      </div>
    </div>
  )
}

export function MapBlock({ practitionerId, practitionerName, lat, lng }: { practitionerId: string; practitionerName: string; lat: number | null; lng: number | null }) {
  if (lat == null || lng == null) return null
  return (
    <div>
      <h2 className="font-bold text-lg mb-3">地圖位置</h2>
      <div className="rounded-xl overflow-hidden border border-border h-[28rem]">
        <GoogleMap practitioners={[{ id: practitionerId, name: practitionerName, lat, lng }]} />
      </div>
    </div>
  )
}

export function TextBlock({ data }: { data: PageBlock['data'] }) {
  if (!data?.heading && !data?.body) return null
  return (
    <div>
      {data.heading && <h2 className="font-bold text-lg mb-3">{data.heading}</h2>}
      {data.body && <p className="text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">{data.body}</p>}
    </div>
  )
}

export function ImageBlock({ data }: { data: PageBlock['data'] }) {
  if (!data?.url) return null
  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={data.url} alt={data.caption ?? ''} className="w-full rounded-xl border border-border" />
      {data.caption && <p className="text-sm text-muted-foreground mt-2">{data.caption}</p>}
    </div>
  )
}
