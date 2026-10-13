// Un tir : il file tout droit, jusqu'à toucher un robot ou sortir de l'arène.
// Une image de la physique Arcade, sans gravité : son corps le fait avancer tout seul.

import Phaser from "phaser";
import type { PlanDeTir } from "./modeles";
import { textureDeTir } from "./textures";
import { VITESSE_TIR, PROFONDEUR } from "./reglages";

export class Tir extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.Body;

  readonly degats: number;
  readonly direction: 1 | -1;

  constructor(scene: Phaser.Scene, groupe: Phaser.Physics.Arcade.Group, plan: PlanDeTir, couleur: number, special: boolean) {
    super(scene, plan.x, plan.y, textureDeTir(scene, couleur, plan.taille));
    this.degats = plan.degats;
    this.direction = plan.direction;
    scene.add.existing(this);
    this.setDepth(PROFONDEUR.tirs);
    // Le groupe lui donne un corps ; ensuite seulement, on règle ce corps
    groupe.add(this);
    this.body.setAllowGravity(false);
    this.body.setVelocityX(this.direction * VITESSE_TIR);

    if (special) {
      // Le coup spécial laisse une traînée : un émetteur de particules qui le suit (follow)
      const trainee = scene.add.particles(0, 0, "etincelle", {
        follow: this,
        lifespan: 300,
        frequency: 15,
        speed: { min: 0, max: 30 },
        scale: { start: plan.taille / 14, end: 0 },
        alpha: { start: 0.7, end: 0 },
        tint: couleur,
        blendMode: "ADD",
      }).setDepth(PROFONDEUR.trainees);
      // Le tir disparaît : la traînée s'arrête, et s'en va quand sa dernière particule s'éteint
      this.once(Phaser.GameObjects.Events.DESTROY, () => {
        if (trainee.scene) {
          trainee.stop();
          trainee.once(Phaser.GameObjects.Particles.Events.COMPLETE, () => trainee.destroy());
        }
      });
    }
  }

  get centreX(): number {
    return this.x;
  }
}
