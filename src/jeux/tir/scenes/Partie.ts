// Une partie : le vaisseau, les vagues d'ennemis, les balles, les bonus, le boss toutes les 5 vagues.
// Le tableau de bord (score, vies, vague, vie du boss) est une autre scène, lancée par-dessus.
//
// L'aire de jeu fait toujours 960 × 540 (les vagues sont écrites pour elle). Au doigt, le jeu s'élargit à la
// proportion du téléphone (socle/largeur.ts) : la caméra de la partie ne montre que l'aire, au milieu, et le
// fond étoilé (Fond.ts, dessous) et le tableau de bord (dessus) vont jusqu'aux bords.
//
// La physique Arcade ne sert ici qu'à deux choses : faire avancer les balles et les bonus (une vitesse,
// et Phaser fait le reste), et dire qui touche qui (les « overlap »). Les balles ne sont jamais créées
// en pleine partie : un groupe en garde une réserve, et les réutilise (group.get) quand elles sortent.

import Phaser from "phaser";
import { Commandes } from "../commandes";
import { Ennemi, Boss, type Terrain } from "../Ennemi";
import { vague, type Vague } from "../vagues";
import {
  VITESSE, CADENCE, VITESSE_BALLE, ARME_MAX, INVINCIBLE, VIES, HAUT_DU_VAISSEAU, ENNEMIS, BOSS,
  VITESSE_BALLE_ENNEMIE, CHANCE_DE_BONUS, VITESSE_BONUS, SAUVEGARDE, CHOC_DU_LOURD,
} from "../reglages";
import { LARGEUR, HAUTEUR } from "../../../socle/style";
import { lire, ecrire } from "../../../socle/sauvegarde";
import { fonduPuis } from "../../../socle/retour";
import { toucheDuSon } from "../../../socle/son";
import { mettreEnPause } from "../../../socle/pause";
import { elargir } from "../../../socle/largeur";
import { vibrer } from "../../../socle/vibration";

// Les ralentis : la vitesse du jeu (1 : normale) et leur durée à l'écran (ms). Brefs : ils ne changent
// pas le jeu, seulement la sensation du choc.
const RALENTI_DU_COUP = { allure: 0.3, duree: 220 };
const RALENTI_DU_BOSS = { allure: 0.25, duree: 900 };

export type GenreDeBonus = "arme" | "bouclier" | "vie";

const RECORD = SAUVEGARDE + "/record";

export function lireLeRecord(): number {
  return lire<number>(RECORD) ?? 0;
}

// Ce que la partie reçoit au départ : la vague par laquelle elle commence (la première, sauf pour
// les tests, qui veulent voir le boss sans jouer quatre vagues)
export interface DonneesDePartie {
  vague?: number;
}

// Une image de physique dont le corps bouge (les types de Phaser, eux, admettent aussi un corps immobile, ou aucun)
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
  ouvrirLaPause: () => void = () => {};    // pour le ⏸ du tableau de bord
  vague!: Vague;
  boss: Boss | null = null;
  ennemis!: Phaser.GameObjects.Group;
  balles!: Phaser.Physics.Arcade.Group;
  ballesEnnemies!: Phaser.Physics.Arcade.Group;
  bonus!: Phaser.Physics.Arcade.Group;
  private restants = 0;                    // les ennemis de la vague pas encore abattus ni partis
  // L'heure de la partie (ms) : elle avance dans update, qui s'arrête pendant la pause, et ralentit avec le
  // ralenti. this.time.now, lui, continue pendant la pause : l'invincibilité finissait pendant la pause.
  private horloge = 0;
  private invincibleJusqua = 0;            // sur l'horloge de la partie
  private finDuRalenti: Phaser.Time.TimerEvent | null = null;
  private quitte = false;
  private fini = false;                    // la fin est affichée : elle a ses boutons, la pause n'a plus de sens
  private collisionsDuBoss: Phaser.Physics.Arcade.Collider[] = [];
  private halo!: Phaser.GameObjects.Image;
  private explosions!: Phaser.GameObjects.Particles.ParticleEmitter;
  private reacteur!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super({ key: "tir-partie", physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 } } } });
  }

  create(donnees: DonneesDePartie = {}) {
    // scene.restart garde la pause et le ralenti de la physique, de l'horloge et des tweens : on remet tout en marche
    this.physics.resume();
    this.tweens.resumeAll();
    this.vitesse(1);
    this.finDuRalenti = null;
    this.horloge = 0;
    this.score = 0;
    this.record = lireLeRecord();
    this.vies = VIES;
    this.arme = 1;
    this.bouclier = false;
    this.boss = null;
    this.quitte = false;
    this.fini = false;
    this.collisionsDuBoss = [];
    this.invincibleJusqua = 0;
    this.enJeu = true;

    // Au doigt, le jeu prend la largeur du téléphone ; la caméra de la partie (sans fond : le ciel est
    // dessous) ne montre que l'aire de 960, au milieu. Le fond et le tableau de bord se placent ensuite.
    elargir(this);
    this.cameras.main.setViewport((this.scale.width - LARGEUR) / 2, 0, LARGEUR, HAUTEUR).fadeIn(300);
    this.scene.launch("tir-fond");

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
      if (!ennemi.active || !this.toucherLeVaisseau()) {
        return;
      }
      // Les petits s'écrasent ; le lourd encaisse le choc et continue sa route. Il ne retouche pas le
      // vaisseau aussitôt : après un coup, le vaisseau clignote et ne craint rien.
      if (ennemi.genre !== "lourd" || ennemi.toucher(CHOC_DU_LOURD)) {
        this.abattre(ennemi, false);
      }
    });
    this.surUnDe(this.vaisseau, this.bonus, (bonus: Phaser.Physics.Arcade.Image) => this.ramasser(bonus));

    // Le vaisseau tire tout seul, tant qu'il est là
    this.time.addEvent({ delay: CADENCE, loop: true, callback: () => this.tirerDuVaisseau() });

    this.commandes = new Commandes(this, () => this.vaisseau.body.center.clone(), () => this.ouvrirLaPause());
    toucheDuSon(this, "tir");
    // À la souris, le vaisseau est le curseur : la flèche se cache pendant la partie, et revient à la fin
    // (et pendant la pause)
    this.input.setDefaultCursor("none");
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.setDefaultCursor("default"));
    // Échap, P, Start, le ⏸ du tableau de bord, ou le jeu qui perd la main : la pause (socle/pause.ts)
    this.ouvrirLaPause = mettreEnPause(this, {
      autres: ["tir-fond", "tir-tableau"],
      quitter: () => this.quitter(),
      possible: () => !this.fini && !this.quitte,
      apresReprise: () => this.input.setDefaultCursor(this.enJeu ? "none" : "default"),
      son: "tir",
      couleur: 0x5ff0ff,
    });

    this.scene.launch("tir-tableau");
    this.commencerLaVague(donnees.vague ?? 1);
  }

  // Quand un objet seul (le vaisseau, le boss) touche un objet d'un groupe. Phaser ne passe pas les deux
  // dans l'ordre où on les a donnés (entre un groupe et un objet seul, il les inverse) : on reconnaît
  // l'objet seul, et l'action reçoit l'autre. Sinon, un ennemi qui percute le vaisseau détruisait le
  // vaisseau à sa place, et le jeu s'arrêtait net.
  private surUnDe<T>(seul: Phaser.GameObjects.GameObject, groupe: Phaser.GameObjects.Group, action: (autre: T) => void) {
    return this.physics.add.overlap(seul, groupe, (a, b) => action((a === seul ? b : a) as T));
  }

  update(_temps: number, delta: number) {
    this.horloge += delta * this.time.timeScale;
    // Ce qui sort de l'écran : une balle retourne dans sa réserve, un bonus manqué s'en va pour de bon
    const dehors = (objet: Phaser.GameObjects.Image) =>
      objet.y < -30 || objet.y > HAUTEUR + 30 || objet.x < -30 || objet.x > LARGEUR + 30;
    for (const groupe of [this.balles, this.ballesEnnemies]) {
      for (const balle of groupe.getMatching("active", true) as Mobile[]) {
        if (dehors(balle)) {
          this.ranger(balle);
        }
      }
    }
    for (const bonus of this.bonus.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (dehors(bonus)) {
        this.oublierLeBonus(bonus);
      }
    }
    // Le bouclier suit le corps du vaisseau : l'image a un pas de physique de retard, et au doigt, où le
    // vaisseau va vite, le bouclier traînait derrière
    const centre = this.vaisseau.body.center;
    this.halo.setPosition(centre.x, centre.y + 2);
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
          this.collisionsDuBoss = [
            this.surUnDe(this.boss, this.balles, (balle: Mobile) => this.balleSurBoss(balle)),
            this.physics.add.overlap(this.boss, this.vaisseau, () => this.toucherLeVaisseau()),
          ];
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

  maintenant(): number {
    return this.horloge;
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
    this.exploser(x, y, lourd ? 50 : 22, lourd ? 2.4 : 1.1);
    // Un peu plus grave ou plus aigu à chaque fois : les explosions ne sonnent pas toutes pareil
    this.sound.play("tir-explosion", { volume: lourd ? 0.9 : 0.5, rate: lourd ? 0.7 : 1.2, detune: Phaser.Math.Between(-250, 250) });
    if (lourd) {
      this.cameras.main.shake(180, 0.006);
    }
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
    // Ses chocs ne servent plus : on les retire, sinon ils s'empilent d'un boss à l'autre
    this.collisionsDuBoss.forEach((collision) => collision.destroy());
    this.collisionsDuBoss = [];
    this.ballesEnnemies.getMatching("active", true).forEach((b) => this.ranger(b as Mobile));
    this.marquer(BOSS.points * (this.vague.serie + 1), boss.x, boss.y);
    this.cameras.main.shake(900, 0.01);
    this.ralentir(RALENTI_DU_BOSS);
    vibrer(this, "fort");
    this.time.addEvent({
      delay: 150, repeat: 6, callback: () => {
        this.exploser(boss.x + Phaser.Math.Between(-90, 90), boss.y + Phaser.Math.Between(-30, 30), 30, 1.6);
        this.sound.play("tir-explosion", { rate: 0.6, detune: Phaser.Math.Between(-300, 300) });
      },
    });
    this.time.delayedCall(1100, () => {
      this.cameras.main.flash(300);
      this.exploser(boss.x, boss.y, 120, 5);
      boss.destroy();
      this.sound.play("tir-victoire");
      this.lacherUnBonus(boss.x, boss.y, "vie");
      this.unDeMoins();
    });
  }

  // Des points, et le nombre qui s'envole là où l'ennemi a explosé
  private marquer(points: number, x: number, y: number) {
    this.score += points;
    this.envoler(String(points), x, y, "#ffd23f", points >= 1000 ? 28 : 16);
  }

  // Un petit texte qui monte et s'efface : des points, ce qu'on gagne ou ce qu'on perd
  private envoler(message: string, x: number, y: number, couleur: string, taille = 18) {
    const texte = this.add.text(x, y, message, {
      fontFamily: "system-ui, sans-serif", fontSize: taille + "px", fontStyle: "bold", color: couleur,
    }).setOrigin(0.5).setDepth(8);
    this.tweens.add({ targets: texte, y: y - 40, alpha: 0, duration: 700, onComplete: () => texte.destroy() });
  }

  // Une explosion : des étincelles, et une onde de choc, un anneau qui grandit et s'efface (taille : sa
  // largeur à la fin, 1 pour 64 pixels)
  private exploser(x: number, y: number, etincelles: number, taille: number) {
    this.explosions.explode(etincelles, x, y);
    const onde = this.add.image(x, y, "tir-onde").setDepth(7).setScale(0.2).setTint(0xffc46b).setBlendMode("ADD");
    this.tweens.add({
      targets: onde, scale: taille, alpha: 0, duration: 250 + 80 * taille, ease: "Cubic.Out", onComplete: () => onde.destroy(),
    });
  }

  // —— Le ralenti ——

  // Tout ralentit un instant : la physique, les tweens (et les chemins des ennemis), les minuteries,
  // l'horloge de la partie, les étincelles. Sa fin est une minuterie de la partie, qui attend pendant la
  // pause ; ralentie comme le reste, elle compte duree × allure pour durer « duree » à l'écran.
  private ralentir({ allure, duree }: { allure: number; duree: number }) {
    this.vitesse(allure);
    this.finDuRalenti?.remove();
    this.finDuRalenti = this.time.delayedCall(duree * allure, () => {
      this.finDuRalenti = null;
      this.vitesse(1);
    });
  }

  private vitesse(allure: number) {
    this.physics.world.timeScale = 1 / allure;   // à l'envers : 2 ralentit de moitié
    this.tweens.timeScale = allure;
    this.time.timeScale = allure;
    // Au début de create, les étincelles ne sont pas encore là (ce sont celles de la partie d'avant, ou rien)
    if (this.explosions) {
      this.explosions.timeScale = allure;
      this.reacteur.timeScale = allure;
    }
  }

  // —— Les bonus ——

  private lacherUnBonus(x: number, y: number, genre?: GenreDeBonus) {
    if (!genre) {
      const tirage = Math.random();
      genre = tirage < 0.55 ? "arme" : tirage < 0.85 ? "bouclier" : "vie";
    }
    const bonus = this.bonus.create(x, y, "tir-bonus-" + genre) as Phaser.Physics.Arcade.Image;
    bonus.setData("genre", genre).setDepth(2).setVelocityY(VITESSE_BONUS);
    // Il bat doucement (il grossit et revient), pour qu'on le remarque
    this.tweens.add({ targets: bonus, scale: 1.15, duration: 400, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  }

  private ramasser(bonus: Phaser.Physics.Arcade.Image) {
    if (!bonus.active || !this.enJeu) {
      return;
    }
    const genre = bonus.getData("genre") as GenreDeBonus;
    this.oublierLeBonus(bonus);
    this.sound.play("tir-bonus");
    // Ce qu'on gagne s'envole au-dessus du vaisseau
    const { x, y } = this.vaisseau;
    if (genre === "arme") {
      if (this.arme < ARME_MAX) {
        this.arme++;
        this.envoler("Tirs " + "▲".repeat(this.arme) + " !", x, y - 34, "#ff9a3c");
      } else {
        this.marquer(500, x, y - 30);   // l'arme est déjà au plus fort
      }
    } else if (genre === "bouclier") {
      this.bouclier = true;
      this.envoler("Bouclier !", x, y - 34, "#7fd8ff");
    } else {
      this.vies++;
      this.envoler("+1 vie", x, y - 34, "#ff7a8a");
    }
    this.halo.setVisible(this.bouclier);
  }

  // Un bonus ramassé ou manqué : il s'en va avec son tween, qui tournerait sinon sans fin
  private oublierLeBonus(bonus: Phaser.Physics.Arcade.Image) {
    this.tweens.killTweensOf(bonus);
    bonus.destroy();
  }

  // —— Être touché ——

  // Renvoie vrai si le coup a compté (pas pendant le clignotement d'après un coup)
  toucherLeVaisseau(): boolean {
    if (!this.enJeu || this.horloge < this.invincibleJusqua) {
      return false;
    }
    const { x, y } = this.vaisseau;
    if (this.bouclier) {
      // Le bouclier prend le coup à notre place, et disparaît
      this.bouclier = false;
      this.halo.setVisible(false);
      this.invincibleJusqua = this.horloge + 800;
      this.sound.play("tir-choc");
      this.explosions.explode(12, x, y);
      vibrer(this, "leger");
      return true;
    }
    this.vies--;
    const armeAvant = this.arme;
    this.arme = Math.max(1, this.arme - 1);
    this.sound.play("tir-touche");
    // Le choc qui se sent : la caméra tremble et rougit, tout ralentit un instant
    this.cameras.main.shake(300, 0.012).flash(250, 255, 40, 40);
    this.ralentir(RALENTI_DU_COUP);
    this.explosions.explode(40, x, y);
    if (this.arme < armeAvant) {
      this.envoler("−1 tir", x, y - 34, "#ff6b6b", 20);
    }
    if (this.vies <= 0) {
      vibrer(this, "fort");
      this.perdre();
      return true;
    }
    vibrer(this, "moyen");
    this.invincibleJusqua = this.horloge + INVINCIBLE;
    this.tweens.add({ targets: this.vaisseau, alpha: 0.25, duration: 100, yoyo: true, repeat: INVINCIBLE / 200 - 1 });
    return true;
  }

  private perdre() {
    this.enJeu = false;
    this.input.setDefaultCursor("default");
    this.commandes.rendreLaSouris();
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
    this.fini = true;
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
      return;                              // déjà en route (la fin et la pause n'ont pas la même garde)
    }
    this.quitte = true;
    // Le ciel, dessous, s'éteint avec la partie (fonduPuis n'assombrit que la caméra de la partie)
    this.scene.get("tir-fond").cameras.main.fade(200, 0, 0, 0, true);
    fonduPuis(this, () => {
      this.scene.stop("tir-fond");
      this.scene.stop("tir-tableau");
      this.scene.stop("tir-fin");
      this.scene.start("tir-menu");
    });
  }
}
