import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2, FileText, Building2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { listCoverLetters, deleteCoverLetter } from '../lib/coverLetterStore'
import { Card } from '../components/ui/Card'

export default function CoverLetterListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [letters, setLetters] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    listCoverLetters(user.id)
      .then(rows => {
        if (cancelled) return
        if (rows.length === 0) {
          navigate('/cover-letter/new', { replace: true })
          return
        }
        setLetters(rows)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        toast.error('자소서 이력을 불러오지 못했습니다.')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [user, navigate, toast])

  const handleDelete = async (id, e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('이 자소서를 삭제할까요?')) return
    try {
      await deleteCoverLetter(id)
      setLetters(prev => prev.filter(l => l.id !== id))
      toast.success('삭제했습니다.')
    } catch (err) {
      console.error(err)
      toast.error('삭제에 실패했습니다.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-slate-400">불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">자소서 이력</h1>
          <p className="text-sm text-slate-500">{letters.length}개의 작업물</p>
        </div>
        <Link
          to="/cover-letter/new"
          className="inline-flex items-center gap-1.5 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 no-underline shadow-sm"
        >
          <Plus size={14} strokeWidth={2.5} />
          새 자소서 쓰기
        </Link>
      </div>

      <div className="space-y-3">
        {letters.map(l => {
          const questionCount = Array.isArray(l.questions) ? l.questions.length : 0
          return (
            <Link
              key={l.id}
              to={`/cover-letter/${l.id}`}
              className="block no-underline"
            >
              <Card hoverable className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <Building2 size={12} strokeWidth={2} />
                      <span className="font-medium">{l.company || '회사 미지정'}</span>
                      {l.position && <span className="text-slate-400">· {l.position}</span>}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {l.company || '제목 없음'}
                      {l.position ? ` — ${l.position}` : ''}
                    </h3>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <FileText size={11} strokeWidth={2} />
                        {questionCount}개 문항
                      </span>
                      <span>
                        {new Date(l.updated_at).toLocaleDateString('ko-KR')} 수정
                      </span>
                      {l.status === 'completed' && (
                        <span className="text-emerald-600 font-medium">완료</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(l.id, e)}
                    className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-md shrink-0"
                    aria-label="삭제"
                  >
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
