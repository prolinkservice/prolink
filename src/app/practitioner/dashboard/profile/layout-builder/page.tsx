import { redirect } from 'next/navigation'

// 首頁編排已併入「品牌頁面」，這裡保留路由做轉址，避免舊書籤/連結失效
export default function LayoutBuilderPage() {
  redirect('/practitioner/dashboard/profile/brand')
}
