import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../config/supabase'
import { CATEGORIES } from '../config/categories'
import { parseJobPosting, matchBlocksToQuestions, generateAnswer, DEFAULT_QUESTIONS, TONE_OPTIONS, EMPHASIS_OPTIONS } from '../lib/coverLetterEngine'
import { UsageLimitError } from '../lib/aiClient'
import { useToast } from '../contexts/ToastContext'
import {
  createCoverLetter,
  updateCoverLetter,
  getCoverLetter,
  listAnswers,
  updateActiveAnswer,
  insertAnswerVersion,
} from '../lib/coverLetterStore'

function JobPostingInput({ onAnalyze, loading, error }) {
  const [rawText, setRawText] = useState('')

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">자소서 쓰기</h1>
        <p className="text-sm text-slate-500">
          지원하려는 공고를 붙여넣어주세요.<br />
          정리 안 돼도 괜찮아요. AI가 알아서 분석합니다.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={`예시:\n삼성전자 DX부문 SW개발\n\n[자기소개서 항목]\n1. 팀워크를 발휘한 경험 (500자)\n2. 도전적인 목표를 달성한 경험 (500자)\n3. 직무 관련 역량 및 경험 (800자)\n\n[우대사항]\nPython, 데이터분석 경험, 협업 도구 활용...`}
          rows={12}
          disabled={loading}
          className="w-full text-sm text-slate-700 resize-none focus:outline-none placeholder:text-slate-300 leading-relaxed disabled:bg-slate-50"
        />
      </div>

      {error && (
        <div className="mb-3 bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        onClick={() => onAnalyze(rawText)}
        disabled={!rawText.trim() || loading}
        className="w-full py-3.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            AI가 공고를 분석하고 있어요...
          </>
        ) : (
          'AI가 분석하기'
        )}
      </button>
    </div>
  )
}

function ManualQuestionsInput({ jobInfo, onUseDefault, onUseCustom, onBack, loading }) {
  const [customQs, setCustomQs] = useState([{ text: '', charLimit: 500 }])

  const addQ = () => setCustomQs([...customQs, { text: '', charLimit: 500 }])
  const updateQ = (i, field, value) => {
    const updated = [...customQs]
    updated[i] = { ...updated[i], [field]: field === 'charLimit' ? (parseInt(value) || null) : value }
    setCustomQs(updated)
  }
  const removeQ = (i) => setCustomQs(customQs.filter((_, idx) => idx !== i))

  const validCustom = customQs.filter(q => q.text.trim())

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      <button onClick={onBack} className="text-xs text-slate-400 hover:text-slate-600 mb-3 block">&larr; 다시 입력</button>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 mb-1">
          {jobInfo?.company || '공고'} 분석 완료
        </h1>
        <p className="text-sm text-slate-500">
          이 공고에는 자소서 문항이 명시되어 있지 않아요. 어떻게 할까요?
        </p>
      </div>

      {jobInfo?.keywords?.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
          <div className="text-xs font-bold text-slate-500 mb-2">공고에서 추출한 핵심 키워드</div>
          <div className="flex flex-wrap gap-1.5">
            {jobInfo.keywords.map((kw, i) => (
              <span key={i} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{kw}</span>
            ))}
          </div>
        </div>
      )}

      {/* Option 1: 기본 문항 */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
        <h3 className="text-sm font-bold text-slate-900 mb-2">옵션 1. 일반적인 자소서 문항 사용</h3>
        <p className="text-xs text-slate-500 mb-3">대부분의 기업에서 공통으로 쓰는 4가지 문항으로 자소서를 만들어드려요.</p>
        <ul className="text-xs text-slate-600 space-y-1 mb-4 bg-slate-50 rounded-lg p-3">
          {DEFAULT_QUESTIONS.map((q, i) => (
            <li key={i}>• {q.text} ({q.charLimit}자)</li>
          ))}
        </ul>
        <button
          onClick={onUseDefault}
          disabled={loading}
          className="w-full py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-40"
        >
          {loading ? '블록 매칭 중...' : '이 문항으로 진행하기'}
        </button>
      </div>

      {/* Option 2: 직접 입력 */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-2">옵션 2. 문항 직접 입력</h3>
        <p className="text-xs text-slate-500 mb-3">채용 페이지에 있는 자소서 문항을 직접 입력하세요.</p>

        <div className="space-y-3 mb-3">
          {customQs.map((q, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500">문항 {i + 1}</span>
                {customQs.length > 1 && (
                  <button onClick={() => removeQ(i)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
                )}
              </div>
              <textarea
                value={q.text}
                onChange={(e) => updateQ(i, 'text', e.target.value)}
                placeholder="예: 팀워크를 발휘한 경험을 서술하시오"
                rows={2}
                className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary-500 mb-2"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">글자수 제한</span>
                <input
                  type="number"
                  value={q.charLimit || ''}
                  onChange={(e) => updateQ(i, 'charLimit', e.target.value)}
                  placeholder="500"
                  className="w-20 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <span className="text-xs text-slate-400">자</span>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addQ}
          className="w-full py-2 text-xs text-slate-500 border border-dashed border-slate-300 rounded-lg hover:bg-slate-50 mb-3"
        >
          + 문항 추가
        </button>

        <button
          onClick={() => onUseCustom(validCustom)}
          disabled={validCustom.length === 0 || loading}
          className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-40"
        >
          {loading ? '블록 매칭 중...' : `${validCustom.length}개 문항으로 진행하기`}
        </button>
      </div>
    </div>
  )
}

function QuestionCard({ index, question, match, block, allBlocks, answer, generating, onGenerate, onEditAnswer, onChangeBlock }) {
  const [editing, setEditing] = useState(false)
  const [tone, setTone] = useState(answer?.generationOptions?.tone || 'default')
  const [emphasis, setEmphasis] = useState(answer?.generationOptions?.emphasis || 'balanced')
  const cat = block ? CATEGORIES.find(c => c.id === block.category) : null
  const charLimit = question.charLimit || 500

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* 문항 헤더 */}
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700">문항 {index + 1}</h3>
          {question.charLimit && (
            <span className="text-xs text-slate-400">{question.charLimit}자</span>
          )}
        </div>
        <p className="text-sm text-slate-600 mt-1">{question.text}</p>
      </div>

      <div className="p-5">
        {/* 매칭된 블록 + 변경 드롭다운 */}
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs text-slate-400">사용 블록</span>
            <select
              value={block?.id || ''}
              onChange={(e) => onChangeBlock(index, e.target.value || null)}
              className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 max-w-[60%]"
            >
              <option value="">— 블록 선택 안 함 —</option>
              {allBlocks.map(b => {
                const bcat = CATEGORIES.find(c => c.id === b.category)
                return (
                  <option key={b.id} value={b.id}>
                    {bcat?.emoji} {b.title}
                  </option>
                )
              })}
            </select>
          </div>
          {block ? (
            <div className="flex items-center gap-2">
              <span className="text-sm">{cat?.emoji}</span>
              <span className="text-xs font-medium text-slate-700">{block.title}</span>
              {match?.reason && !answer && (
                <span className="text-xs text-slate-400 truncate">· {match.reason}</span>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-100 mt-1">
              <p className="text-sm text-amber-700 mb-2">사용할 블록이 선택되지 않았습니다</p>
              <Link
                to="/interview"
                className="text-xs text-primary-600 font-medium hover:text-primary-700 no-underline"
              >
                이 문항에 쓸 블록 만들러 가기 &rarr;
              </Link>
            </div>
          )}
        </div>

        {/* 톤/강조 옵션 — 블록 있을 때만 */}
        {block && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs text-slate-400 block mb-1">톤</span>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {TONE_OPTIONS.map(o => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-slate-400 block mb-1">강조</span>
              <select
                value={emphasis}
                onChange={(e) => setEmphasis(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {EMPHASIS_OPTIONS.map(o => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {/* 자소서 답변 */}
        {answer ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400">자소서 답변</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditing(!editing)}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  {editing ? '미리보기' : '수정하기'}
                </button>
                {block && (
                  <button
                    onClick={() => onGenerate(index, { tone, emphasis })}
                    disabled={generating}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium disabled:opacity-40"
                  >
                    {generating ? '재생성 중...' : '다시 생성'}
                  </button>
                )}
              </div>
            </div>
            {editing ? (
              <textarea
                value={answer.answer}
                onChange={(e) => onEditAnswer(index, { ...answer, answer: e.target.value, charCount: e.target.value.length })}
                rows={8}
                className="w-full text-sm text-slate-700 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none leading-relaxed"
              />
            ) : (
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{answer.answer}</p>
            )}
            <div className="flex items-center justify-between mt-2">
              <div className="flex flex-wrap gap-1">
                {answer.usedKeywords?.map((kw, i) => (
                  <span key={i} className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">{kw}</span>
                ))}
              </div>
              <span className={`text-xs font-medium ${answer.charCount > charLimit ? 'text-red-500' : 'text-slate-400'}`}>
                {answer.charCount} / {charLimit}자
              </span>
            </div>
          </div>
        ) : block ? (
          <button
            onClick={() => onGenerate(index, { tone, emphasis })}
            disabled={generating}
            className="w-full py-2.5 bg-primary-50 text-primary-600 rounded-lg text-sm font-medium hover:bg-primary-100 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                작성 중...
              </>
            ) : (
              '이 블록으로 답변 생성하기'
            )}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function CoverLetterResult({ jobInfo, questions, matchResult: initialMatchResult, blocks, onReset, coverLetterId, initialAnswers = {} }) {
  const [answers, setAnswers] = useState(initialAnswers)
  const [matchResult, setMatchResult] = useState(initialMatchResult)
  const [generatingIndex, setGeneratingIndex] = useState(null)
  const [generatingAll, setGeneratingAll] = useState(false)
  const toast = useToast()
  const saveTimers = useRef({})

  // 인라인 편집 자동 저장 (디바운스, 활성 행 in-place 갱신)
  const persistAnswer = (questionIndex, payload) => {
    if (!coverLetterId) return
    clearTimeout(saveTimers.current[questionIndex])
    saveTimers.current[questionIndex] = setTimeout(() => {
      updateActiveAnswer(coverLetterId, questionIndex, payload).catch(err => {
        console.error('Save answer failed:', err)
      })
    }, 600)
  }

  // 블록 매칭 변경 — matchResult patch + DB 동기화
  const handleChangeBlock = async (questionIndex, newBlockId) => {
    setMatchResult(prev => {
      const matches = Array.isArray(prev?.matches) ? [...prev.matches] : []
      const existingIdx = matches.findIndex(m => m.questionIndex === questionIndex)
      const next = { questionIndex, blockId: newBlockId, reason: '수동 선택' }
      if (existingIdx >= 0) matches[existingIdx] = { ...matches[existingIdx], ...next }
      else matches.push(next)
      const updated = { ...(prev || { overallFit: 0, missingAreas: [] }), matches }
      if (coverLetterId) {
        updateCoverLetter(coverLetterId, { matchResult: updated }).catch(err =>
          console.error('Match save failed:', err)
        )
      }
      return updated
    })
  }

  const getMatchedBlock = (questionIndex) => {
    const match = matchResult.matches?.find(m => m.questionIndex === questionIndex)
    if (!match?.blockId) return null
    return blocks.find(b => b.id === match.blockId)
  }

  const getMatch = (questionIndex) => {
    return matchResult.matches?.find(m => m.questionIndex === questionIndex)
  }

  const handleGenerate = async (questionIndex, options = {}) => {
    const block = getMatchedBlock(questionIndex)
    if (!block) return

    setGeneratingIndex(questionIndex)
    try {
      const result = await generateAnswer(questions[questionIndex], block, jobInfo, {
        ...options,
        coverLetterId,
        questionIndex,
      })
      setAnswers(prev => ({ ...prev, [questionIndex]: result }))
      // 생성/재생성은 버전 누적 (이전 답변은 inactive로 보존)
      if (coverLetterId) {
        try {
          await insertAnswerVersion(coverLetterId, questionIndex, {
            blockId: block.id,
            answer: result.answer,
            usedKeywords: result.usedKeywords,
            charCount: result.charCount,
            generationOptions: result.generationOptions,
          })
        } catch (e) {
          console.error('Version save failed:', e)
        }
      }
    } catch (err) {
      console.error('Generate error:', err)
      if (err instanceof UsageLimitError) {
        toast.error(err.message)
      } else {
        toast.error('자소서 생성에 실패했습니다. 잠시 후 다시 시도해주세요.')
      }
    } finally {
      setGeneratingIndex(null)
    }
  }

  const handleGenerateAll = async () => {
    setGeneratingAll(true)
    const tasks = questions
      .map((q, i) => ({ q, i, block: getMatchedBlock(i) }))
      .filter(({ i, block }) => block && !answers[i])

    const results = await Promise.allSettled(
      tasks.map(({ q, i, block }) => generateAnswer(q, block, jobInfo, { coverLetterId, questionIndex: i }))
    )

    let limitHit = false
    let failures = 0
    setAnswers(prev => {
      const next = { ...prev }
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          const qi = tasks[idx].i
          next[qi] = r.value
          if (coverLetterId) {
            insertAnswerVersion(coverLetterId, qi, {
              blockId: tasks[idx].block.id,
              answer: r.value.answer,
              usedKeywords: r.value.usedKeywords,
              charCount: r.value.charCount,
              generationOptions: r.value.generationOptions,
            }).catch(e => console.error('Version save failed:', e))
          }
        } else {
          if (r.reason instanceof UsageLimitError) limitHit = r.reason
          else failures++
          console.error(`Generate error for question ${tasks[idx].i}:`, r.reason)
        }
      })
      return next
    })
    if (limitHit) toast.error(limitHit.message)
    else if (failures > 0) toast.error(`${failures}개 문항 생성에 실패했습니다.`)
    setGeneratingAll(false)
  }

  const handleEditAnswer = (index, newAnswer) => {
    setAnswers(prev => ({ ...prev, [index]: newAnswer }))
    const block = getMatchedBlock(index)
    persistAnswer(index, {
      blockId: block?.id,
      answer: newAnswer.answer,
      usedKeywords: newAnswer.usedKeywords,
      charCount: newAnswer.charCount,
    })
  }

  const handleCopyAll = () => {
    const text = questions.map((q, i) => {
      const ans = answers[i]
      return `[문항 ${i + 1}] ${q.text}\n\n${ans?.answer || '(미작성)'}`
    }).join('\n\n---\n\n')
    navigator.clipboard.writeText(text)
    toast.success('자소서 전체가 클립보드에 복사되었습니다.')
  }

  const answeredCount = Object.keys(answers).length
  const matchableCount = matchResult.matches?.filter(m => m.blockId).length || 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      {/* 헤더 */}
      <div className="mb-6">
        <button onClick={onReset} className="text-xs text-slate-400 hover:text-slate-600 mb-3 block">&larr; 이력으로 돌아가기</button>
        <h1 className="text-xl font-bold text-slate-900">
          {jobInfo.company || '회사'} {jobInfo.position && `- ${jobInfo.position}`}
        </h1>
      </div>

      {/* AI 분석 요약 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <h3 className="text-sm font-bold text-slate-900 mb-3">AI 분석 요약</h3>
        <div className="flex items-center gap-4 mb-3">
          <div>
            <span className="text-xs text-slate-500">매칭도</span>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-32 bg-slate-100 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${matchResult.overallFit || 0}%` }}
                />
              </div>
              <span className="text-sm font-bold text-primary-600">{matchResult.overallFit || 0}%</span>
            </div>
          </div>
          <div className="text-center">
            <span className="text-xs text-slate-500">문항</span>
            <div className="text-sm font-bold text-slate-700">{questions.length}개</div>
          </div>
          <div className="text-center">
            <span className="text-xs text-slate-500">매칭 블록</span>
            <div className="text-sm font-bold text-green-600">{matchableCount}개</div>
          </div>
        </div>

        {jobInfo.keywords?.length > 0 && (
          <div>
            <span className="text-xs text-slate-400">공고 핵심 키워드</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {jobInfo.keywords.map((kw, i) => (
                <span key={i} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{kw}</span>
              ))}
            </div>
          </div>
        )}

        {matchResult.missingAreas?.length > 0 && (
          <div className="mt-3 bg-amber-50 rounded-lg p-3 border border-amber-100">
            <span className="text-xs font-medium text-amber-700">부족한 영역: </span>
            <span className="text-xs text-amber-600">{matchResult.missingAreas.join(', ')}</span>
          </div>
        )}
      </div>

      {/* 전체 생성 버튼 */}
      {matchableCount > 0 && answeredCount < matchableCount && (
        <button
          onClick={handleGenerateAll}
          disabled={generatingAll}
          className="w-full py-3 mb-4 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {generatingAll ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              자소서 생성 중... ({answeredCount}/{matchableCount})
            </>
          ) : (
            `전체 문항 한번에 생성하기 (${matchableCount}문항)`
          )}
        </button>
      )}

      {/* 문항별 카드 */}
      <div className="space-y-4 mb-8">
        {questions.map((q, i) => (
          <QuestionCard
            key={i}
            index={i}
            question={q}
            match={getMatch(i)}
            block={getMatchedBlock(i)}
            allBlocks={blocks}
            answer={answers[i]}
            generating={generatingIndex === i}
            onGenerate={handleGenerate}
            onEditAnswer={handleEditAnswer}
            onChangeBlock={handleChangeBlock}
          />
        ))}
      </div>

      {/* 하단 액션 */}
      {answeredCount > 0 && (
        <div className="sticky bottom-4">
          <button
            onClick={handleCopyAll}
            className="w-full py-3.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 shadow-lg flex items-center justify-center gap-2"
          >
            전체 복사하기
          </button>
        </div>
      )}
    </div>
  )
}

export default function CoverLetterPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id: routeId } = useParams() // /cover-letter/:id 또는 undefined(새)
  const toast = useToast()

  const [blocks, setBlocks] = useState([])
  const [phase, setPhase] = useState(routeId ? 'loading' : 'input') // loading | input | manual | result
  const [analyzing, setAnalyzing] = useState(false)
  const [jobInfo, setJobInfo] = useState(null)
  const [jobPostingRaw, setJobPostingRaw] = useState('')
  const [questions, setQuestions] = useState([])
  const [matchResult, setMatchResult] = useState(null)
  const [analyzeError, setAnalyzeError] = useState(null)
  const [coverLetterId, setCoverLetterId] = useState(null)
  const [initialAnswers, setInitialAnswers] = useState({})

  useEffect(() => {
    if (user) loadBlocks()
  }, [user])

  // /cover-letter/:id 진입 시 기존 작업물 로드
  useEffect(() => {
    if (!routeId || !user) return
    let cancelled = false
    Promise.all([getCoverLetter(routeId), listAnswers(routeId)])
      .then(([letter, answerRows]) => {
        if (cancelled) return
        if (letter.user_id !== user.id) {
          toast.error('접근 권한이 없습니다.')
          navigate('/cover-letter', { replace: true })
          return
        }
        setCoverLetterId(letter.id)
        setJobInfo(letter.job_info)
        setJobPostingRaw(letter.job_posting_raw || '')
        setQuestions(letter.questions || [])
        setMatchResult(letter.match_result)
        const answersByIndex = {}
        answerRows.forEach(r => {
          answersByIndex[r.question_index] = {
            answer: r.answer,
            usedKeywords: r.used_keywords || [],
            charCount: r.char_count ?? (r.answer || '').length,
          }
        })
        setInitialAnswers(answersByIndex)
        setPhase('result')
      })
      .catch(err => {
        console.error(err)
        toast.error('자소서를 불러오지 못했습니다.')
        navigate('/cover-letter', { replace: true })
      })
    return () => { cancelled = true }
  }, [routeId, user, navigate, toast])

  const loadBlocks = async () => {
    const { data } = await supabase
      .from('experience_blocks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setBlocks(data || [])
  }

  const runMatching = async (jobData, questionList) => {
    if (blocks.length > 0 && questionList.length > 0) {
      try {
        const matches = await matchBlocksToQuestions(questionList, blocks, jobData.requirements)
        return matches
      } catch (err) {
        console.error('Match error:', err)
        return { matches: [], overallFit: 0, missingAreas: ['매칭 실패 — 블록을 수동 선택해주세요'] }
      }
    }
    return {
      matches: [],
      overallFit: 0,
      missingAreas: blocks.length === 0 ? ['경험 블록을 먼저 만들어주세요'] : ['문항을 추가해주세요'],
    }
  }

  // result 단계 진입 = DB row 생성 후 /:id로 라우팅 (자동 저장 활성화)
  const enterResultPhase = async (jobData, questionList, rawText) => {
    const match = await runMatching(jobData, questionList)
    try {
      const created = await createCoverLetter(user.id, {
        jobInfo: jobData,
        jobPostingRaw: rawText,
        questions: questionList,
        matchResult: match,
      })
      navigate(`/cover-letter/${created.id}`, { replace: true })
    } catch (err) {
      console.error('Create cover letter failed:', err)
      // DB 저장 실패해도 사용자 경험은 보존 (메모리 모드)
      setMatchResult(match)
      setPhase('result')
      toast.error('이력 저장에 실패했지만 작업은 계속할 수 있어요.')
    }
  }

  const handleAnalyze = async (rawText) => {
    if (!rawText.trim()) return
    setAnalyzing(true)
    setAnalyzeError(null)
    setJobPostingRaw(rawText)

    try {
      const parsed = await parseJobPosting(rawText)
      setJobInfo(parsed)

      if (!parsed.questions || parsed.questions.length === 0) {
        setQuestions([])
        setPhase('manual')
        setAnalyzing(false)
      } else {
        setQuestions(parsed.questions)
        await enterResultPhase(parsed, parsed.questions, rawText)
        setAnalyzing(false)
      }
    } catch (err) {
      console.error('Analyze error:', err)
      setAnalyzeError(err.message || '공고 분석에 실패했습니다.')
      setAnalyzing(false)
    }
  }

  const handleUseDefaultQuestions = async () => {
    setAnalyzing(true)
    setQuestions(DEFAULT_QUESTIONS)
    await enterResultPhase(jobInfo, DEFAULT_QUESTIONS, jobPostingRaw)
    setAnalyzing(false)
  }

  const handleUseCustomQuestions = async (customQs) => {
    setAnalyzing(true)
    setQuestions(customQs)
    await enterResultPhase(jobInfo, customQs, jobPostingRaw)
    setAnalyzing(false)
  }

  const handleReset = () => {
    navigate('/cover-letter')
  }

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-slate-400">불러오는 중...</div>
      </div>
    )
  }

  if (phase === 'input') {
    return <JobPostingInput onAnalyze={handleAnalyze} loading={analyzing} error={analyzeError} />
  }

  if (phase === 'manual') {
    return (
      <ManualQuestionsInput
        jobInfo={jobInfo}
        onUseDefault={handleUseDefaultQuestions}
        onUseCustom={handleUseCustomQuestions}
        onBack={() => setPhase('input')}
        loading={analyzing}
      />
    )
  }

  return (
    <CoverLetterResult
      jobInfo={jobInfo}
      questions={questions}
      matchResult={matchResult}
      blocks={blocks}
      onReset={handleReset}
      coverLetterId={coverLetterId}
      initialAnswers={initialAnswers}
    />
  )
}
