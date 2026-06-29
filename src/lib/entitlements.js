import { supabase } from '../config/supabase'

// 현재 사용자의 권한 상태 조회 (RLS 로 본인 행만 보임).
//   pro          : Pro 구독 활성 (모든 공고 무제한)
//   passUnlocked : 이 공고에 마감 패스 보유
// 둘 중 하나라도 true 면 해당 공고는 잠금 해제 상태.
export async function fetchEntitlements(coverLetterId) {
  const [proRes, passRes] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('current_period_end')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle(),
    coverLetterId
      ? supabase
          .from('passes')
          .select('id')
          .eq('cover_letter_id', coverLetterId)
          .eq('status', 'paid')
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const pro = !!proRes.data && new Date(proRes.data.current_period_end) > new Date()
  return { pro, passUnlocked: !!passRes.data }
}
