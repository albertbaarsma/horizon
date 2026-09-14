// ─── Updatelog ────────────────────────────────────────────────────────────────
// Wat er in de app veranderd is, in gewone taal. Dit is de enige plek: de
// landingspagina leest hier uit. Nieuwe release? Zet een blok bovenaan CHANGELOG
// — nieuwste eerst, datum als YYYY-MM-DD.

export type Soort = 'nieuw' | 'beter' | 'fix'

export interface Wijziging {
  soort: Soort
  tekst: string
}

export interface Release {
  /** YYYY-MM-DD */
  datum: string
  titel: string
  wijzigingen: Wijziging[]
}

export const SOORT_META: Record<Soort, { label: string; kleur: string }> = {
  nieuw: { label: 'Nieuw',      kleur: '#3fb950' },
  beter: { label: 'Verbeterd',  kleur: '#58a6ff' },
  fix:   { label: 'Opgelost',   kleur: '#d29922' },
}

export const CHANGELOG: Release[] = [
  {
    datum: '2026-09-14',
    titel: 'Week opent weer betrouwbaar bij vandaag',
    wijzigingen: [
      { soort: 'fix', tekst: 'Week opende soms bij het begin van de lijst (twee weken terug) in plaats van bij vandaag — vooral op mobiel. De sprong naar vandaag gebeurde te vroeg, vóórdat het weerkaartje boven de dagen was geladen; dat kaartje schoof alles daarna omlaag zonder dat er opnieuw gescrold werd. Week scrolt nu ook opnieuw zodra het weer binnenkomt, en doet dat direct in plaats van geanimeerd, zodat het ook lukt op een net-geopende tab.' },
    ],
  },
  {
    datum: '2026-09-10',
    titel: 'Mobiel-menu compleet, en een echte instelgids voor Horizon AI',
    wijzigingen: [
      { soort: 'fix', tekst: 'Op mobiel/tablet opende ☰ nog het oude categorieënmenu — nu opent het hetzelfde ‘Meer’-menu als onderin, met alle hoofdtabs erin (Dag t/m Overige) plus Instellingen, Dagboek en Boodschappenlijstje. De rondzwevende AI- en dagboek-knopjes zijn ook weg tussen 768 en 1024px breed, waar ze nog in de weg stonden.' },
      { soort: 'nieuw', tekst: 'Instellingen → Horizon AI heeft nu een link naar een uitgebreide instelgids (beide talen) met drie manieren om Horizon AI aan de praat te krijgen: gratis en lokaal via Ollama, gratis in de cloud via Google Gemini, of betaald via Anthropic Claude.' },
      { soort: 'nieuw', tekst: 'Zie je ‘Geen API key geconfigureerd’ bij Rapport of de weeknotities-AI? Daar staat nu een duidelijke uitleg met een link naar die instelgids, in plaats van alleen een rode foutregel.' },
      { soort: 'fix', tekst: 'Een eigen OpenAI-compatible AI-provider instellen in Instellingen deed eerst niks in de chat zelf — die negeerde die keuze stilzwijgend. De chat heeft er nu een ‘⚙️ Mijn instellingen’-optie bij in het modelmenu die je eigen instelling écht gebruikt (ook nodig om Gemini te kunnen kiezen).' },
    ],
  },
  {
    datum: '2026-09-09',
    titel: 'Mobiel drastisch simpeler, en Inzicht/YouTube/Mail/AI samen onder ‘Overige’',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'Op mobiel is het linker menu (met alle projectcategorieën) helemaal weg — dat was toch alleen maar clutter bij Dag, Week, Maand, Taken, Projecten, Doelen en Wins. Die tabs tonen nu gewoon hun inhoud, edge-to-edge.' },
      { soort: 'nieuw', tekst: 'Inzicht, YouTube, Mail, Voortgang (level/XP), Plansessie, Weekreview, Dag afsluiten en de AI-popup/chat zitten op desktop nu samen onder één nieuw tabblad ‘Overige’, met een eigen linker submenu — precies zoals Inzicht dat al voor zichzelf deed.' },
      { soort: 'nieuw', tekst: 'Op mobiel staat dat hele ‘Overige’-cluster standaard uit — te veel voor een klein scherm. In Instellingen (📱 Onderdelen aan/uit) zet je per surface, los voor mobiel en desktop, weer aan wat je wél wilt zien. Mail en YouTube staan ook op desktop standaard uit.' },
      { soort: 'nieuw', tekst: 'Wins toont de levensgebieden op mobiel nu als een horizontale pillenrij bovenaan in plaats van een linker sidebar — zelfde aanpak als Visie al had.' },
      { soort: 'beter', tekst: 'Boodschappenlijstje en Instellingen blijven gewoon altijd bereikbaar op mobiel, net als daarvoor.' },
    ],
  },
  {
    datum: '2026-09-08',
    titel: 'Herhaaltaken zijn nu gewoon taken, en overal handmatig herschikken',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'Een herhaaltaak is niet langer een apart, doorzichtig "spook"-item — elke gelegenheid is nu gewoon een echte taak die je afvinkt, sleept en herschikt zoals alles in Week/Dag/Maand. Vink je ‘m af, dan verandert dat alleen die ene dag; de herhaling zelf loopt door.' },
      { soort: 'nieuw', tekst: 'Van een gewone taak in Week een herhaling maken kan nu direct vanuit het detailvenster (↻ Van herhaling maken) — de dag van de taak wordt vast voorgesteld, mag je aanpassen. "↻ Herhaaltaken beheren" blijft de plek om patronen aan/uit te zetten of helemaal te verwijderen.' },
      { soort: 'nieuw', tekst: 'Zo’n taak verwijderen slaat voortaan alleen die dag over (de herhaling blijft gewoon lopen) — daarvoor hoef je niks aparts meer te doen, de gewone 🗑-knop is daar al slim genoeg voor.' },
      { soort: 'nieuw', tekst: 'Handmatig herschikken (slepen om de volgorde te bepalen) werkt inmiddels overal hetzelfde: Projecten, Taken (Kanban/Lijst/Horizon), Doelen en Week — allemaal dezelfde gedeelde functie (lib/reorder.ts), dus wat op de ene plek werkt, werkt overal.' },
      { soort: 'nieuw', tekst: 'Een taak omzetten naar herhaaltaak (en andersom) kan ook vanuit het takendetail zelf — de taak gaat dan naar de prullenbak (terug te halen) en de herhaling neemt het over, of omgekeerd.' },
      { soort: 'fix', tekst: 'Een herhaaltaak telde soms per ongeluk als "gehaald" in de reeksteller (🔥) zodra hij verscheen, ook als je ‘m nog niet had afgevinkt — nu telt alleen een echt afgevinkte dag mee.' },
    ],
  },
  {
    datum: '2026-09-07',
    titel: 'Horizon spreekt nu ook Engels, en een gehoste koppeling met Claude zonder gedoe',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'De homepage kiest voortaan standaard Engels voor nieuwe bezoekers, met twee vlaggetjes rechtsboven om te wisselen — jouw eigen bezoek blijft gewoon Nederlands via het cookie.' },
      { soort: 'nieuw', tekst: 'Ook het dashboard zelf kan nu in het Engels: een taalkeuze bij Instellingen (⚙ → Taal/Language) zet de balk, tabbladen en meldingen om. Jouw account staat op Nederlands; nieuwe accounts starten straks in het Engels.' },
      { soort: 'nieuw', tekst: 'Een AI koppelen kan nu zonder een los script te downloaden: Horizon heeft een eigen, gehoste MCP-verbinding. Bij Instellingen → Externe AI-toegang staat een nieuwe stap-voor-stap gids (/ai-setup) met een kant-en-klare link voor Claude Desktop/claude.ai, een commando voor Claude Code, en de bestaande REST-route voor eigen scripts — inclusief een knop die meteen test of je token werkt.' },
    ],
  },
  {
    datum: '2026-09-06',
    titel: 'Deadlines sturen de horizon aan, en Week + Taken kun je nu écht naast elkaar zien',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'Taken en Projecten hebben nu ook een deadline (Doelen hadden ‘m al). Zet je een deadline, dan bepaalt die vanaf nu automatisch de horizon: hoe dichterbij, hoe korter (Jaar → Kwartaal → 6 weken → Nu), zonder dat je zelf nog hoeft te slepen.' },
      { soort: 'nieuw', tekst: 'Sleep je een taak/project/doel mét deadline toch naar een andere horizon-kolom, dan verschuift de deadline automatisch mee. Sleep je ‘m naar Ooit of Doorlopend (of terug naar "Nog niet ingedeeld"), dan laat de deadline los — het wordt weer een normaal, handmatig item.' },
      { soort: 'nieuw', tekst: 'Een verschoven deadline (later dan de oorspronkelijke) krijgt een 🔀-icoontje — hover erover voor de oude en nieuwe datum. De allereerste ooit gezette deadline en de aanmaakdatum blijven zichtbaar in het detailvenster, ook nadat de deadline is opgeschoven.' },
      { soort: 'beter', tekst: 'Een verlopen deadline (⚠) en de deadline zelf zijn nu ook zichtbaar op de kaart in Taken (Kanban/Lijst) en Projecten (Secties) — niet alleen in de Horizon-weergaven.' },
      { soort: 'beter', tekst: 'Het splitscherm (Week + Taken naast elkaar, met een sleepbare scheidingslijn) stond verstopt in een klein icoontje rechtsboven — er staat nu een gewone "⊞ Split"-knop naast Week/Maand, dus je ziet ‘m meteen.' },
      { soort: 'nieuw', tekst: 'De takenlijst in dat splitscherm is niet langer een uitgeklede mini-versie — het is nu de volledige Taken-tab, inclusief de Horizon-weergave, filters en prullenbak. Sleep een taak van daaruit (in elke weergave) zo op een dag in Week om ‘m in te plannen.' },
      { soort: 'fix', tekst: 'Een doel/project/taak met een deadline over meerdere jaren (heel gewoon voor bestaande 2-4jr/5-9jr/10jr+ items) werd door de nieuwe deadline-sturing plat in "Dit jaar" gepropt — nu rekent die logica de hele schaal door, dus zo’n item valt weer in zijn eigen lange-termijn-kolom.' },
      { soort: 'beter', tekst: '"Doorlopend" stond als tweede kolom, meteen na "Nu" — dat paste niet goed tussen de gedateerde horizons in. Staat nu als een-na-laatste, samen met "Ooit/misschien" aan het eind — overal hetzelfde: Doelen, Projecten en Taken.' },
    ],
  },
  {
    datum: '2026-09-05',
    titel: 'Projecten: makkelijker afvinken, en meteen zien welke taken erbij horen',
    wijzigingen: [
      { soort: 'beter', tekst: 'De ✓/⇄/🗑-knoppen op een projectkaart staan niet meer verstopt tot je erover hovert — ze staan er nu altijd, ook op je telefoon (waar hoveren toch niet kan).' },
      { soort: 'nieuw', tekst: 'De Horizon-weergave van Projecten had nog geen manier om een project in één klik als klaar te markeren — alleen verwijderen. Er staat nu ook een ✓-knop op, net als in Secties.' },
      { soort: 'nieuw', tekst: 'Een projectkaart toont voortaan de namen van de openstaande taken die erbij horen (tot 3, met "+N meer"), niet meer alleen een kaal getal zoals "3/7". Geldt voor zowel Secties als Horizon.' },
    ],
  },
  {
    datum: '2026-09-04',
    titel: 'Taken op horizon — dezelfde weergave als Projecten en Doelen',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'Taken heeft er een derde weergave bij, naast Kanban en Lijst: Horizon — dezelfde tien periodes als Doelen en Projecten. Sleep een taak naar een horizon om ‘m in te delen; het gekoppelde project staat er als gekleurd chipje bij, in de kleur van zijn levensgebied.' },
      { soort: 'beter', tekst: 'Horizon in Taken is een vooruitkijk-weergave: een klaar-gezette taak verdwijnt er meteen uit, in plaats van tussen de nog-te-doen taken te blijven staan.' },
    ],
  },
  {
    datum: '2026-09-03',
    titel: 'Projecten op horizon — net als Doelen, en een nettere lay-out voor lange termijn',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'Projecten heeft er een tweede weergave bij: naast de vertrouwde Secties (Prioriteiten, Overige, Routines, ...) nu ook Horizon — dezelfde negen periodes als Doelen (Nu t/m Ooit/misschien). Sleep een kaart naar een andere horizon om ‘m in te delen; een project met sub-projecten valt in deze weergave uit elkaar in zijn losse onderdelen, elk met een verwijzing naar het hoofdproject.' },
      { soort: 'beter', tekst: 'Zowel Doelen als de nieuwe Horizon-weergave van Projecten tonen voortaan de korte-termijn periodes (Nu t/m Dit jaar) altijd, en de vier lange-termijn periodes (2-4 jaar t/m Ooit/misschien) achter een inklapbaar "🔭 Lange termijn"-paneel — minder rommel in het dagelijkse overzicht.' },
      { soort: 'nieuw', tekst: 'Nieuwe horizon "🔁 Doorlopend", naast Nu — voor routines en gewoontes zonder eindpunt (sporten, oefenen, wekelijkse gewoontes). Die telden nergens goed mee tussen "vandaag" en "over jaren".' },
      { soort: 'beter', tekst: 'Alle projecten hebben nu een horizon ingedeeld (op basis van bijpassende doelen waar die er waren), en 8 doelen die nog geen eigen project hadden (kruidentuin, zwemvijver, uitbouw, veranda, overkapping, eigen nummer uitbrengen) hebben er nu een.' },
    ],
  },
  {
    datum: '2026-09-02',
    titel: 'Bijlagen bij projecten/doelen/taken, herhaaltaken lichter te overslaan',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'Projecten, doelen en taken hebben nu een BIJLAGEN-sectie: sleep of kies een foto, PDF of ander bestand en het hangt eraan. Afbeeldingen tonen een kleine voorvertoning, andere bestanden een icoon met bestandsnaam. Meerdere bestanden per item, elk apart te verwijderen. Bestanden staan privé in eigen opslag (Supabase Storage) — alleen jij kunt erbij, tot 15MB per bestand.' },
      { soort: 'fix', tekst: 'Een herhaaltaak in Week, Maand of Dag kon tot nu toe alleen helemaal verwijderd worden (stopt alle herhaling). Standaard is dat nu een lichte actie geworden: de prullenbak-knop en de rechtermuisknop-menu slaan voortaan alleen die ene dag over, het herhaalpatroon blijft gewoon gelden. Slepen naar een andere dag werkte al zo.' },
      { soort: 'beter', tekst: 'In het detailvenster van een herhaaltaak staat nu zowel "deze dag overslaan" als de zwaardere "hele herhaling verwijderen (stopt alle herhaling)" — die laatste blijft bewust een aparte, expliciete stap.' },
      { soort: 'beter', tekst: 'Doelen voorbij dit jaar zijn niet meer één grote "Meerdere jaren"-bak: dat is nu opgesplitst in 2-4 jaar, 5-9 jaar, 10+ jaar, en een "Ooit / misschien" bak voor ongedateerde dromen. Bestaande meerjarendoelen zijn automatisch ingedeeld op basis van hun streefdatum.' },
      { soort: 'beter', tekst: 'Binnen elke horizon-kolom in Doelen staan doelen nu gegroepeerd op levensgebied, elk met het eigen kleurtje uit Visie — gelijksoortige doelen staan zo bij elkaar in plaats van door elkaar.' },
    ],
  },
  {
    datum: '2026-09-01',
    titel: 'Externe AI-toegang uitgebreid — mood, dagboek, projecten',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'De externe AI-koppeling (Instellingen → toegangstoken, waar JARVIS gebruik van maakt) kan er nu ook bij: je stemming loggen en opvragen, dagboekregels schrijven en opvragen, en de lijst van levensgebieden + projecten opvragen zodat een taak in de juiste categorie terechtkomt.' },
      { soort: 'beter', tekst: 'Een taak bijwerken via die koppeling kan er nu ook naar een ander project verplaatsen (dus een andere categorie) en een prioriteit meegeven — dat kon eerder niet.' },
    ],
  },
  {
    datum: '2026-08-31',
    titel: 'Navigatie opgeruimd, taakprioriteit, Week anders ingericht',
    wijzigingen: [
      { soort: 'beter', tekst: 'Rapport en Financiën zijn geen aparte tabs/pagina meer — ze staan nu als weergave in Inzicht, naast 3D bol, 2D kaart, Heatmap, Controle en Gebruik. Financiën opent dus niet meer een aparte pagina, en Inzicht heeft er ook meteen een nieuwe weergave "📈 Stemming" bij (je stemmingsgrafiek, die eerder alleen in Dag zat).' },
      { soort: 'nieuw', tekst: 'Taken hebben nu een prioriteit (0-5, in te stellen in de taakdetails). Taken en Dag sorteren voortaan hoge prioriteit eerst.' },
      { soort: 'beter', tekst: 'Week heeft een eigen linkermenu in plaats van de projectenboom: het aantal openstaande items van eerder, en een snelkoppeling "📥 Taken inplannen" naar het splitscherm (week + takenlijst naast elkaar, een taak naar een dag slepen om in te plannen) — dat bestond al, maar zat verstopt achter een klein icoontje.' },
    ],
  },
  {
    datum: '2026-08-29',
    titel: 'Rapport — een eerlijk week- en maandverhaal om te beluisteren',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'Nieuwe tab 🎧 Rapport: elke zondagavond en aan het begin van elke maand schrijft Horizon AI automatisch een rapport over je stemming, je achievements en afgeronde taken, aan welke doelen je hebt gewerkt en welke zijn blijven liggen — met open, direct advies over de vervolgstap. Kan ook altijd met één klik handmatig opnieuw.' },
      { soort: 'nieuw', tekst: 'Druk op 🎧 Voorlezen en het rapport wordt hardop uitgesproken — ook op de telefoon, geen extra app nodig.' },
    ],
  },
  {
    datum: '2026-08-27',
    titel: 'Financiën — zakgeld voor Sam en Robin',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'Nieuwe tab "Zakgeld" op de Financiën-pagina: een kaart per kind met het actuele saldo, en snel een bedrag erbij (weekgeld, cadeau) of eraf (iets gekocht) boeken — met optioneel een omschrijving van waaraan het is uitgegeven.' },
      { soort: 'nieuw', tekst: 'Spaardoelen per kind: een titel, optioneel een link naar het product en een streefbedrag — je ziet meteen de voortgang t.o.v. hun saldo, en kan een doel afvinken als het gehaald/gekocht is.' },
      { soort: 'nieuw', tekst: 'Ook via Horizon AI: "Sam heeft 2 euro uitgegeven aan een ijsje" of "hoe staat het zakgeld ervoor?" werkt nu net als bij de rest van Financiën — inclusief spaardoelen toevoegen, bijwerken en afvinken.' },
    ],
  },
  {
    datum: '2026-08-25',
    titel: 'Financiën — bankafschriften uploaden en per categorie zien',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'Nieuwe tab "Uitgaven & inkomsten" op de Financiën-pagina: upload een PDF van je maandelijkse bankafschrift en Horizon AI leest elke transactie eruit — datum, omschrijving, bedrag en een voorgestelde categorie. Je controleert de lijst (en past bedrag of categorie eventueel aan) voordat je hem importeert.' },
      { soort: 'nieuw', tekst: 'Maandoverzicht met totaal inkomsten, uitgaven en netto, plus een uitsplitsing per categorie (Boodschappen, Wonen, Vaste lasten, Vervoer, Zorg, Uitgaan & vrije tijd, Sparen, Inkomen, Overig) met een kleurbalkje per categorie.' },
      { soort: 'beter', tekst: 'Al eerder geïmporteerde transacties worden bij een nieuwe upload herkend (zelfde datum, bedrag en omschrijving) en staan standaard uitgevinkt, zodat je niet per ongeluk dubbel importeert.' },
    ],
  },
  {
    datum: '2026-08-23',
    titel: 'Financiën — wie is jou wat schuldig',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'Nieuwe pagina 💰 Financiën (naast Instellingen): houd per persoon bij wat iemand jou schuldig is of wat jij iemand schuldig bent. Elke persoon krijgt automatisch een nettostand; een bedrag "verrekenen" telt niet meer mee maar blijft zichtbaar als geschiedenis.' },
      { soort: 'nieuw', tekst: 'Ook via Horizon AI: "Rein is me €5 schuldig voor een pianoles" of "hoeveel ben ik nog schuldig?" werkt nu net als bij taken en het boodschappenlijstje.' },
      { soort: 'beter', tekst: 'Instellingen en Financiën delen nu dezelfde bouwstenen voor kaarten en velden, en een paar losse kleurtjes (rood/groen bij het boodschappenlijstje en het belletje) gebruiken nu de standaardkleuren van de app in plaats van een eigen kopie — geen zichtbaar verschil, wel minder kans dat ze uit elkaar gaan lopen.' },
    ],
  },
  {
    datum: '2026-08-22',
    titel: 'Eén stijl voor Wins, Inzicht en Visie',
    wijzigingen: [
      { soort: 'beter', tekst: 'Wins, Inzicht en Visie hadden alle drie hun eigen stijl navigatie — een rij filterknopjes, een zwevende knoppenrij, een net weer andere categorielijst. Alle drie hebben nu een linker menukolom in dezelfde stijl als het hoofdmenu.' },
      { soort: 'fix', tekst: 'Dezelfde categorie kon in Visie een andere kleur krijgen dan in Inzicht of Wins. Nu overal dezelfde kleur.' },
      { soort: 'fix', tekst: 'Op Wins/Inzicht/Visie stond de nieuwe menukolom eerst naast het project-overzicht — niet relevant daar, en verwarrend. Dat overzicht verschijnt nu alleen nog bij de tabs waar het wél iets zegt (Projecten, Dag, Week, Maand, Taken, Doelen).' },
      { soort: 'beter', tekst: 'De levensgebieden in Wins en Visie hebben nu een eigen icoontje, net als de projecten in het hoofdmenu.' },
      { soort: 'beter', tekst: 'Mijn Ultieme Visie stond als losse, inklapbare balk boven de Visie-tab. Die is nu gewoon het eerste item in de menukolom — "Ultimate vision", boven de levensgebieden.' },
      { soort: 'fix', tekst: 'Het belletje voor browser-meldingen (naast het nieuwe meldingenbelletje) was verwarrend dubbelop. Weggehaald.' },
    ],
  },
  {
    datum: '2026-08-20',
    titel: 'Meldingen onder het belletje',
    wijzigingen: [
      { soort: 'beter', tekst: 'De balkjes bovenin (urgent, achterstallig, wekelijkse controle, "nog niet SMART") staan niet meer standaard los in beeld. Ze zitten nu onder het belletje, met een rood aantal erbij.' },
      { soort: 'nieuw', tekst: 'Wil je de balkjes toch ook los bovenin zien? Zet dat aan bij Instellingen → Meldingen.' },
      { soort: 'nieuw', tekst: 'De Ultieme Visie op de Visie-tab staat er nu woordelijk, zoals in het eigen visiedocument. Woorden die naar een levensgebied, doel of achievement verwijzen — zoals "kinderen", "topfit" of "zonnepanelen" — zijn klikbaar en springen er meteen naartoe.' },
      { soort: 'beter', tekst: 'De Ultieme Visie leest een stuk prettiger: kortere regels en duidelijke witruimte tussen de alinea\'s, in plaats van één brede lap tekst.' },
      { soort: 'nieuw', tekst: 'Levensgebied Thuis & Land heeft nu ook zijn volledige, woordelijke uitwerking: Ultieme Visie, Ultimate Purpose, Rollen en 3 to Thrive.' },
      { soort: 'nieuw', tekst: 'Herhaaltaken in de weekplanning krijgen bij het overhoveren nu een prullenbakje, net als gewone taken — geen rechtermuisklik meer nodig om er eentje kwijt te raken.' },
      { soort: 'beter', tekst: 'De melding over niet-afgeronde items gaat nu alleen nog over de afgelopen week, in plaats van alles wat ooit is blijven liggen.' },
    ],
  },
  {
    datum: '2026-08-14',
    titel: 'Doelen krijgen dezelfde diepte als projecten',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'Klik op een doel en je krijgt hetzelfde soort venster als bij een project: Result, Why/Purpose, een tijdlijn, vrije notities, en een vak voor geplakte HTML.' },
      { soort: 'nieuw', tekst: 'Hoofd- en subdoelen — koppel een doel aan een ander doel, en zie ze in het doelenoverzicht direct onder elkaar staan.' },
      { soort: 'nieuw', tekst: 'Een doel toont nu de projecten uit hetzelfde levensgebied, zodat je in één oogopslag ziet wat eraan bijdraagt.' },
      { soort: 'nieuw', tekst: 'Heeft een doel geen duidelijk result, dan biedt de app aan het samen SMART te maken — dezelfde aanpak als bij een dun uitgewerkt project.' },
      { soort: 'nieuw', tekst: 'De Visie-tab toont per levensgebied nu alle horizonnen — week, 6 weken, kwartaal, dit jaar en meerdere jaren — in plaats van alleen jaar en kwartaal.' },
      { soort: 'nieuw', tekst: 'Elk levensgebied heeft een eigen notitieveld voor losse gedachten die nergens anders passen.' },
      { soort: 'nieuw', tekst: 'Een Over-pagina die uitlegt waar Horizon op gebaseerd is: RPM (Rapid Planning Method) van Tony Robbins, met Result, Purpose en Massive Action Plan als de kern, stap-voor-stap uitleg om een ultieme visie te schrijven, en de keten visie → levensgebied → doel/project → taak.' },
      { soort: 'beter', tekst: '"90-Dagen Doelen" heet nu overal gewoon Kwartaal — dezelfde naam als in het doelenoverzicht.' },
      { soort: 'beter', tekst: 'Klikken op een doel opent het nu; het vinkje ernaast blijft los daarvan afvinken.' },
      { soort: 'fix',   tekst: 'De Visie-tab in de menubalk had alleen een sterretje, geen tekst — nu staat er "Visie" bij, net als bij de andere tabs.' },
      { soort: 'fix',   tekst: 'De genummerde stappenkaarten ("Aan de slag") toonden zich als platte tekst in plaats van kaarten met een nummerbadge — de bijbehorende opmaak was onderweg zoekgeraakt.' },
      { soort: 'nieuw', tekst: 'Bij een doel of project dat nog geen duidelijk result heeft staat nu "Copy prompt": kopieert een kant-en-klare vraag naar je klembord, om in je eigen Claude te plakken. Het venster sluit niet meer vanzelf.' },
      { soort: 'nieuw', tekst: 'Die prompt volgt nu de RPM-methode stap voor stap: eerst wat je wil en waarom, dan chunken in sub-resultaten met hun eigen taken (RPM-blokken) — en hij neemt mee wat je al hebt vastgelegd in plaats van alles opnieuw te vragen.' },
      { soort: 'nieuw', tekst: 'Nieuwe melding: "Nog niet SMART" verzamelt alle doelen én projecten zonder duidelijk result op één plek. Vink aan wat je nu wil uitwerken en kopieer daar één gecombineerde prompt van.' },
      { soort: 'fix',   tekst: 'Een uitgeklapte projectgroep kon bij het laden van de pagina een hydration-fout veroorzaken (de server kent je opgeslagen uitklapstand nog niet). Verholpen.' },
    ],
  },
  {
    datum: '2026-08-13',
    titel: 'Alles hangt aan elkaar — en dat zie je nu',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'De 3D-weergave laat de hele keten zien: je visie in het midden, daaromheen je levensgebieden, en daaruit je doelen, projecten en taken. Eén boom in plaats van losse eilandjes.' },
      { soort: 'nieuw', tekst: 'Elke bol heeft een vaste plek. De indeling wordt berekend uit die boom, dus je herkent hem elke keer dat je hem opent — geen wolk meer die zichzelf steeds anders neerzet.' },
      { soort: 'nieuw', tekst: 'Sleep een bol naar een plek die jou logisch lijkt; zijn hele tak gaat mee en het blijft zo staan. Eén knop zet alles terug op de berekende plek.' },
      { soort: 'nieuw', tekst: 'Dubbelklik klapt een tak in, met een telletje van wat eronder verstopt zit. Zo pel je je leven af in plaats van naar alles tegelijk te kijken.' },
      { soort: 'beter', tekst: 'De bol staat nu stil in plaats van eeuwig na te trillen, en een tak die naar je toe draait zwelt niet meer op.' },
      { soort: 'nieuw', tekst: 'Klik een doel in de 3D-weergave en je ziet zijn horizon, zijn levensgebied en de projecten die daar hun werk doen.' },
      { soort: 'nieuw', tekst: 'Elke projectkaart heeft nu knoppen om af te vinken, te verplaatsen (naar een andere sectie óf een ander levensgebied) en te verwijderen.' },
      { soort: 'nieuw', tekst: 'Sleep een doel van de ene horizon naar de andere — een kwartaaldoel dat dichterbij komt zet je zo op zes weken.' },
      { soort: 'nieuw', tekst: 'Hobbydoelen staan standaard verborgen, met één knop om ze er weer bij te halen.' },
      { soort: 'nieuw', tekst: 'Deze landingspagina, met het updatelog dat je nu leest.' },
      { soort: 'nieuw', tekst: 'Open je een project dat je zelf prioriteit gaf maar dat nog dun staat opgeschreven, dan biedt de app aan het samen uit te werken. Eén klik en je AI stelt eerst vragen, in plaats van er meteen taken bij te verzinnen.' },
      { soort: 'fix',   tekst: 'Een project verwijderen liet zijn sub-projecten onzichtbaar achter — die gaan nu zelfstandig verder.' },
    ],
  },
  {
    datum: '2026-08-12',
    titel: 'De app kijkt met je mee',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'Horizon houdt bij welke onderdelen je echt gebruikt en stelt zelf voor wat er beter kan.' },
    ],
  },
  {
    datum: '2026-08-10',
    titel: 'Doelen opgeruimd',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'Hobbydoelen als eigen soort — een spel uitspelen telt niet mee in je voortgangscijfer.' },
      { soort: 'nieuw', tekst: 'Doelen toevoegen vanuit het overzicht, en kolommen die je kunt inklappen.' },
      { soort: 'nieuw', tekst: 'Een prullenbak voor taken, zodat weggooien niet meer definitief is.' },
    ],
  },
  {
    datum: '2026-08-08',
    titel: 'Inzicht in hoe alles samenhangt',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'Inzicht-tab met drie weergaven: een 3D-bol van je projecten, een 2D-kaart en een heatmap.' },
      { soort: 'nieuw', tekst: 'Taken toevoegen en verwijderen rechtstreeks vanuit de kaart.' },
      { soort: 'nieuw', tekst: 'Een startgesprek dat je levensgebieden voor je klaarzet bij je eerste inlog.' },
      { soort: 'nieuw', tekst: 'Stemmingsmeter en een vrije skill-tree bij je level.' },
      { soort: 'beter', tekst: 'Eén controle die alle tabbladen met elkaar vergelijkt en meldt waar je plan uit elkaar loopt.' },
      { soort: 'fix',   tekst: 'Een doel weggooien werkt nu echt overal — het verdwijnt uit de hele app, inclusief XP en prestaties.' },
    ],
  },
  {
    datum: '2026-08-07',
    titel: 'Weekritme',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'Herhaaltaken zijn sleepbaar, met een weekoverzicht dat je urenbalans laat zien.' },
      { soort: 'fix',   tekst: 'Een doel afvinken in de Visie-tab levert nu ook een prestatie op.' },
      { soort: 'fix',   tekst: 'Alle bekende beveiligingslekken in de gebruikte pakketten verholpen.' },
    ],
  },
  {
    datum: '2026-08-06',
    titel: 'Dagboek en prullenbak',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'Dagboek voor vrije verhalen — je AI kan meeschrijven en teruglezen.' },
      { soort: 'nieuw', tekst: 'Prullenbak voor doelen, met herstel.' },
      { soort: 'nieuw', tekst: 'Een gehaald doel wordt automatisch een prestatie.' },
    ],
  },
  {
    datum: '2026-07-29',
    titel: 'Subtaken',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'Taken kunnen subtaken hebben, zichtbaar in het weekitem-paneel en bereikbaar voor je AI.' },
    ],
  },
  {
    datum: '2026-07-27',
    titel: 'Sterren',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'Geef een week-item een ster als het belangrijk is — je AI kan dat ook.' },
    ],
  },
  {
    datum: '2026-07-24',
    titel: 'XP, levels en skills',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'Een compleet XP-systeem: levels, skills en stats, met je AI eraan gekoppeld.' },
    ],
  },
  {
    datum: '2026-07-17',
    titel: 'Op je telefoon',
    wijzigingen: [
      { soort: 'beter', tekst: 'Onderaan-navigatie op mobiel, en de weergave op telefoon en tablet flink opgeknapt.' },
      { soort: 'beter', tekst: 'Meldingen kun je wegklikken.' },
    ],
  },
  {
    datum: '2026-07-16',
    titel: 'Projectgroepen',
    wijzigingen: [
      { soort: 'nieuw', tekst: 'Projecten groeperen en uitklappen, met sub-projecten die je tussen groepen sleept.' },
    ],
  },
]

/** De datum van de laatste release — voor "laatst bijgewerkt" in beeld. */
export function laatsteUpdate(log: Release[] = CHANGELOG): string | null {
  return log[0]?.datum ?? null
}

/** Hoeveel losse wijzigingen er in totaal in het log staan. */
export function aantalWijzigingen(log: Release[] = CHANGELOG): number {
  return log.reduce((n, r) => n + r.wijzigingen.length, 0)
}

/** '2026-08-13' → '13 augustus 2026'. Ongeldige invoer geeft de invoer terug. */
const MAANDEN = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december']

export function datumNL(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const maand = MAANDEN[Number(m[2]) - 1]
  if (!maand) return iso
  return `${Number(m[3])} ${maand} ${m[1]}`
}

/** '2026-08-13' → 'August 13, 2026'. Invalid input returns the input unchanged. */
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export function datumEN(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const month = MONTHS[Number(m[2]) - 1]
  if (!month) return iso
  return `${month} ${Number(m[3])}, ${m[1]}`
}
