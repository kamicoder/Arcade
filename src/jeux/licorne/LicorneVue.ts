// Ce qu'on voit d'une licorne en course : un Container qui la suit, avec son halo de turbo, son sprite
// (tourné et animé selon son galop), les étoiles d'étourdissement et, à deux, son étiquette J1 / J2.
// La licorne elle-même (où elle va, à quelle vitesse) est une Coureuse : du calcul pur.

import Phaser from "phaser";
import type { Coureuse } from "./Coureuse";
import { textureDeLicorne, imageDuGalop } from "./textures";
import { PROFONDEUR } from "./reglages";
import { ecrire, enNombre } from "./interface";

const RESOLUTION = 2;                      // la feuille de galop est dessinée en double : nette même géante

export class LicorneVue extends Phaser.GameObjects.Container {
  readonly coureuse: Coureuse;
  private readonly halo: Phaser.GameObjects.Image;
  private readonly corps: Phaser.GameObjects.Sprite;
  private readonly tete: Phaser.GameObjects.Image[] = [];   // les étoiles qui tournent autour de sa tête
  private readonly etiquette?: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, coureuse: Coureuse, avecEtiquette: boolean) {
    super(scene, coureuse.x, coureuse.y);
    this.coureuse = coureuse;
    this.halo = scene.add.image(0, 0, "licorne-halo").setVisible(false);
    this.corps = scene.add.sprite(0, 0, textureDeLicorne(scene, coureuse.look, RESOLUTION), 0);
    this.add([this.halo, this.corps]);
    for (let k = 0; k < 3; k++) {
      const etoile = scene.add.image(0, 0, "licorne-petite-etoile").setVisible(false);
      this.tete.push(etoile);
      this.add(etoile);
    }
    if (avecEtiquette) {
      const couleur = coureuse.look.criniere[0];
      const pointe = scene.add.triangle(0, 0, -7, 0, 7, 0, 0, 9, enNombre(couleur)).setOrigin(0.5, 0);
      const texte = ecrire(scene, 0, -12, "J" + coureuse.joueur, 16, couleur, { contour: true });
      this.etiquette = scene.add.container(0, 0, [pointe, texte]);
      this.add(this.etiquette);
    }
    scene.add.existing(this);
    this.actualiser(0);
  }

  // À chaque image : la vue rattrape la coureuse
  actualiser(horloge: number) {
    const c = this.coureuse;
    const e = c.echelle();
    this.setPosition(c.x, c.y).setDepth(PROFONDEUR.licornes + e);   // les géantes passent par-dessus
    this.corps.setRotation(c.angle + c.tourbillon).setScale(e / RESOLUTION).setFrame(imageDuGalop(c.phase));
    this.halo.setVisible(c.turbo > 0).setScale(e);
    this.tete.forEach((etoile, k) => {
      const a = horloge * 6 + k * Math.PI * 2 / 3;
      etoile.setVisible(c.etourdie > 0).setPosition(Math.cos(a) * 22 * e, -8 + Math.sin(a) * 10 * e).setRotation(a);
    });
    this.etiquette?.setY(-42 * e);
  }
}
