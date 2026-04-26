// 카테고리 그룹 — UI 컬러 액센트의 의미 단위
// academic(학업/연구) / practical(실무) / challenge(도전) / external(대외활동)
export const CATEGORY_GROUPS = {
  academic:  { label: '학업/연구', accent: 'sky',    bar: 'bg-sky-500',    soft: 'bg-sky-50',    text: 'text-sky-700' },
  practical: { label: '실무',      accent: 'emerald',bar: 'bg-emerald-500',soft: 'bg-emerald-50',text: 'text-emerald-700' },
  challenge: { label: '도전',      accent: 'amber',  bar: 'bg-amber-500',  soft: 'bg-amber-50',  text: 'text-amber-700' },
  external:  { label: '대외활동',  accent: 'violet', bar: 'bg-violet-500', soft: 'bg-violet-50', text: 'text-violet-700' },
}

export const CATEGORIES = [
  { id: 'team_project',     label: '팀 프로젝트',     emoji: '🎓', group: 'academic',  description: '학교/직장에서 팀으로 진행한 프로젝트' },
  { id: 'internship',       label: '인턴/직무 경험',  emoji: '💼', group: 'practical', description: '인턴십, 정규직, 계약직 등 직무 경험' },
  { id: 'competition',      label: '공모전/대회',     emoji: '🏆', group: 'challenge', description: '공모전, 해커톤, 경진대회 참여' },
  { id: 'personal_project', label: '개인 프로젝트',   emoji: '🔧', group: 'challenge', description: '혼자 진행한 사이드 프로젝트' },
  { id: 'club_activity',    label: '동아리/대외활동', emoji: '👥', group: 'external',  description: '동아리, 학생회, 봉사활동, 대외활동' },
  { id: 'part_time',        label: '아르바이트',      emoji: '💪', group: 'practical', description: '아르바이트, 파트타임 근무 경험' },
  { id: 'certification',    label: '자격증/교육',     emoji: '📚', group: 'academic',  description: '자격증 취득, 교육과정 수료' },
  { id: 'overseas',         label: '해외 경험',       emoji: '🌏', group: 'external',  description: '교환학생, 해외 인턴, 워킹홀리데이' },
]

export function getCategoryGroup(categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId)
  return cat ? CATEGORY_GROUPS[cat.group] : null
}

export const COMPETENCY_TAGS = [
  { id: 'leadership', label: '리더십', color: 'bg-purple-100 text-purple-700', aliases: ['리더', '주도', '이끎'] },
  { id: 'teamwork', label: '협업/소통', color: 'bg-blue-100 text-blue-700', aliases: ['협업', '팀워크', '협력', '팀플레이'] },
  { id: 'problem_solving', label: '문제해결', color: 'bg-red-100 text-red-700', aliases: ['문제', '해결', '트러블슈팅'] },
  { id: 'technical', label: '기술력', color: 'bg-green-100 text-green-700', aliases: ['기술', '개발', '코딩', '전문성'] },
  { id: 'self_driven', label: '자기주도', color: 'bg-yellow-100 text-yellow-700', aliases: ['주도성', '능동', '자발'] },
  { id: 'creativity', label: '창의성', color: 'bg-pink-100 text-pink-700', aliases: ['창의', '아이디어', '기획력'] },
  { id: 'resilience', label: '위기대응', color: 'bg-orange-100 text-orange-700', aliases: ['위기', '극복', '인내', '끈기'] },
  { id: 'communication', label: '커뮤니케이션', color: 'bg-indigo-100 text-indigo-700', aliases: ['소통', '설득', '대화', '발표'] },
  { id: 'analytical', label: '분석력', color: 'bg-teal-100 text-teal-700', aliases: ['분석', '데이터', '논리'] },
  { id: 'adaptability', label: '적응력', color: 'bg-cyan-100 text-cyan-700', aliases: ['적응', '유연', '변화대응'] },
]

// AI 생성 태그를 표준 역량으로 매핑
export function mapTagToCompetency(rawTag) {
  if (!rawTag) return null
  const clean = rawTag.replace(/#/g, '').trim()
  if (!clean) return null

  // 1. 정확 매칭 (label)
  const exact = COMPETENCY_TAGS.find(t => t.label === clean)
  if (exact) return exact

  // 2. ID 매칭
  const byId = COMPETENCY_TAGS.find(t => t.id === clean)
  if (byId) return byId

  // 3. alias 매칭
  const byAlias = COMPETENCY_TAGS.find(t => t.aliases?.some(a => clean.includes(a) || a.includes(clean)))
  if (byAlias) return byAlias

  // 4. label 부분 포함
  const byPartial = COMPETENCY_TAGS.find(t => clean.includes(t.label) || t.label.includes(clean))
  if (byPartial) return byPartial

  return null
}
