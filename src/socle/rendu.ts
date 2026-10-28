// WebGL ou canvas 2D : le moteur de rendu de l'Arcade, choisi au démarrage.
//
// Phaser.AUTO prend WebGL dès que le navigateur dit le connaître. Mais sur un vieil ordinateur, le
// navigateur refuse souvent la carte graphique (pilote trop vieux, sur liste noire) et fait tout le
// WebGL au processeur (SwiftShader, le « Microsoft Basic Render Driver ») : le jeu devient injouable.
// Dans ce cas, le canvas 2D, que le navigateur dessine avec ses propres outils, va bien plus vite.
//
// Pour essayer : ?rendu=canvas ou ?rendu=webgl dans l'adresse impose l'un ou l'autre.

import Phaser from "phaser";

// Les noms que donnent les moteurs WebGL qui tournent au processeur
const AU_PROCESSEUR = /swiftshader|llvmpipe|softpipe|software|basic render/i;

// Le type de rendu à donner à Phaser.Game, avant de le créer
export function choisirLeRendu(): number {
  const impose = new URLSearchParams(location.search).get("rendu");
  if (impose === "canvas") {
    return Phaser.CANVAS;
  }
  if (impose === "webgl") {
    return Phaser.WEBGL;
  }
  // failIfMajorPerformanceCaveat : le navigateur refuse lui-même un WebGL qu'il sait trop lent
  const toile = document.createElement("canvas");
  const gl = toile.getContext("webgl2", { failIfMajorPerformanceCaveat: true })
    ?? toile.getContext("webgl", { failIfMajorPerformanceCaveat: true });
  if (!gl) {
    console.info("L'Arcade dessine en canvas 2D : pas de WebGL rapide sur cet appareil");
    return Phaser.CANVAS;
  }
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const nom = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  gl.getExtension("WEBGL_lose_context")?.loseContext();   // l'essai rend sa place tout de suite
  if (AU_PROCESSEUR.test(nom)) {
    console.info("L'Arcade dessine en canvas 2D : le WebGL de cet appareil tourne au processeur (" + nom + ")");
    return Phaser.CANVAS;
  }
  return Phaser.AUTO;
}

// Les teintes (setTint, setTintMode, le tint des particules) n'existent qu'en WebGL : en canvas, Phaser
// les ignore, et le flash blanc d'un coup reçu, la balle de feu ou les couleurs des étincelles
// disparaissent. On les refait ici : un objet teinté est dessiné à partir d'une copie colorée de son
// image, faite une fois puis gardée. Seuls MULTIPLY (la couleur multipliée) et FILL (la silhouette
// d'une seule couleur) servent dans l'Arcade ; les autres modes sont dessinés comme MULTIPLY, et la
// teinte d'un coin (tintTopLeft) vaut pour toute l'image.
//
// Une image qui change en cours de jeu (une RenderTexture, un texte) garderait sa vieille copie : on
// ne teinte que des images fixes.
export function teindreEnCanvas(jeu: Phaser.Game) {
  const renderer = jeu.renderer;
  if (!(renderer instanceof Phaser.Renderer.Canvas.CanvasRenderer)) {
    return;
  }

  // Les images, sprites et images répétées passent tous par batchSprite
  const dessinerUnSprite = renderer.batchSprite.bind(renderer);
  renderer.batchSprite = (objet, frame, camera, parent) => {
    const { tintMode, tintTopLeft } = objet as unknown as Phaser.GameObjects.Components.Tint;
    if (tintMode === undefined || (tintMode !== Phaser.TintModes.FILL && tintTopLeft === 0xffffff)) {
      dessinerUnSprite(objet, frame, camera, parent);
      return;
    }
    avecDesCopies(renderer.currentContext, () => ({ couleur: tintTopLeft, mode: tintMode }),
      () => dessinerUnSprite(objet, frame, camera, parent));
  };

  // Les particules : chacune a sa teinte, et l'émetteur son mode
  // alive (les particules en vie) n'est pas dans les types de Phaser
  type Emetteur = Phaser.GameObjects.Particles.ParticleEmitter & { alive: Phaser.GameObjects.Particles.Particle[] };
  const prototype = Phaser.GameObjects.Particles.ParticleEmitter.prototype as unknown as {
    renderCanvas: (renderer: Phaser.Renderer.Canvas.CanvasRenderer, emetteur: Emetteur, camera: Phaser.Cameras.Scene2D.Camera, parent?: unknown) => void;
  };
  const dessinerDesParticules = prototype.renderCanvas;
  prototype.renderCanvas = function (renderer, emetteur, camera, parent) {
    const vivantes = emetteur.alive;
    const mode = emetteur.tintMode;
    if (mode !== Phaser.TintModes.FILL && vivantes.every((p) => p.tint === 0xffffff)) {
      dessinerDesParticules.call(this, renderer, emetteur, camera, parent);
      return;
    }
    // Phaser trie puis saute certaines particules sans rien dessiner : on refait son tri et ses sauts
    // (ParticleEmitterCanvasRenderer.js) pour savoir à qui revient chaque drawImage
    if (emetteur.sortCallback) {
      emetteur.depthSort();
    }
    const alpha = emetteur.alpha * camera.alpha;
    const dessinees = vivantes.filter((p) => {
      const morceau = p.frame.canvasData as { width: number; height: number };
      return p.alpha * alpha > 0 && p.scaleX !== 0 && p.scaleY !== 0 && morceau.width > 0 && morceau.height > 0;
    });
    let n = 0;
    avecDesCopies(renderer.currentContext, () => ({ couleur: dessinees[n++]?.tint ?? 0xffffff, mode }),
      () => dessinerDesParticules.call(this, renderer, emetteur, camera, parent));
  };
}

type Teinte = { couleur: number; mode: number };
type DessinDecoupe = (image: CanvasImageSource, sx: number, sy: number, sw: number, sh: number,
  dx: number, dy: number, dw: number, dh: number) => void;

// Le temps de dessiner, chaque drawImage du contexte prend la copie colorée de son morceau d'image
function avecDesCopies(contexte: CanvasRenderingContext2D, teinte: () => Teinte, dessiner: () => void) {
  const original = CanvasRenderingContext2D.prototype.drawImage as DessinDecoupe;
  const remplacant: DessinDecoupe = (image, sx, sy, sw, sh, dx, dy, dw, dh) => {
    const { couleur, mode } = teinte();
    if (mode !== Phaser.TintModes.FILL && couleur === 0xffffff) {
      original.call(contexte, image, sx, sy, sw, sh, dx, dy, dw, dh);
    } else {
      original.call(contexte, copieColoree(image, sx, sy, sw, sh, couleur, mode), 0, 0, sw, sh, dx, dy, dw, dh);
    }
  };
  (contexte as unknown as { drawImage: DessinDecoupe }).drawImage = remplacant;
  try {
    dessiner();
  } finally {
    // Le contexte retrouve le drawImage de son prototype
    delete (contexte as unknown as { drawImage?: DessinDecoupe }).drawImage;
  }
}

// Les copies déjà faites, par image puis par morceau et couleur
const copies = new WeakMap<object, Map<string, HTMLCanvasElement>>();
const COPIES_PAR_IMAGE = 200;              // au-delà, on recommence : une couleur qui varie sans cesse ne remplit pas la mémoire

function copieColoree(image: CanvasImageSource, sx: number, sy: number, sw: number, sh: number,
  couleur: number, mode: number): HTMLCanvasElement {
  let deCetteImage = copies.get(image);
  if (!deCetteImage) {
    deCetteImage = new Map();
    copies.set(image, deCetteImage);
  }
  const cle = sx + "," + sy + "," + sw + "," + sh + "," + couleur + "," + (mode === Phaser.TintModes.FILL ? "f" : "m");
  let copie = deCetteImage.get(cle);
  if (copie) {
    return copie;
  }
  if (deCetteImage.size >= COPIES_PAR_IMAGE) {
    deCetteImage.clear();
  }
  copie = document.createElement("canvas");
  copie.width = Math.max(1, Math.ceil(sw));
  copie.height = Math.max(1, Math.ceil(sh));
  const p = copie.getContext("2d")!;
  p.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  p.fillStyle = "#" + couleur.toString(16).padStart(6, "0");
  if (mode === Phaser.TintModes.FILL) {
    // La silhouette : la couleur, là où l'image n'est pas transparente
    p.globalCompositeOperation = "source-in";
    p.fillRect(0, 0, copie.width, copie.height);
  } else {
    // La couleur multipliée partout, puis la transparence de l'image remise par-dessus
    p.globalCompositeOperation = "multiply";
    p.fillRect(0, 0, copie.width, copie.height);
    p.globalCompositeOperation = "destination-in";
    p.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  }
  deCetteImage.set(cle, copie);
  return copie;
}
