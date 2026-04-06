import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-slate-900 no-underline">
            Starblocks
          </Link>
          <nav className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="text-sm text-slate-600 hover:text-slate-900 no-underline"
                >
                  내 블록
                </Link>
                <Link
                  to="/interview"
                  className="text-sm bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 no-underline"
                >
                  + 새 블록
                </Link>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-slate-400 hover:text-slate-600"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="text-sm bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 no-underline"
              >
                로그인
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
