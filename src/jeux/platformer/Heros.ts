// Le héros : une image animée (sa planche heros.png) qui a un corps Arcade.
// La physique le fait tomber et l'arrête sur les plateformes (collider, dans Monde.ts) ; lui ne
// décide que de sa vitesse, à chaque image : courir, glisser sur la glace, sauter deux fois, nager.

import Phaser from "phaser";
import type { Rect } from "./elements";
import { VITESSE, SAUT, NAGE, GRAVITE, CHUTE_DANS_L_EAU, CHUTE_MAX } from "./reglages";

export interface Entrees {
  gauche: boolean;
  droite: boolean;
  saut: boolean;                           // le saut est tenu
  appui?: boolean;                         // une touche de saut a été enfoncée depuis l'image d'avant (même relâchée depuis)
}

// Ce que les plateformes font au héros pendant cette image (calculé par le Monde)
export interface Terrain {
  auSol: boolean;
  glisse: number;                          // sur la glace : de combien l'élan rattrape la vitesse voulue (0 : pas de glace)
  eau: Rect | null;                        // l'eau où il est plongé
  poussee: number;                         // un tapis roulant ou une plateforme mobile l'emporte (pixels par seconde)
}

export class Heros extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  sauts = 2;                               // les sauts qui lui restent : le double saut
  aSaute = false;                          // vient-il de sauter ? (le son, la poussière)
  private sautAvant = false;               // le saut était-il déjà tenu à l'image d'avant ?
  private elan = 0;                        // sa vitesse de côté (sur la glace, elle change doucement)

  // x, y : le coin haut gauche, comme le « départ » d'un niveau. « planche » : heros ou heros2 (le joueur 2).
  constructor(scene: Phaser.Scene, x: number, y: number, readonly planche = "platformer-heros") {
    super(scene, x + 15, y + 20, planche, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setMaxVelocityY(CHUTE_MAX);
    this.setCollideWorldBounds(true);
    this.play(planche + "-attente");
  }

  avancer(entrees: Entrees, terrain: Terrain, duree: number) {
    const corps = this.body;
    this.aSaute = false;
    if (terrain.auSol) {
      this.sauts = 2;                      // au sol, on récupère ses deux sauts
    }

    // Courir. Sur la glace, l'élan rattrape doucement la vitesse voulue.
    let voulue = ((entrees.droite ? 1 : 0) - (entrees.gauche ? 1 : 0)) * VITESSE;
    if (terrain.eau) {
      voulue *= 0.6;                       // dans l'eau, on avance moins vite
    }
    if (terrain.glisse > 0) {
      const pas = terrain.glisse * duree;
      this.elan = this.elan < voulue ? Math.min(voulue, this.elan + pas) : Math.max(voulue, this.elan - pas);
    } else {
      this.elan = voulue;
    }
    // Contre un mur, l'élan retombe : sinon on repartirait d'un coup en s'en éloignant
    if ((corps.blocked.left && this.elan < 0) || (corps.blocked.right && this.elan > 0)) {
      this.elan = voulue;
    }
    corps.setVelocityX(this.elan + terrain.poussee);
    if (voulue !== 0) {
      this.setFlipX(voulue < 0);           // il regarde où il va
    }

    // Sauter, au moment de l'appui seulement (tenir le saut ne fait pas sauter en boucle).
    // Un appui très bref, enfoncé et relâché entre deux images, compte aussi.
    if (entrees.appui || (entrees.saut && !this.sautAvant)) {
      if (terrain.eau) {                   // dans l'eau, chaque appui fait nager ; la tête dehors, un vrai saut
        corps.setVelocityY(corps.top < terrain.eau.y ? SAUT : NAGE);
        this.sauts = 1;
        this.aSaute = true;
      } else if (this.sauts > 0) {
        corps.setVelocityY(SAUT);
        this.sauts--;
        this.aSaute = true;
      }
    }
    this.sautAvant = entrees.saut;

    // Dans l'eau, on coule doucement : la moitié de la gravité, et jamais vite
    if (terrain.eau) {
      corps.setGravityY(-GRAVITE / 2);
      corps.velocity.y = Math.min(corps.velocity.y, CHUTE_DANS_L_EAU);
    } else {
      corps.setGravityY(0);
    }

    // L'animation : en l'air le saut, au sol la marche s'il avance, sinon l'attente.
    // play(..., true) ne recommence pas une animation qui tourne déjà.
    const animation = !terrain.auSol || this.aSaute ? "saut" : voulue !== 0 ? "marche" : "attente";
    this.play(this.planche + "-" + animation, true);
  }

  // Remis ailleurs (un téléporteur, une deuxième chance) : immobile, l'élan oublié.
  // x, y : le milieu de ses pieds.
  poserA(x: number, y: number) {
    this.body.reset(x, y - this.body.height / 2);
    this.elan = 0;
  }
}

// Les animations du héros, d'après le descriptif de sa planche (heros.json, comme dans l'atelier) :
// une rangée par animation, « images » cases de large, jouées à « vitesse » images par seconde.
export interface Descriptif {
  largeur: number;
  hauteur: number;
  animations: { nom: string; images: number; vitesse: number }[];
}

export function creerLesAnimations(scene: Phaser.Scene, planche: string, descriptif: Descriptif) {
  const parRangee = scene.textures.get(planche).source[0].width / descriptif.largeur;
  descriptif.animations.forEach((animation, rangee) => {
    const cle = planche + "-" + animation.nom;
    if (scene.anims.exists(cle)) {
      return;
    }
    scene.anims.create({
      key: cle,
      frames: scene.anims.generateFrameNumbers(planche, {
        start: rangee * parRangee, end: rangee * parRangee + animation.images - 1,
      }),
      frameRate: animation.vitesse,
      repeat: -1,
    });
  });
}
