-- Mobiele "Overige"-cluster (Inzicht, YouTube, Mail, Voortgang/level, Plansessie,
-- Weekreview, Dag afsluiten, AI, Chat) staat standaard UIT op mobiel — te veel
-- clutter op een klein scherm. Op desktop blijft alles gewoon aan (via het
-- bestaande hidden_tabs), behalve Mail en YouTube die daar ook standaard uit
-- gaan (werken op dit moment niet lekker voor Jordan).
alter table profiles add column if not exists mobile_hidden_features text[]
  default '{graph,youtube,mail,voortgang,plansessie,weekreview,dagafsluiten,ai,chat}';

alter table profiles alter column hidden_tabs set default '{youtube,mail}';

-- Bestaande rijen (op dit moment alleen Jordan, hidden_tabs = '{}') krijgen de
-- nieuwe default ook meteen mee — alleen als ze 'm nog niet zelf hebben aangepast.
update profiles set hidden_tabs = array['youtube','mail']
  where hidden_tabs is null or hidden_tabs = '{}';
