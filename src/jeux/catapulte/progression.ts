// Ce que la catapulte garde d'une partie à l'autre : pour chaque niveau gagné, ses étoiles et son
// meilleur score. Un niveau s'ouvre quand celui d'avant est gagné.

import { lire, ecrire } from "../../socle/sauvegarde";
import { SAUVEGARDE } from "./reglages";

export interface Resultat {
  etoiles: number;
  score: number;
}

const CLE = SAUVEGARDE + "/niveaux";

export function resultats(): Record<number, Resultat> {
  const tout = lire<Record<number, Resultat>>(CLE);
  return tout && typeof tout === "object" ? tout : {};
}

export function ouvert(numero: number): boolean {
  return numero === 0 || !!resultats()[numero - 1];
}

// Garde le meilleur des deux : les étoiles et le score ne baissent jamais. Renvoie vrai pour un record.
export function garder(numero: number, resultat: Resultat): boolean {
  const tout = resultats();
  const avant = tout[numero];
  const record = !avant || resultat.score > avant.score;
  tout[numero] = {
    etoiles: Math.max(resultat.etoiles, avant?.etoiles ?? 0),
    score: Math.max(resultat.score, avant?.score ?? 0),
  };
  ecrire(CLE, tout);
  return record;
}
