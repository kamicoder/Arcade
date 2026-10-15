// Le thème des licornes : la course de l'ancien jeu (C:\Data\Jeux\Licorne). Des licornes à personnaliser,
// une route arc-en-ciel bordée de nuages, des étoiles pour le turbo, des flèches, des bonbons qui rendent
// géante, des nuages d'orage qui étourdissent, et une musique.

import Phaser from "phaser";
// La police ronde de l'ancien jeu, Fredoka (licence libre SIL OFL). Elle voyage DANS le code du jeu
// (?inline : Vite l'écrit en data:...) : elle marche donc sans réseau, comme le reste de l'Arcade.
import fredoka from "./fredoka.woff2?inline";
import type { Theme, Apparence } from "../../theme";
import type { ModeleDeCircuit, Point } from "../../circuits";
import { CONDUITE, NIVEAUX, AIDE_DOIGT, ARC_EN_CIEL, COULEURS, POLICE_LICORNE, LARGEUR_ROUTE, LIMITE, type Look } from "./reglages";
import { fabriquerTextures, textureDeLicorne, imageDuGalop } from "./textures";
import { peindreDecor, dessinerApercu } from "./dessins";
import { decorDesLicornes } from "./decor";
import { sons, MUSIQUES } from "./sons";
import { assombrir, bords } from "../../interface";
import { LARGEUR } from "../../../../socle/style";

// ===== Les licornes, et ce que l'atelier peut y changer =====

const LICORNES: Omit<Look, "ombre">[] = [
  { nom: "Paillette", corps: "#fffafd", criniere: ["#ff7eb6", "#ffc94d", "#7fdcff", "#b98bff"], corne: "#ffcf4d", accessoire: "aucun" },
  { nom: "Guimauve", corps: "#ffd9ec", criniere: ["#ff4f9a", "#ffffff", "#ff9fcf"], corne: "#eef2f8", accessoire: "nœud" },
  { nom: "Myrtille", corps: "#ddd8ff", criniere: ["#4b5bff", "#8fe3ff", "#c59bff"], corne: "#ffcf4d", accessoire: "aucun" },
  { nom: "Caramel", corps: "#ffe6c2", criniere: ["#ff8a3d", "#ffd36e", "#ff5f6d"], corne: "#ff9fcf", accessoire: "aucun" },
  { nom: "Menthe", corps: "#dcfff1", criniere: ["#22c48a", "#9af0ff", "#fff27a"], corne: "#bff4ff", accessoire: "fleurs" },
  { nom: "Nuit étoilée", corps: "#55558a", criniere: ["#ffe66d", "#b98bff", "#7fdcff"], corne: "#ffcf4d", accessoire: "ailes" },
];

const COULEURS_CORPS = [
  "#fffafd", "#ffd9ec", "#ffb3c7", "#ddd8ff", "#c9b8ff", "#d6efff", "#dcfff1",
  "#fff3b0", "#ffe6c2", "#c9a27e", "#e8e8ee", "#9aa0b4", "#55558a", "#2d2d3a",
];

const CRINIERES = [
  ["#ff7eb6", "#ffc94d", "#7fdcff", "#b98bff"],
  ["#ff5e7e", "#ff9f43", "#ffd93d", "#6bdb8f", "#4fc3ff", "#7b7bff", "#c47dff"],
  ["#ff4f9a", "#ffffff", "#ff9fcf"],
  ["#4b5bff", "#8fe3ff", "#c59bff"],
  ["#ff8a3d", "#ffd36e", "#ff5f6d"],
  ["#22c48a", "#9af0ff", "#fff27a"],
  ["#ffe66d", "#b98bff", "#7fdcff"],
  ["#ffffff", "#dcd6ff", "#c0f0ff"],
  ["#2d2d3a", "#ff4f9a", "#2d2d3a"],
  ["#b52bff", "#ff4fd8", "#ffd1f7"],
  ["#ff3b3b", "#ffffff", "#3b6bff"],
];

const CORNES: Record<string, string> = {
  "#ffcf4d": "Or", "#eef2f8": "Argent", "#ff9fcf": "Rose", "#bff4ff": "Cristal", arc: "Arc-en-ciel",
};

const ACCESSOIRES: Record<string, string> = {
  aucun: "Aucun", ailes: "Des ailes", couronne: "Une couronne", "nœud": "Un nœud",
  lunettes: "Des lunettes de soleil", fleurs: "Une couronne de fleurs", chapeau: "Un chapeau de sorcière",
};

// ===== Les circuits : la route passe près de ces points, dans l'ordre =====
// objets : des places le long du tour (0 = la ligne, 0.5 = la moitié) et un décalage sur le côté
//   fleches : [place, décalage]                un petit turbo gratuit
//   orages : [place, décalage, balancement]    ils étourdissent ; un balancement les fait bouger
//   bonbons : [place, décalage]                ils rendent géante
// Les étoiles se posent toutes seules le long du tour.

function pointsHuit(): Point[] {
  const n = 32;
  const a = 1100;
  const points: Point[] = [];
  for (let k = 0; k < n; k++) {
    const t = ((k + 6) % n) / n * Math.PI * 2;
    const s = Math.sin(t);
    const c = Math.cos(t);
    points.push({ x: 1300 + a * c / (1 + s * s), y: 900 + 1.8 * a * s * c / (1 + s * s) });
  }
  return points;
}

function pointsEtoile(): Point[] {
  const points: Point[] = [];
  for (let k = 0; k < 10; k++) {
    const angle = -Math.PI / 2 + (k + 1) * Math.PI / 5;
    const rayon = k % 2 === 0 ? 520 : 860;
    points.push({ x: 1300 + Math.cos(angle) * rayon, y: 1220 + Math.sin(angle) * rayon });
  }
  return points;
}

const CIRCUITS: ModeleDeCircuit[] = [
  {
    id: "coeur", nom: "Le Cœur", largeur: 2600, hauteur: 2400,
    points: [
      { x: 2080, y: 1250 }, { x: 1850, y: 1580 }, { x: 1600, y: 1880 }, { x: 1420, y: 2120 },
      { x: 1180, y: 2120 }, { x: 1000, y: 1880 }, { x: 750, y: 1580 }, { x: 520, y: 1250 },
      { x: 370, y: 900 }, { x: 400, y: 560 }, { x: 600, y: 330 }, { x: 900, y: 280 },
      { x: 1150, y: 420 }, { x: 1240, y: 600 }, { x: 1360, y: 600 }, { x: 1450, y: 420 },
      { x: 1700, y: 280 }, { x: 2000, y: 330 }, { x: 2200, y: 560 }, { x: 2230, y: 900 },
    ],
    objets: { fleches: [[0.1, 0], [0.52, 0]] },
  },
  {
    id: "vallon", nom: "Le Vallon des Nuages", largeur: 2600, hauteur: 1800,
    points: [
      { x: 400, y: 1100 }, { x: 400, y: 450 }, { x: 550, y: 250 }, { x: 950, y: 250 },
      { x: 1150, y: 500 }, { x: 1300, y: 800 }, { x: 1500, y: 500 }, { x: 1700, y: 280 },
      { x: 2200, y: 280 }, { x: 2380, y: 500 }, { x: 2380, y: 950 }, { x: 2150, y: 1100 },
      { x: 1650, y: 1100 }, { x: 1300, y: 1250 }, { x: 1100, y: 1600 }, { x: 600, y: 1650 },
      { x: 400, y: 1450 },
    ],
    objets: { fleches: [[0.08, 0], [0.6, 0]], orages: [[0.3, -35, 0], [0.78, 35, 0]] },
  },
  {
    id: "huit", nom: "Le Grand Huit", largeur: 2600, hauteur: 1800, points: pointsHuit(),
    objets: {
      fleches: [[0.22, 0], [0.72, 0]],
      orages: [[0.1, 0, 0], [0.42, -40, 0], [0.9, 40, 0]],
      bonbons: [[0.58, 0]],
    },
  },
  {
    id: "etoile", nom: "L'Étoile Filante", largeur: 2600, hauteur: 2300, points: pointsEtoile(),
    objets: {
      fleches: [[0.05, 0], [0.45, 0], [0.85, 0]],
      orages: [[0.18, 0, 55], [0.38, 0, 55], [0.62, 0, 55], [0.8, 0, 55]],
      bonbons: [[0.3, 0], [0.7, 0]],
    },
  },
  {
    id: "tourbillon", nom: "Le Tourbillon", largeur: 3000, hauteur: 2300,
    points: [
      { x: 300, y: 1800 }, { x: 300, y: 1200 }, { x: 350, y: 600 }, { x: 600, y: 300 },
      { x: 900, y: 450 }, { x: 1050, y: 800 }, { x: 1300, y: 950 }, { x: 1550, y: 800 },
      { x: 1650, y: 450 }, { x: 1900, y: 280 }, { x: 2300, y: 300 }, { x: 2650, y: 500 },
      { x: 2700, y: 900 }, { x: 2450, y: 1100 }, { x: 2100, y: 1050 }, { x: 1850, y: 1250 },
      { x: 2000, y: 1550 }, { x: 2400, y: 1550 }, { x: 2700, y: 1750 }, { x: 2600, y: 2000 },
      { x: 2100, y: 2050 }, { x: 1600, y: 1950 }, { x: 1300, y: 1650 }, { x: 1000, y: 1500 },
      { x: 800, y: 1700 }, { x: 700, y: 2000 }, { x: 450, y: 2050 },
    ],
    objets: {
      fleches: [[0.06, 0], [0.33, 0], [0.66, 0]],
      orages: [[0.14, 0, 60], [0.24, -40, 0], [0.42, 0, 60], [0.52, 40, 0], [0.74, 0, 60], [0.9, 0, 60]],
      bonbons: [[0.2, 0], [0.6, 0]],
    },
  },
];

// ===== L'apparence des écrans =====

// Les confettis de l'arc-en-ciel, qui tombent du haut de l'écran en tournant.
// frequence : un confetti toutes les tant de millisecondes (0 : seulement quand on lance une pluie).
function confettis(scene: Phaser.Scene, frequence: number): Phaser.GameObjects.Particles.ParticleEmitter {
  type Confetti = Phaser.GameObjects.Particles.Particle & { tourne?: number };
  return scene.add.particles(0, 0, "licorne-particules", {
    frame: ["rond", "etoile"],
    x: { min: bords(scene).gauche, max: bords(scene).droite },   // toute la largeur, même élargie
    y: { min: -80, max: -10 },
    speedX: { min: -40, max: 40 },
    speedY: { min: 60, max: 160 },
    scale: { min: 0.6, max: 1.4 },
    // Chaque confetti tourne à sa vitesse : on la choisit à sa naissance, on l'applique à chaque image
    rotate: {
      onEmit: (p?: Confetti) => {
        if (p) {
          p.tourne = Phaser.Math.FloatBetween(-340, 340);
        }
        return Phaser.Math.Between(0, 360);
      },
      onUpdate: (p: Confetti, _cle: string, t: number, valeur: number) => valeur + (p.tourne ?? 0) * t * 0.03,
    },
    tint: ARC_EN_CIEL.map((c) => parseInt(c.slice(1), 16)),
    lifespan: 8000,
    frequency: frequence > 0 ? frequence : -1,
    maxParticles: 400,
  });
}

// Le ciel des menus : le dégradé, l'arc-en-ciel, des nuages qui passent, quelques confettis
// Le ciel est peint en 960 × 540 : sur un écran plus large (au doigt), il grandit pour le couvrir,
// et les nuages traversent toute la largeur.
function fondDeMenu(scene: Phaser.Scene) {
  const { gauche, droite, milieu } = bords(scene);
  scene.add.image(milieu, 0, "licorne-ciel").setOrigin(0.5, 0).setScale(Math.max(1, (droite - gauche) / LARGEUR));
  for (let i = 0; i < 6; i++) {
    const y = 80 + (i * 97) % 380;
    const vitesse = 12 + i * 5;                       // pixels par seconde
    const depart = gauche + ((i * 230) % (droite - gauche + 300)) - 150;
    const nuage = scene.add.image(depart, y, "licorne-nuage");
    // Un tween qui traverse l'écran, puis un autre qui recommence de la gauche, sans fin
    const traverser = (de: number) => {
      nuage.x = de;
      scene.tweens.add({
        targets: nuage,
        x: droite + 150,
        duration: (droite + 150 - de) / vitesse * 1000,
        onComplete: () => traverser(gauche - 150),
      });
    };
    traverser(depart);
  }
  confettis(scene, 200);
}

// ===== Le thème =====

export const licornes: Theme = {
  id: "licornes",
  titre: "La Course des Licornes",
  emoji: "🦄",
  mots: {
    vehicule: "licorne",
    vehicules: "licornes",
    ta: "Ta licorne",
    rivaux: "licornes de l'ordinateur",
    lesRivaux: "rivales",
    aucunRival: "aucune, juste vous deux",
    premier: "1re",
    turbo: "turbo arc-en-ciel",
    atelier: "Atelier des licornes",
    atelierDetail: "Son nom, ses couleurs, ses accessoires",
    astuce: "Ramasse les étoiles ★ pour le turbo arc-en-ciel",
    objets: "Flèches arc-en-ciel : petit turbo   ·   Bonbon : géante !   ·   Nuage d'orage : la tête qui tourne",
  },
  habillage: {
    police: POLICE_LICORNE,
    contour: "#ffffff",
    degrade: ARC_EN_CIEL,
    couleurs: {
      texte: COULEURS.texte, texteDoux: COULEURS.texteDoux, texteClair: COULEURS.texteClair,
      accent: COULEURS.rose, accent2: COULEURS.violet, record: COULEURS.orange,
      rangs: [COULEURS.or, COULEURS.argent, COULEURS.bronze],
      ligne: "#7a5a9c",
      fondCarte: "rgba(255,255,255,0.55)", fondLigne: "rgba(255,255,255,0.45)", fondChoisi: "#ffffff",
      fondPanneau: 0xffffff, alphaPanneau: 0.82,
      voile: 0xfff0fa, alphaVoile: 0.82,
      separation: 0xffffff,
      carteRoute: "#cdb2ff",
      compte: ARC_EN_CIEL,
      commande: "#8a5cd6", alphaCommande: 0.38,
    },
    icones: {
      reserve: "licorne-compteur-etoile", reserveVide: "licorne-compteur-vide",
      grandeReserve: "licorne-grande-etoile", barre: "licorne-barre",
    },
    fond: fondDeMenu,
    fete: confettis,
    // Un titre en arc-en-ciel, de gauche à droite (à refaire après un setText : il est calé sur la largeur)
    titre: (texte) => {
      const degrade = texte.context.createLinearGradient(0, 0, texte.width, 0);
      ARC_EN_CIEL.forEach((c, i) => degrade.addColorStop(i / (ARC_EN_CIEL.length - 1), c));
      return texte.setFill(degrade);
    },
  },

  equipe: LICORNES as unknown as Apparence[],
  rubriques: [
    { cle: "corps", libelle: "Sa robe", choix: COULEURS_CORPS, montrer: "couleur" },
    { cle: "criniere", libelle: "Sa crinière", choix: CRINIERES, montrer: "couleurs" },
    { cle: "corne", libelle: "Sa corne", choix: Object.keys(CORNES), montrer: (v) => CORNES[v] ?? "Or" },
    { cle: "accessoire", libelle: "Accessoire", choix: Object.keys(ACCESSOIRES), montrer: (v) => ACCESSOIRES[v] ?? "Aucun" },
  ],
  // L'ombre se déduit de la robe : un peu plus sombre
  completer: (a) => ({ ...a, ombre: assombrir(String(a.corps), 0.14) }),
  // Un nom blanc sur blanc ne se lirait pas : on prend alors l'ombre de la robe
  couleur: (a) => {
    const l = a as unknown as Look;
    return l.criniere[0] === "#ffffff" ? l.ombre : l.criniere[0];
  },
  vehicule: {
    resolution: 2,
    echellePortrait: 1,
    texture: (scene, a, resolution, cle) => textureDeLicorne(scene, a as unknown as Look, resolution, cle),
    anime: true,
    imageDe: imageDuGalop,
  },

  conduite: CONDUITE,
  route: { largeur: LARGEUR_ROUTE, barriere: LIMITE },
  niveaux: NIVEAUX,
  niveauParDefaut: "facile",
  aideAuDoigt: AIDE_DOIGT,
  objets: [
    { id: "etoiles", effet: { genre: "reserve" }, portee: 42, retour: 6, auto: true },
    { id: "fleches", effet: { genre: "turbo", duree: 0.7 }, portee: 55, attente: 1 },
    { id: "bonbons", effet: { genre: "geant", duree: 6 }, portee: 42, retour: 12 },
    { id: "orages", effet: { genre: "etourdi", duree: 1.3 }, portee: 38, attente: 1.5 },
  ],

  circuits: CIRCUITS,
  objetsDuCircuitDessine: { fleches: [[0.25, 0], [0.7, 0]] },
  margeEditeur: 230,
  // Le Grand Prix : cinq courses de plus en plus corsées
  grandPrix: [
    { circuit: "coeur", niveau: 0.72 },
    { circuit: "vallon", niveau: 0.77 },
    { circuit: "huit", niveau: 0.81 },
    { circuit: "etoile", niveau: 0.85 },
    { circuit: "tourbillon", niveau: 0.89 },
  ],
  niveauDesRivaux: 0.82,
  ecartsRivaux: [0.03, -0.02, -0.07],      // la première rivale est la plus forte

  charger(scene) {
    // Déjà là, à un lancement d'avant ? (document.fonts.check ne sert à rien ici : il répond oui
    // pour une police qu'il ne connaît pas du tout)
    const dejaLa = [...document.fonts].some((police) => police.family === "Fredoka" && police.status === "loaded");
    if (!dejaLa) {
      scene.load.font("Fredoka", fredoka, "woff2", { weight: "300 700" });
    }
  },
  fabriquerTextures,
  peindreLaPiste: peindreDecor,
  peindreLApercu: (p, monde, points, w, h) => dessinerApercu(p, monde, points, 0, 0, w, h),
  decor: decorDesLicornes,
  camera: { suivi: 0.1, regard: 0.35, lissage: 1, recul: 0, fond: "#e9dcff" },

  sons: {
    menu: sons.menu, non: sons.non, bip: sons.bip, partez: sons.partez, tour: sons.tour,
    record: sons.record, victoire: sons.victoire, atelier: sons.etoile,
  },
  musique: MUSIQUES,
};
