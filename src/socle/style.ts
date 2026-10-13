// Ce que toute l'Arcade partage : la taille de l'écran, les couleurs, la police.

export const LARGEUR = 960;
export const HAUTEUR = 540;

export const COULEURS = {
  fond: "#14121c",
  carte: 0x221f2e,                         // Phaser veut les couleurs des formes en nombre (0xRRVVBB)...
  carteBord: 0x3a3550,
  texte: "#ffffff",                        // ... mais celles des textes en chaîne CSS
  texteDoux: "#a59fc0",
  accent: 0xffc83d,
};

export const POLICE = "system-ui, 'Segoe UI', Roboto, sans-serif";
