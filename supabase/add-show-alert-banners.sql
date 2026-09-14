-- ═══════════════════════════════════════════════════════════════════════════
--  profiles.show_alert_banners toevoegen — staat de balkjes bovenin (urgent,
--  achterstallig, wekelijkse controle, niet-SMART) standaard nog gewoon
--  zichtbaar, of alleen onder het belletje? Standaard uit (alleen belletje).
--  Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
alter table profiles add column if not exists show_alert_banners boolean default false;
