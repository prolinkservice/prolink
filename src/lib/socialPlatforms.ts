import type { IconType } from 'react-icons'
import { Globe, Mail } from 'lucide-react'
import {
  FaInstagram, FaFacebook, FaYoutube, FaTiktok, FaXTwitter,
  FaWhatsapp, FaTelegram, FaLinkedin, FaLine, FaThreads,
} from 'react-icons/fa6'

export const SOCIAL_PLATFORMS: { value: string; label: string; icon: IconType }[] = [
  { value: 'instagram', label: 'Instagram', icon: FaInstagram },
  { value: 'facebook', label: 'Facebook', icon: FaFacebook },
  { value: 'line', label: 'LINE', icon: FaLine },
  { value: 'threads', label: 'Threads', icon: FaThreads },
  { value: 'youtube', label: 'YouTube', icon: FaYoutube },
  { value: 'tiktok', label: 'TikTok', icon: FaTiktok },
  { value: 'x', label: 'X（Twitter）', icon: FaXTwitter },
  { value: 'whatsapp', label: 'WhatsApp', icon: FaWhatsapp },
  { value: 'telegram', label: 'Telegram', icon: FaTelegram },
  { value: 'linkedin', label: 'LinkedIn', icon: FaLinkedin },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'other', label: '其他網站', icon: Globe },
]

export function getSocialIcon(platform: string): IconType {
  return SOCIAL_PLATFORMS.find((p) => p.value === platform)?.icon ?? Globe
}

export function getSocialLabel(platform: string): string {
  return SOCIAL_PLATFORMS.find((p) => p.value === platform)?.label ?? platform
}
