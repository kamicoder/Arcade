// Ce que le casse-briques garde d'une partie à l'autre : pour chaque niveau gagné, ses étoiles et son
// meilleur score ; et le record du mode sans fin. Un niveau s'ouvre quand celui d'avant est gagné, et
// le mode sans fin quand le dernier niveau l'est.

import { lire, ecrire } from "../../socle/sauvegarde";
import { NIVEAUX } from "./niveaux";
import { SAUVEGARDE } from "./reglages";

export interface Resultat {
  etoiles: number;
  score: number;
}

export interface RecordSansFin {
  score: number;
  mur: number;                             // le mur atteint
}

const NIVEAUX_GAGNES = SAUVEGARDE + "/niveaux";
const SANS_FIN = SAUVEGARDE + "/sans-fin";

export function resultats(): Record<number, Resultat> {
  const tout = lire<Record<number, Resultat>>(NIVEAUX_GAGNES);
  return tout && typeof tout === "object" ? tout : {};
}

export function ouvert(numero: number): boolean {
  return numero === 0 || !!resultats()[numero - 1];
}

export function sansFinOuvert(): boolean {
  return !!resultats()[NIVEAUX.length - 1];
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
  ecrire(NIVEAUX_GAGNES, tout);
  return record;
}

export function recordSansFin(): RecordSansFin {
  return lire<RecordSansFin>(SANS_FIN) ?? { score: 0, mur: 0 };
}

// Renvoie vrai pour un nouveau record
export function garderSansFin(resultat: RecordSansFin): boolean {
  const avant = recordSansFin();
  if (resultat.score <= avant.score) {
    return false;
  }
  ecrire(SANS_FIN, resultat);
  return true;
}

// Les étoiles d'un niveau gagné : trois sans perdre de balle, deux pour une perdue, une sinon
export function etoiles(viesPerdues: number): number {
  return Math.max(1, 3 - viesPerdues);
}
