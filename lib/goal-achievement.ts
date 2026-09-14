import type { Goal, GoalHorizon, Achievement } from '@/lib/types'
import type { createClient } from '@/lib/supabase'
import { isHobbyGoal, KIND_META } from '@/lib/goal-kinds'
import { HORIZON_META } from '@/lib/goal-horizons'

type Supabase = ReturnType<typeof createClient>

// Hoe een gehaald doel in het prestatie-overzicht komt te staan. Het icoon komt
// rechtstreeks uit HORIZON_META (lib/goal-horizons.ts) zodat je in één oogopslag
// ziet uit welke bak een prestatie komt, en het nooit uit de pas kan lopen met de
// horizon-kolommen in het doelen-overzicht. Het label is met opzet wél een eigen
// tekst — "Kwartaaldoel gehaald" leest natuurlijker dan "Kwartaal gehaald".
const HORIZON_LABEL: Record<GoalHorizon, string> = {
  nu:        'Focusdoel',
  doorlopend:'Doorlopend doel',
  wk:        'Weekdoel',
  '6w':      'Zesweken-doel',
  kwartaal:  'Kwartaaldoel',
  jaar:      'Jaardoel',
  '2-4jr':   '2-4 jaar-doel',
  '5-9jr':   '5-9 jaar-doel',
  '10jr+':   '10+ jaar-doel',
  ooit:      'Droomdoel',
}

/** Prestatie-tekst voor een gehaald doel, bijv. "Kwartaaldoel gehaald: 10 nummers".
 *  Deterministisch: hetzelfde doel geeft altijd dezelfde tekst, zodat het afvinken
 *  ongedaan maken de bijbehorende prestatie weer kan terugvinden. */
export function goalAchievementText(goal: Goal): string {
  // Een hobbydoel is niet 'gehaald' maar 'gedaan' — het hoort bij je vrije tijd
  if (isHobbyGoal(goal)) return `Hobbydoel gedaan: ${goal.text}`
  return `${HORIZON_LABEL[goal.horizon]} gehaald: ${goal.text}`
}

export function goalAchievementEmoji(goal: Goal): string {
  return isHobbyGoal(goal) ? KIND_META.hobby.emoji : HORIZON_META[goal.horizon].icon
}

/**
 * Houdt het prestatie-overzicht in sync met een afgevinkt doel. Elk gehaald doel
 * levert een prestatie op — ongeacht de horizon — met het soort doel in de tekst.
 *
 * Aanroepen ná het wegschrijven van `goals.done`. Bij het ongedaan maken van het
 * afvinken wordt de prestatie weer verwijderd, inclusief de XP die de
 * `trg_achievement_xp`-trigger erop had toegekend.
 *
 * Geeft de nieuwe prestatie terug bij afvinken, anders null.
 */
export async function syncGoalAchievement(
  supabase: Supabase,
  userId: string,
  goal: Goal,
  nowDone: boolean,
  dateStr: string,
): Promise<Achievement | null> {
  const text = goalAchievementText(goal)

  if (nowDone) {
    const { data } = await supabase.from('achievements').insert({
      user_id: userId,
      text,
      emoji:   goalAchievementEmoji(goal),
      date:    dateStr,
      cat_id:  goal.cat_id,
    }).select().single()
    return (data as Achievement) ?? null
  }

  const { data: removed } = await supabase.from('achievements')
    .delete().eq('user_id', userId).eq('text', text).select('id')
  for (const row of removed ?? []) {
    await supabase.from('xp_events').delete()
      .eq('user_id', userId).eq('source', 'achievement').eq('ref_id', String(row.id))
  }
  return null
}
