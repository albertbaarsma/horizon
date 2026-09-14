# De verbeterlus: van meting naar betere app

Horizon meet nu zijn eigen gebruik. Dit beschrijft wat er automatisch gaat, wat
de app zelf kan aanpassen, en waar een mens tussen blijft zitten — en waarom.

## Wat er gemeten wordt

Twee soorten regels in `usage_events`:

| kind | target | seconds |
|---|---|---|
| `tab` | `week`, `tasks`, … | hoe lang het tabblad openstond |
| `feature` | `taak-afvinken`, `inzicht-2d`, … | — |

**Wat er niet in staat:** taaknamen, doelteksten, dagboek, stemming, e-mail, IP,
user-agent, locatie. Alleen sleutels uit een vaste lijst (`TRACKED_FEATURES` in
`lib/usage.ts`) en een aantal seconden. Geen Google Analytics, geen Plausible,
geen cookie van een derde partij: het blijft in de eigen Supabase, achter dezelfde
regel als de rest van de data (`auth.uid() = user_id`).

Uit te zetten met één vinkje in **Inzicht → 📈 Gebruik**, en met één knop te
wissen. Standaard staat het aan, want zonder meting geen verbetering.

## Trap 1 — de app past zichzelf aan (nu al)

Uit de meting komen voorstellen met het bewijs erbij. Twee daarvan kan de app
zelf uitvoeren, met één klik:

- **Openen op je meest gebruikte tab** (`profiles.start_tab`)
- **Een tab die je nooit opent uit de balk halen** (`profiles.hidden_tabs`)

Bewust conservatief: onder 14 dagen meten en 30 regels doet de app geen enkele
uitspraak, en er wordt nooit iets voorgesteld over een tab waar je deze week nog
was. Het verschil moet ook echt een verschil zijn — de startpagina wisselt pas
bij een factor 1,5.

## Trap 2 — de AI verbetert de code (met jou erbij)

Voor "dit onderdeel gebruikt niemand, haal het weg" is een codewijziging nodig.
Daar zit deze lus:

1. **Rapport maken.** `node scripts/usage-report.mjs --out gebruik.txt`, of de
   knop *Rapport kopiëren voor de AI* in het paneel.
2. **Aan de AI geven.** Het rapport is opzettelijk korte platte tekst: tabs met
   bezoeken en tijd, onderdelen met nul kliks, en de voorstellen met hun bewijs.
3. **De AI stelt een wijziging voor en voert die uit** in een sessie: onderdeel
   vereenvoudigen, weghalen, of ergens anders zetten. Met tests, en met een
   commit die uitlegt op welk cijfer het besluit rust.
4. **Opnieuw meten.** Werkte het? Dan gaat het gebruik omhoog of verdwijnt de
   melding. Zo niet, dan staat dat er de week erna weer.

Wekelijks in te plannen met een geplande taak (JARVIS of een cron) die stap 1
doet en het rapport neerzet.

## Waarom stap 3 niet volautomatisch is

Technisch kan het: een agent die het rapport leest, code aanpast, tests draait en
een pull request opent. Wat daar tegen pleit:

- **Een meting is geen bedoeling.** "Visie is 30 dagen niet geopend" kan
  betekenen dat het onderdeel niet werkt, of dat het een jaardoel-ding is dat je
  twee keer per jaar opent. Alleen jij weet welke van de twee.
- **Eén gebruiker is geen steekproef.** Met één persoon is elk cijfer een
  anekdote. Een agent die daarop autonoom code sloopt, sloopt op ruis.
- **Weghalen is moeilijker terug te draaien dan toevoegen.** Een tab verbergen is
  één klik terug; een verwijderd onderdeel moet opnieuw gebouwd worden.

Daarom: de app doet zelf wat omkeerbaar is, en zet de rest als voorstel met bewijs
voor je neer. Wil je stap 3 wél automatisch, dan is de veilige vorm een agent die
een **pull request** opent die jij samenvoegt — nooit rechtstreeks naar productie.

## Als anderen de app gaan gebruiken

Zodra er meer mensen inloggen meet je hún gedrag, en dan gelden er andere regels:
vertel het in de app, laat het uitzetten (dat kan al), en verzamel niets meer dan
nu. De huidige opzet — alleen sleutels, eigen database, per gebruiker afgeschermd,
zelf te wissen — is precies de vorm die daar het minst gedoe geeft.
