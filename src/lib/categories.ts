import { Dumbbell, Bone, Flame, Sparkles, Hand, Activity, type LucideIcon } from 'lucide-react'

export const SERVICE_CATEGORIES: { value: string; icon: LucideIcon }[] = [
  { value: '運動按摩', icon: Hand },
  { value: '整復', icon: Bone },
  { value: '泰式按摩', icon: Flame },
  { value: '美容', icon: Sparkles },
  { value: '美甲', icon: Activity },
  { value: '健身教練', icon: Dumbbell },
]
