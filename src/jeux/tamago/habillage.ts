// L'habillage du Tamago : ce qui change d'un thème à l'autre (couleurs, police, console). Les règles,
// elles, ne changent pas. Un seul thème pour l'instant, Néon (le look de TAMAGO-XTREME 3000) ; le thème
// Rétro (un écran LCD) viendra en ajouter un second.

import Phaser from "phaser";
// La police pixel de TAMAGO-XTREME, Press Start 2P (licence libre SIL OFL). Elle voyage DANS le code du
// jeu (?inline : Vite l'écrit en data:...) : elle marche donc sans réseau, comme le reste de l'Arcade.
import pressStart from "@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2?inline";

export interface Habillage {
  pixel: string;                           // la police des titres et des boutons (pas pour les longs textes)
  police: string;                          // la police des textes à lire
  fond: number;
  console: { couleur: number; ombre: number; bord: number; halo: number };
  ecran: { fond: number; bord: number; texte: string; doux: string };
  accent: string;                          // le titre, ce qui doit se voir
  accent2: string;
  bulle: { fond: number; texte: string };
  coeur: { plein: string; vide: string };
  charger(scene: Phaser.Scene): void;
}

export const NEON: Habillage = {
  pixel: "'Press Start 2P', monospace",
  police: "system-ui, 'Segoe UI', Roboto, sans-serif",
  fond: 0x0a0a2e,
  console: { couleur: 0x1e1e5a, ombre: 0x12123a, bord: 0x00f3ff, halo: 0xff2d95 },
  ecran: { fond: 0x071a2a, bord: 0x00f3ff, texte: "#e8fbff", doux: "#7fb8c8" },
  accent: "#ff2d95",
  accent2: "#39ff14",
  bulle: { fond: 0xffffff, texte: "#14121c" },
  coeur: { plein: "♥", vide: "♡" },
  charger(scene) {
    // Déjà là, à un lancement d'avant ? (document.fonts.check répond oui même pour une police inconnue)
    const dejaLa = [...document.fonts].some((p) => p.family.replace(/'/g, "") === "Press Start 2P" && p.status === "loaded");
    if (!dejaLa) {
      scene.load.font("Press Start 2P", pressStart, "woff2");
    }
  },
};

export const habillage = NEON;

// La console et son écran, en pixels de jeu (960 × 540)
export const CONSOLE = { x: 480, y: 284, rx: 340, ry: 262 };
export const ECRAN = { x: 280, y: 92, largeur: 400, hauteur: 252 };
export const CENTRE_ECRAN = { x: ECRAN.x + ECRAN.largeur / 2, y: ECRAN.y + ECRAN.hauteur / 2 };
