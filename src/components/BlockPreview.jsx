import { useState } from 'react'
import { CATEGORIES } from '../config/categories'

export default function BlockPreview({ block, category, messages, turnCount, onSave }) {
  const [editing, setEditing] = useState(false)
  const [editedBlock, setEditedBlock] = useState({ ...block })
  const [saving, setSaving] = useState(false)

  const cat = CATEGORIES.find(c => c.id === category)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(editedBlock, messages, turnCount, category)
    } catch {
      setSaving(false)
    }
  }

  const updateField = (field, value) => {
    setEditedBlock(prev => ({ ...prev, [field]: value }))
  }

  const strengthStars = (score) => {
    return Array.from({ length: 5 }, (_, i) =>
      i < score ? '\u2605' : '\u2606'
    ).join('')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">✨</div>
        <h1 className="text-xl font-bold text-slate-900">경험 블록이 완성되었습니다!</h1>
        <p className="text-sm text-slate-500 mt-1">내용을 확인하고 저장하세요. 수정도 가능합니다.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{cat?.emoji}</span>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {cat?.label}
            </span>
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            {editing ? '미리보기' : '수정하기'}
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            {editing ? (
              <input
                value={editedBlock.title}
                onChange={(e) => updateField('title', e.target.value)}
                className="w-full text-lg font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            ) : (
              <h2 className="text-lg font-bold text-slate-900">{editedBlock.title}</h2>
            )}
          </div>

          {/* STAR Fields */}
          {[
            { key: 'situation', label: '상황 (Situation)', icon: '📍' },
            { key: 'action', label: '행동 (Action)', icon: '⚡' },
            { key: 'result', label: '결과 (Result)', icon: '🎯' },
            { key: 'lesson', label: '배운점 (Takeaway)', icon: '💡' },
          ].map(({ key, label, icon }) => (
            <div key={key}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{icon}</span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</span>
              </div>
              {editing ? (
                <textarea
                  value={editedBlock[key] || ''}
                  onChange={(e) => updateField(key, e.target.value)}
                  rows={key === 'lesson' ? 2 : 3}
                  className="w-full text-sm text-slate-700 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              ) : (
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {editedBlock[key]}
                </p>
              )}
            </div>
          ))}

          {/* Tags */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">태그</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {editedBlock.tags?.map((tag, i) => (
                <span key={i} className="text-xs bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Recommended questions */}
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">추천 활용 문항</div>
            <div className="flex flex-wrap gap-1.5">
              {editedBlock.recommended_questions?.map((q, i) => (
                <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                  {q}
                </span>
              ))}
            </div>
          </div>

          {/* Strength + AI Insight */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-700">경험 강도</span>
              <span className="text-sm text-amber-600">{strengthStars(editedBlock.strength_score)}</span>
            </div>
            <div className="text-xs font-bold text-amber-700 mb-1">AI 인사이트</div>
            <p className="text-sm text-amber-900 leading-relaxed">{editedBlock.ai_insight}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '블록 저장하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
