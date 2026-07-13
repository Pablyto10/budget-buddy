// Novità mostrate nel pop-up di benvenuto della dashboard. Ogni voce ha una
// data di rilascio: il pop-up si propone quando ci sono novità più recenti
// dell'ultimo batch che l'utente ha già visto.
export type ReleaseNoteIcon = "calendar" | "credit-card" | "target";

export type ReleaseNote = {
  date: string; // yyyy-MM-dd
  title: string;
  description: string;
  tone: "new" | "improved";
  icon: ReleaseNoteIcon;
};

export const releaseNotes: ReleaseNote[] = [
  {
    date: "2026-07-12",
    title: "Proposta di inizio mese",
    description:
      "Un banner ti propone stipendio e spese ricorrenti da registrare non appena inizia il mese.",
    tone: "new",
    icon: "calendar",
  },
  {
    date: "2026-07-12",
    title: "Riepilogo carta di credito",
    description:
      "Vedi subito quanto è stato addebitato questo mese, senza cercarlo tra i movimenti.",
    tone: "improved",
    icon: "credit-card",
  },
  {
    date: "2026-07-12",
    title: "Foto sugli obiettivi",
    description:
      "Aggiungi un'immagine al tuo obiettivo di risparmio per vederne l'avanzamento a colpo d'occhio.",
    tone: "new",
    icon: "target",
  },
];

export function latestReleaseBatch(notes: ReleaseNote[] = releaseNotes): {
  date: string | null;
  notes: ReleaseNote[];
} {
  if (notes.length === 0) return { date: null, notes: [] };
  const latestDate = notes.reduce((max, n) => (n.date > max ? n.date : max), notes[0].date);
  return { date: latestDate, notes: notes.filter((n) => n.date === latestDate) };
}
