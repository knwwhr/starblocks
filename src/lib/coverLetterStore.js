import { supabase } from '../config/supabase'

// ───────────── cover_letters ─────────────

export async function listCoverLetters(userId) {
  const { data, error } = await supabase
    .from('cover_letters')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getCoverLetter(id) {
  const { data, error } = await supabase
    .from('cover_letters')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createCoverLetter(userId, payload) {
  const { data, error } = await supabase
    .from('cover_letters')
    .insert({
      user_id: userId,
      company: payload.jobInfo?.company || null,
      position: payload.jobInfo?.position || null,
      job_posting_raw: payload.jobPostingRaw || null,
      job_info: payload.jobInfo || null,
      questions: payload.questions || [],
      match_result: payload.matchResult || null,
      status: 'draft',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCoverLetter(id, patch) {
  const dbPatch = {}
  if (patch.company !== undefined) dbPatch.company = patch.company
  if (patch.position !== undefined) dbPatch.position = patch.position
  if (patch.jobInfo !== undefined) dbPatch.job_info = patch.jobInfo
  if (patch.questions !== undefined) dbPatch.questions = patch.questions
  if (patch.matchResult !== undefined) dbPatch.match_result = patch.matchResult
  if (patch.status !== undefined) dbPatch.status = patch.status

  const { data, error } = await supabase
    .from('cover_letters')
    .update(dbPatch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCoverLetter(id) {
  const { error } = await supabase.from('cover_letters').delete().eq('id', id)
  if (error) throw error
}

// ───────────── cover_letter_answers ─────────────

export async function listAnswers(coverLetterId) {
  const { data, error } = await supabase
    .from('cover_letter_answers')
    .select('*')
    .eq('cover_letter_id', coverLetterId)
    .eq('is_active', true)
  if (error) throw error
  return data || []
}

// 사용자의 인라인 편집 등 단순 갱신 — 활성 행을 in-place update (버전 안 늘림)
export async function updateActiveAnswer(coverLetterId, questionIndex, payload) {
  const { data: existing } = await supabase
    .from('cover_letter_answers')
    .select('id')
    .eq('cover_letter_id', coverLetterId)
    .eq('question_index', questionIndex)
    .eq('is_active', true)
    .maybeSingle()

  const row = {
    cover_letter_id: coverLetterId,
    question_index: questionIndex,
    block_id: payload.blockId || null,
    answer: payload.answer ?? '',
    used_keywords: payload.usedKeywords || null,
    char_count: payload.charCount ?? (payload.answer || '').length,
    generation_options: payload.generationOptions || null,
    is_active: true,
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from('cover_letter_answers')
      .update(row)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('cover_letter_answers')
      .insert(row)
      .select()
      .single()
    if (error) throw error
    return data
  }
}

// 새 생성/재생성 — 기존 active를 비활성화하고 새 active 행 추가 (이력 누적)
export async function insertAnswerVersion(coverLetterId, questionIndex, payload) {
  const { error: deactErr } = await supabase
    .from('cover_letter_answers')
    .update({ is_active: false })
    .eq('cover_letter_id', coverLetterId)
    .eq('question_index', questionIndex)
    .eq('is_active', true)
  if (deactErr) throw deactErr

  const row = {
    cover_letter_id: coverLetterId,
    question_index: questionIndex,
    block_id: payload.blockId || null,
    answer: payload.answer ?? '',
    used_keywords: payload.usedKeywords || null,
    char_count: payload.charCount ?? (payload.answer || '').length,
    generation_options: payload.generationOptions || null,
    is_active: true,
  }
  const { data, error } = await supabase
    .from('cover_letter_answers')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return data
}

// 호환용 별칭 (인라인 저장은 update 의미)
export const saveAnswer = updateActiveAnswer

export async function countAnswerVersions(coverLetterId, questionIndex) {
  const { count, error } = await supabase
    .from('cover_letter_answers')
    .select('id', { count: 'exact', head: true })
    .eq('cover_letter_id', coverLetterId)
    .eq('question_index', questionIndex)
  if (error) throw error
  return count ?? 0
}

export async function deleteAnswer(coverLetterId, questionIndex) {
  const { error } = await supabase
    .from('cover_letter_answers')
    .delete()
    .eq('cover_letter_id', coverLetterId)
    .eq('question_index', questionIndex)
  if (error) throw error
}
