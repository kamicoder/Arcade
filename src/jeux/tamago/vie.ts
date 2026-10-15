// La vie du Tamago, en TypeScript pur : son état, le temps qui passe, et les soins. Les règles sont
// dans REGLES.md, les chiffres dans reglages.ts.
//
// La scène appelle avancer() à chaque image avec le temps écoulé, tant que l'écran est affiché : le
// Tamago ne vit que pendant qu'on joue avec lui. avancer() renvoie ce qui s'est passé (une crotte, un
// appel, une évolution...) pour que la scène le montre. Le hasard est passé en paramètre : les tests
// peuvent le choisir.

import {
  COEURS, PERTE_VENTRE, PERTE_MORAL, BEBE_PLUS_VITE, CROTTE_MIN, CROTTE_MAX, CROTTES_MAX, CROTTE_FRAICHE,
  MALADE_DES_CROTTES, ROI_CACA_APRES, ROI_CACA_VIE, OUBLI_APRES, CAPRICE_DUREE, DOSES_MIN, DOSES_MAX,
  PART_SI_MALADE, PART_SI_VENTRE_VIDE, OEUF_TAPES, OEUF_ECLOSION, DUREE_STADE, LEGENDE_A, VIE_MAX, VIE_MIN,
  OUBLI_RACCOURCIT, CAPRICES, DISCIPLINE_GENTIL, OUBLIS_GENTIL, POIDS, SURPRISE_MIN, SURPRISE_MAX,
  CARESSE_COMPTE, JOURNAL_MAX, SECONDE, UN_AN, UN_MOIS, BIENTOT, MALADIE_ADULTE_DANS, DISCIPLINE_MAX,
} from "./reglages";
import { forme, ligneeGagnante, LIGNEES, type Stade, type Lignee, type Variante, type Forme } from "./formes";
import { SURPRISES, type Surprise } from "./surprises";

export type Hasard = () => number;         // entre 0 (compris) et 1, comme Math.random
export type RaisonDAppel = "ventre" | "moral" | "caprice";
export type Fin = "vieillesse" | "faim" | "maladie";

export interface Etat {
  version: 2;                              // 2 : le rythme ×4 (octobre 2026) ; une version 1 est convertie (relire)
  stade: Stade;
  lignee: Lignee | null;
  variante: Variante | null;
  legende: boolean;
  tapes: number;                           // l'œuf : les tapes pour le réchauffer
  eclosion: number | null;                 // l'œuf : le temps avant d'éclore, après la dernière tape
  age: number;                             // le temps de jeu depuis l'éclosion
  dansLeStade: number;
  ventre: number;                          // de 0 à 4 cœurs
  moral: number;
  avantPerteVentre: number;
  avantPerteMoral: number;
  discipline: number;                      // en quarts : de 0 à 4 (100 %)
  poids: number;
  crottes: number[];                       // l'âge de chaque crotte à l'écran
  avantCrotte: number;
  roiCaca: number | null;                  // ses points de vie, s'il est là
  quatreCrottesDepuis: number;
  saleDepuis: number;                      // depuis quand il vit avec des crottes (ou le ROI CACA)
  malade: number;                          // les doses de médicament qu'il faut encore ; 0 : en forme
  maladeDepuis: number;
  maladieDuStade: number | null;           // le moment du stade où il tombera malade, une fois
  tropGrosDejaMalade: boolean;
  appel: { raison: RaisonDAppel; depuis: number; compte: boolean } | null;
  caprices: number[];                      // les moments du stade où il fera un caprice
  oublis: number;
  oublisDuStade: number;
  points: Record<Lignee, number>;          // les points de chaque lignée, pendant le stade
  ventreVideDepuis: number;
  derniereCaresse: number;
  avantSurprise: number;
  journal: { age: number; texte: string }[];
  fin: Fin | null;
}

// Ce que avancer() raconte à la scène
export type Evenement =
  | { type: "eclosion" }
  | { type: "evolution"; forme: Forme }
  | { type: "coeur"; jauge: "ventre" | "moral" }
  | { type: "crotte" }
  | { type: "roi-caca" }
  | { type: "malade" }
  | { type: "appel"; raison: RaisonDAppel }
  | { type: "oubli"; raison: RaisonDAppel }
  | { type: "caprice-passe" }
  | { type: "surprise"; surprise: Surprise }
  | { type: "fin"; cause: Fin };

const entre = (hasard: Hasard, min: number, max: number) => min + hasard() * (max - min);
// Le poids de base d'un stade (l'œuf n'en a pas)
const poidsDeBase = (stade: Stade) => (stade === "oeuf" ? 0 : POIDS[stade]);
const pointsAZero = (): Record<Lignee, number> => ({ gourmand: 0, joyeux: 0, propre: 0, style: 0 });

export function nouvelEtat(hasard: Hasard = Math.random): Etat {
  return {
    version: 2, stade: "oeuf", lignee: null, variante: null, legende: false, tapes: 0, eclosion: null,
    age: 0, dansLeStade: 0, ventre: 0, moral: 0, avantPerteVentre: PERTE_VENTRE, avantPerteMoral: PERTE_MORAL,
    discipline: 0, poids: POIDS.bebe, crottes: [], avantCrotte: entre(hasard, CROTTE_MIN, CROTTE_MAX),
    roiCaca: null, quatreCrottesDepuis: 0, saleDepuis: 0, malade: 0, maladeDepuis: 0, maladieDuStade: null,
    tropGrosDejaMalade: false, appel: null, caprices: [], oublis: 0, oublisDuStade: 0, points: pointsAZero(),
    ventreVideDepuis: 0, derniereCaresse: -Infinity, avantSurprise: entre(hasard, SURPRISE_MIN, SURPRISE_MAX),
    journal: [], fin: null,
  };
}

export function formeDe(e: Etat): Forme {
  return forme(e.stade, e.lignee, e.variante, e.legende);
}

export function ageEnAnnees(e: Etat): number {
  return Math.floor(e.age / UN_AN);
}

// L'âge à lire : en mois la première année (« 3 mois »), puis en ans (« 1 an », « 2 ans »)
export function ageEnTexte(age: number): string {
  if (age < UN_AN) {
    const mois = Math.floor(age / UN_MOIS);
    return mois === 0 ? "nouveau-né" : `${mois} mois`;
  }
  const ans = Math.floor(age / UN_AN);
  return ans > 1 ? `${ans} ans` : "1 an";
}

// Où il en est de son stade : la part déjà faite (de 0 à 1), et s'il grandit bientôt. L'œuf compte
// ses tapes (puis éclot bientôt) ; l'adulte a fini de grandir : rien.
export function avantDeGrandir(e: Etat): { fait: number; bientot: boolean } | null {
  if (e.stade === "oeuf") {
    return { fait: e.eclosion !== null ? 1 : e.tapes / OEUF_TAPES, bientot: e.eclosion !== null };
  }
  if (e.stade === "adulte") {
    return null;
  }
  const fait = Math.min(1, e.dansLeStade / DUREE_STADE[e.stade]);
  return { fait, bientot: fait >= BIENTOT };
}

// L'âge où il repartira sur sa planète : chaque oubli raccourcit sa vie
export function finDeVie(e: Etat): number {
  return Math.max(VIE_MIN, VIE_MAX - e.oublis * OUBLI_RACCOURCIT);
}

function noter(e: Etat, texte: string) {
  e.journal.unshift({ age: e.age, texte });
  e.journal.length = Math.min(e.journal.length, JOURNAL_MAX);
}

// —— Le temps ——

export function avancer(e: Etat, duree: number, hasard: Hasard = Math.random): Evenement[] {
  const evenements: Evenement[] = [];
  // Par petits pas d'au plus une seconde : rien ne saute un seuil, même après une longue image
  while (duree > 0 && !e.fin) {
    const pas = Math.min(duree, SECONDE);
    unPas(e, pas, hasard, evenements);
    duree -= pas;
  }
  return evenements;
}

function unPas(e: Etat, pas: number, hasard: Hasard, ev: Evenement[]) {
  if (e.stade === "oeuf") {
    if (e.eclosion !== null) {
      e.eclosion -= pas;
      if (e.eclosion <= 0) {
        eclore(e, hasard);
        ev.push({ type: "eclosion" });
      }
    }
    return;
  }
  e.age += pas;
  e.dansLeStade += pas;
  const vite = e.stade === "bebe" ? BEBE_PLUS_VITE : 1;

  // Les jauges
  e.avantPerteVentre -= pas * vite;
  if (e.avantPerteVentre <= 0) {
    e.avantPerteVentre += PERTE_VENTRE;
    if (e.ventre > 0) {
      e.ventre--;
      ev.push({ type: "coeur", jauge: "ventre" });
    }
  }
  e.avantPerteMoral -= pas * vite;
  if (e.avantPerteMoral <= 0) {
    e.avantPerteMoral += PERTE_MORAL;
    if (e.moral > 0) {
      e.moral--;
      ev.push({ type: "coeur", jauge: "moral" });
    }
  }

  // Les crottes, et le ROI CACA quand on en laisse quatre
  e.crottes = e.crottes.map((age) => age + pas);
  e.avantCrotte -= pas * vite;
  if (e.avantCrotte <= 0) {
    e.avantCrotte = entre(hasard, CROTTE_MIN, CROTTE_MAX);
    if (e.crottes.length < CROTTES_MAX && e.roiCaca === null) {
      e.crottes.push(0);
      ev.push({ type: "crotte" });
    }
  }
  if (e.crottes.length >= CROTTES_MAX && e.roiCaca === null) {
    e.quatreCrottesDepuis += pas;
    if (e.quatreCrottesDepuis >= ROI_CACA_APRES) {
      e.crottes = [];
      e.roiCaca = ROI_CACA_VIE;
      noter(e, "👑💩 Le ROI CACA est arrivé.");
      ev.push({ type: "roi-caca" });
    }
  } else {
    e.quatreCrottesDepuis = 0;
  }

  // La maladie : la saleté, le poids, et une fois par stade
  e.saleDepuis = e.crottes.length > 0 || e.roiCaca !== null ? e.saleDepuis + pas : 0;
  if (e.saleDepuis >= MALADE_DES_CROTTES) {
    e.saleDepuis = 0;
    tomberMalade(e, hasard, ev, "à force de vivre dans ses crottes");
  }
  if (e.maladieDuStade !== null && e.dansLeStade >= e.maladieDuStade) {
    e.maladieDuStade = null;
    tomberMalade(e, hasard, ev, "un petit rhume");
  }
  const tropGros = e.poids >= 2 * poidsDeBase(e.stade);
  if (tropGros && !e.tropGrosDejaMalade) {
    e.tropGrosDejaMalade = true;
    tomberMalade(e, hasard, ev, "trop de friandises");
  } else if (!tropGros) {
    e.tropGrosDejaMalade = false;
  }

  // Partir : malade trop longtemps, ou le ventre vide trop longtemps
  e.maladeDepuis = e.malade > 0 ? e.maladeDepuis + pas : 0;
  e.ventreVideDepuis = e.ventre === 0 ? e.ventreVideDepuis + pas : 0;
  if (e.maladeDepuis >= PART_SI_MALADE) {
    finir(e, "maladie", ev);
    return;
  }
  if (e.ventreVideDepuis >= PART_SI_VENTRE_VIDE) {
    finir(e, "faim", ev);
    return;
  }

  appels(e, pas, ev);

  // Les surprises, à partir de l'enfance
  e.avantSurprise -= pas;
  if (e.avantSurprise <= 0) {
    e.avantSurprise = entre(hasard, SURPRISE_MIN, SURPRISE_MAX);
    if (e.stade !== "bebe") {
      const surprise = SURPRISES[Math.floor(hasard() * SURPRISES.length)];
      surprise.effet(e);
      noter(e, surprise.emoji + " " + surprise.annonce);
      ev.push({ type: "surprise", surprise });
    }
  }

  // Grandir, devenir une légende, vieillir
  if (e.stade !== "adulte" && e.dansLeStade >= DUREE_STADE[e.stade]) {
    grandir(e, hasard);
    ev.push({ type: "evolution", forme: formeDe(e) });
  }
  if (e.stade === "adulte" && !e.legende && e.oublis === 0 && e.discipline === DISCIPLINE_MAX && e.age >= LEGENDE_A) {
    e.legende = true;
    noter(e, `🌟 Il est devenu une légende : ${formeDe(e).nom} !`);
    ev.push({ type: "evolution", forme: formeDe(e) });
  }
  if (e.stade === "adulte" && e.age >= finDeVie(e)) {
    finir(e, "vieillesse", ev);
  }
}

function appels(e: Etat, pas: number, ev: Evenement[]) {
  const appel = e.appel;
  if (appel) {
    appel.depuis += pas;
    const regle = (appel.raison === "ventre" && e.ventre > 0) || (appel.raison === "moral" && e.moral > 0);
    if (regle) {
      e.appel = null;
    } else if (appel.raison === "caprice") {
      if (appel.depuis >= CAPRICE_DUREE) {
        e.appel = null;                    // un caprice ignoré passe tout seul, sans oubli
        ev.push({ type: "caprice-passe" });
      }
    } else if (!appel.compte && appel.depuis >= OUBLI_APRES) {
      appel.compte = true;                 // un seul oubli par appel ; l'appel reste jusqu'au soin
      e.oublis++;
      e.oublisDuStade++;
      noter(e, appel.raison === "ventre" ? "😢 Personne ne lui a donné à manger." : "😢 Personne n'est venu jouer avec lui.");
      ev.push({ type: "oubli", raison: appel.raison });
    }
    return;
  }
  let raison: RaisonDAppel | null = null;
  if (e.ventre === 0) {
    raison = "ventre";
  } else if (e.moral === 0) {
    raison = "moral";
  } else if (e.caprices.length > 0 && e.dansLeStade >= e.caprices[0] && e.malade === 0) {
    e.caprices.shift();
    raison = "caprice";
  }
  if (raison) {
    e.appel = { raison, depuis: 0, compte: false };
    ev.push({ type: "appel", raison });
  }
}

function tomberMalade(e: Etat, hasard: Hasard, ev: Evenement[], pourquoi: string) {
  if (e.malade > 0) {
    return;
  }
  e.malade = Math.floor(entre(hasard, DOSES_MIN, DOSES_MAX + 1));
  noter(e, `🤒 Il est tombé malade (${pourquoi}).`);
  ev.push({ type: "malade" });
}

function finir(e: Etat, cause: Fin, ev: Evenement[]) {
  e.fin = cause;
  e.appel = null;
  noter(e, {
    vieillesse: "🛸 Il est reparti sur sa planète, la tête pleine de souvenirs.",
    faim: "🏃 Il s'est enfui chez le voisin, qui a des croquettes.",
    maladie: "🚑 Il est parti se soigner chez sa grand-mère, sur sa planète.",
  }[cause]);
  ev.push({ type: "fin", cause });
}

// —— Grandir ——

function commencerLeStade(e: Etat, stade: Stade, hasard: Hasard) {
  e.stade = stade;
  e.dansLeStade = 0;
  e.oublisDuStade = 0;
  e.points = pointsAZero();
  e.poids = Math.max(e.poids, poidsDeBase(stade));
  // Les caprices et la maladie du stade tombent à des moments au hasard, pas dès le début du stade
  const duree = stade === "adulte" ? MALADIE_ADULTE_DANS : DUREE_STADE[stade as keyof typeof DUREE_STADE];
  // Un caprice du stade d'avant qui n'a pas pu venir (il appelait déjà, ou il était malade) n'est pas
  // perdu : il vient tôt dans le nouveau stade, sinon sa discipline serait fichue sans qu'on y puisse rien
  const enRetard = e.caprices.map(() => entre(hasard, 0.05, 0.15) * duree);
  const nouveaux = Array.from({ length: CAPRICES[stade as keyof typeof CAPRICES] ?? 0 }, () => entre(hasard, 0.15, 0.85) * duree);
  e.caprices = [...enRetard, ...nouveaux].sort((a, b) => a - b);
  e.maladieDuStade = stade === "bebe" ? null : entre(hasard, 0.2, 0.8) * duree;
}

function eclore(e: Etat, hasard: Hasard) {
  e.eclosion = null;
  e.ventre = 2;
  e.moral = 2;
  commencerLeStade(e, "bebe", hasard);
  noter(e, "🐣 Il est né !");
}

function grandir(e: Etat, hasard: Hasard) {
  const avant = e.stade as "bebe" | "enfant" | "ado";
  const suivant: Stade = avant === "bebe" ? "enfant" : avant === "enfant" ? "ado" : "adulte";
  e.lignee = ligneeGagnante(e.points, e.lignee, hasard);
  const sage = e.oublisDuStade <= OUBLIS_GENTIL && e.discipline >= DISCIPLINE_GENTIL[avant];
  e.variante = sage ? "gentil" : "sauvage";
  commencerLeStade(e, suivant, hasard);
  const nouvelle = formeDe(e);
  noter(e, `✨ Il a grandi : c'est maintenant ${nouvelle.nom} ${nouvelle.emoji}, ${nouvelle.caractere}.`);
}

// —— Les soins ——
// Chacun renvoie s'il a marché, et sinon pourquoi : la scène en fait une réaction.

export type Refus = "oeuf" | "plein" | "caprice" | "malade" | "rien-a-nettoyer" | "pas-malade" | "vexe" | "fini";
export type Reponse = { ok: true; detail?: string } | { ok: false; refus: Refus };

function vivant(e: Etat): Reponse | null {
  if (e.fin) {
    return { ok: false, refus: "fini" };
  }
  if (e.stade === "oeuf") {
    return { ok: false, refus: "oeuf" };
  }
  return null;
}

export function taperLOeuf(e: Etat): boolean {
  if (e.stade !== "oeuf" || e.eclosion !== null) {
    return false;
  }
  e.tapes++;
  if (e.tapes >= OEUF_TAPES) {
    e.eclosion = OEUF_ECLOSION;
  }
  return true;
}

export function nourrir(e: Etat): Reponse {
  const non = vivant(e);
  if (non) return non;
  if (e.appel?.raison === "caprice") return { ok: false, refus: "caprice" };
  if (e.ventre >= COEURS) return { ok: false, refus: "plein" };
  e.ventre++;
  e.poids++;
  e.points.gourmand++;
  return { ok: true };
}

export function donnerUneFriandise(e: Etat): Reponse {
  const non = vivant(e);
  if (non) return non;
  e.moral = Math.min(COEURS, e.moral + 1);
  e.poids += 2;
  e.points.style++;
  return { ok: true };
}

// Le jeu ne commence que s'il veut bien jouer ; finirLeJeu en donne le résultat
export function peutJouer(e: Etat): Reponse {
  const non = vivant(e);
  if (non) return non;
  if (e.appel?.raison === "caprice") return { ok: false, refus: "caprice" };
  if (e.malade > 0) return { ok: false, refus: "malade" };
  return { ok: true };
}

export function finirLeJeu(e: Etat, manchesGagnees: number) {
  if (manchesGagnees >= 3) {
    e.moral = Math.min(COEURS, e.moral + 1);
  }
  e.poids = Math.max(poidsDeBase(e.stade), e.poids - 1);
  e.points.joyeux += 2;
}

export function nettoyer(e: Etat): Reponse {
  const non = vivant(e);
  if (non) return non;
  if (e.roiCaca !== null) {
    e.roiCaca--;
    if (e.roiCaca > 0) {
      return { ok: true, detail: "roi-touche" };
    }
    e.roiCaca = null;
    e.moral = Math.min(COEURS, e.moral + 1);
    e.points.propre += 3;
    noter(e, "🧽 Le ROI CACA est vaincu !");
    return { ok: true, detail: "roi-vaincu" };
  }
  if (e.crottes.length === 0) return { ok: false, refus: "rien-a-nettoyer" };
  for (const age of e.crottes) {
    pointsDeLaCrotte(e, age);
  }
  e.crottes = [];
  return { ok: true };
}

// Une seule crotte, la n° i (on l'a touchée)
export function nettoyerUne(e: Etat, i: number): Reponse {
  const non = vivant(e);
  if (non) return non;
  if (i < 0 || i >= e.crottes.length) return { ok: false, refus: "rien-a-nettoyer" };
  pointsDeLaCrotte(e, e.crottes[i]);
  e.crottes.splice(i, 1);
  return { ok: true };
}

// Une crotte nettoyée vite compte double pour la lignée Propre
function pointsDeLaCrotte(e: Etat, age: number) {
  e.points.propre += age < CROTTE_FRAICHE ? 2 : 1;
}

export function soigner(e: Etat): Reponse {
  const non = vivant(e);
  if (non) return non;
  if (e.malade === 0) return { ok: false, refus: "pas-malade" };
  e.malade--;
  if (e.malade === 0) {
    noter(e, "💊 Il est guéri !");
    return { ok: true, detail: "gueri" };
  }
  return { ok: true, detail: "encore" };
}

export function gronder(e: Etat): Reponse {
  const non = vivant(e);
  if (non) return non;
  if (e.appel?.raison === "caprice") {
    e.appel = null;
    e.discipline = Math.min(DISCIPLINE_MAX, e.discipline + 1);
    return { ok: true };
  }
  e.moral = Math.max(0, e.moral - 1);    // grondé pour rien : il est vexé
  return { ok: false, refus: "vexe" };
}

export function caresser(e: Etat): Reponse {
  const non = vivant(e);
  if (non) return non;
  if (e.age - e.derniereCaresse >= CARESSE_COMPTE) {
    e.derniereCaresse = e.age;
    e.points.style++;
  }
  return { ok: true };
}

// —— La sauvegarde ——

// Une sauvegarde d'une autre forme (abîmée, ou d'une version future) est remplacée par un œuf neuf ;
// un Tamago déjà parti aussi (sinon il resterait là, figé, à ne plus rien vouloir)
export function relire(sauvegarde: unknown): Etat | null {
  if (!sauvegarde || typeof sauvegarde !== "object") {
    return null;
  }
  const lu = sauvegarde as Omit<Partial<Etat>, "version"> & { version?: number };
  if ((lu.version !== 1 && lu.version !== 2) || typeof lu.stade !== "string" || !Array.isArray(lu.crottes) || !lu.points || lu.fin) {
    return null;
  }
  for (const lignee of LIGNEES) {
    if (typeof lu.points[lignee] !== "number") {
      return null;
    }
  }
  const e = (lu.version === 1 ? auNouveauRythme(lu as Partial<Etat>) : lu) as Partial<Etat>;
  // derniereCaresse vaut -Infinity, que JSON écrit null
  return { ...nouvelEtat(), ...e, version: 2, derniereCaresse: e.derniereCaresse ?? -Infinity } as Etat;
}

// Une sauvegarde de la version 1 a vécu au premier rythme, quatre fois plus lent : toutes les durées de
// sa vie sont divisées par 4, pour qu'il continue là où il en était (le même âge affiché, le même
// moment du stade). L'éclosion, à la vitesse de celui qui regarde, ne change pas.
const ANCIEN_RYTHME = 4;

function auNouveauRythme(e: Partial<Etat>): Partial<Etat> {
  const d = (duree: number | undefined) => (typeof duree === "number" ? duree / ANCIEN_RYTHME : duree);
  return {
    ...e,
    age: d(e.age), dansLeStade: d(e.dansLeStade), avantPerteVentre: d(e.avantPerteVentre),
    avantPerteMoral: d(e.avantPerteMoral), avantCrotte: d(e.avantCrotte), quatreCrottesDepuis: d(e.quatreCrottesDepuis),
    saleDepuis: d(e.saleDepuis), maladeDepuis: d(e.maladeDepuis), ventreVideDepuis: d(e.ventreVideDepuis),
    derniereCaresse: d(e.derniereCaresse ?? undefined), avantSurprise: d(e.avantSurprise),
    maladieDuStade: e.maladieDuStade === null ? null : d(e.maladieDuStade),
    crottes: e.crottes?.map((age) => age / ANCIEN_RYTHME),
    caprices: e.caprices?.map((moment) => moment / ANCIEN_RYTHME),
    appel: e.appel ? { ...e.appel, depuis: e.appel.depuis / ANCIEN_RYTHME } : e.appel,
    journal: e.journal?.map((ligne) => ({ ...ligne, age: ligne.age / ANCIEN_RYTHME })),
  };
}
