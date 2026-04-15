import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../config/supabase'
import { CATEGORIES } from '../config/categories'
import { parseJobPosting, matchBlocksToQuestions, generateAnswer, DEFAULT_QUESTIONS } from '../lib/coverLetterEngine'

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

function QuestionCard({ index, question, match, block, answer, generating, onGenerate, onEditAnswer }) {
  const [editing, setEditing] = useState(false)
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
        {/* 매칭된 블록 */}
        {block ? (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-slate-400">사용 블록</span>
              <span className="text-sm">{cat?.emoji}</span>
              <span className="text-xs font-medium text-slate-700">{block.title}</span>
            </div>
            {match?.reason && (
              <p className="text-xs text-slate-400">{match.reason}</p>
            )}
          </div>
        ) : (
          <div className="mb-4 bg-amber-50 rounded-lg p-3 border border-amber-100">
            <p className="text-sm text-amber-700 mb-2">매칭 가능한 블록이 없습니다</p>
            <Link
              to="/interview"
              className="text-xs text-primary-600 font-medium hover:text-primary-700 no-underline"
            >
              이 문항에 쓸 블록 만들러 가기 &rarr;
            </Link>
          </div>
        )}

        {/* 자소서 답변 */}
        {answer ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400">자소서 답변</span>
              <button
                onClick={() => setEditing(!editing)}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                {editing ? '미리보기' : '수정하기'}
              </button>
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
            onClick={() => onGenerate(index)}
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

function CoverLetterResult({ jobInfo, questions, matchResult, blocks, onReset }) {
  const [answers, setAnswers] = useState({})
  const [generatingIndex, setGeneratingIndex] = useState(null)
  const [generatingAll, setGeneratingAll] = useState(false)

  const getMatchedBlock = (questionIndex) => {
    const match = matchResult.matches?.find(m => m.questionIndex === questionIndex)
    if (!match?.blockId) return null
    return blocks.find(b => b.id === match.blockId)
  }

  const getMatch = (questionIndex) => {
    return matchResult.matches?.find(m => m.questionIndex === questionIndex)
  }

  const handleGenerate = async (questionIndex) => {
    const block = getMatchedBlock(questionIndex)
    if (!block) return

    setGeneratingIndex(questionIndex)
    try {
      const result = await generateAnswer(questions[questionIndex], block, jobInfo)
      setAnswers(prev => ({ ...prev, [questionIndex]: result }))
    } catch (err) {
      console.error('Generate error:', err)
    } finally {
      setGeneratingIndex(null)
    }
  }

  const handleGenerateAll = async () => {
    setGeneratingAll(true)
    for (let i = 0; i < questions.length; i++) {
      const block = getMatchedBlock(i)
      if (block && !answers[i]) {
        setGeneratingIndex(i)
        try {
          const result = await generateAnswer(questions[i], block, jobInfo)
          setAnswers(prev => ({ ...prev, [i]: result }))
        } catch (err) {
          console.error(`Generate error for question ${i}:`, err)
        }
        setGeneratingIndex(null)
      }
    }
    setGeneratingAll(false)
  }

  const handleEditAnswer = (index, newAnswer) => {
    setAnswers(prev => ({ ...prev, [index]: newAnswer }))
  }

  const handleCopyAll = () => {
    const text = questions.map((q, i) => {
      const ans = answers[i]
      return `[문항 ${i + 1}] ${q.text}\n\n${ans?.answer || '(미작성)'}`
    }).join('\n\n---\n\n')
    navigator.clipboard.writeText(text)
  }

  const answeredCount = Object.keys(answers).length
  const matchableCount = matchResult.matches?.filter(m => m.blockId).length || 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      {/* 헤더 */}
      <div className="mb-6">
        <button onClick={onReset} className="text-xs text-slate-400 hover:text-slate-600 mb-3 block">&larr; 다른 공고로 쓰기</button>
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
            answer={answers[i]}
            generating={generatingIndex === i}
            onGenerate={handleGenerate}
            onEditAnswer={handleEditAnswer}
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
  const [blocks, setBlocks] = useState([])
  const [phase, setPhase] = useState('input') // input | result
  const [analyzing, setAnalyzing] = useState(false)
  const [jobInfo, setJobInfo] = useState(null)
  const [questions, setQuestions] = useState([])
  const [matchResult, setMatchResult] = useState(null)
  const [analyzeError, setAnalyzeError] = useState(null)
  const [needsManualQuestions, setNeedsManualQuestions] = useState(false)

  useEffect(() => {
    if (user) loadBlocks()
  }, [user])

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
        setMatchResult(matches)
      } catch (err) {
        console.error('Match error:', err)
        setMatchResult({ matches: [], overallFit: 0, missingAreas: ['매칭 실패 — 블록을 수동 선택해주세요'] })
      }
    } else {
      setMatchResult({
        matches: [],
        overallFit: 0,
        missingAreas: blocks.length === 0 ? ['경험 블록을 먼저 만들어주세요'] : ['문항을 추가해주세요'],
      })
    }
  }

  const handleAnalyze = async (rawText) => {
    if (!rawText.trim()) return
    setAnalyzing(true)
    setAnalyzeError(null)
    setNeedsManualQuestions(false)

    try {
      const parsed = await parseJobPosting(rawText)
      setJobInfo(parsed)

      if (!parsed.questions || parsed.questions.length === 0) {
        // 공고에 자소서 문항이 없으면 수동 단계로 진입
        setQuestions([])
        setNeedsManualQuestions(true)
        setPhase('manual')
      } else {
        setQuestions(parsed.questions)
        await runMatching(parsed, parsed.questions)
        setPhase('result')
      }
    } catch (err) {
      console.error('Analyze error:', err)
      setAnalyzeError(err.message || '공고 분석에 실패했습니다.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleUseDefaultQuestions = async () => {
    const qs = DEFAULT_QUESTIONS
    setQuestions(qs)
    setAnalyzing(true)
    await runMatching(jobInfo, qs)
    setAnalyzing(false)
    setPhase('result')
  }

  const handleUseCustomQuestions = async (customQs) => {
    setQuestions(customQs)
    setAnalyzing(true)
    await runMatching(jobInfo, customQs)
    setAnalyzing(false)
    setPhase('result')
  }

  const handleReset = () => {
    setPhase('input')
    setJobInfo(null)
    setQuestions([])
    setMatchResult(null)
    setAnalyzeError(null)
    setNeedsManualQuestions(false)
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
        onBack={handleReset}
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
    />
  )
}
