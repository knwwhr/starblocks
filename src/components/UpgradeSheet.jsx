import { PRICES } from '../lib/payments'

// 가치 확인(첫 문항 완성) 직후 뜨는 업그레이드 시트.
// 토스트가 아니라 머무름이 가능한 모달/바텀시트 — 결제 결정용.
// 기본 선택(강조)은 구독: "같은 값에 이 공고도, 다음 공고도".
export default function UpgradeSheet({ open, onClose, onBuyPass, onSubscribe, loading }) {
  if (!open) return null

  const won = (n) => `₩${n.toLocaleString('ko-KR')}`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* dim */}
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={loading ? undefined : onClose} />

      {/* sheet */}
      <div className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-5 shadow-xl animate-fade-in">
        <div className="text-center mb-4">
          <h2 className="text-base font-bold text-slate-900">1번 문항, 마음에 드셨어요?</h2>
          <p className="text-sm text-slate-500 mt-1">나머지 문항도 이렇게 완성해 드릴게요.</p>
        </div>

        {/* Pro 구독 — 기본 강조 */}
        <button
          onClick={onSubscribe}
          disabled={loading}
          className="w-full text-left rounded-xl border-2 border-primary-500 bg-primary-50 p-4 mb-3 disabled:opacity-50 hover:bg-primary-100 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-primary-700">Pro 첫 달</span>
            <span className="text-sm font-bold text-primary-700">{won(PRICES.proFirstMonth)}</span>
          </div>
          <p className="text-xs text-primary-600 mt-1">
            모든 공고 무제한 · 같은 값에 이 공고도, 다음 공고도
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            이후 월 {won(PRICES.proMonthly)} · 언제든 해지 · 갱신 전 미리 알림
          </p>
        </button>

        {/* 마감 패스 — 단건 */}
        <button
          onClick={onBuyPass}
          disabled={loading}
          className="w-full text-left rounded-xl border border-slate-200 p-4 mb-4 disabled:opacity-50 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">마감 패스</span>
            <span className="text-sm font-bold text-slate-700">{won(PRICES.pass)}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">이 공고 1건만 — 남은 문항 전부 완성</p>
        </button>

        <button
          onClick={onClose}
          disabled={loading}
          className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 disabled:opacity-50"
        >
          {loading ? '결제창을 여는 중...' : '다음에'}
        </button>
      </div>
    </div>
  )
}
