import { MapPin, Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'

const MOCK_PRACTITIONERS = [
  {
    id: 1,
    name: '林小美',
    specialty: '瑞典式按摩・深層組織',
    rating: 4.9,
    reviews: 128,
    distance: '0.8 km',
    price: 1200,
    serviceMode: ['到店', '到府'],
    avatar: '',
  },
  {
    id: 2,
    name: '陳大偉',
    specialty: '泰式按摩・運動按摩',
    rating: 4.8,
    reviews: 96,
    distance: '1.2 km',
    price: 1000,
    serviceMode: ['到店'],
    avatar: '',
  },
  {
    id: 3,
    name: '王雅婷',
    specialty: '芳療按摩・淋巴排毒',
    rating: 5.0,
    reviews: 64,
    distance: '1.5 km',
    price: 1500,
    serviceMode: ['到府'],
    avatar: '',
  },
]

export default function Home() {
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
          <Button variant="ghost" size="sm">登入</Button>
          <Button size="sm">立即預約</Button>
        </div>
      </nav>

      {/* Hero + Search */}
      <div className="bg-gradient-to-br from-primary to-[#FF8E53] px-4 py-10 text-white">
        <h1 className="text-2xl font-bold mb-1">找到附近的專業師傅</h1>
        <p className="text-white/80 text-sm mb-6">按摩・舒壓・到府服務，隨時預約</p>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜尋地區或捷運站"
              className="pl-9 bg-white text-foreground"
            />
          </div>
          <Button variant="secondary" size="icon">
            <Search className="w-4 h-4" />
          </Button>
          <Button variant="secondary" size="icon">
            <SlidersHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 篩選標籤 */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto">
        {['全部', '到店', '到府', '評分最高', '距離最近', '價格最低'].map((tag) => (
          <Badge
            key={tag}
            variant={tag === '全部' ? 'default' : 'outline'}
            className="cursor-pointer whitespace-nowrap"
          >
            {tag}
          </Badge>
        ))}
      </div>

      {/* 地圖佔位 */}
      <div className="mx-4 rounded-2xl overflow-hidden border border-border bg-muted h-48 flex items-center justify-center text-muted-foreground text-sm gap-2">
        <MapPin className="w-5 h-5" />
        地圖載入中（Google Maps API Key 待申請）
      </div>

      {/* 師傅列表 */}
      <div className="px-4 py-4">
        <h2 className="font-semibold text-base mb-3">附近師傅</h2>
        <div className="flex flex-col gap-3">
          {MOCK_PRACTITIONERS.map((p) => (
            <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex gap-3">
                <Avatar className="w-14 h-14 shrink-0">
                  <AvatarImage src={p.avatar} />
                  <AvatarFallback className="bg-accent text-foreground font-semibold">
                    {p.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{p.name}</span>
                    <span className="text-primary font-bold text-sm">NT${p.price}</span>
                  </div>
                  <p className="text-muted-foreground text-xs mt-0.5 truncate">{p.specialty}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs">⭐ {p.rating}</span>
                    <span className="text-xs text-muted-foreground">({p.reviews} 則評價)</span>
                    <span className="text-xs text-muted-foreground ml-auto">{p.distance}</span>
                  </div>
                  <div className="flex gap-1 mt-2">
                    {p.serviceMode.map((mode) => (
                      <Badge key={mode} variant="outline" className="text-xs px-1.5 py-0">
                        {mode}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
