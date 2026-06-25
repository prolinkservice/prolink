'use client'

import { useEffect, useState } from 'react'
import { NotebookPen, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getClientNote, saveClientNote } from './notes-actions'

interface ClientNoteEditorProps {
  customerId: string
}

export function ClientNoteEditor({ customerId }: ClientNoteEditorProps) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [note, setNote] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!open || loaded) return
    getClientNote(customerId).then(res => {
      setNote(res.note)
      setUpdatedAt(res.updatedAt)
      setLoaded(true)
    })
  }, [open, loaded, customerId])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const formData = new FormData()
    formData.set('customerId', customerId)
    formData.set('note', note)
    const result = await saveClientNote(formData)
    setSaving(false)
    if (!result?.error) {
      setSaved(true)
      setUpdatedAt(new Date().toISOString())
    }
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <NotebookPen className="w-3.5 h-3.5" />
          客人體質備註（僅您本人與該客人可見）
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="mt-2">
          {!loaded ? (
            <p className="text-xs text-muted-foreground py-2">載入中...</p>
          ) : (
            <>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="例：上次按了肩頸與下背，體質偏寒、避免重力按壓..."
                value={note}
                onChange={e => { setNote(e.target.value); setSaved(false) }}
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  {updatedAt ? `最後更新：${new Date(updatedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}` : '尚無紀錄'}
                </p>
                <div className="flex items-center gap-2">
                  {saved && <span className="text-xs text-green-600">已儲存</span>}
                  <Button size="sm" disabled={saving} onClick={handleSave} className="active:scale-95 transition-transform">
                    {saving ? '儲存中...' : '儲存備註'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
