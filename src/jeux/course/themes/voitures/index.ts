// Le thème des voitures : la course de l'atelier PixelForge et de l'ancien jeu (C:\Data\Jeux\Voiture).
// Des voitures à personnaliser (carrosserie, décalco, aileron...), une route bordée de pneus dans l'herbe,
// des bidons de nitro, des flèches, des flaques d'huile, et un moteur qui monte dans les aigus.

import type { Theme, Apparence } from "../../theme";
import type { ModeleDeCircuit } from "../../circuits";
import {
  fabriquerTextures, textureDeVoiture, peindrePiste, peindreApercu, ORANGE, LARGEUR_ROUTE, LIMITE, type LookDeVoiture,
} from "./dessins";
import { decorDesVoitures, moteurDeVoiture } from "./decor";
import { jouerFichier } from "../../son";
import { LARGEUR, HAUTEUR, POLICE } from "../../../../socle/style";

const FOND = "#1c1a25";

// ===== Les voitures, et ce que l'atelier peut y changer =====

// Pixy est la voiture orange de toujours (le joueur 1) ; Glaçon, la troisième, celle du joueur 2 de
// l'ancienne course à deux
const VOITURES: LookDeVoiture[] = [
  { nom: "Pixy", carrosserie: ORANGE, decalco: "aucune", couleurDecalco: "#ffffff", piece: "aucune", numero: "7" },
  { nom: "Éclair", carrosserie: "#f4d03f", decalco: "eclair", couleurDecalco: "#1c1a25", piece: "aucune", numero: "9" },
  { nom: "Glaçon", carrosserie: "#7fd8e6", decalco: "aucune", couleurDecalco: "#ffffff", piece: "aucune", numero: "2" },
  { nom: "Fusée", carrosserie: "#9b6bff", decalco: "flammes", couleurDecalco: "#ffb02e", piece: "aileron", numero: "5" },
  { nom: "Bolide", carrosserie: "#3ec46d", decalco: "bandes", couleurDecalco: "#ffffff", piece: "aucune", numero: "3" },
];

const CARROSSERIES = [
  ORANGE, "#e8453c", "#ff8fd0", "#f4d03f", "#3ec46d", "#2e8b57", "#7fd8e6", "#3b6bff",
  "#9b6bff", "#ffffff", "#9aa0aa", "#2d2d3a", "#8b5a2b", "#ffd479",
];

const COULEURS_DECALCO = ["#ffffff", "#1c1a25", "#ffd23f", "#ffb02e", "#e8453c", "#3b6bff", "#3ec46d", "#ff8fd0", "#9b6bff"];

const DECALCOS: Record<string, string> = {
  aucune: "Aucune", flammes: "Des flammes", bandes: "Des bandes de course", damier: "Un damier",
  eclair: "Un éclair", etoiles: "Des étoiles", numero: "Son numéro",
};

const PIECES: Record<string, string> = {
  aucune: "Aucune", aileron: "Un aileron", "prise-air": "Une prise d'air", gyrophare: "Un gyrophare",
  echappements: "Deux gros pots",
};

// ===== Les circuits : la route passe près de ces points, dans l'ordre =====
// objets : des places le long du tour (0 = la ligne, 0.5 = la moitié) et un décalage sur le côté

const CIRCUITS: ModeleDeCircuit[] = [
  {
    id: "vallon", nom: "Le Vallon", largeur: 2600, hauteur: 1800,
    points: [
      { x: 400, y: 1100 }, { x: 400, y: 450 }, { x: 550, y: 250 }, { x: 950, y: 250 },
      { x: 1150, y: 500 }, { x: 1300, y: 800 }, { x: 1500, y: 500 }, { x: 1700, y: 280 },
      { x: 2200, y: 280 }, { x: 2380, y: 500 }, { x: 2380, y: 950 }, { x: 2150, y: 1100 },
      { x: 1650, y: 1100 }, { x: 1300, y: 1250 }, { x: 1100, y: 1600 }, { x: 600, y: 1650 },
      { x: 400, y: 1450 },
    ],
    objets: {
      bidons: [[0.2, -30], [0.2, 30], [0.65, 0]],
      fleches: [[0.08, 0], [0.55, 0]],
      huiles: [[0.35, -35], [0.85, 35]],
    },
  },
  {
    id: "grande-boucle", nom: "La Grande Boucle", largeur: 2600, hauteur: 1500,
    points: [
      { x: 500, y: 1150 }, { x: 350, y: 750 }, { x: 500, y: 350 }, { x: 1000, y: 250 },
      { x: 1400, y: 450 }, { x: 1800, y: 250 }, { x: 2200, y: 350 }, { x: 2300, y: 750 },
      { x: 2150, y: 1150 }, { x: 1700, y: 1250 }, { x: 1300, y: 1050 }, { x: 900, y: 1250 },
    ],
    objets: {
      bidons: [[0.3, 0], [0.75, -30], [0.75, 30]],
      fleches: [[0.12, 0], [0.45, 0], [0.9, 0]],
      huiles: [[0.6, 0]],
    },
  },
  {
    id: "huit", nom: "Le Huit", largeur: 2600, hauteur: 1800,
    points: [
      { x: 2350, y: 900 }, { x: 2150, y: 1450 }, { x: 1790, y: 1500 }, { x: 1520, y: 1240 },
      { x: 1300, y: 900 }, { x: 1080, y: 560 }, { x: 810, y: 300 }, { x: 450, y: 350 },
      { x: 250, y: 900 }, { x: 450, y: 1450 }, { x: 810, y: 1500 }, { x: 1080, y: 1240 },
      { x: 1300, y: 900 }, { x: 1520, y: 560 }, { x: 1790, y: 310 }, { x: 2150, y: 350 },
    ],
    objets: {
      bidons: [[0.15, 0], [0.5, -30], [0.5, 30], [0.85, 0]],
      fleches: [[0.05, 0], [0.4, 0], [0.7, 0]],
      huiles: [[0.25, 35], [0.62, -35], [0.95, 0]],
    },
  },
];

// ===== Le thème =====

export const voitures: Theme = {
  id: "voitures",
  titre: "Course de voitures",
  emoji: "🏎️",
  mots: {
    vehicule: "voiture",
    vehicules: "voitures",
    ta: "Ta voiture",
    rivaux: "voitures de l'ordinateur",
    lesRivaux: "rivaux",
    aucunRival: "aucun, juste vous deux",
    premier: "1er",
    turbo: "nitro",
    atelier: "Le garage",
    atelierDetail: "Sa carrosserie, sa décalco, un aileron...",
    astuce: "Ramasse les bidons pour la nitro",
    objets: "Flèches jaunes : petite nitro   ·   Flaque d'huile : ça glisse !   ·   Coincé ? La marche arrière",
  },
  habillage: {
    police: POLICE,
    contour: FOND,
    degrade: [ORANGE, "#ffb02e"],
    couleurs: {
      texte: "#ffffff", texteDoux: "#a49cb4", texteClair: "#77708a",
      accent: ORANGE, accent2: "#ffd479", record: "#ffd479",
      rangs: ["#ffd23f", "#c0c6d8", "#d08a50"],
      ligne: "#e9e4f0",
      fondCarte: "#2a2735", fondLigne: "#2a2735", fondChoisi: "#3a3550",
      fondPanneau: 0x000000, alphaPanneau: 0.5,
      voile: 0x000000, alphaVoile: 0.6,
      separation: 0x1c1a25,
      carteRoute: "#8a8794",
      compte: ["#ffffff"],
      commande: "#ffffff", alphaCommande: 0.18,
    },
    icones: {
      reserve: "voiture-bidon-petit", reserveVide: "voiture-bidon-vide",
      grandeReserve: "voiture-bidon-grand", barre: "voiture-barre",
    },
    fond: (scene) => {
      scene.cameras.main.setBackgroundColor(FOND);
    },
    // Un feu d'artifice : des étincelles qui jaillissent du bas de l'écran
    fete: (scene, frequence) => scene.add.particles(0, 0, "etincelle", {
      x: { min: 100, max: LARGEUR - 100 },
      y: HAUTEUR + 10,
      lifespan: 1600,
      speedY: { min: -420, max: -260 },
      speedX: { min: -60, max: 60 },
      gravityY: 250,
      scale: { start: 1.6, end: 0 },
      tint: [0xff7a1a, 0xffd479, 0xffffff, 0x9b6bff],
      frequency: frequence > 0 ? frequence : -1,
      blendMode: "ADD",
    }),
    titre: (texte) => texte.setStroke(FOND, 0),
  },

  equipe: VOITURES as unknown as Apparence[],
  rubriques: [
    { cle: "carrosserie", libelle: "Carrosserie", choix: CARROSSERIES, montrer: "couleur" },
    { cle: "decalco", libelle: "Décalco", choix: Object.keys(DECALCOS), montrer: (v) => DECALCOS[v] ?? "Aucune" },
    { cle: "couleurDecalco", libelle: "Sa couleur", choix: COULEURS_DECALCO, montrer: "couleur" },
    { cle: "piece", libelle: "En plus", choix: Object.keys(PIECES), montrer: (v) => PIECES[v] ?? "Aucune" },
  ],
  completer: (a) => a,
  couleur: (a) => String(a.carrosserie),
  vehicule: {
    resolution: 2,
    echellePortrait: 1.7,                  // une voiture est bien plus petite qu'une licorne
    texture: (scene, a, resolution, cle) => textureDeVoiture(scene, a as unknown as LookDeVoiture, resolution, cle),
    anime: false,
  },

  // Les réglages de la conduite : change-les, relance, et sens la différence au volant
  conduite: {
    acceleration: 380,
    frein: 700,
    vitesseMax: 520,
    marcheArriere: 160,
    virage: 2.6,
    pivot: 0,                              // il faut rouler pour tourner
    frottement: 0.5,                       // la route freine un peu la voiture
    frottementHorsPiste: 2.5,              // l'herbe la freine beaucoup
    adherence: 5,                          // les pneus collent à la route : moins, et la voiture glisse
    adherenceHorsPiste: 1.5,
    turbo: { duree: 1.5, vitesse: 760, poussee: 2, survole: false },
    reserveMax: 3,                         // trois bidons
    taille: 1,
    rayonChoc: 17,
    rayonBarriere: 17,
    choc: 1,
    redresser: 0,
    grille: { recul: 70, rangee: 80, decalage: 35 },
    repechage: { horsPiste: 1.5 },         // presque arrêtée dans l'herbe pendant 1,5 s : remise sur la route
  },
  route: { largeur: LARGEUR_ROUTE, barriere: LIMITE },
  niveaux: [
    { id: "facile", nom: "🐣 Facile", rivaux: 0.68, horsPiste: 1.3, malus: 0.5, direction: 0.7, elastique: 1 },
    { id: "normal", nom: "🏁 Normal", rivaux: 1, horsPiste: 2.5, malus: 1, direction: 0, elastique: 0 },
    { id: "expert", nom: "🔥 Expert", rivaux: 1.08, horsPiste: 2.5, malus: 1, direction: 0, elastique: 0 },
  ],
  niveauParDefaut: "normal",
  // Au doigt, c'est plus difficile qu'au clavier : les rivaux vont un peu moins vite, l'herbe freine moins,
  // l'huile fait glisser deux fois moins longtemps, et la voiture se remet doucement dans l'axe de la route
  aideAuDoigt: { rivaux: 0.92, horsPiste: 1.3, malus: 0.5, direction: 0.7 },
  objets: [
    { id: "bidons", effet: { genre: "reserve" }, portee: 37, retour: 5 },
    { id: "fleches", effet: { genre: "turbo", duree: 0.6 }, portee: 47 },
    { id: "huiles", effet: { genre: "glisse", duree: 1.2, adherence: 0.3 }, portee: 34 },
  ],

  circuits: CIRCUITS,
  objetsDuCircuitDessine: { bidons: [[0.3, 0], [0.7, 0]], fleches: [[0.1, 0]] },
  margeEditeur: 100,
  // Le Grand Prix : une course sur chaque circuit, des rivaux un peu plus forts à chaque fois
  grandPrix: [
    { circuit: "vallon", niveau: 0.7 },
    { circuit: "grande-boucle", niveau: 0.75 },
    { circuit: "huit", niveau: 0.8 },
  ],
  niveauDesRivaux: 0.75,
  ecartsRivaux: [0],

  charger(scene) {
    scene.load.setPath("course/voitures/sons");
    scene.load.audio("voiture-bip", "bip.wav");
    scene.load.audio("voiture-moteur", "moteur.wav");
    scene.load.audio("voiture-moteur-mobile", "moteur-mobile.wav");
    scene.load.setPath();
  },
  fabriquerTextures,
  peindreLaPiste: peindrePiste,
  peindreLApercu: peindreApercu,
  decor: decorDesVoitures,
  camera: { suivi: 0.12, regard: 0.25, lissage: 0.05, recul: 0.15 },

  sons: {
    bip: (scene) => jouerFichier(scene, "voiture-bip"),
    partez: (scene) => jouerFichier(scene, "voiture-bip", { rate: 2 }),
    tour: (scene) => jouerFichier(scene, "voiture-bip", { rate: 1.5 }),
    victoire: (scene) => jouerFichier(scene, "voiture-bip", { rate: 1.5 }),
    record: (scene) => jouerFichier(scene, "voiture-bip", { rate: 3 }),
  },
  moteur: moteurDeVoiture,
};
