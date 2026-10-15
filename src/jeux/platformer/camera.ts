// La caméra qui suit un héros en regardant devant lui : on voit mieux où l'on va que d'où l'on vient.
//
// Phaser suit déjà la cible (startFollow, avec un retard doux, le « lerp ») ; son décalage (followOffset)
// la fait viser un peu à côté. Ici, on fait glisser ce décalage vers l'avant du héros, dans le sens où il
// regarde : quand il se retourne, la caméra passe doucement de l'autre côté, sans à-coup. Une petite zone
// morte (setDeadzone) laisse le héros aller et venir de quelques pas sans que tout l'écran bouge.
// En hauteur, la caméra montre déjà les 480 pixels du monde (ses bornes) : elle ne monte et ne descend
// que zoomée (la fête du drapeau).

import type Phaser from "phaser";
import type { Heros } from "./Heros";
import { AVANCE_CAMERA } from "./reglages";

const ZONE_MORTE = 40;                     // pixels du monde, de côté
const GLISSE = 4;                          // le décalage rattrape sa place à cette vitesse (par seconde)

export class CameraDevant {
  private sens = 1;                        // 1 : il regarde à droite ; -1 : à gauche

  constructor(private readonly camera: Phaser.Cameras.Scene2D.Camera, private readonly heros: Heros) {}

  // Suivre le héros (au départ, ou de nouveau après une deuxième chance), le regard déjà devant lui
  suivre() {
    this.sens = this.heros.flipX ? -1 : 1;
    this.camera.startFollow(this.heros, true, 0.15, 0.15, this.voulu(), 0);
    this.camera.setDeadzone(ZONE_MORTE, ZONE_MORTE);
  }

  // À chaque image : le décalage glisse vers l'avant du héros
  avancer(duree: number) {
    this.sens = this.heros.flipX ? -1 : 1;
    const decalage = this.camera.followOffset;
    decalage.x += (this.voulu() - decalage.x) * Math.min(1, duree * GLISSE);
  }

  // Le décalage voulu. Phaser vise « héros moins décalage » : devant à droite, c'est un décalage négatif.
  private voulu(): number {
    return -this.sens * AVANCE_CAMERA * this.camera.width / this.camera.zoom;
  }
}
