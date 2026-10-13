// Les ennemis et le boss : des images avec un corps Arcade, qui font leurs allers-retours.
// Ils ne touchent pas les plateformes (comme dans l'atelier, ils suivent leur trajet) : leur corps
// sert seulement à savoir quand le héros les touche (overlap, dans Monde.ts).

import Phaser from "phaser";
import type { Element, TypeEnnemi } from "./elements";
import { IMAGES, VITESSE_ENNEMI, BOND_DU_SAUTEUR, VITESSE_BOSS, INVINCIBLE_BOSS } from "./reglages";

const IMAGE: Record<TypeEnnemi, string> = {
  marcheur: "platformer-ennemi", volant: "platformer-volant", sauteur: "platformer-sauteur",
};

export class Ennemi extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  readonly type: TypeEnnemi;
  private xmin: number;
  private xmax: number;
  private ymin: number;
  private ymax: number;
  private sol: number;

  // dy : le monde peut être décalé vers le bas (le joueur 2 du duo a le sien sous celui du joueur 1)
  constructor(scene: Phaser.Scene, e: Element, dy: number) {
    const taille = e.taille ?? 30;
    super(scene, e.x + taille / 2, e.y + dy + taille / 2, IMAGE[e.type!]);
    this.type = e.type!;
    this.xmin = e.xmin!;
    this.xmax = e.xmax!;
    this.ymin = (e.ymin ?? 0) + dy;
    this.ymax = (e.ymax ?? 0) + dy;
    this.sol = (e.sol ?? 0) + dy;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDisplaySize(taille, taille);   // les images font 60 × 60 : on les montre à la taille de l'ennemi
    this.body.setAllowGravity(this.type === "sauteur");   // seul le sauteur retombe
    const vitesse = (e.v ?? VITESSE_ENNEMI) * IMAGES;
    if (this.type !== "sauteur") {
      this.body.setVelocityX(vitesse);
    }
    if (this.type === "volant") {
      this.body.setVelocityY(vitesse);
      // Il bat des ailes : un tween qui l'écrase un peu, puis le relâche, sans fin
      scene.tweens.add({ targets: this, scaleY: this.scaleY * 0.85, duration: 180, yoyo: true, repeat: -1 });
    }
  }

  // Demi-tour au bord de son trajet, toujours vers l'intérieur
  avancer() {
    const c = this.body;
    if (this.type !== "sauteur") {
      if (c.left <= this.xmin) {
        c.velocity.x = Math.abs(c.velocity.x);
      } else if (c.right >= this.xmax) {
        c.velocity.x = -Math.abs(c.velocity.x);
      }
      this.setFlipX(c.velocity.x < 0);
    }
    if (this.type === "volant") {
      if (c.top <= this.ymin) {
        c.velocity.y = Math.abs(c.velocity.y);
      } else if (c.bottom >= this.ymax) {
        c.velocity.y = -Math.abs(c.velocity.y);
      }
    } else if (this.type === "sauteur" && c.bottom >= this.sol && c.velocity.y >= 0) {
      c.y = this.sol - c.height;           // il rebondit sur sa plateforme
      c.velocity.y = BOND_DU_SAUTEUR;
    }
  }

  ecrase = false;

  // Écrasé : il s'aplatit, s'efface, puis disparaît. Son corps part tout de suite : on ne meurt pas d'un
  // ennemi écrasé. (« ecrase » le dit aussi : la physique fait deux pas par image, et le deuxième pas
  // de cette image a déjà sa liste de contacts, où l'ennemi est encore.)
  ecraser() {
    this.ecrase = true;
    this.body.enable = false;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this, scaleY: this.scaleY * 0.2, y: this.y + this.displayHeight * 0.4, alpha: 0, duration: 250,
      onComplete: () => this.destroy(),
    });
  }
}

export class Boss extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  hp: number;
  private invincibleJusqua = 0;
  private xmin: number;
  private xmax: number;
  private barres: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene, e: Element, dy: number) {
    super(scene, e.x + 32, e.y + dy + 32, "platformer-boss");
    this.hp = e.hp!;
    this.xmin = e.xmin!;
    this.xmax = e.xmax!;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setAllowGravity(false);
    this.body.setVelocityX(VITESSE_BOSS);
    // Une barre par vie, au-dessus de lui
    for (let k = 0; k < this.hp; k++) {
      this.barres.push(scene.add.image(0, 0, "platformer-vie-boss").setOrigin(0));
    }
    // Il respire : il gonfle un peu, sans fin
    scene.tweens.add({ targets: this, scaleX: 1.06, scaleY: 0.94, duration: 400, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  }

  get invincible(): boolean {
    return this.scene.time.now < this.invincibleJusqua;
  }

  avancer() {
    const c = this.body;
    if (c.left <= this.xmin) {
      c.velocity.x = VITESSE_BOSS;
    } else if (c.right >= this.xmax) {
      c.velocity.x = -VITESSE_BOSS;
    }
    this.barres.forEach((barre, k) => barre.setPosition(c.left + k * 22, c.top - 14));
  }

  // Un coup sur la tête : une vie de moins, et un court instant d'invincibilité où il clignote
  toucher() {
    this.hp--;
    this.invincibleJusqua = this.scene.time.now + INVINCIBLE_BOSS;
    this.barres.pop()?.destroy();
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.tweens.add({
      targets: this, alpha: 0.3, duration: 80, yoyo: true, repeat: 2,
      onComplete: () => this.clearTint().setAlpha(1),
    });
  }

  destroy(fromScene?: boolean) {
    this.barres.forEach((barre) => barre.destroy());
    this.barres = [];
    super.destroy(fromScene);
  }
}
