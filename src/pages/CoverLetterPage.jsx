import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../config/supabase'
import { CATEGORIES } from '../config/categories'
import { parseJobPosting, matchBlocksToQuestions, generateAnswer } from '../lib/coverLetterEngine'

function JobPostingInput({ onAnalyze, loading }) {
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

  const handleAnalyze = async (rawText) => {
    if (!rawText.trim()) return
    setAnalyzing(true)

    try {
      // 1. 공고 파싱
      const parsed = await parseJobPosting(rawText)
      setJobInfo(parsed)
      setQuestions(parsed.questions || [])

      // 2. 블록이 있으면 매칭
      if (blocks.length > 0 && parsed.questions?.length > 0) {
        const matches = await matchBlocksToQuestions(parsed.questions, blocks, parsed.requirements)
        setMatchResult(matches)
      } else {
        setMatchResult({ matches: [], overallFit: 0, missingAreas: ['경험 블록을 먼저 만들어주세요'] })
      }

      setPhase('result')
    } catch (err) {
      console.error('Analyze error:', err)
      alert('공고 분석에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleReset = () => {
    setPhase('input')
    setJobInfo(null)
    setQuestions([])
    setMatchResult(null)
  }

  if (phase === 'input') {
    return <JobPostingInput onAnalyze={handleAnalyze} loading={analyzing} />
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
