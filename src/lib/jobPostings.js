import { supabase } from '../config/supabase'

// 마감 안 지난(또는 마감일 미상) 공고를 마감 임박 순으로 로드.
export async function fetchActivePostings(limit = 200) {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('job_postings')
    .select('id, company, title, position, region, employment_type, description, url, keywords, close_at')
    .or(`close_at.gte.${today},close_at.is.null`)
    .order('close_at', { ascending: true, nullsFirst: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

// 사용자 블록에서 매칭 신호어 추출 (직무/업종/역량 태그).
function blockTerms(blocks) {
  const terms = new Set()
  for (const b of blocks || []) {
    ;(b.tags || []).forEach(t => {
      const w = String(t).replace(/^#/, '').trim()
      if (w.length >= 2) terms.add(w)
    })
    const rec = b.recommended_industries || {}
    ;(rec.roles || []).forEach(r => { if (r) terms.add(String(r).trim()) })
    ;(rec.industries || []).forEach(i => { if (i?.name) terms.add(String(i.name).trim()) })
  }
  return Array.from(terms).filter(Boolean)
}

// 블록 신호어와 공고 텍스트의 겹침으로 점수화 (AI 비용 0). 상위 N개 반환.
export function recommendPostings(blocks, postings, topN = 6) {
  const terms = blockTerms(blocks)
  if (terms.length === 0) return []

  const scored = []
  for (const p of postings) {
    const haystack = [p.title, p.position, p.company, ...(p.keywords || [])]
      .filter(Boolean)
      .join(' ')
    const matched = terms.filter(t => haystack.includes(t))
    if (matched.length > 0) {
      scored.push({ posting: p, score: matched.length, matched: matched.slice(0, 4) })
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    // 동점이면 마감 임박 우선 (null 은 뒤로)
    const ac = a.posting.close_at || '9999-12-31'
    const bc = b.posting.close_at || '9999-12-31'
    return ac < bc ? -1 : ac > bc ? 1 : 0
  })
  return scored.slice(0, topN)
}

// 마감까지 남은 일수 (없으면 null).
export function daysUntil(closeAt) {
  if (!closeAt) return null
  const diff = new Date(closeAt + 'T00:00:00') - new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00')
  return Math.round(diff / 86400000)
}
