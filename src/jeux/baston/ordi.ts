// Le robot de l'ordinateur. Une « IA » de jeu, la plus simple : des règles, écrites avec des if.
// Du TypeScript pur : il regarde les deux robots et fabrique les mêmes commandes que le clavier.

import { aucuneCommande, type Commandes } from "./commandes";
import { ORDI } from "./reglages";

// Ce que le cerveau a besoin de voir d'un robot
export interface VueDeRobot {
  centreX: number;
  etat: string;
  invincible: number;
  listeDesTirs: { centreX: number; direction: number }[];
}

// L'atelier tirait au sort à chaque tour de 1/60 s. Une image peut durer plus ou moins longtemps :
// on ramène la chance à la durée de l'image, pour que l'ordinateur joue pareil à 30 ou à 144 images/s.
export function auHasard(chanceParTour: number, duree: number, hasard = Math.random): boolean {
  return hasard() < 1 - Math.pow(1 - chanceParTour, duree * 60);
}

// duree : les secondes de cette image ; aide : moins de 1, il frappe moins souvent (au doigt)
export function cerveau(moi: VueDeRobot, adversaire: VueDeRobot, duree: number, aide = 1): Commandes {
  const commandes = aucuneCommande();
  const distance = adversaire.centreX - moi.centreX;      // positive : l'adversaire est à sa droite

  // Règle 1 : un tir arrive sur lui, il saute par-dessus
  for (const tir of adversaire.listeDesTirs) {
    const ecart = moi.centreX - tir.centreX;
    if (ecart * tir.direction > 0 && Math.abs(ecart) < ORDI.danger) {
      commandes.saut = true;
    }
  }

  // Règle 2 : trop loin, il s'approche, et il tire de temps en temps
  if (Math.abs(distance) > ORDI.pres) {
    commandes.droite = distance > 0;
    commandes.gauche = distance < 0;
    commandes.tirer = auHasard(ORDI.tir, duree);
  } else {
    // Règle 3 : tout près, il frappe de temps en temps (appuyer à chaque image, ce serait garder la touche)
    commandes.frapper = auHasard(ORDI.frappe * aide, duree);
  }

  // Règle 4 : touché, il prend ses distances ; face à un coup qui arrive tout près, il recule parfois
  const menace = adversaire.etat === "attaque" && Math.abs(distance) < ORDI.danger;
  if (moi.invincible > 0 || (menace && auHasard(ORDI.recul, duree))) {
    commandes.frapper = false;
    commandes.gauche = distance > 0;       // l'adversaire est à droite : il part à gauche
    commandes.droite = distance < 0;
  }
  return commandes;
}
