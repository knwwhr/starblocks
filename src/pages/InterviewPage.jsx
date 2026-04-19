import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { CATEGORIES } from '../config/categories'
import { createInterviewSession, buildApiMessages, parseBlockFromResponse, getDisplayText, buildBlockGenerationMessages, MAX_TURNS } from '../lib/interviewEngine'
import { sendMessage, UsageLimitError } from '../lib/aiClient'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../config/supabase'
import { recommendIndustries } from '../lib/coverLetterEngine'
import BlockPreview from '../components/BlockPreview'

const DRAFT_KEY = 'starblocks:interview_draft'

function CategorySelector({ onSelect, draft, onResume, onDiscard }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {draft && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-amber-900">진행 중이던 인터뷰가 있어요</div>
            <div className="text-xs text-amber-700 mt-0.5">
              {CATEGORIES.find(c => c.id === draft.category)?.label} · {draft.turnCount}턴 진행
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onDiscard}
              className="text-xs text-slate-500 px-3 py-1.5 hover:text-slate-700"
            >버리기</button>
            <button
              onClick={onResume}
              className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-amber-700"
            >이어하기</button>
          </div>
        </div>
      )}
      <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">어떤 경험을 정리해볼까요?</h1>
      <p className="text-sm text-slate-500 text-center mb-8">카테고리를 선택하면 AI 인터뷰가 시작됩니다.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className="bg-white border border-slate-200 rounded-xl p-4 hover:border-primary-400 hover:shadow-md transition-all text-center group"
          >
            <div className="text-3xl mb-2">{cat.emoji}</div>
            <div className="text-sm font-medium text-slate-800 group-hover:text-primary-700">{cat.label}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-slate-100 rounded-2xl rounded-bl-sm w-fit">
      <span className="typing-dot w-2 h-2 bg-slate-400 rounded-full" />
      <span className="typing-dot w-2 h-2 bg-slate-400 rounded-full" />
      <span className="typing-dot w-2 h-2 bg-slate-400 rounded-full" />
    </div>
  )
}

function ChatBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-primary-600 text-white rounded-br-sm'
            : 'bg-slate-100 text-slate-800 rounded-bl-sm'
        }`}
      >
        {message.displayContent || message.content}
      </div>
    </div>
  )
}

function ChatInterface({ session, onComplete }) {
  const [messages, setMessages] = useState(session.messages.map(m => ({ ...m, displayContent: m.content })))
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatingBlock, setGeneratingBlock] = useState(false)
  const [generatedBlock, setGeneratedBlock] = useState(null)
  const [turnCount, setTurnCount] = useState(session.turnCount)
  const [blockError, setBlockError] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Persist draft so the user can resume after refresh/navigation.
  useEffect(() => {
    if (generatedBlock) return // 블록 생성 완료 후엔 draft 유지 불필요 (완료 시 삭제)
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        category: session.category,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        turnCount,
        savedAt: Date.now(),
      }))
    } catch {}
  }, [messages, turnCount, session.category, generatedBlock])

  // 별도 API 호출로 블록 생성 (대화 컨텍스트 → 구조화된 JSON)
  const generateBlock = async (currentMessages) => {
    setGeneratingBlock(true)
    setBlockError(null)
    try {
      const blockSession = {
        ...session,
        messages: currentMessages.map(m => ({ role: m.role, content: m.content })),
      }
      const blockMessages = buildBlockGenerationMessages(blockSession)

      // 최대 2회 시도
      let block = null
      for (let i = 0; i < 2; i++) {
        const response = await sendMessage(blockMessages, { action: 'block_gen' })
        block = parseBlockFromResponse(response)
        if (block && block.title && block.situation) break
      }

      if (block) {
        setGeneratedBlock(block)
      } else {
        setBlockError('블록 생성에 실패했습니다. 다시 시도해주세요.')
      }
    } catch (err) {
      setBlockError(`오류: ${err.message}`)
    } finally {
      setGeneratingBlock(false)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (!loading) inputRef.current?.focus()
  }, [loading])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { role: 'user', content: text, displayContent: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const currentSession = {
        ...session,
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        turnCount,
      }
      const apiMessages = buildApiMessages(currentSession, text)
      const response = await sendMessage(apiMessages, { action: 'interview' })

      const inlineBlock = parseBlockFromResponse(response)
      const displayText = getDisplayText(response) || response

      const aiMsg = { role: 'assistant', content: response, displayContent: displayText }
      const updatedMessages = [...newMessages, aiMsg]
      setMessages(updatedMessages)
      const newTurnCount = turnCount + 1
      setTurnCount(newTurnCount)

      // 인라인 블록이 나왔으면 바로 사용
      if (inlineBlock && inlineBlock.title && inlineBlock.situation) {
        setGeneratedBlock(inlineBlock)
      } else if (newTurnCount >= MAX_TURNS) {
        // 마지막 턴이면 별도 API 호출로 블록 생성
        setLoading(false)
        await generateBlock(updatedMessages)
        return
      }
    } catch (err) {
      const errorMsg = {
        role: 'assistant',
        content: `오류가 발생했습니다: ${err.message}`,
        displayContent: `오류가 발생했습니다: ${err.message}`,
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (generatedBlock) {
    return (
      <BlockPreview
        block={generatedBlock}
        category={session.category}
        messages={messages}
        turnCount={turnCount}
        onSave={onComplete}
      />
    )
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">경험 인터뷰</h2>
            <p className="text-xs text-slate-400">
              {CATEGORIES.find(c => c.id === session.category)?.emoji}{' '}
              {CATEGORIES.find(c => c.id === session.category)?.label}
            </p>
          </div>
          <div className="text-xs text-slate-400">{turnCount}/{MAX_TURNS}턴</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <ChatBubble key={i} message={msg} />
        ))}
        {(loading || generatingBlock) && (
          <div className="flex justify-start">
            <TypingIndicator />
          </div>
        )}
        {generatingBlock && (
          <div className="flex justify-center">
            <div className="text-xs text-primary-600 bg-primary-50 px-3 py-1.5 rounded-full">
              ✨ 경험을 블록으로 정리하고 있어요...
            </div>
          </div>
        )}
        {blockError && (
          <div className="flex justify-center">
            <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {blockError}
              <button
                onClick={() => generateBlock(messages)}
                className="ml-2 underline font-medium"
              >
                다시 시도
              </button>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-slate-200 bg-white">
        {/* 턴 3 이상이면 수동 블록 생성 버튼 노출 */}
        {turnCount >= 3 && !generatingBlock && (
          <button
            onClick={() => generateBlock(messages)}
            disabled={loading}
            className="w-full mb-2 py-2 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 disabled:opacity-40 border border-amber-200"
          >
            ✨ 지금까지 내용으로 블록 만들기
          </button>
        )}
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={turnCount >= MAX_TURNS ? '대화가 끝났어요. 블록을 만들고 있습니다...' : '경험을 편하게 말해주세요...'}
            rows={1}
            disabled={loading || generatingBlock || turnCount >= MAX_TURNS}
            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-slate-50"
            style={{ minHeight: '42px', maxHeight: '120px' }}
            onInput={(e) => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || generatingBlock || !input.trim() || turnCount >= MAX_TURNS}
            className="px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            전송
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1.5 text-center">Enter로 전송, Shift+Enter로 줄바꿈</p>
      </div>
    </div>
  )
}

export default function InterviewPage() {
  const [session, setSession] = useState(null)
  const [draft, setDraft] = useState(null)
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed?.category && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
        setDraft(parsed)
      }
    } catch {}
  }, [])

  const handleCategorySelect = (categoryId) => {
    const newSession = createInterviewSession(categoryId)
    setSession(newSession)
  }

  const handleResume = () => {
    if (!draft) return
    setSession({
      category: draft.category,
      messages: draft.messages,
      status: 'in_progress',
      turnCount: draft.turnCount || 0,
    })
    setDraft(null)
  }

  const handleDiscardDraft = () => {
    localStorage.removeItem(DRAFT_KEY)
    setDraft(null)
  }

  const handleComplete = async (block, messages, turnCount, category) => {
    if (!user) {
      navigate('/dashboard')
      return
    }

    try {
      // Save block immediately (recommendIndustries는 저장 후 백그라운드)
      const { data: savedBlock, error: blockError } = await supabase
        .from('experience_blocks')
        .insert({
          user_id: user.id,
          category,
          title: block.title,
          situation: block.situation,
          action: block.action,
          result: block.result,
          lesson: block.lesson,
          tags: block.tags || [],
          recommended_questions: block.recommended_questions || [],
          strength_score: block.strength_score || 3,
          ai_insight: block.ai_insight,
          recommended_industries: {},
        })
        .select()
        .single()

      if (blockError) throw blockError

      // 백그라운드로 업종 추천 채워넣기 (사용자 흐름 차단하지 않음)
      recommendIndustries({ ...block, category })
        .then(rec => {
          if (!rec || (!rec.industries?.length && !rec.roles?.length)) return
          supabase
            .from('experience_blocks')
            .update({ recommended_industries: rec })
            .eq('id', savedBlock.id)
        })
        .catch(e => console.warn('Recommendation failed:', e))

      // Save interview session
      await supabase
        .from('interview_sessions')
        .insert({
          user_id: user.id,
          block_id: savedBlock.id,
          category,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          status: 'completed',
          turn_count: turnCount,
          completed_at: new Date().toISOString(),
        })

      // 저장 성공 시 draft 제거
      try { localStorage.removeItem(DRAFT_KEY) } catch {}

      navigate('/block-result', { state: { block: { ...savedBlock, category } } })
    } catch (err) {
      console.error('Save error:', err)
      if (err instanceof UsageLimitError) {
        toast.error(err.message + ' 프로 플랜으로 업그레이드해주세요.')
      } else {
        toast.error('저장 중 오류가 발생했습니다. 다시 시도해주세요.')
      }
    }
  }

  if (!session) {
    return (
      <CategorySelector
        onSelect={handleCategorySelect}
        draft={draft}
        onResume={handleResume}
        onDiscard={handleDiscardDraft}
      />
    )
  }

  return <ChatInterface session={session} onComplete={handleComplete} />
}
