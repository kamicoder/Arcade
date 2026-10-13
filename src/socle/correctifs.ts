// Les correctifs de Phaser : des défauts de la version utilisée, réparés ici en attendant qu'ils le
// soient dans Phaser. Chacun dit ce qu'il répare, et comment savoir s'il sert encore.

import Phaser from "phaser";

// Phaser 4.2.1 : sur certains téléphones (vu sur un Pixel 7), des traits partent du coin haut gauche
// de l'écran vers les rectangles arrondis à contour (les cartes du Hub, les panneaux du choix des robots).
//
// Le contour d'une forme est tracé segment par segment par le nœud de rendu DrawLine, qui divise par la
// longueur du segment sans la vérifier (« un chemin bien formé n'a pas de segment de longueur nulle »).
// Or le chemin d'un rectangle arrondi répète la fin de chaque coin au début du côté suivant, et le tri
// des doublons de StrokePathWebGL rate quand l'origine n'est pas (0, 0) : 0 / 0 donne des sommets NaN.
// Les cartes graphiques d'ordinateur jettent ces triangles ; celle du téléphone les dessine vers (0, 0).
//
// Le correctif : un segment de longueur nulle est allongé d'un millième de pixel, invisible, mais assez
// pour que son épaisseur se calcule. Il sert tant que DrawLine.js contient encore la phrase
// « A well-formed path has no zero length segments, so we don't check ».
export function corrigerLesSegmentsNuls(jeu: Phaser.Game) {
  const renderer = jeu.renderer;
  if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) {
    return;                                // en canvas 2D, le navigateur trace lui-même : rien à corriger
  }
  // Un seul nœud DrawLine pour tout le jeu : StrokePath (les formes) et les Graphics s'en servent
  const noeud = renderer.renderNodes.getNode("DrawLine") as unknown as {
    run: (...args: unknown[]) => void;
  } | null;
  if (!noeud) {
    return;
  }
  const tracer = noeud.run.bind(noeud);
  noeud.run = (contexte, matrice, ax, ay, bx, by, ...reste) => {
    if (ax === bx && ay === by) {
      bx = (bx as number) + 0.001;
    }
    tracer(contexte, matrice, ax, ay, bx, by, ...reste);
  };
}
