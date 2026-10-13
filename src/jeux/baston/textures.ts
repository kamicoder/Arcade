// Les images de la baston : les planches des robots (chargées), leurs animations, et les tirs (fabriqués).

import Phaser from "phaser";

export type CouleurDeRobot = "bleu" | "orange";

export const cleDePlanche = (couleur: CouleurDeRobot) => "baston-robot-" + couleur;
export const cleDAnimation = (couleur: CouleurDeRobot, etat: string) => "baston-" + couleur + "-" + etat;

// Une rangée de la planche, telle que le descriptif de l'atelier la décrit
interface DescriptifDAnimation {
  nom: string;
  images: number;
  vitesse: number;                         // images par seconde
}

// Les animations des deux robots, d'après leurs planches. Le .json de chaque planche est un atlas
// Phaser (une case nommée « marche-2 », etc.) qui a gardé la liste « animations » de l'atelier :
// Phaser range ce qu'il ne connaît pas dans texture.customData.
// Les animations sont globales (le gestionnaire this.anims est partagé par toutes les scènes) :
// on ne les crée qu'une fois.
export function creerAnimations(scene: Phaser.Scene) {
  for (const couleur of ["bleu", "orange"] as CouleurDeRobot[]) {
    const planche = scene.textures.get(cleDePlanche(couleur));
    planche.setFilter(Phaser.Textures.FilterMode.NEAREST);     // des pixels nets, pas flous, une fois agrandis
    const descriptif = (planche.customData as { animations: DescriptifDAnimation[] }).animations;
    for (const animation of descriptif) {
      const cle = cleDAnimation(couleur, animation.nom);
      if (scene.anims.exists(cle)) {
        continue;
      }
      scene.anims.create({
        key: cle,
        frames: scene.anims.generateFrameNames(cleDePlanche(couleur), {
          prefix: animation.nom + "-", start: 0, end: animation.images - 1,
        }),
        frameRate: animation.vitesse,
        repeat: -1,                        // comme l'atelier : chaque animation tourne en boucle
      });
    }
  }
}

// Un tir : un rond de la couleur du robot, au cœur tout blanc. Une texture par couleur et par taille.
export function textureDeTir(scene: Phaser.Scene, couleur: number, taille: number): string {
  const cle = "baston-tir-" + couleur.toString(16) + "-" + taille;
  if (!scene.textures.exists(cle)) {
    const g = scene.make.graphics();
    g.fillStyle(couleur).fillEllipse(taille / 2, taille / 2, taille, taille);
    g.fillStyle(0xffffff).fillEllipse(taille / 2, taille / 2, taille - 6, taille - 6);
    g.generateTexture(cle, taille, taille);
    g.destroy();
  }
  return cle;
}
