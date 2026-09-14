-- ═══════════════════════════════════════════════════════════════════════════
--  finance_entries.reasoning — de uitgeschreven berekening achter een bedrag
--  ("13x €10 + 5x €15 + ... = €245, min €40 boodschappen = €205"), apart van
--  de korte description. Alleen gevuld als een bedrag uit geplakte tekst is
--  geëxtraheerd; handmatig toegevoegde bedragen laten 'm leeg.
--  Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
alter table finance_entries add column if not exists reasoning text;
