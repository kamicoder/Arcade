// Une partie : un niveau dessiné, ou le mode sans fin (un mur après l'autre). La raquette, la balle, les
// briques, les bonus qui tombent. Le tableau de bord est une autre scène, lancée par-dessus.
//
// La physique Arcade fait presque tout : la balle rebondit sur les bords du monde (sauf en bas, où elle
// se perd) et sur les briques (un groupe de corps immobiles). Deux choses seulement sont faites à la main :
// le rebond sur la raquette, que le joueur vise (rebond.ts), et la vitesse de la balle, remise à chaque
// image à la vitesse voulue (la physique la garderait, mais la balle accélère au fil du niveau).

import Phaser from "phaser";
import { Commandes } from "../commandes";
import { NIVEAUX, lireLaGrille, aCasser, voisines, murSansFin, COLONNES, type Brique, type GenreDeBrique } from "../niveaux";
import { rebondSurLaRaquette, redresser } from "../rebond";
import { garder, garderSansFin, etoiles, recordSansFin } from "../progression";
import { BRIQUE, COULEURS_DES_BRIQUES, GENRES_DE_BONUS, imageDeBrique, type GenreDeBonus } from "../textures";
import {
  VITESSE, VITESSE_PAR_BRIQUE, VITESSE_MAX, VITESSE_PAR_MUR, BALLES_MAX, VITESSE_RAQUETTE, VIES,
  CHANCE_DE_BONUS, VITESSE_BONUS, DUREE_LARGE, DUREE_FEU, DUREE_LENTE, LENTE, POINTS_PAR_VIE, COMBO_MAX, SAUVEGARDE, VIOLET,
} from "../reglages";
import { LARGEUR, HAUTEUR } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { toucheDuSon } from "../../../socle/son";
import { surManette, MANETTE } from "../../../socle/manette";
import { fonduPuis } from "../../../socle/retour";
import { mettreEnPause } from "../../../socle/pause";
import type { DonneesDeFin } from "./Fin";

// Ce que la partie reçoit au départ : un niveau (0 à 9), ou le mode sans fin (les tests peuvent le faire
// commencer à un mur plus loin)
export type DonneesDePartie = { mode: "niveau"; numero: number } | { mode: "sansFin"; mur?: number };

type Mobile = Phaser.Physics.Arcade.Image & { body: Phaser.Physics.Arcade.Body };
type Etat = "tenue" | "jeu" | "fini";      // la balle attend sur la raquette, roule, ou c'est fini

const HAUT_DU_MONDE = 44;                  // sous le tableau de bord
const HAUT_DES_BRIQUES = 78;
const PAS = { x: BRIQUE.largeur + 4, y: BRIQUE.hauteur + 4 };
const GAUCHE_DES_BRIQUES = (LARGEUR - COLONNES * PAS.x) / 2;
const Y_RAQUETTE = HAUTEUR - 40;
const POINTS: Record<GenreDeBrique, number> = { simple: 10, argent: 20, or: 30, explosive: 15, metal: 0 };
const DUREES: Partial<Record<GenreDeBonus, number>> = { large: DUREE_LARGE, feu: DUREE_FEU, lente: DUREE_LENTE };

// Une brique du mur : son image, son corps immobile, et ce que dit la grille d'elle
export class BriqueDuMur extends Phaser.Physics.Arcade.Image {
  constructor(scene: Phaser.Scene, readonly brique: Brique) {
    super(scene,
      GAUCHE_DES_BRIQUES + brique.colonne * PAS.x + PAS.x / 2,
      HAUT_DES_BRIQUES + brique.ligne * PAS.y + PAS.y / 2,
      imageDeBrique(brique.couleur));
  }
  get ligne() { return this.brique.ligne; }
  get colonne() { return this.brique.colonne; }
  get genre() { return this.brique.genre; }
}

export class Partie extends Phaser.Scene {
  donnees!: DonneesDePartie;
  etat: Etat = "tenue";
  score = 0;
  vies = VIES;
  viesPerdues = 0;
  mur = 1;                                 // le mode sans fin : le numéro du mur
  vitesse = VITESSE;
  combo = 0;
  readonly effets = new Map<GenreDeBonus, Phaser.Time.TimerEvent>();
  raquette!: Mobile;
  balles!: Phaser.Physics.Arcade.Group;
  briques!: Phaser.Physics.Arcade.StaticGroup;
  bonus!: Phaser.Physics.Arcade.Group;
  private commandes!: Commandes;
  private quitte = false;
  ouvrirLaPause!: () => void;              // pour le ⏸ du tableau de bord
  private eclats!: Phaser.GameObjects.Particles.ParticleEmitter;
  private trainee!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super({ key: "briques-partie", physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 } } } });
  }

  get sansFin() {
    return this.donnees.mode === "sansFin";
  }

  // Le nom du mur, pour le tableau de bord
  get titre() {
    return this.donnees.mode === "niveau"
      ? `Niveau ${this.donnees.numero + 1} : ${NIVEAUX[this.donnees.numero].nom}`
      : `Sans fin : mur ${this.mur}`;
  }

  create(donnees: DonneesDePartie) {
    // scene.restart garde la pause de la physique et des tweens : on remet tout en marche
    this.physics.resume();
    this.tweens.resumeAll();
    this.donnees = donnees;
    this.score = 0;
    this.vies = VIES;
    this.viesPerdues = 0;
    this.mur = donnees.mode === "sansFin" ? donnees.mur ?? 1 : 1;
    this.combo = 0;
    this.quitte = false;
    this.effets.clear();

    this.cameras.main.fadeIn(300);
    this.add.image(0, 0, "briques-fond").setOrigin(0).setDepth(-10);

    // Le monde : ses bords renvoient la balle, sauf en bas, où elle tombe
    this.physics.world.setBounds(0, HAUT_DU_MONDE, LARGEUR, HAUTEUR - HAUT_DU_MONDE + 200);
    this.physics.world.setBoundsCollision(true, true, true, false);
    this.physics.world.on(Phaser.Physics.Arcade.Events.WORLD_BOUNDS, () => this.sound.play("briques-mur", { volume: 0.25 }));

    this.raquette = this.physics.add.image(LARGEUR / 2, Y_RAQUETTE, "briques-raquette").setDepth(5) as Mobile;
    this.raquette.setImmovable(true).setCollideWorldBounds(true);

    // Un groupe de physique règle lui-même chaque balle qu'il crée : rebond parfait, bords du monde
    this.balles = this.physics.add.group({ defaultKey: "briques-balle", bounceX: 1, bounceY: 1, collideWorldBounds: true });
    this.bonus = this.physics.add.group();
    this.briques = this.physics.add.staticGroup();

    this.eclats = this.add.particles(0, 0, "etincelle", {
      emitting: false, lifespan: { min: 250, max: 600 }, speed: { min: 60, max: 260 }, scale: { start: 1.1, end: 0 },
      gravityY: 400, blendMode: "ADD",
    }).setDepth(7);
    this.trainee = this.add.particles(0, 0, "etincelle", {
      emitting: false, lifespan: 260, scale: { start: 0.7, end: 0 }, alpha: { start: 0.6, end: 0 }, blendMode: "ADD",
    }).setDepth(3);

    // Qui touche qui. Entre deux groupes, Phaser ne garde pas toujours l'ordre : on reconnaît la brique
    // à sa classe. La fonction « process » dit si le choc rebondit : la balle de feu traverse les briques.
    this.physics.add.collider(this.balles, this.briques,
      (a, b) => a instanceof BriqueDuMur ? this.toucherUneBrique(a) : this.toucherUneBrique(b as BriqueDuMur),
      (a, b) => this.rebondit(a instanceof BriqueDuMur ? a : b as BriqueDuMur));
    this.surUnDe(this.raquette, this.balles, (balle: Mobile) => this.renvoyer(balle));
    this.surUnDe(this.raquette, this.bonus, (bonus: Mobile) => this.ramasser(bonus));

    this.commandes = new Commandes(this, () => this.raquette.body.center.x, () => this.lancer());
    surTouche(this, "SPACE", () => this.lancer());
    surTouche(this, "UP", () => this.lancer());
    toucheDuSon(this, SAUVEGARDE);
    surManette(this, MANETTE.A, () => this.lancer());
    // Échap, P, Start ou Select : la pause (socle/pause.ts). Pas à la fin : là, Start choisit un bouton de la fin.
    this.ouvrirLaPause = mettreEnPause(this, {
      quitter: () => this.quitter(),
      ailleurs: "Les niveaux",
      autres: ["briques-tableau"],
      possible: () => this.etat !== "fini" && !this.quitte,
      // Un doigt levé pendant la pause n'a pas été entendu : la raquette ne le suit plus
      apresReprise: () => this.commandes.toutLacher(),
      son: SAUVEGARDE,
      couleur: VIOLET,
    });
    // À la souris, la raquette suit le curseur : la flèche se cache pendant la partie
    this.input.setDefaultCursor("none");
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.setDefaultCursor("default"));

    this.monterLeMur();
    this.scene.launch("briques-tableau");
  }

  // Quand un objet seul (la raquette) touche un objet d'un groupe : Phaser ne passe pas les deux dans
  // l'ordre donné, on reconnaît l'objet seul (voir docs/PIEGES-PHASER.md)
  private surUnDe<T>(seul: Phaser.GameObjects.GameObject, groupe: Phaser.GameObjects.Group, action: (autre: T) => void) {
    this.physics.add.overlap(seul, groupe, (a, b) => action((a === seul ? b : a) as T));
  }

  // —— Le mur ——

  private grille(): string[] {
    return this.donnees.mode === "niveau" ? NIVEAUX[this.donnees.numero].grille : murSansFin(this.mur);
  }

  // Les briques arrivent rangée par rangée, puis la balle attend sur la raquette
  private monterLeMur() {
    this.briques.clear(true, true);
    this.vitesse = Math.min(VITESSE + (this.sansFin ? (this.mur - 1) * VITESSE_PAR_MUR : 0), VITESSE_MAX);
    for (const brique of lireLaGrille(this.grille())) {
      const image = new BriqueDuMur(this, brique);
      this.add.existing(image);
      this.briques.add(image);
      // Le corps immobile est déjà placé : on n'anime que l'image (un corps immobile ne suit pas l'échelle)
      image.setAlpha(0).setScale(0.4);
      this.tweens.add({ targets: image, alpha: 1, scale: 1, duration: 300, delay: brique.ligne * 70 + brique.colonne * 15, ease: "Back.Out" });
    }
    this.tenirLaBalle();
  }

  // Les briques encore là (le métal compris)
  briquesRestantes(): BriqueDuMur[] {
    return this.briques.getMatching("active", true) as BriqueDuMur[];
  }

  // —— La balle ——

  private creerUneBalle(x: number, y: number): Mobile {
    const balle = this.balles.create(x, y) as Mobile;
    balle.setDepth(6).body.setCircle(9);
    balle.body.onWorldBounds = true;
    if (this.effets.has("feu")) {
      balle.setTint(0xff7a1a);
    }
    return balle;
  }

  // Une seule balle, posée sur la raquette
  private tenirLaBalle() {
    this.balles.clear(true, true);
    this.creerUneBalle(this.raquette.x, Y_RAQUETTE - 20);
    this.etat = "tenue";
    this.combo = 0;
  }

  lancer() {
    if (this.etat !== "tenue" || this.quitte) {
      return;
    }
    this.etat = "jeu";
    const balle = this.balles.getFirstAlive() as Mobile;
    // Un peu de biais, au hasard, pour ne pas renvoyer la balle toujours au même endroit
    const v = rebondSurLaRaquette(Phaser.Math.FloatBetween(0.15, 0.35) * Phaser.Utils.Array.GetRandom([-1, 1]), this.vitesseVoulue());
    balle.body.setVelocity(v.x, v.y);
    this.sound.play("briques-rebond");
  }

  vitesseVoulue() {
    return this.vitesse * (this.effets.has("lente") ? LENTE : 1);
  }

  update() {
    this.piloter();
    const balles = this.balles.getMatching("active", true) as Mobile[];
    if (this.etat === "tenue") {
      // La balle suit la raquette. On part de body.center : la place de l'image a un pas de physique de retard.
      balles[0]?.body.reset(this.raquette.body.center.x, Y_RAQUETTE - 20);
    } else if (this.etat === "jeu") {
      for (const balle of balles) {
        const v = redresser(balle.body.velocity, this.vitesseVoulue());
        balle.body.setVelocity(v.x, v.y);
        this.trainee.emitParticleAt(balle.x, balle.y, 1);
        if (balle.y > HAUTEUR + 30) {
          balle.destroy();
        }
      }
      if (this.balles.countActive() === 0) {
        this.perdreUneBalle();
      }
    }
    for (const bonus of this.bonus.getMatching("active", true) as Mobile[]) {
      if (bonus.y > HAUTEUR + 30) {
        this.tweens.killTweensOf(bonus);
        bonus.destroy();
      }
    }
  }

  private piloter() {
    const corps = this.raquette.body;
    if (this.etat === "fini") {
      corps.setVelocityX(0);
      return;
    }
    const { dx, cible } = this.commandes.lire();
    if (cible !== null) {
      // Le doigt ou la souris : la raquette rattrape la cible, vite, sans la dépasser
      corps.setVelocityX(Phaser.Math.Clamp((cible - corps.center.x) * 18, -VITESSE_RAQUETTE * 3, VITESSE_RAQUETTE * 3));
    } else {
      corps.setVelocityX(dx * VITESSE_RAQUETTE);
    }
  }

  // La balle sur la raquette : elle repart vers le haut, plus penchée quand elle tape loin du milieu
  private renvoyer(balle: Mobile) {
    if (this.etat !== "jeu" || !balle.active || balle.body.velocity.y <= 0) {
      return;                              // elle remonte déjà (un second choc dans la même image)
    }
    const raquette = this.raquette.body;
    const ecart = (balle.body.center.x - raquette.center.x) / (raquette.width / 2);
    const v = rebondSurLaRaquette(ecart, this.vitesseVoulue());
    balle.body.setVelocity(v.x, v.y);
    this.combo = 0;
    this.sound.play("briques-rebond", { volume: 0.6 });
    this.raquette.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(70, () => this.raquette.clearTint());
  }

  private perdreUneBalle() {
    this.vies--;
    this.viesPerdues++;
    this.finirLesEffets();
    this.bonus.clear(true, true);
    this.sound.play("briques-perdu");
    this.cameras.main.shake(250, 0.01);
    if (this.vies <= 0) {
      this.finir(false);
      return;
    }
    this.tenirLaBalle();
  }

  // —— Les briques ——

  // Le choc rebondit-il ? Non pour la balle de feu, qui casse et traverse (sauf le métal)
  private rebondit(brique: BriqueDuMur): boolean {
    if (this.effets.has("feu") && brique.genre !== "metal") {
      this.casser(brique);
      return false;
    }
    return brique.active;
  }

  private toucherUneBrique(brique: BriqueDuMur) {
    if (!brique.active) {
      return;
    }
    if (brique.genre === "metal") {
      this.sound.play("briques-metal", { volume: 0.5 });
      return;
    }
    brique.brique.coups--;
    if (brique.brique.coups > 0) {
      // Une brique dure : une fissure de plus, et elle tremble
      const fissures = (brique.genre === "or" ? 3 : 2) - brique.brique.coups;
      brique.setTexture(imageDeBrique(brique.brique.couleur, fissures));
      this.sound.play("briques-dure", { volume: 0.6 });
      this.tweens.add({ targets: brique, scale: { from: 1.12, to: 1 }, duration: 120 });
      return;
    }
    this.casser(brique);
  }

  // Une brique cassée : des points (plus pour une série sans toucher la raquette), des éclats, peut-être
  // un bonus, et la balle un peu plus rapide
  private casser(brique: BriqueDuMur) {
    if (!brique.active || this.etat === "fini") {
      return;
    }
    const { x, y } = brique;
    brique.disableBody(true, true);
    this.combo = Math.min(this.combo + 1, COMBO_MAX);
    this.marquer(POINTS[brique.genre] * this.combo, x, y);
    this.eclats.particleTint = COULEURS_DES_BRIQUES[brique.brique.couleur].corps;
    this.eclats.explode(14, x, y);
    this.sound.play("briques-brique", { rate: 1 + (this.combo - 1) * 0.07, volume: 0.6 });
    this.vitesse = Math.min(this.vitesse + VITESSE_PAR_BRIQUE, VITESSE_MAX);
    if (Math.random() < CHANCE_DE_BONUS) {
      this.lacherUnBonus(x, y);
    }
    if (brique.genre === "explosive") {
      this.exploser(brique);
    }
    if (aCasser(this.briquesRestantes()) === 0) {
      this.gagnerLeMur();
    }
  }

  // L'explosive casse ses huit voisines (le métal résiste) ; une voisine explosive explose à son tour
  private exploser(brique: BriqueDuMur) {
    this.sound.play("briques-boum");
    this.cameras.main.shake(180, 0.008);
    this.eclats.particleTint = 0xffd23f;
    this.eclats.explode(30, brique.x, brique.y);
    const autour = voisines(brique, this.briquesRestantes()).filter((b) => b.genre !== "metal");
    this.time.delayedCall(90, () => autour.forEach((b) => this.casser(b)));
  }

  // Des points, et le nombre qui s'envole là où la brique a cassé
  private marquer(points: number, x: number, y: number) {
    this.score += points;
    const texte = this.add.text(x, y, String(points), {
      fontFamily: "system-ui, sans-serif", fontSize: points >= 50 ? "22px" : "15px", fontStyle: "bold", color: "#ffd23f",
    }).setOrigin(0.5).setDepth(8);
    this.tweens.add({ targets: texte, y: y - 30, alpha: 0, duration: 600, onComplete: () => texte.destroy() });
  }

  // —— Les bonus ——

  lacherUnBonus(x: number, y: number, genre?: GenreDeBonus) {
    // Une vie est plus rare que le reste
    genre ??= Math.random() < 0.08 ? "vie" : Phaser.Utils.Array.GetRandom(GENRES_DE_BONUS.filter((g) => g !== "vie"));
    const bonus = this.bonus.create(x, y, "briques-bonus-" + genre) as Mobile;
    bonus.setData("genre", genre).setDepth(4).body.setVelocityY(VITESSE_BONUS);
    // Il bat doucement, pour qu'on le remarque
    this.tweens.add({ targets: bonus, scale: 1.15, duration: 350, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  }

  private ramasser(bonus: Mobile) {
    if (!bonus.active || this.etat === "fini") {
      return;
    }
    const genre = bonus.getData("genre") as GenreDeBonus;
    this.tweens.killTweensOf(bonus);
    bonus.destroy();
    this.sound.play("briques-bonus");
    if (genre === "vie") {
      this.vies++;
    } else if (genre === "multi") {
      this.multiplier();
    } else {
      this.commencerUnEffet(genre);
    }
  }

  // Chaque balle en donne deux autres, qui partent un peu de côté
  private multiplier() {
    for (const balle of this.balles.getMatching("active", true) as Mobile[]) {
      for (const angle of [-25, 25]) {
        if (this.balles.countActive() >= BALLES_MAX || this.etat !== "jeu") {
          return;
        }
        const nouvelle = this.creerUneBalle(balle.body.center.x, balle.body.center.y);
        const v = balle.body.velocity.clone().rotate(Phaser.Math.DegToRad(angle));
        nouvelle.body.setVelocity(v.x, v.y);
      }
    }
  }

  // Un effet qui dure : le reprendre le fait durer de nouveau
  private commencerUnEffet(genre: GenreDeBonus) {
    this.effets.get(genre)?.remove();
    this.effets.set(genre, this.time.delayedCall(DUREES[genre]!, () => this.finirUnEffet(genre)));
    if (genre === "large") {
      this.tweens.add({ targets: this.raquette, scaleX: 1.5, duration: 250, ease: "Back.Out" });
    } else if (genre === "feu") {
      this.balles.getMatching("active", true).forEach((b) => (b as Mobile).setTint(0xff7a1a));
      this.trainee.particleTint = 0xff5a1a;
    }
  }

  private finirUnEffet(genre: GenreDeBonus) {
    this.effets.get(genre)?.remove();
    this.effets.delete(genre);
    if (genre === "large") {
      this.tweens.add({ targets: this.raquette, scaleX: 1, duration: 250 });
    } else if (genre === "feu") {
      this.balles.getMatching("active", true).forEach((b) => (b as Mobile).clearTint());
      this.trainee.particleTint = 0xffffff;
    }
  }

  private finirLesEffets() {
    for (const genre of [...this.effets.keys()]) {
      this.finirUnEffet(genre);
    }
  }

  // Le temps qui reste à un effet, en secondes (pour le tableau de bord)
  resteDeLEffet(genre: GenreDeBonus): number {
    const minuterie = this.effets.get(genre);
    return minuterie ? Math.ceil(minuterie.getRemainingSeconds()) : 0;
  }

  // —— Gagner, perdre ——

  private gagnerLeMur() {
    this.etat = "fini";
    this.balles.getMatching("active", true).forEach((b) => (b as Mobile).body.setVelocity(0, 0));
    this.bonus.clear(true, true);
    this.finirLesEffets();
    this.sound.play("briques-victoire");
    this.cameras.main.flash(250, 255, 255, 255);
    if (this.sansFin) {
      // Le mur suivant, un peu plus dur ; la balle repart de la raquette
      this.time.delayedCall(1200, () => {
        this.mur++;
        this.monterLeMur();
      });
      return;
    }
    this.score += this.vies * POINTS_PAR_VIE;
    this.time.delayedCall(900, () => this.finir(true));
  }

  private finir(gagne: boolean) {
    this.etat = "fini";
    this.input.setDefaultCursor("default");
    let record: boolean;
    let nombreDEtoiles = 0;
    if (this.donnees.mode === "niveau") {
      nombreDEtoiles = etoiles(this.viesPerdues);
      record = gagne && garder(this.donnees.numero, { etoiles: nombreDEtoiles, score: this.score });
    } else {
      record = garderSansFin({ score: this.score, mur: this.mur });
    }
    if (!gagne) {
      this.sound.play("briques-defaite");
    }
    this.physics.pause();
    const fin: DonneesDeFin = { gagne, etoiles: nombreDEtoiles, score: this.score, record, recordSansFin: recordSansFin() };
    this.scene.launch("briques-fin", fin);
  }

  // —— Après la fin, ou en cours de route ——

  private partir(action: () => void) {
    if (this.quitte) {
      return;                              // un double appui, ou Échap pendant la fin : on ne part qu'une fois
    }
    this.quitte = true;
    fonduPuis(this, () => {
      this.scene.stop("briques-tableau");
      this.scene.stop("briques-fin");
      action();
    });
  }

  rejouer() {
    this.partir(() => this.scene.restart(this.donnees.mode === "niveau" ? this.donnees : { mode: "sansFin" }));
  }

  suivant() {
    if (this.donnees.mode === "niveau" && this.donnees.numero + 1 < NIVEAUX.length) {
      const numero = this.donnees.numero + 1;
      this.partir(() => this.scene.restart({ mode: "niveau", numero }));
    } else {
      this.partir(() => this.scene.restart({ mode: "sansFin" }));
    }
  }

  quitter() {
    this.partir(() => this.scene.start("briques-menu"));
  }
}
