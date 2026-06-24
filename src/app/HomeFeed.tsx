'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MapPin, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { SERVICE_CATEGORIES } from '@/lib/categories'

export type Practitioner = {
  id: string
  name: string
  avatar: string
  serviceMode: string[]
  price: number
  serviceCount: number
  categories: string[]
  avgRating: number
  reviewCount: number
  specialtyTags: string[]
  district: string | null
}

export function HomeFeed({ list, featured, searchActive }: { list: Practitioner[]; featured: Practitioner[]; searchActive?: boolean }) {
  const [selected, setSelected] = useState<string | null>(null)

  const filteredFeatured = selected ? featured.filter(p => p.categories.includes(selected)) : featured
  const filteredList = selected ? list.filter(p => p.categories.includes(selected)) : list
  const emptyReason = list.length === 0 && searchActive
    ? '找不到符合的老師，換個關鍵字試試'
    : '這個分類目前還沒有老師上架'

  return (
    <>
      {/* 分類篩選標籤 */}
      <div className="px-4 py-3">
        <p className="text-xs text-muted-foreground mb-2">想找什麼類型的服務？</p>
        <div className="flex gap-2 overflow-x-auto">
          <Badge
            variant={selected === null ? 'default' : 'outline'}
            className="cursor-pointer whitespace-nowrap text-xs shrink-0"
            onClick={() => setSelected(null)}
          >
            全部
          </Badge>
          {SERVICE_CATEGORIES.map(({ value, icon: Icon }) => (
            <Badge
              key={value}
              variant={selected === value ? 'default' : 'outline'}
              className="cursor-pointer whitespace-nowrap text-xs shrink-0 gap-1"
              onClick={() => setSelected(value)}
            >
              <Icon className="w-3 h-3" />
              {value}
            </Badge>
          ))}
        </div>
      </div>

      {/* 精選老師橫捲 */}
      <div className="px-4 pt-4">
        <h2 className="font-heading font-semibold text-base mb-3">精選老師</h2>
        {filteredFeatured.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">{emptyReason}</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {filteredFeatured.map((p, i) => (
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
                    <span className="text-sm text-foreground mt-1 truncate w-full">{p.categories[0] ?? p.specialtyTags[0] ?? ' '}</span>
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
        )}
      </div>

      {/* 附近所有老師 */}
      <div className="px-4 pt-3 pb-6">
        <h2 className="font-heading font-semibold text-sm mb-2">附近老師</h2>
        {filteredList.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">{emptyReason}</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {filteredList.map((p) => (
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
    </>
  )
}
