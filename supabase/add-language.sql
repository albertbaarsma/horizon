alter table profiles add column if not exists language text;
-- Enige echte gebruiker van deze app is Jordan — zet zijn profiel op nl,
-- zodat zijn dashboard-ervaring precies blijft zoals hij 'm kende.
update profiles set language = 'nl';
