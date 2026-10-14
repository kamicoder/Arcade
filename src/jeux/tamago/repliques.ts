// Ce que dit le Tamago, avec l'humour de TAMAGO-XTREME 3000. Du TypeScript pur.

import type { Etat, Refus, Hasard } from "./vie";

const au = <T>(liste: T[], hasard: Hasard): T => liste[Math.floor(hasard() * liste.length)];

const FAIM = [
  "Je mange mes propres pieds bientôt.", "J'ai l'estomac dans les chaussettes.",
  "Nourris-moi ou je mange le décor.", "Je pourrais manger 47 pizzas là.",
];
const TRISTE = ["Personne ne m'aime. Même pas moi.", "*pleure en pixel*", "On joue ? Dis oui. Dis oui."];
const MALADE = ["Je me sens tout vert. Plus que d'habitude.", "Atchoum. ATCHOUM. Pardon.", "Un médicament ? Un câlin ? Les deux ?"];
const CROTTES = ["On pourrait faire pousser des champignons ici.", "Ça sent... le génie.", "Quelqu'un a un balai ?"];
const CAPRICE = ["JE FAIS CE QUE JE VEUX !", "Non. Juste non.", "J'ai décidé d'être pénible. C'est mon droit."];
const CONTENT = ["La vie est belle. Surtout la mienne.", "Je suis au top du top !", "Je t'aime bien, toi."];
const IDLE = [
  "Est-ce que je suis réel ou juste des pixels ?", "Mon autobiographie s'appellera « Vie de Pixel ».",
  "On est quel jour ? Tamagoudi ?", "Parfois je me parle tout seul. C'est grave ?",
  "Tu savais que les nuages n'ont pas de pieds ?", "Je réfléchis. Ne me dérange pas. C'est fini.",
];

// Une réplique selon son état : ce qui ne va pas passe avant le reste
export function replique(e: Etat, hasard: Hasard): string {
  if (e.appel?.raison === "caprice") return au(CAPRICE, hasard);
  if (e.malade > 0) return au(MALADE, hasard);
  if (e.ventre <= 1) return au(FAIM, hasard);
  if (e.moral <= 1) return au(TRISTE, hasard);
  if (e.crottes.length >= 2 || e.roiCaca !== null) return au(CROTTES, hasard);
  if (e.ventre + e.moral >= 7 && hasard() < 0.5) return au(CONTENT, hasard);
  return au(IDLE, hasard);
}

// Ce que dit une crotte vivante
const CROTTE = ["Je pue donc je suis.", "Prout.", "Je suis ton destin.", "Beurk ? Non, BEAU.", "Je suis un artiste."];
export const parleDeCrotte = (hasard: Hasard) => au(CROTTE, hasard);

const ROI = ["LA CACA-LYPSE EST LÀ !", "JE SUIS ÉTERNEL !", "INCLINE-TOI DEVANT LE ROI !", "TU NE ME NETTOIERAS JAMAIS !"];
export const parleDuRoi = (hasard: Hasard) => au(ROI, hasard);

// Ce qu'il répond à un soin, réussi ou refusé
export const MERCI = {
  repas: ["Miam !", "Encore ! Non. Si. Encore !", "C'était délicieux. Je crois."],
  friandise: ["SUCRE !!!", "Je vibre.", "Une de plus et je décolle."],
  nettoyer: ["Tout propre !", "Ça brille !", "Adieu, mes œuvres d'art."],
  soin: ["Beurk. Merci.", "Je me sens déjà mieux. Un peu."],
  gronder: ["...pardon.", "D'accord, d'accord.", "Je ne recommencerai plus. Peut-être."],
  caresse: ["Hihihi !", "Encore !", "Purrrr.", "♥"],
  jeu: ["Encore une partie !", "J'ai gagné ? J'ai gagné !", "C'était trop bien !"],
};
export const merci = (soin: keyof typeof MERCI, hasard: Hasard) => au(MERCI[soin], hasard);

export const REFUS: Record<Refus, string> = {
  oeuf: "...",
  plein: "J'ai plus faim ! Je vais exploser !",
  caprice: "NON. C'est mon caprice et je le garde.",
  malade: "Pas envie de jouer... je suis malade.",
  "rien-a-nettoyer": "C'est déjà propre ! Regarde !",
  "pas-malade": "Je suis pas malade ! Garde ton médicament.",
  vexe: "Mais j'ai RIEN FAIT !",
  fini: "",
};

export const BONJOUR = ["Bien dormi !", "Te revoilà !", "*bâille* Bonjour !", "J'ai rêvé que j'étais un brocoli."];
export const bonjour = (hasard: Hasard) => au(BONJOUR, hasard);
