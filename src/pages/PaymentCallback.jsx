import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { confirmPayment } from '../lib/payments'
import { useToast } from '../contexts/ToastContext'

// 토스 결제창 복귀 지점.
//   /payment/success ?kind=pass&cl=&paymentKey=&orderId=&amount=
//                    ?kind=pro&authKey=&customerKey=
//   /payment/fail    ?code=&message=
export default function PaymentCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [error, setError] = useState(null)
  const ran = useRef(false)

  const isFail = location.pathname.endsWith('/fail')

  useEffect(() => {
    if (isFail || ran.current) return
    ran.current = true // StrictMode 중복 confirm 방지

    const kind = params.get('kind')
    const cl = params.get('cl')

    confirmPayment({
      kind,
      cl,
      mock: params.get('mock'),
      paymentKey: params.get('paymentKey'),
      orderId: params.get('orderId'),
      amount: params.get('amount'),
      authKey: params.get('authKey'),
      customerKey: params.get('customerKey'),
    })
      .then(() => {
        if (kind === 'pass') {
          toast.success('마감 패스 적용 완료! 이어서 작성해보세요.')
          navigate(`/cover-letter/${cl}`, { replace: true })
        } else {
          toast.success('Pro 구독이 시작됐어요. 모든 공고가 열렸습니다.')
          navigate('/dashboard', { replace: true })
        }
      })
      .catch((err) => {
        console.error('Payment confirm failed:', err)
        setError(err.message || '결제 확인에 실패했습니다.')
      })
  }, [isFail, params, navigate, toast])

  if (isFail) {
    const msg = params.get('message') || '결제가 취소되었거나 실패했습니다.'
    return <CallbackShell title="결제가 완료되지 않았어요" detail={msg} onBack={() => navigate(-1)} />
  }

  if (error) {
    return <CallbackShell title="결제 확인에 실패했어요" detail={error} onBack={() => navigate('/cover-letter')} />
  }

  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-400">결제를 확인하고 있어요...</p>
    </div>
  )
}

function CallbackShell({ title, detail, onBack }) {
  return (
    <div className="max-w-sm mx-auto px-4 py-16 text-center animate-fade-in">
      <h1 className="text-lg font-bold text-slate-900 mb-2">{title}</h1>
      <p className="text-sm text-slate-500 mb-6">{detail}</p>
      <button
        onClick={onBack}
        className="px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
      >
        돌아가기
      </button>
    </div>
  )
}
