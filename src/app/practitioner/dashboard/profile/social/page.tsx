import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Link2, AtSign, Share2, Globe, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { addSocialLink, removeSocialLink } from '../actions'

const PLATFORM_ICON: Record<string, typeof Globe> = {
  instagram: AtSign,
  facebook: Share2,
  line: Link2,
  other: Globe,
}

export default async function SocialLinksPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: practitioner } = await supabase
    .from('practitioners')
    .select('social_links')
    .eq('user_id', user.id)
    .single()

  if (!practitioner) redirect('/')

  const socialLinks = (practitioner.social_links as { platform: string; url: string }[]) ?? []

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/practitioner/dashboard/profile">
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <span className="font-semibold text-lg">社群連結</span>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="w-4 h-4 text-primary" />
              社群帳號連結
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {socialLinks.length > 0 && (
              <div className="flex flex-col gap-2">
                {socialLinks.map((link, i) => {
                  const Icon = PLATFORM_ICON[link.platform] ?? Globe
                  return (
                    <div key={i} className="flex items-center gap-3 bg-muted/40 rounded-xl px-3 py-2.5">
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 hover:bg-primary hover:text-white transition-colors active:scale-90">
                        <Icon className="w-4 h-4 text-primary group-hover:text-white" />
                      </a>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary truncate flex-1 underline-offset-2 hover:underline">
                        {link.url}
                      </a>
                      <form action={removeSocialLink}>
                        <input type="hidden" name="index" value={i} />
                        <button type="submit" className="text-muted-foreground hover:text-destructive active:scale-90 transition-transform">
                          <X className="w-4 h-4" />
                        </button>
                      </form>
                    </div>
                  )
                })}
              </div>
            )}

            <form action={addSocialLink} className="flex flex-col gap-2 pt-1">
              <div className="flex gap-2">
                <select name="platform" className="border border-input rounded-md px-3 py-2 text-sm bg-background" defaultValue="instagram">
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="line">LINE</option>
                  <option value="other">其他</option>
                </select>
                <Input name="url" placeholder="https://..." required className="flex-1" />
              </div>
              <Button type="submit" size="sm" variant="outline" className="self-start active:scale-95 transition-transform">
                <Plus className="w-3.5 h-3.5 mr-1" />
                新增連結
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
