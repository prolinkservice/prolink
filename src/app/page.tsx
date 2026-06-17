import { createClient } from '@/lib/supabase'

export default async function Home() {
  const supabase = createClient()
  const { data, error } = await supabase.from('profiles').select('count')

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>ProLink 🎉</h1>
      <p>Supabase 連線狀態：{error ? '❌ 失敗' : '✅ 成功'}</p>
    </main>
  )
}