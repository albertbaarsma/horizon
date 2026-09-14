'use client'

// Taal is een dwarsliggend gegeven — nodig op elke diepte (bv. RecurringTaskModal
// binnen TaskModal binnen TasksTab), dus via Context i.p.v. props doorgeven op
// elk tussenliggend component. DashboardClient bepaalt de taal éénmalig uit
// profile.language en wrapt zijn hele boom in <LangProvider>.

import { createContext, useContext } from 'react'
import type { Lang } from '../lang'

const LangCtx = createContext<Lang>('en')

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangCtx.Provider value={lang}>{children}</LangCtx.Provider>
}

export function useLang(): Lang {
  return useContext(LangCtx)
}
