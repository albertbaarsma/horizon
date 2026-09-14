// Detecteert 'open' taken die baat hebben bij concrete AI-ideeën
// (verzin/bedenk/organiseer/regelen/cadeau ...). Bewust conservatief: liever
// een gemiste taak dan overal een ✨ — 'Plankjes ophangen' of 'Was doen'
// horen er dus géén te krijgen.
const IDEA_PATTERNS = /\b(verzin\w*|bedenk\w*|idee\w*|brainstorm\w*|organiseer\w*|organiseren|uitzoek\w*|uitwerk\w*|kies|kiezen|bepaal\w*|bepalen|ontdek\w*|plannen|voorbereid\w*|verras\w*|cadeau\w*|activiteit\w*|uitje\w*|voorstel\w*|regelen|opties?)\b/i

export function taskWantsIdeas(text: string | null | undefined): boolean {
  if (!text) return false
  return IDEA_PATTERNS.test(text)
}
