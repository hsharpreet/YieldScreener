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
    <div className="text-xs" style={{ color: '#4a6080' }}>
      <a href="/login" className="transition-colors" style={{ color: '#00d4aa' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#00bfa0')}
        onMouseLeave={e => (e.currentTarget.style.color = '#00d4aa')}
      >
        Sign in
      </a>{' '}
      to save screeners
    </div>
  )

  if (user.tier !== 'pro') return (
    <div className="text-xs" style={{ color: '#4a6080' }}>
      <span
        className="rounded px-1.5 py-0.5 text-[10px] font-semibold mr-1"
        style={{ background: 'rgba(0,212,170,0.15)', color: '#00d4aa' }}
      >
        Pro
      </span>
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
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#3a5070' }}>
        Saved Screeners
      </p>
      {saved.length === 0 && (
        <p className="text-xs" style={{ color: '#3a5070' }}>No saved screeners yet.</p>
      )}
      {saved.map(s => (
        <div key={s.id} className="flex items-center gap-1">
          <button
            onClick={() => onLoad(s.params)}
            className="flex-1 text-left text-xs truncate transition-colors"
            style={{ color: '#8a9ab0' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#00d4aa')}
            onMouseLeave={e => (e.currentTarget.style.color = '#8a9ab0')}
          >
            {s.name}
          </button>
          <button
            onClick={() => void handleDelete(s.id)}
            className="text-xs transition-colors px-1"
            style={{ color: '#2a3a58' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.color = '#2a3a58')}
          >
            &#x2715;
          </button>
        </div>
      ))}
      <div className="flex gap-1.5 mt-2 pt-2" style={{ borderTop: '1px solid #1a2d4a' }}>
        <input
          value={saveName}
          onChange={e => setSaveName(e.target.value)}
          placeholder="Name..."
          className="flex-1 rounded px-2 py-1 text-xs focus:outline-none"
          style={{
            background: '#1a2438',
            border: '1px solid #2a3a58',
            color: '#c8d8e8',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = '#00d4aa')}
          onBlur={e => (e.currentTarget.style.borderColor = '#2a3a58')}
        />
        <button
          onClick={() => void handleSave()}
          disabled={saving || !saveName.trim()}
          className="text-xs rounded px-2.5 py-1 transition-colors font-medium disabled:opacity-40"
          style={{ background: '#1a2d4a', color: '#00d4aa', border: '1px solid #2a3a58' }}
          onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#00d4aa20' }}
          onMouseLeave={e => (e.currentTarget.style.background = '#1a2d4a')}
        >
          Save
        </button>
      </div>
    </div>
  )
}
