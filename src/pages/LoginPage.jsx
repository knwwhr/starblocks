import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isSignUp) {
        await signUp(email, password, nickname)
      } else {
        await signIn(email, password)
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err.message === 'Invalid login credentials'
        ? '이메일 또는 비밀번호가 올바르지 않습니다.'
        : err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-slate-900 mb-6">
          {isSignUp ? '회원가입' : '로그인'}
        </h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">닉네임</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required={isSignUp}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="닉네임"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="6자 이상"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? '처리 중...' : isSignUp ? '가입하기' : '로그인'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-4">
          {isSignUp ? '이미 계정이 있나요?' : '아직 계정이 없나요?'}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError('') }}
            className="ml-1 text-primary-600 hover:text-primary-700 font-medium"
          >
            {isSignUp ? '로그인' : '회원가��'}
          </button>
        </p>
      </div>
    </div>
  )
}
