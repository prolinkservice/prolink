export type FixedBlockType =
  | 'cover'
  | 'about'
  | 'certificates'
  | 'services'
  | 'reviews'
  | 'social'
  | 'map'
  | 'availability'

export type FreeBlockType = 'text' | 'image'

export type BlockType = FixedBlockType | FreeBlockType

export type PageBlock = {
  id: string
  type: BlockType
  visible: boolean
  data?: {
    heading?: string
    body?: string
    url?: string
    caption?: string
  }
}

export const BLOCK_REGISTRY: Record<BlockType, { label: string; deletable: boolean }> = {
  cover: { label: '封面與基本資料', deletable: false },
  about: { label: '關於我們', deletable: false },
  certificates: { label: '經歷／相關證照', deletable: false },
  services: { label: '服務項目', deletable: false },
  reviews: { label: '學員評價', deletable: false },
  social: { label: '社群連結', deletable: false },
  map: { label: '服務地點', deletable: false },
  availability: { label: '可預約時段', deletable: false },
  text: { label: '文字區塊', deletable: true },
  image: { label: '圖片區塊', deletable: true },
}

// 注意：cover（封面/大頭照）與 availability（可預約時段）在公開頁面是固定在頭尾的版面區塊，
// 不透過這套排序系統渲染，所以不放進 DEFAULT_LAYOUT、也不會出現在編輯介面的拖曳列表中。
export const DEFAULT_LAYOUT: PageBlock[] = [
  { id: 'about', type: 'about', visible: true },
  { id: 'certificates', type: 'certificates', visible: true },
  { id: 'services', type: 'services', visible: true },
  { id: 'reviews', type: 'reviews', visible: true },
  { id: 'social', type: 'social', visible: true },
  { id: 'map', type: 'map', visible: true },
]

export function resolveLayout(pageBlocks: unknown): PageBlock[] {
  if (Array.isArray(pageBlocks) && pageBlocks.length > 0) {
    return pageBlocks as PageBlock[]
  }
  return DEFAULT_LAYOUT
}
