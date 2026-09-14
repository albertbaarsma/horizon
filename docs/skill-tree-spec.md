# Vrije skill-tree — ontwerp-spec

Doel: naast de bestaande "skills = levensgebieden" (XP per `cat_id`), **vrije/verzonnen
vaardigheden** (sociaal, IT, marketing, muziek, discipline, schrijven, ondernemen…) die
**dynamisch ontstaan**. Elke keer dat de AI een achievement registreert, kent hij XP toe
aan 1–3 passende skills; nieuwe skills worden on-the-fly aangemaakt.

## 1. Datamodel — additief, botst NIET met de huidige cat-skills

**Advies: optie A (minimaal).** Voeg één nullable kolom toe aan `xp_events`:

```sql
alter table xp_events add column if not exists skill text;
```

- Een skill "bestaat" zodra er ≥1 `xp_events`-rij met die `skill` is (geen aparte tabel nodig).
- Skill-XP = `sum(amount) where skill = <naam>`. Level = `skillLevelForXp(som)` — bestaat al in `lib/xp.ts` (zelfde curve als hoofdlevel; ook `skillProgress`).
- Hergebruikt bestaande XP-infra, RLS en curve.

Optie B (alleen als je per-skill iconen/omschrijving/volgorde wilt): aparte `skills`-tabel
(`id, user_id, name` uniek per user, `icon`, `created_at`) + skill-XP-events. Meer werk.

Toepassen met de migratie-runner: `node scripts/migrate.mjs supabase/<bestand>.sql`.

## 2. AI — `lib/tool-executor.ts` + `app/api/chat/route.ts`

Nieuwe tools:

- **`award_skill_xp({ skills: [{ name, amount }], reason })`** — per skill een rij inserten:
  `{ user_id, amount, reason, source: 'skill', skill: name.toLowerCase().trim(), cat_id: null }`.
  Standaard `amount` 10–20.
- **`get_skills()`** — `xp_events` groeperen op `skill` (waar `skill is not null`), `amount` scommeren,
  teruggeven als `naam · totaal-XP · level`, aflopend op XP.

Systeemprompt (aanvulling): *"Wanneer je een achievement registreert (`add_achievement`),
bepaal 1–3 vaardigheden die Jordan hiermee oefende. Roep eerst `get_skills` om bestaande namen
te hergebruiken (voorkom 'sociaal' vs 'sociale vaardigheden' vs 'communicatie'); verzin anders een
passende, herbruikbare naam. Roep `award_skill_xp` aan. Meld kort welke skills XP kregen."*

Normaliseer skill-namen (lowercase, trim) bij opslaan én vergelijken.

## 3. UI — skills-scherm (waar jij al aan bouwt)

Voeg een "Vaardigheden"-blok toe:
- Skill-tree/lijst: naam · level (`skillLevelForXp`) · voortgangsbalk (`skillProgress`) · totaal-XP.
- Sorteer aflopend op XP/level; top-skills prominent.
- Optioneel: klik op skill → de achievements die eraan bijdroegen (`xp_events` met die skill).
- Data: filter de al-geladen `xpEvents` op `skill != null` en aggregeer client-side (scheelt een query).

## 4. Let op
- Raak de bestaande **cat-based skills** (`skillLevelForXp` op `cat_id`) niet aan; vrije skills staan ernáást.
- `xp_events` heeft al: `id, user_id, amount, reason, cat_id, source, ref_id, seen, created_at`. Voeg alleen `skill` toe.
- `source: 'skill'` onderscheidt deze events; ze tellen wél mee in het totaal-XP/hoofdlevel (bewust — een geoefende vaardigheid is echte vooruitgang). Wil je dat niet, sluit `source='skill'` uit bij de hoofdlevel-som.
</content_placeholder>
