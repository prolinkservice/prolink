'use client'

import { useEffect, useState } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Eye, EyeOff, Trash2, Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { updatePageBlocks } from '../actions'
import { BLOCK_REGISTRY, DEFAULT_LAYOUT, type PageBlock, type BlockType } from '@/lib/pageBlocks'

function newId() {
  return Math.random().toString(36).slice(2, 10)
}

function SortableRow({
  block,
  onToggle,
  onDelete,
  onEdit,
}: {
  block: PageBlock
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const info = BLOCK_REGISTRY[block.type]

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-white border border-border rounded-xl px-3 py-2.5"
    >
      <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground touch-none">
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="flex-1 text-sm font-medium text-foreground">{info.label}</span>
      {(block.type === 'text' || block.type === 'image') && (
        <Button type="button" variant="ghost" size="icon" className="w-7 h-7" onClick={() => onEdit(block.id)}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      )}
      <Button type="button" variant="ghost" size="icon" className="w-7 h-7" onClick={() => onToggle(block.id)}>
        {block.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
      </Button>
      {info.deletable && (
        <Button type="button" variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => onDelete(block.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  )
}

export function LayoutBuilderForm() {
  const [blocks, setBlocks] = useState<PageBlock[]>(DEFAULT_LAYOUT)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('practitioners')
        .select('page_blocks')
        .eq('user_id', user.id)
        .single()
      const stored = data?.page_blocks as PageBlock[] | null
      setBlocks(stored && stored.length > 0 ? stored : DEFAULT_LAYOUT)
      setLoading(false)
    })
  }, [])

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setBlocks((items) => {
      const oldIndex = items.findIndex((b) => b.id === active.id)
      const newIndex = items.findIndex((b) => b.id === over.id)
      return arrayMove(items, oldIndex, newIndex)
    })
  }

  function toggleVisible(id: string) {
    setBlocks((items) => items.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b)))
  }

  function deleteBlock(id: string) {
    setBlocks((items) => items.filter((b) => b.id !== id))
    if (editingId === id) setEditingId(null)
  }

  function addBlock(type: BlockType) {
    const id = newId()
    setBlocks((items) => [...items, { id, type, visible: true, data: {} }])
    setEditingId(id)
  }

  function updateBlockData(id: string, data: PageBlock['data']) {
    setBlocks((items) => items.map((b) => (b.id === id ? { ...b, data: { ...b.data, ...data } } : b)))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccess(false)
    const formData = new FormData()
    formData.set('blocks', JSON.stringify(blocks))
    const result = await updatePageBlocks(formData)
    setSaving(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    }
  }

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground text-sm">載入中...</div>
  }

  const editingBlock = blocks.find((b) => b.id === editingId)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        拖曳調整公開頁面各區塊的順序，可開關顯示/隱藏，也可以新增自訂的文字或圖片區塊。
      </p>

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {blocks.map((block) => (
              <SortableRow
                key={block.id}
                block={block}
                onToggle={toggleVisible}
                onDelete={deleteBlock}
                onEdit={(id) => setEditingId(id === editingId ? null : id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {editingBlock && (editingBlock.type === 'text' || editingBlock.type === 'image') && (
        <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
          {editingBlock.type === 'text' ? (
            <>
              <div>
                <Label htmlFor="block-heading">標題</Label>
                <Input
                  id="block-heading"
                  value={editingBlock.data?.heading ?? ''}
                  onChange={(e) => updateBlockData(editingBlock.id, { heading: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="block-body">內容</Label>
                <textarea
                  id="block-body"
                  value={editingBlock.data?.body ?? ''}
                  onChange={(e) => updateBlockData(editingBlock.id, { body: e.target.value })}
                  className="w-full mt-1 bg-white border border-border rounded-lg px-3 py-2 text-sm resize-none min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <Label htmlFor="block-url">圖片網址</Label>
                <Input
                  id="block-url"
                  value={editingBlock.data?.url ?? ''}
                  onChange={(e) => updateBlockData(editingBlock.id, { url: e.target.value })}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="block-caption">說明文字（選填）</Label>
                <Input
                  id="block-caption"
                  value={editingBlock.data?.caption ?? ''}
                  onChange={(e) => updateBlockData(editingBlock.id, { caption: e.target.value })}
                  className="mt-1"
                />
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => addBlock('text')}>
          <Plus className="w-3.5 h-3.5 mr-1" />新增文字區塊
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => addBlock('image')}>
          <Plus className="w-3.5 h-3.5 mr-1" />新增圖片區塊
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {success && <p className="text-green-600 text-sm">排版已儲存</p>}

      <Button type="button" size="lg" disabled={saving} onClick={handleSave} className="active:scale-95 transition-transform">
        {saving ? '儲存中...' : '儲存排版'}
      </Button>
    </div>
  )
}
