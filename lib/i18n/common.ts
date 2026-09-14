// Kort-woordenboek voor UI-tekst die letterlijk overal terugkomt (12+ bestanden
// voor sommige van deze). Één plek, i.p.v. dezelfde woorden per tab opnieuw
// vertalen — zelfde gedachte als lib/reorder.ts: één functioneel blok, overal
// hergebruikt.
import type { Lang } from '../lang'

export const COMMON: Record<Lang, Record<string, string>> = {
  nl: {
    verwijderen: 'Verwijderen',
    nieuw: 'Nieuw',
    sluiten: 'Sluiten',
    klaar: 'Klaar',
    toevoegen: 'Toevoegen',
    opslaan: 'Opslaan',
    annuleren: 'Annuleren',
    terug: 'Terug',
    bewerken: 'Bewerken',
    zoeken: 'Zoeken',
    backlog: 'Backlog',
    bezig: 'Bezig',
    wacht: 'Wacht',
  },
  en: {
    verwijderen: 'Delete',
    nieuw: 'New',
    sluiten: 'Close',
    klaar: 'Done',
    toevoegen: 'Add',
    opslaan: 'Save',
    annuleren: 'Cancel',
    terug: 'Back',
    bewerken: 'Edit',
    zoeken: 'Search',
    backlog: 'Backlog',
    bezig: 'In progress',
    wacht: 'Waiting',
  },
}
