// Een project-id is een leesbare slug van de naam ("financieel-overzicht"),
// uniek binnen de projecten van de gebruiker. De database maakt zelf geen id
// aan: projects.id heeft geen standaardwaarde.

export function projectSlug(name: string, existingIds: Iterable<string>): string {
  const bezet = new Set(existingIds)
  const base = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'project'
  let slug = base, n = 2
  while (bezet.has(slug)) slug = `${base}-${n++}`
  return slug
}
