// La funzionalità va attiva solo a partire dal 1° agosto 2026: prima di quella
// data il banner non deve mai proporsi, anche se ci fossero voci "pendenti".
export const PROPOSAL_FEATURE_LAUNCH = new Date(2026, 7, 1);

export function isProposalFeatureActive(now: Date, launch: Date = PROPOSAL_FEATURE_LAUNCH): boolean {
  return now.getTime() >= launch.getTime();
}
