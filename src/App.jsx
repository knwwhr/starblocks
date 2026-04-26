import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import Layout from './components/Layout'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'

// 무거운 화면(차트/AI 흐름)은 lazy 로드 — 첫 페인트 단축
const InterviewPage = lazy(() => import('./pages/InterviewPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const BlockResultPage = lazy(() => import('./pages/BlockResultPage'))
const CoverLetterPage = lazy(() => import('./pages/CoverLetterPage'))
const CoverLetterListPage = lazy(() => import('./pages/CoverLetterListPage'))
const BlockEditPage = lazy(() => import('./pages/BlockEditPage'))

const LazyFallback = () => (
  <div className="flex items-center justify-center h-64 text-sm text-slate-400">
    로딩 중...
  </div>
)

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-slate-400">로딩 중...</div>
  if (!user) return <Navigate to="/login" />
  return children
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Layout>
      <Suspense fallback={<LazyFallback />}>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
        <Route
          path="/interview"
          element={
            <ProtectedRoute>
              <InterviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/block-result"
          element={
            <ProtectedRoute>
              <BlockResultPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cover-letter"
          element={
            <ProtectedRoute>
              <CoverLetterListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cover-letter/new"
          element={
            <ProtectedRoute>
              <CoverLetterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cover-letter/:id"
          element={
            <ProtectedRoute>
              <CoverLetterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/block/:id/edit"
          element={
            <ProtectedRoute>
              <BlockEditPage />
            </ProtectedRoute>
          }
        />
      </Routes>
      </Suspense>
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter basename="/starblocks">
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
