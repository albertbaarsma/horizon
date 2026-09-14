// Fase 1: de balk en tabbladen die je op elke pagina van het dashboard ziet,
// ongeacht welke tab open staat. Zelfde vorm als lib/i18n-landing.ts's LANDING.
import type { Lang } from '../lang'

interface DashboardChrome {
  tabs: {
    dag: string; week: string; maand: string; projecten: string; taken: string
    doelen: string; wins: string; inzicht: string; visie: string; overige: string
  }
  meer: string
  meerTitel: string
  plansessie: string
  weekreview: string
  dagAfsluiten: string
  dagAfsluitenKort: string
  albertAi: string
  zoeken: string
  boodschappenlijstje: string
  albertAiChat: string
  instellingen: string
  geenInternet: string
  aiChatKort: string
  instellingenKort: string
  weekplanning: string
  dagboek: string
  voortgang: string
}

export const DASHBOARD_CHROME: Record<Lang, DashboardChrome> = {
  nl: {
    tabs: {
      dag: 'Dag', week: 'Week', maand: 'Maand', projecten: 'Projecten', taken: 'Taken',
      doelen: 'Doelen', wins: 'Wins', inzicht: 'Inzicht', visie: 'Visie', overige: 'Overige',
    },
    meer: 'Meer',
    meerTitel: 'Meer tabs en acties',
    plansessie: 'Plansessie',
    weekreview: 'Weekreview',
    dagAfsluiten: 'Dag afsluiten — review & doorschuiven',
    dagAfsluitenKort: 'Dag afsluiten',
    albertAi: 'Horizon AI (Ctrl+J)',
    zoeken: 'Zoeken (Ctrl+K)',
    boodschappenlijstje: 'Boodschappenlijstje',
    albertAiChat: 'Horizon AI chat (volledig scherm)',
    instellingen: 'Instellingen (uitloggen zit hier ook)',
    geenInternet: 'Geen internetverbinding',
    aiChatKort: 'AI-chat',
    instellingenKort: 'Instellingen',
    weekplanning: 'Weekplanning',
    dagboek: 'Dagboek',
    voortgang: 'Voortgang',
  },
  en: {
    tabs: {
      dag: 'Day', week: 'Week', maand: 'Month', projecten: 'Projects', taken: 'Tasks',
      doelen: 'Goals', wins: 'Wins', inzicht: 'Insight', visie: 'Vision', overige: 'Other',
    },
    meer: 'More',
    meerTitel: 'More tabs and actions',
    plansessie: 'Planning session',
    weekreview: 'Week review',
    dagAfsluiten: 'End day — review & carry over',
    dagAfsluitenKort: 'End day',
    albertAi: 'Horizon AI (Ctrl+J)',
    zoeken: 'Search (Ctrl+K)',
    boodschappenlijstje: 'Shopping list',
    albertAiChat: 'Horizon AI chat (full screen)',
    instellingen: 'Settings (logging out is here too)',
    geenInternet: 'No internet connection',
    aiChatKort: 'AI chat',
    instellingenKort: 'Settings',
    weekplanning: 'Week plan',
    dagboek: 'Journal',
    voortgang: 'Progress',
  },
}
