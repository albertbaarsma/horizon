// Eén bron voor het taal-type — gebruikt door de landingspagina (cookie-based)
// en het dashboard (profiel-based).
export type Lang = 'en' | 'nl'

/** Onbekend/null profiel.language → Engels (nieuwe gebruikers); Jordan staat op 'nl'.
 *  Bewust in dit bestand (geen 'use client') i.p.v. LangContext.tsx — server
 *  components (zoals app/ai-setup/page.tsx) mogen geen functie aanroepen die
 *  uit een 'use client'-bestand komt, ook niet een pure hulpfunctie zoals deze. */
export function resolveLang(language: Lang | null | undefined): Lang {
  return language === 'nl' ? 'nl' : 'en'
}
