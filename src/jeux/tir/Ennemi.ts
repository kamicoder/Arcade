// Les ennemis et le boss.
//
// Un ennemi est un PathFollower : une image qui glisse le long d'un chemin (une courbe de Phaser) en un
// temps donné, sans qu'on calcule sa vitesse. Il a quand même un corps Arcade, pour les « overlap » avec
// les balles et le vaisseau ; ce corps ne bouge pas tout seul (moves = false) : il suit l'image.
// Le boss, lui, se déplace par tweens : il descend, puis va et vient en haut de l'écran.

import Phaser from "phaser";
import type { Apparition } from "./vagues";
import { allure } from "./vagues";
import { ENNEMIS, BOSS, type GenreDEnnemi } from "./reglages";

// Ce que les ennemis demandent à la partie
export interface Terrain {
  cible(): Phaser.Math.Vector2;            // où viser : le vaisseau
  tirer(x: number, y: number, angle: number, vitesse?: number): void;   // angle en degrés, 90 = vers le bas
  parti(ennemi: Ennemi | Boss): void;      // sorti de l'écran sans être abattu
}

export class Ennemi extends Phaser.GameObjects.PathFollower {
  declare body: Phaser.Physics.Arcade.Body;
  readonly genre: GenreDEnnemi;
  vie: number;
  private readonly cadence: number;
  private prochainTir: number;

  constructor(scene: Phaser.Scene, private terrain: Terrain, apparition: Apparition, serie: number) {
    const [depart, ...suite] = apparition.chemin.map((p) => new Phaser.Math.Vector2(p.x, p.y));
    const chemin = new Phaser.Curves.Path(depart.x, depart.y);
    if (suite.length === 1) {
      chemin.lineTo(suite[0]);
    } else {
      chemin.splineTo(suite);
    }
    super(scene, chemin, depart.x, depart.y, "tir-" + apparition.genre);
    this.genre = apparition.genre;
    const fiche = ENNEMIS[this.genre];
    this.vie = fiche.vie + (this.genre === "lourd" ? 4 * serie : 0);
    this.cadence = fiche.tir / allure(serie);
    this.prochainTir = scene.time.now + 600 + Math.random() * this.cadence;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.moves = false;
    // Les corps Arcade ne tournent pas : un rond, qui reste juste quand l'image tourne
    const rayon = Math.min(this.width, this.height) * 0.4;
    this.body.setCircle(rayon, this.width / 2 - rayon, this.height / 2 - rayon);
    this.setDepth(3);

    // Les petits suivent leur chemin le nez en avant ; leur image regarde vers le bas (90°)
    const tourne = this.genre !== "lourd";
    this.startFollow({
      duration: apparition.duree,
      rotateToPath: tourne,
      rotationOffset: -90,
      onComplete: () => {
        if (!this.active) {
          return;
        }
        if (apparition.attente) {
          // Arrivé à sa place : il se remet droit, tire un moment, puis plonge
          this.scene.tweens.add({ targets: this, angle: 0, duration: 300 });
          this.scene.time.delayedCall(apparition.attente, () => this.plonger());
        } else {
          this.terrain.parti(this);
          this.destroy();
        }
      },
    });
  }

  // Vers le bas de l'écran, en accélérant, un peu vers le joueur
  private plonger() {
    if (!this.active) {
      return;
    }
    const cible = this.terrain.cible();
    this.scene.tweens.add({
      targets: this, y: 620, x: (this.x + cible.x) / 2, duration: 1600, ease: "Quad.In",
      onComplete: () => {
        if (this.active) {
          this.terrain.parti(this);
          this.destroy();
        }
      },
    });
  }

  preUpdate(temps: number, delta: number) {
    super.preUpdate(temps, delta);
    // Il ne tire que bien visible, et pas quand il est déjà sous le joueur
    if (this.cadence > 0 && temps >= this.prochainTir && this.y > 20 && this.y < 380) {
      this.prochainTir = temps + this.cadence;
      const cible = this.terrain.cible();
      const visee = Phaser.Math.RadToDeg(Math.atan2(cible.y - this.y, cible.x - this.x));
      if (this.genre === "lourd") {
        for (const ecart of [-30, -15, 0, 15, 30]) {
          this.terrain.tirer(this.x, this.y + 30, visee + ecart);
        }
      } else {
        this.terrain.tirer(this.x, this.y + 14, visee);
      }
    }
  }

  // Une balle le touche : renvoie vrai s'il est abattu
  toucher(): boolean {
    this.vie--;
    eclairer(this);
    return this.vie <= 0;
  }
}

// Un éclair blanc quand une balle touche
function eclairer(cible: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image) {
  cible.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
  cible.scene.time.delayedCall(60, () => cible.active && cible.clearTint());
}

export class Boss extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.Body;
  readonly vieMax: number;
  vie: number;
  pret = false;                            // il ne craint rien pendant son arrivée
  private attaque = 0;
  private readonly allure: number;
  private minuterie: Phaser.Time.TimerEvent | null = null;
  private enRage = false;

  constructor(scene: Phaser.Scene, private terrain: Terrain, serie: number) {
    super(scene, 480, -80, "tir-boss");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.moves = false;
    this.body.setSize(190, 70);
    this.setDepth(3);
    this.allure = allure(serie);
    this.vieMax = Math.round(BOSS.vie * (1 + 0.5 * serie));
    this.vie = this.vieMax;

    // Il descend, puis va et vient d'un bord à l'autre, sans fin
    scene.tweens.chain({
      targets: this,
      tweens: [
        { y: 100, duration: 2200, ease: "Cubic.Out", onComplete: () => this.commencer() },
        { x: 160, duration: 1600 / this.allure, ease: "Sine.InOut" },
        { x: 800, duration: 3200 / this.allure, ease: "Sine.InOut", yoyo: true, repeat: -1 },
      ],
    });
  }

  private commencer() {
    this.pret = true;
    this.attaquer(1300);
  }

  private attaquer(intervalle: number) {
    this.minuterie?.remove();
    this.minuterie = this.scene.time.addEvent({ delay: intervalle / this.allure, loop: true, callback: () => this.tirer() });
  }

  // Trois attaques, chacune son tour : l'éventail, la rafale visée, la couronne
  private tirer() {
    if (!this.active) {
      return;
    }
    const canons = [this.x - 73, this.x, this.x + 73];
    const bas = this.y + 50;
    const attaque = this.attaque++ % 3;
    if (attaque === 0) {
      for (let angle = 40; angle <= 140; angle += 12.5) {
        this.terrain.tirer(this.x, bas, angle, 200);
      }
    } else if (attaque === 1) {
      for (let i = 0; i < 3; i++) {
        this.scene.time.delayedCall(i * 150, () => {
          if (!this.active) {
            return;
          }
          const cible = this.terrain.cible();
          for (const x of canons) {
            this.terrain.tirer(x, bas, Phaser.Math.RadToDeg(Math.atan2(cible.y - bas, cible.x - x)), 320);
          }
        });
      }
    } else {
      const decalage = Math.random() * 22.5;
      for (let angle = 0; angle < 360; angle += 22.5) {
        this.terrain.tirer(this.x, this.y + 10, angle + decalage, 170);
      }
    }
  }

  // Une balle le touche : renvoie vrai s'il est battu
  toucher(): boolean {
    if (!this.pret) {
      return false;
    }
    this.vie--;
    eclairer(this);
    // À moitié : il se fâche (il rougit et tire plus vite)
    if (!this.enRage && this.vie <= this.vieMax / 2) {
      this.enRage = true;
      this.attaquer(850);
      this.scene.tweens.add({ targets: this, scale: 1.08, duration: 200, yoyo: true, repeat: 2 });
    }
    return this.vie <= 0;
  }

  // Battu : il ne tire plus, ne bouge plus, et ne compte plus pour les collisions
  arreter() {
    this.minuterie?.remove();
    this.scene.tweens.killTweensOf(this);
    this.body.enable = false;
  }
}
