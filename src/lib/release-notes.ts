// Novità mostrate nel pop-up di benvenuto della dashboard, tenute allineate
// a mano con le ultime voci del foglio Notion "Implementazioni". L'elenco è
// in ordine dalla più recente alla più vecchia.
export type ReleaseNoteIcon = "bell" | "receipt" | "pie-chart";

export type ReleaseNote = {
  date: string; // yyyy-MM-dd, data della voce su Notion
  title: string;
  description: string;
  tone: "new" | "improved";
  icon: ReleaseNoteIcon;
};

export const releaseNotes: ReleaseNote[] = [
  {
    date: "2026-07-13",
    title: "Pop-up di benvenuto",
    description:
      "Un saluto personalizzato all'apertura della dashboard, con le ultime novità rilasciate.",
    tone: "new",
    icon: "bell",
  },
  {
    date: "2026-07-13",
    title: "Gestione Bollette",
    description:
      "Nuova sezione per bollette e scadenze: inserimento manuale, foto e promemoria di pagamento.",
    tone: "new",
    icon: "receipt",
  },
  {
    date: "2026-07-12",
    title: "Grafico spese per categoria",
    description:
      'Risolto il bug che duplicava la voce "Altro" nella ciambella e nel grafico a barre del Forecast.',
    tone: "improved",
    icon: "pie-chart",
  },
];

// Le ultime `count` voci più recenti (non necessariamente della stessa data):
// così il pop-up mostra sempre le ultime 3 novità pubblicate su Notion, anche
// quando sono state aggiunte in giorni diversi.
export function latestReleaseNotes(
  count = 3,
  notes: ReleaseNote[] = releaseNotes,
): { date: string | null; notes: ReleaseNote[] } {
  if (notes.length === 0) return { date: null, notes: [] };
  const sorted = [...notes].sort((a, b) => b.date.localeCompare(a.date));
  const top = sorted.slice(0, count);
  return { date: top[0].date, notes: top };
}
