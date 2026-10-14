// Une partie : le vaisseau, les vagues d'ennemis, les balles, les bonus, le boss toutes les 5 vagues.
// Le tableau de bord (score, vies, vague, vie du boss) est une autre scène, lancée par-dessus.
//
// La physique Arcade ne sert ici qu'à deux choses : faire avancer les balles et les bonus (une vitesse,
// et Phaser fait le reste), et dire qui touche qui (les « overlap »). Les balles ne sont jamais créées
// en pleine partie : un groupe en garde une réserve, et les réutilise (group.get) quand elles sortent.

import Phaser from "phaser";
import { Commandes } from "../commandes";
import { Ennemi, Boss, type Terrain } from "../Ennemi";
import { vague, type Vague } from "../vagues";
import { toucheDuSon } from "../son";
import {
  VITESSE, CADENCE, VITESSE_BALLE, ARME_MAX, INVINCIBLE, VIES, HAUT_DU_VAISSEAU, ENNEMIS, BOSS,
  VITESSE_BALLE_ENNEMIE, CHANCE_DE_BONUS, VITESSE_BONUS, FOND, SAUVEGARDE,
} from "../reglages";
import { LARGEUR, HAUTEUR } from "../../../socle/style";
import { lire, ecrire } from "../../../socle/sauvegarde";
import { surTouche } from "../../../socle/clavier";
import { fonduPuis } from "../../../socle/retour";

export type GenreDeBonus = "arme" | "bouclier" | "vie";

const RECORD = SAUVEGARDE + "/record";

export function lireLeRecord(): number {
  return lire<number>(RECORD) ?? 0;
}

// Une image de physique dont le corps bouge (les types de Phaser, eux, admettent aussi un corps immobile, ou aucun)
// Ce que la partie reçoit au départ : la vague par laquelle elle commence (la première, sauf pour
// les tests, qui veulent voir le boss sans jouer quatre vagues)
export interface DonneesDePartie {
  vague?: number;
}

type Mobile = Phaser.Physics.Arcade.Image & { body: Phaser.Physics.Arcade.Body };

export class Partie extends Phaser.Scene implements Terrain {
  vaisseau!: Mobile;
  commandes!: Commandes;
  score = 0;
  record = 0;
  vies = VIES;
  arme = 1;
  bouclier = false;
  enJeu = false;
  vague!: Vague;
  boss: Boss | null = null;
  ennemis!: Phaser.GameObjects.Group;
  balles!: Phaser.Physics.Arcade.Group;
  ballesEnnemies!: Phaser.Physics.Arcade.Group;
  bonus!: Phaser.Physics.Arcade.Group;
  private restants = 0;                    // les ennemis de la vague pas encore abattus ni partis
  private invincibleJusqua = 0;
  private quitte = false;
  private halo!: Phaser.GameObjects.Image;
  private etoiles: Phaser.GameObjects.TileSprite[] = [];
  private explosions!: Phaser.GameObjects.Particles.ParticleEmitter;
  private reacteur!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super({ key: "tir-partie", physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 } } } });
  }

  create(donnees: DonneesDePartie = {}) {
    // scene.restart garde la pause de la physique et des tweens : on remet tout en marche
    this.physics.resume();
    this.tweens.resumeAll();
    this.score = 0;
    this.record = lireLeRecord();
    this.vies = VIES;
    this.arme = 1;
    this.bouclier = false;
    this.boss = null;
    this.quitte = false;
    this.invincibleJusqua = 0;
    this.enJeu = true;

    this.cameras.main.setBackgroundColor(FOND).fadeIn(300);
    this.etoiles = [
      this.add.tileSprite(0, 0, LARGEUR, HAUTEUR, "tir-etoiles-loin").setOrigin(0).setDepth(-10).setData("vitesse", 30),
      this.add.tileSprite(0, 0, LARGEUR, HAUTEUR, "tir-etoiles-milieu").setOrigin(0).setDepth(-9).setData("vitesse", 70),
      this.add.tileSprite(0, 0, LARGEUR, HAUTEUR, "tir-etoiles-pres").setOrigin(0).setDepth(-8).setData("vitesse", 160),
    ];

    // Le vaisseau : un petit corps rond au centre de l'image. Un shoot'em up est juste quand seul le
    // cœur du vaisseau compte : une balle qui frôle une aile ne fait rien.
    this.vaisseau = this.physics.add.image(LARGEUR / 2, HAUTEUR - 70, "tir-vaisseau").setDepth(5) as Mobile;
    this.vaisseau.body.setCircle(9, 24 - 9, 26 - 9);
    this.vaisseau.setCollideWorldBounds(true);
    this.vaisseau.body.setBoundsRectangle(new Phaser.Geom.Rectangle(16, HAUT_DU_VAISSEAU, LARGEUR - 32, HAUTEUR - HAUT_DU_VAISSEAU - 16));
    this.halo = this.add.image(0, 0, "tir-bouclier").setDepth(5).setVisible(false);
    this.reacteur = this.add.particles(0, 0, "etincelle", {
      follow: this.vaisseau, followOffset: { x: 0, y: 26 }, frequency: 30, lifespan: 250,
      speedY: { min: 80, max: 160 }, speedX: { min: -15, max: 15 }, scale: { start: 0.8, end: 0 },
      tint: [0xff9a3c, 0xffd23f], blendMode: "ADD",
    }).setDepth(4);

    this.balles = this.physics.add.group({ defaultKey: "tir-balle", maxSize: 120 });
    this.ballesEnnemies = this.physics.add.group({ defaultKey: "tir-balle-ennemie", maxSize: 200 });
    this.bonus = this.physics.add.group();
    // Un groupe simple : les ennemis règlent eux-mêmes leur corps (un groupe de physique le remettrait à zéro)
    this.ennemis = this.add.group();

    this.explosions = this.add.particles(0, 0, "etincelle", {
      emitting: false, lifespan: { min: 300, max: 700 }, speed: { min: 60, max: 300 }, scale: { start: 1.4, end: 0 },
      tint: [0xffd23f, 0xff7a1a, 0xffffff, 0xff4f4f], blendMode: "ADD",
    }).setDepth(7);

    // Qui touche qui. Une balle et un ennemi peuvent se toucher deux fois dans la même image (plusieurs
    // pas de physique) : chaque fonction vérifie que les deux sont encore là.
    // Entre deux groupes, Phaser ne garde pas toujours l'ordre : on reconnaît l'ennemi à sa classe
    this.physics.add.overlap(this.balles, this.ennemis, (a, b) => a instanceof Ennemi
      ? this.balleSurEnnemi(b as Mobile, a)
      : this.balleSurEnnemi(a as Mobile, b as Ennemi));
    this.surUnDe(this.vaisseau, this.ballesEnnemies, (balle: Mobile) => {
      if (balle.active && this.toucherLeVaisseau()) {
        this.ranger(balle);
      }
    });
    this.surUnDe(this.vaisseau, this.ennemis, (ennemi: Ennemi) => {
      if (ennemi.active && this.toucherLeVaisseau()) {
        this.abattre(ennemi, false);
      }
    });
    this.surUnDe(this.vaisseau, this.bonus, (bonus: Phaser.Physics.Arcade.Image) => this.ramasser(bonus));

    // Le vaisseau tire tout seul, tant qu'il est là
    this.time.addEvent({ delay: CADENCE, loop: true, callback: () => this.tirerDuVaisseau() });

    this.commandes = new Commandes(this, () => this.vaisseau.body.center.clone());
    surTouche(this, "ESC", () => this.quitter());
    toucheDuSon(this);
    // À la souris, le vaisseau est le curseur : la flèche se cache pendant la partie, et revient à la fin
    this.input.setDefaultCursor("none");
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.setDefaultCursor("default"));
    this.input.gamepad?.on("down", (_m: Phaser.Input.Gamepad.Gamepad, bouton: Phaser.Input.Gamepad.Button) => {
      if (bouton.index === 9 || bouton.index === 8) {   // Start ou Select : on s'en va
        this.quitter();
      }
    });

    this.scene.launch("tir-tableau");
    this.commencerLaVague(donnees.vague ?? 1);
  }

  // Quand un objet seul (le vaisseau, le boss) touche un objet d'un groupe. Phaser ne passe pas les deux
  // dans l'ordre où on les a donnés (entre un groupe et un objet seul, il les inverse) : on reconnaît
  // l'objet seul, et l'action reçoit l'autre. Sinon, un ennemi qui percute le vaisseau détruisait le
  // vaisseau à sa place, et le jeu s'arrêtait net.
  private surUnDe<T>(seul: Phaser.GameObjects.GameObject, groupe: Phaser.GameObjects.Group, action: (autre: T) => void) {
    this.physics.add.overlap(seul, groupe, (a, b) => action((a === seul ? b : a) as T));
  }

  update(_temps: number, delta: number) {
    const secondes = delta / 1000;
    for (const couche of this.etoiles) {
      couche.tilePositionY -= couche.getData("vitesse") * secondes;
    }
    // Ce qui sort de l'écran retourne dans sa réserve
    for (const groupe of [this.balles, this.ballesEnnemies, this.bonus]) {
      for (const objet of groupe.getMatching("active", true) as Mobile[]) {
        if (objet.y < -30 || objet.y > HAUTEUR + 30 || objet.x < -30 || objet.x > LARGEUR + 30) {
          this.ranger(objet);
        }
      }
    }
    this.halo.setPosition(this.vaisseau.x, this.vaisseau.y + 2);
    if (!this.enJeu) {
      return;
    }
    this.piloter();
  }

  private piloter() {
    const { dx, dy, cible } = this.commandes.lire();
    const corps = this.vaisseau.body;
    if (cible) {
      // Au doigt : le vaisseau rattrape la cible, vite, sans la dépasser. On part de body.center :
      // la place de l'image a un pas de physique de retard.
      const ecart = cible.clone().subtract(corps.center);
      corps.velocity.copy(ecart.scale(18).limit(VITESSE * 3));
    } else {
      corps.setVelocity(dx * VITESSE, dy * VITESSE);
    }
    // Le vaisseau penche du côté où il va
    this.vaisseau.setAngle(Phaser.Math.Clamp(corps.velocity.x / VITESSE, -1, 1) * 12);
  }

  // —— Les vagues ——

  commencerLaVague(numero: number) {
    if (!this.enJeu) {
      return;
    }
    this.vague = vague(numero);
    // Le tableau de bord annonce la vague ; les ennemis arrivent juste après
    const annonce = 1600;
    if (this.vague.boss) {
      this.restants = 1;
      this.sound.play("tir-boss", { volume: 0.7 });
      this.time.delayedCall(annonce, () => {
        if (this.enJeu) {
          this.boss = new Boss(this, this, this.vague.serie);
          this.surUnDe(this.boss, this.balles, (balle: Mobile) => this.balleSurBoss(balle));
          this.physics.add.overlap(this.boss, this.vaisseau, () => this.toucherLeVaisseau());
        }
      });
      return;
    }
    this.restants = this.vague.apparitions.length;
    for (const apparition of this.vague.apparitions) {
      this.time.delayedCall(annonce + apparition.delai, () => {
        if (this.enJeu) {
          this.ennemis.add(new Ennemi(this, this, apparition, this.vague.serie));
        } else {
          this.restants--;
        }
      });
    }
  }

  // Un ennemi de moins : abattu ou parti. Le dernier fait venir la vague suivante.
  private unDeMoins() {
    this.restants--;
    if (this.restants === 0) {
      const suivante = this.vague.numero + 1;
      this.time.delayedCall(1200, () => this.commencerLaVague(suivante));
    }
  }

  // —— Ce que les ennemis demandent (Terrain) ——

  cible(): Phaser.Math.Vector2 {
    return this.vaisseau.body.center.clone();
  }

  tirer(x: number, y: number, angle: number, vitesse = VITESSE_BALLE_ENNEMIE) {
    if (!this.enJeu) {
      return;
    }
    const balle = this.ballesEnnemies.get(x, y) as Mobile | null;
    if (!balle) {
      return;                              // la réserve est vide : une balle de moins, personne ne le verra
    }
    this.sortir(balle, x, y);
    balle.setDepth(6).body.setCircle(5, 2, 2);
    this.physics.velocityFromAngle(angle, vitesse, balle.body.velocity);
  }

  parti(_ennemi: Ennemi | Boss) {
    this.unDeMoins();
  }

  // —— Les balles ——

  private sortir(balle: Mobile, x: number, y: number) {
    balle.enableBody(true, x, y, true, true);
  }

  private ranger(objet: Mobile) {
    objet.disableBody(true, true);
  }

  private tirerDuVaisseau() {
    if (!this.enJeu) {
      return;
    }
    // L'arme : de 1 à 4. Chaque tir est un écart sur le côté (en pixels) et un angle (en degrés).
    const tirs: [number, number][] = [
      [[0, 0]],
      [[-9, 0], [9, 0]],
      [[0, 0], [-10, -8], [10, 8]],
      [[0, 0], [-10, -7], [10, 7], [-16, -15], [16, 15]],
    ][this.arme - 1] as [number, number][];
    const { x, y } = this.vaisseau;
    for (const [ecart, angle] of tirs) {
      const balle = this.balles.get() as Mobile | null;
      if (!balle) {
        return;
      }
      this.sortir(balle, x + ecart, y - 24);
      balle.setDepth(4).setAngle(angle);
      this.physics.velocityFromAngle(angle - 90, VITESSE_BALLE, balle.body.velocity);
    }
    this.sound.play("tir-tir", { volume: 0.18 });
  }

  private balleSurEnnemi(balle: Mobile, ennemi: Ennemi) {
    if (!balle.active || !ennemi.active) {
      return;
    }
    this.ranger(balle);
    if (ennemi.toucher()) {
      this.abattre(ennemi, true);
    } else {
      this.sound.play("tir-choc", { volume: 0.5 });
    }
  }

  // parLeJoueur : faux quand l'ennemi s'écrase sur le vaisseau (ni points, ni bonus)
  private abattre(ennemi: Ennemi, parLeJoueur: boolean) {
    const { x, y, genre } = ennemi;
    ennemi.destroy();
    this.unDeMoins();
    const lourd = genre === "lourd";
    this.explosions.explode(lourd ? 50 : 22, x, y);
    this.sound.play("tir-explosion", { volume: lourd ? 0.9 : 0.5, rate: lourd ? 0.7 : 1.2 });
    if (!parLeJoueur) {
      return;
    }
    this.marquer(ENNEMIS[genre].points * (this.vague.serie + 1), x, y);
    if (lourd || Math.random() < CHANCE_DE_BONUS) {
      this.lacherUnBonus(x, y);
    }
  }

  private balleSurBoss(balle: Mobile) {
    const boss = this.boss;
    if (!balle.active || !boss?.active || !boss.pret) {
      return;
    }
    this.ranger(balle);
    this.explosions.explode(3, balle.x, balle.y);
    if (!boss.toucher()) {
      return;
    }
    // Battu : il tremble, explose en plusieurs fois, et la série suivante commence
    boss.arreter();
    this.boss = null;
    this.ballesEnnemies.getMatching("active", true).forEach((b) => this.ranger(b as Mobile));
    this.marquer(BOSS.points * (this.vague.serie + 1), boss.x, boss.y);
    this.cameras.main.shake(900, 0.01);
    this.time.addEvent({
      delay: 150, repeat: 6, callback: () => {
        this.explosions.explode(30, boss.x + Phaser.Math.Between(-90, 90), boss.y + Phaser.Math.Between(-30, 30));
        this.sound.play("tir-explosion", { rate: 0.6 });
      },
    });
    this.time.delayedCall(1100, () => {
      this.cameras.main.flash(300);
      this.explosions.explode(120, boss.x, boss.y);
      boss.destroy();
      this.sound.play("tir-victoire");
      this.lacherUnBonus(boss.x, boss.y, "vie");
      this.unDeMoins();
    });
  }

  // Des points, et le nombre qui s'envole là où l'ennemi a explosé
  private marquer(points: number, x: number, y: number) {
    this.score += points;
    const texte = this.add.text(x, y, String(points), {
      fontFamily: "system-ui, sans-serif", fontSize: points >= 1000 ? "28px" : "16px", fontStyle: "bold", color: "#ffd23f",
    }).setOrigin(0.5).setDepth(8);
    this.tweens.add({ targets: texte, y: y - 40, alpha: 0, duration: 700, onComplete: () => texte.destroy() });
  }

  // —— Les bonus ——

  private lacherUnBonus(x: number, y: number, genre?: GenreDeBonus) {
    if (!genre) {
      const tirage = Math.random();
      genre = tirage < 0.55 ? "arme" : tirage < 0.85 ? "bouclier" : "vie";
    }
    const bonus = this.bonus.create(x, y, "tir-bonus-" + genre) as Phaser.Physics.Arcade.Image;
    bonus.setData("genre", genre).setDepth(2).setVelocityY(VITESSE_BONUS);
    // Il tourne doucement sur lui-même, pour qu'on le remarque
    this.tweens.add({ targets: bonus, scale: 1.15, duration: 400, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  }

  private ramasser(bonus: Phaser.Physics.Arcade.Image) {
    if (!bonus.active || !this.enJeu) {
      return;
    }
    const genre = bonus.getData("genre") as GenreDeBonus;
    this.tweens.killTweensOf(bonus);
    bonus.destroy();
    this.sound.play("tir-bonus");
    if (genre === "arme") {
      if (this.arme < ARME_MAX) {
        this.arme++;
      } else {
        this.marquer(500, this.vaisseau.x, this.vaisseau.y - 30);   // l'arme est déjà au plus fort
      }
    } else if (genre === "bouclier") {
      this.bouclier = true;
    } else {
      this.vies++;
    }
    this.halo.setVisible(this.bouclier);
  }

  // —— Être touché ——

  // Renvoie vrai si le coup a compté (pas pendant le clignotement d'après un coup)
  toucherLeVaisseau(): boolean {
    if (!this.enJeu || this.time.now < this.invincibleJusqua) {
      return false;
    }
    if (this.bouclier) {
      // Le bouclier prend le coup à notre place, et disparaît
      this.bouclier = false;
      this.halo.setVisible(false);
      this.invincibleJusqua = this.time.now + 800;
      this.sound.play("tir-choc");
      this.explosions.explode(12, this.vaisseau.x, this.vaisseau.y);
      return true;
    }
    this.vies--;
    this.arme = Math.max(1, this.arme - 1);
    this.sound.play("tir-touche");
    this.cameras.main.shake(300, 0.012);
    this.explosions.explode(40, this.vaisseau.x, this.vaisseau.y);
    if (this.vies <= 0) {
      this.perdre();
      return true;
    }
    this.invincibleJusqua = this.time.now + INVINCIBLE;
    this.tweens.add({ targets: this.vaisseau, alpha: 0.25, duration: 100, yoyo: true, repeat: INVINCIBLE / 200 - 1 });
    return true;
  }

  private perdre() {
    this.enJeu = false;
    this.input.setDefaultCursor("default");
    this.vaisseau.setVisible(false);
    this.vaisseau.body.setVelocity(0, 0).enable = false;
    this.reacteur.stop();
    this.explosions.explode(80, this.vaisseau.x, this.vaisseau.y);
    this.time.delayedCall(1400, () => this.finir());
  }

  private finir() {
    const nouveauRecord = this.score > this.record;
    if (nouveauRecord) {
      this.record = this.score;
      ecrire(RECORD, this.score);
    }
    this.physics.pause();
    this.tweens.pauseAll();
    this.scene.launch("tir-fin", { nouveauRecord });
  }

  // —— Après la fin, ou en cours de route ——

  rejouer() {
    this.scene.stop("tir-fin");
    this.scene.stop("tir-tableau");
    this.scene.restart({ vague: 1 });   // sans rien, restart redonnerait les données du départ
  }

  quitter() {
    if (this.quitte) {
      return;                              // Échap pendant la fin : la fin et la partie l'entendent toutes les deux
    }
    this.quitte = true;
    fonduPuis(this, () => {
      this.scene.stop("tir-tableau");
      this.scene.stop("tir-fin");
      this.scene.start("tir-menu");
    });
  }
}
