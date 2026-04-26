import { Link, useNavigate } from 'react-router-dom'
import { LayoutGrid, FileText, Plus, LogOut } from 'lucide-react'
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
      <header className="bg-white/90 backdrop-blur border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5 text-lg font-bold text-slate-900 no-underline tracking-tight">
            <span className="inline-block w-2 h-2 rounded-sm bg-primary-600" aria-hidden />
            Starblocks
          </Link>
          <nav className="flex items-center gap-1">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg no-underline"
                >
                  <LayoutGrid size={14} strokeWidth={2} />
                  내 블록
                </Link>
                <Link
                  to="/cover-letter"
                  className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg no-underline"
                >
                  <FileText size={14} strokeWidth={2} />
                  자소서 쓰기
                </Link>
                <Link
                  to="/interview"
                  className="inline-flex items-center gap-1.5 text-sm bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 no-underline ml-1 shadow-sm"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  새 블록
                </Link>
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center text-slate-400 hover:text-slate-600 p-1.5 ml-1 rounded-lg hover:bg-slate-100"
                  aria-label="로그아웃"
                >
                  <LogOut size={14} strokeWidth={2} />
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="text-sm bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 no-underline shadow-sm"
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
