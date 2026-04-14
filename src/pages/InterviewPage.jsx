import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { CATEGORIES } from '../config/categories'
import { createInterviewSession, buildApiMessages, parseBlockFromResponse, getDisplayText, MAX_TURNS } from '../lib/interviewEngine'
import { sendMessage } from '../lib/aiClient'
import { supabase } from '../config/supabase'
import BlockPreview from '../components/BlockPreview'

function CategorySelector({ onSelect }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
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
  const [generatedBlock, setGeneratedBlock] = useState(null)
  const [turnCount, setTurnCount] = useState(session.turnCount)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

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
      const response = await sendMessage(apiMessages)

      let block = parseBlockFromResponse(response)
      const displayText = getDisplayText(response)

      const aiMsg = { role: 'assistant', content: response, displayContent: displayText }
      const updatedMessages = [...newMessages, aiMsg]
      setMessages(updatedMessages)
      const newTurnCount = turnCount + 1
      setTurnCount(newTurnCount)

      // 마지막 턴인데 블록이 안 나왔으면 강제 재요청
      if (!block && newTurnCount >= MAX_TURNS) {
        const retrySession = {
          ...session,
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          turnCount: newTurnCount,
        }
        const retryMessages = buildApiMessages(retrySession, '지금까지 내용으로 블록을 만들어주세요.')
        const retryResponse = await sendMessage(retryMessages)
        block = parseBlockFromResponse(retryResponse)

        if (block) {
          const retryDisplay = getDisplayText(retryResponse)
          setMessages(prev => [
            ...prev,
            { role: 'user', content: '지금까지 내용으로 블록을 만들어주세요.', displayContent: '지금까지 내용으로 블록을 만들어주세요.' },
            { role: 'assistant', content: retryResponse, displayContent: retryDisplay },
          ])
        }
      }

      if (block) {
        setGeneratedBlock(block)
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
        {loading && (
          <div className="flex justify-start">
            <TypingIndicator />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-slate-200 bg-white">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="경험을 편하게 말해주세요..."
            rows={1}
            disabled={loading}
            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-slate-50"
            style={{ minHeight: '42px', maxHeight: '120px' }}
            onInput={(e) => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
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
  const { user } = useAuth()
  const navigate = useNavigate()

  const handleCategorySelect = (categoryId) => {
    const newSession = createInterviewSession(categoryId)
    setSession(newSession)
  }

  const handleComplete = async (block, messages, turnCount, category) => {
    if (!user) {
      navigate('/dashboard')
      return
    }

    try {
      // Save block
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
        })
        .select()
        .single()

      if (blockError) throw blockError

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

      navigate('/block-result', { state: { block: { ...savedBlock, category } } })
    } catch (err) {
      console.error('Save error:', err)
      alert('저장 중 오류가 발생했습니다. 다시 시도해주세요.')
    }
  }

  if (!session) {
    return <CategorySelector onSelect={handleCategorySelect} />
  }

  return <ChatInterface session={session} onComplete={handleComplete} />
}
