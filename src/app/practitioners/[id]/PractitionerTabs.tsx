'use client'

import { useState } from 'react'
import { Clock, Star, AtSign, Share2, Link2, Globe, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import GoogleMap from '@/components/GoogleMap'

const PLATFORM_ICON: Record<string, typeof Globe> = {
  instagram: AtSign, facebook: Share2, line: Link2, other: Globe,
}

type Service = { id: string; name: string; description: string | null; duration_minutes: number; price: number }
type Review = {
  rating: number
  comment: string | null
  reviewerName: string
  serviceName: string | null
  servicePrice: number | null
}
type SocialLink = { platform: string; url: string }

export function PractitionerTabs({
  bio,
  specialtyTags,
  socialLinks,
  services,
  reviews,
  avgRating,
  practitionerId,
  practitionerName,
  lat,
  lng,
}: {
  bio: string | null
  specialtyTags: string[]
  socialLinks: SocialLink[]
  services: Service[]
  reviews: Review[]
  avgRating: number
  practitionerId: string
  practitionerName: string
  lat: number | null
  lng: number | null
}) {
  const [tab, setTab] = useState<'about' | 'services' | 'reviews'>('about')

  const tabs = [
    { key: 'about' as const, label: '關於我們' },
    { key: 'services' as const, label: '服務項目' },
    { key: 'reviews' as const, label: `學員評價${reviews.length > 0 ? `（${reviews.length}）` : ''}` },
  ]

  return (
    <div>
      <div className="flex border-b border-border px-1 gap-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`py-2.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="py-4 flex flex-col gap-4">
        {tab === 'about' && (
          <>
            <p className="text-base text-muted-foreground leading-relaxed">{bio ?? '尚未填寫簡介'}</p>
            {specialtyTags.length > 0 && (
              <div className="flex flex-col gap-2">
                {specialtyTags.map((tag, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-base text-muted-foreground">{tag}</span>
                  </div>
                ))}
              </div>
            )}
            {socialLinks.length > 0 && (
              <div className="flex gap-2">
                {socialLinks.map((link, i) => {
                  const Icon = PLATFORM_ICON[link.platform] ?? Globe
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
            )}
            {lat != null && lng != null && (
              <div className="rounded-xl overflow-hidden border border-border h-72">
                <GoogleMap practitioners={[{ id: practitionerId, name: practitionerName, lat, lng }]} />
              </div>
            )}
          </>
        )}

        {tab === 'services' && (
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
        )}

        {tab === 'reviews' && (
          <>
            {reviews.length > 0 && (
              <div className="flex items-center gap-2">
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
          </>
        )}
      </div>
    </div>
  )
}
