import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../config/supabase'
import { CATEGORIES, COMPETENCY_TAGS, mapTagToCompetency } from '../config/categories'

export default function BlockEditPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [block, setBlock] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user || !id) return
    supabase
      .from('experience_blocks')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error('블록을 찾을 수 없습니다.')
          navigate('/dashboard')
          return
        }
        setBlock(data)
        setLoading(false)
      })
  }, [id, user, navigate, toast])

  const updateField = (field, value) => {
    setBlock(prev => ({ ...prev, [field]: value }))
  }

  const toggleTag = (label) => {
    const currentLabels = new Set(
      (block.tags || [])
        .map(t => mapTagToCompetency(t)?.label)
        .filter(Boolean)
    )
    if (currentLabels.has(label)) currentLabels.delete(label)
    else currentLabels.add(label)
    setBlock(prev => ({ ...prev, tags: [...currentLabels].map(l => `#${l}`) }))
  }

  const handleSave = async () => {
    if (!block.title?.trim() || !block.situation?.trim() || !block.action?.trim() || !block.result?.trim()) {
      toast.error('제목, 상황, 행동, 결과는 필수입니다.')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('experience_blocks')
      .update({
        title: block.title,
        situation: block.situation,
        action: block.action,
        result: block.result,
        lesson: block.lesson,
        tags: block.tags || [],
        strength_score: block.strength_score || 3,
        ai_insight: block.ai_insight,
      })
      .eq('id', id)

    setSaving(false)
    if (error) {
      toast.error('저장에 실패했습니다.')
      return
    }
    toast.success('블록이 수정되었습니다.')
    navigate('/dashboard')
  }

  if (loading || !block) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-slate-400">불러오는 중...</div>
      </div>
    )
  }

  const cat = CATEGORIES.find(c => c.id === block.category)
  const activeTagIds = new Set(
    (block.tags || []).map(t => mapTagToCompetency(t)?.id).filter(Boolean)
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      <button
        onClick={() => navigate('/dashboard')}
        className="text-xs text-slate-400 hover:text-slate-600 mb-3 block"
      >&larr; 대시보드로</button>

      <div className="text-center mb-6">
        <h1 className="text-xl font-bold text-slate-900">블록 수정</h1>
        <p className="text-sm text-slate-500 mt-1">
          {cat?.emoji} {cat?.label}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">제목</label>
          <input
            value={block.title || ''}
            onChange={(e) => updateField('title', e.target.value)}
            className="w-full text-lg font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {[
          { key: 'situation', label: '상황 (Situation)', icon: '📍', rows: 3 },
          { key: 'action', label: '행동 (Action)', icon: '⚡', rows: 4 },
          { key: 'result', label: '결과 (Result)', icon: '🎯', rows: 3 },
          { key: 'lesson', label: '배운점 (Takeaway)', icon: '💡', rows: 2 },
        ].map(({ key, label, icon, rows }) => (
          <div key={key}>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">
              {icon} {label}
            </label>
            <textarea
              value={block[key] || ''}
              onChange={(e) => updateField(key, e.target.value)}
              rows={rows}
              className="w-full text-sm text-slate-700 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>
        ))}

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">역량 태그</label>
          <div className="flex flex-wrap gap-1.5">
            {COMPETENCY_TAGS.map(tag => {
              const active = activeTagIds.has(tag.id)
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.label)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${
                    active
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  #{tag.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">경험 강도</label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => updateField('strength_score', n)}
                className={`text-lg ${n <= (block.strength_score || 3) ? 'text-amber-500' : 'text-slate-300'}`}
              >★</button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">AI 인사이트</label>
          <textarea
            value={block.ai_insight || ''}
            onChange={(e) => updateField('ai_insight', e.target.value)}
            rows={3}
            className="w-full text-sm text-slate-700 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-5">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
        >취소</button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
        >{saving ? '저장 중...' : '저장하기'}</button>
      </div>
    </div>
  )
}
