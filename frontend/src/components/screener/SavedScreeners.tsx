'use client'
import { useState, useEffect } from 'react'
import { fetchSavedScreeners, saveScreener, deleteSavedScreener, SavedScreener, ScreenParams } from '@/lib/api'
import { useAuth } from '@/components/auth'

interface Props {
  currentParams: ScreenParams
  onLoad: (params: ScreenParams) => void
}

export default function SavedScreeners({ currentParams, onLoad }: Props) {
  const { user } = useAuth()
  const [saved, setSaved] = useState<SavedScreener[]>([])
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user?.tier === 'pro') {
      fetchSavedScreeners().then(setSaved)
    }
  }, [user])

  if (!user) return (
    <div className="text-xs text-gray-400 italic">
      <a href="/login" className="text-blue-500 hover:underline">Sign in</a> to save screeners
    </div>
  )

  if (user.tier !== 'pro') return (
    <div className="text-xs text-gray-400 italic">
      <span className="bg-blue-100 text-blue-700 rounded px-1 text-[10px] font-medium mr-1">Pro</span>
      Saved screeners
    </div>
  )

  async function handleSave() {
    if (!saveName.trim()) return
    setSaving(true)
    try {
      const s = await saveScreener(saveName.trim(), currentParams)
      setSaved(prev => [...prev, s])
      setSaveName('')
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    await deleteSavedScreener(id)
    setSaved(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Saved Screeners</p>
      {saved.map(s => (
        <div key={s.id} className="flex items-center gap-1">
          <button
            onClick={() => onLoad(s.params)}
            className="flex-1 text-left text-xs text-gray-700 hover:text-blue-600 truncate">
            {s.name}
          </button>
          <button
            onClick={() => void handleDelete(s.id)}
            className="text-gray-300 hover:text-red-500 text-xs">
            &#x2715;
          </button>
        </div>
      ))}
      <div className="flex gap-1 mt-1">
        <input
          value={saveName}
          onChange={e => setSaveName(e.target.value)}
          placeholder="Name&#x2026;"
          className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs" />
        <button
          onClick={() => void handleSave()}
          disabled={saving || !saveName.trim()}
          className="text-xs bg-gray-100 hover:bg-gray-200 rounded px-2 py-1 disabled:opacity-50">
          Save
        </button>
      </div>
    </div>
  )
}
