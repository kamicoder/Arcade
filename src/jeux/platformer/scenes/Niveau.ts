// Un niveau en solo : une campagne (des niveaux à la suite : l'Aventure ou Mon aventure), l'Infini (un
// monde sans fin) ou le test d'un niveau de l'éditeur. Le tableau de bord (score, vies, commandes au doigt) est une autre scène,
// lancée par-dessus : elle ne bouge pas avec la caméra.
//
// Perdre une vie ou passer au niveau suivant, c'est relancer CETTE scène (this.scene.restart) avec le
// score et les vies du moment : le monde repart tout neuf, les pièces et les plateformes fragiles reviennent.
// Comme les pièces reviennent, ce qu'elles avaient rapporté s'en va avec la vie perdue (voir mourir).

import Phaser from "phaser";
import type { Niveau as DonneesDuNiveau } from "../elements";
import { Monde } from "../Monde";
import { Heros } from "../Heros";
import { CameraDevant } from "../camera";
import { Commandes } from "../commandes";
import { Generateur } from "../generateur";
import { Genres } from "../genres";
import { chargerTous, garderLeRecord, type Campagne } from "../niveaux";
import { creerLeDecor, defilerLeDecor } from "../decor";
import type { Boss } from "../Ennemis";
import type { Tableau } from "./Tableau";
import {
  FOND, ZOOM, HAUTEUR_MONDE, LARGEUR_VUE, PIECES_POUR_UNE_VIE, VIES, SAUVEGARDE, SAUT, INTOUCHABLE,
} from "../reglages";
import { lire, ecrire } from "../../../socle/sauvegarde";
import { toucheDuSon } from "../../../socle/son";
import { fonduPuis } from "../../../socle/retour";
import { mettreEnPause } from "../../../socle/pause";
import { elargir } from "../../../socle/largeur";
import { vibrer } from "../../../socle/vibration";

export type Mode = "aventure" | "infini" | "test";

export interface DonneesDeNiveau {
  mode: Mode;                              // « aventure » : une campagne, l'Aventure ou Mon aventure
  campagne?: Campagne;                     // laquelle (l'Aventure si rien n'est dit)
  niveaux: DonneesDuNiveau[];              // ceux de la campagne, ou le seul niveau testé ; vide pour l'Infini
  numero: number;
  score: number;
  vies: number;
  pieces: number;                          // les pièces prises depuis le début de la partie (une vie toutes les 10)
}

export type Fin = "gagne" | "perdu";

const RECORD_INFINI = SAUVEGARDE + "/record-infini";
const MEILLEUR_SCORE = SAUVEGARDE + "/meilleur-score";

// Le record de l'Infini, en mètres (10 pixels font un mètre, comme dans l'atelier)
export function lireLeRecord(): number {
  return lire<number>(RECORD_INFINI) ?? 0;
}

export class Niveau extends Phaser.Scene {
  donnees!: DonneesDeNiveau;
  monde!: Monde;
  heros!: Heros;
  commandes!: Commandes;
  enJeu = false;                           // faux pendant une chute mortelle, et une fois la partie finie
  distance = 0;                            // l'Infini : le plus loin atteint, en mètres
  record = 0;
  ouvrirLaPause: () => void = () => {};    // pour le ⏸ du tableau de bord
  private quitte = false;
  private fini = false;                    // la fin est affichée : elle a ses boutons, la pause n'a plus de sens
  private auDebut = { score: 0, pieces: 0 };   // le score et les pièces au début du niveau
  private viesGagnees = 0;                 // les vies gagnées avec les pièces de ce niveau
  // L'Infini : après une deuxième chance, les ennemis ne le touchent pas, le temps qu'il clignote. Une
  // minuterie de la scène, pas l'heure (time.now) : elle attend pendant la pause.
  intouchable = false;
  private generateur: Generateur | null = null;
  private genres!: Genres;
  private etincelles!: Phaser.GameObjects.Particles.ParticleEmitter;
  confettis!: Phaser.GameObjects.Particles.ParticleEmitter;   // la fête du drapeau
  private camera!: CameraDevant;
  private decor: Phaser.GameObjects.TileSprite[] = [];

  constructor() {
    // La physique Arcade, avec la gravité de l'atelier. 120 pas par seconde au lieu de 60 : un héros qui
    // retombe d'un grand ressort avance de 13 pixels par pas, et ne traverse pas une plateforme de 20.
    super({ key: "platformer-niveau", physics: { default: "arcade", arcade: { gravity: { x: 0, y: 3600 }, fps: 120 } } });
  }

  init(donnees: DonneesDeNiveau) {
    this.donnees = { ...donnees };
    this.auDebut = { score: donnees.score, pieces: donnees.pieces };
    this.viesGagnees = 0;
    this.intouchable = false;
    this.enJeu = true;
    this.quitte = false;
    this.fini = false;
    this.distance = 0;
    this.record = lireLeRecord();
    this.generateur = null;
  }

  get niveau(): DonneesDuNiveau | null {
    return this.donnees.niveaux[this.donnees.numero] ?? null;
  }

  // L'Aventure, celle du jeu ? Elle se joue toujours telle qu'elle est livrée, genres compris
  get dansLAventure(): boolean {
    return this.donnees.mode === "aventure" && (this.donnees.campagne ?? "aventure") === "aventure";
  }

  create() {
    // Au doigt, le niveau prend toute la largeur du téléphone : on en voit plus. Il la garde jusqu'au
    // niveau suivant (un téléphone qu'on tourne compte à la prochaine vie).
    elargir(this);
    this.genres = new Genres(!this.dansLAventure);
    this.monde = new Monde(this, this.genres);
    let largeur: number;
    if (this.donnees.mode === "infini") {
      this.generateur = new Generateur("infini");
      this.monde.ajouter(this.generateur.depart());
      this.monde.ajouter(this.generateur.suite(LARGEUR_VUE + 300));
      largeur = 10_000_000;                // « l'infini » à droite : pas de mur
    } else {
      this.monde.ajouter(this.niveau!.elements);
      largeur = this.niveau!.largeur;
    }
    this.decor = creerLeDecor(this);

    this.heros = new Heros(this, this.monde.depart.x, this.monde.depart.y);
    this.heros.setDepth(3);
    this.monde.brancher(this.heros, {
      piece: () => this.ramasserUnePiece(),
      ecrase: (ennemi) => {
        this.donnees.score++;
        this.sound.play("platformer-saut", { rate: 1.5 });
        this.etincelles.explode(10, ennemi.x, ennemi.y);
        vibrer(this, "leger");
      },
      touche: () => {
        if (!this.intouchable) {
          this.mourir();                   // sauf juste après une deuxième chance, le temps qu'il clignote
        }
      },
      rebond: () => vibrer(this, "leger"),
      bossTouche: (boss) => this.toucherLeBoss(boss),
      drapeau: () => {
        if (!this.monde.boss) {
          this.gagner();
        }
      },
    });

    this.etincelles = this.add.particles(0, 0, "etincelle", {
      emitting: false, lifespan: 500, speed: { min: 80, max: 220 }, scale: { start: 1, end: 0 },
      tint: [0xffd23f, 0xffffff, 0xff7a1a],
    }).setDepth(6);
    // Des confettis, lancés vers le haut, qui retombent en tournoyant
    this.confettis = this.add.particles(0, 0, "platformer-confetti", {
      emitting: false, lifespan: 1600, speed: { min: 180, max: 420 }, angle: { min: 235, max: 305 }, gravityY: 500,
      rotate: { start: 0, end: 540 }, scaleY: { start: 1, end: 0.3 },
      tint: [0xffd23f, 0x5fd068, 0x3fa8ff, 0xff5a8a, 0xffffff, 0xff7a1a],
    }).setDepth(7);

    // Le monde : des murs à gauche et à droite, mais ni plafond ni plancher (on tombe dans le vide)
    this.physics.world.setBounds(0, -HAUTEUR_MONDE, largeur, 3 * HAUTEUR_MONDE);
    this.physics.world.setBoundsCollision(true, true, false, false);

    // La caméra montre les 480 pixels de haut du monde, agrandis pour remplir l'écran, et suit le héros en
    // regardant devant lui (camera.ts). Un niveau moins large que l'écran (un téléphone allongé, un petit
    // niveau de l'éditeur) se montre au milieu.
    const camera = this.cameras.main;
    const vue = this.scale.width / ZOOM;
    const marge = Math.max(0, (vue - largeur) / 2);
    camera.setBackgroundColor(FOND).setZoom(ZOOM).setBounds(-marge, 0, largeur + 2 * marge, HAUTEUR_MONDE);
    this.camera = new CameraDevant(camera, this.heros);
    this.camera.suivre();
    camera.fadeIn(300);

    this.commandes = new Commandes(this, "seul");
    toucheDuSon(this, SAUVEGARDE);
    // Échap, P, Start, le ⏸ du tableau de bord, ou le jeu qui perd la main : la pause (socle/pause.ts)
    this.ouvrirLaPause = mettreEnPause(this, {
      autres: ["platformer-tableau"],
      quitter: () => this.quitter(),
      ailleurs: this.donnees.mode === "test" ? "L'éditeur" : "Le menu",
      possible: () => !this.fini && !this.quitte,
      apresReprise: () => (this.scene.get("platformer-tableau") as Tableau).lacherLesDoigts(),
      son: SAUVEGARDE,
      couleur: 0x5fd068,
    });

    this.scene.launch("platformer-tableau");
  }

  update(_temps: number, delta: number) {
    defilerLeDecor(this, this.decor);
    if (!this.enJeu) {
      return;
    }
    const duree = Math.min(delta / 1000, 0.05);
    const camera = this.cameras.main;

    if (this.generateur) {
      // L'Infini : on fabrique le monde devant la caméra, et on oublie ce qui est loin derrière
      const vue = camera.worldView;
      this.monde.ajouter(this.generateur.suite(vue.right + 300));
      this.monde.oublierAvant(vue.left - 200);
      this.distance = Math.max(this.distance, Math.floor(this.heros.body.x / 10));
    }

    this.monde.avancer(duree);
    this.camera.avancer(duree);
    const terrain = this.monde.terrain(this.heros);
    if (terrain.mortel) {
      this.mourir();
      return;
    }
    this.heros.avancer(this.commandes.lire(), terrain, duree);
    if (this.heros.aSaute) {
      this.sound.play("platformer-saut", { rate: this.heros.doubleSaut ? 1.35 : 1 });   // le double saut, plus aigu
    }
    if (this.heros.body.top > HAUTEUR_MONDE) {
      this.mourir();                       // tombé dans le vide
    }
  }

  private ramasserUnePiece() {
    this.donnees.score++;
    this.donnees.pieces++;
    this.sound.play("platformer-piece");
    this.etincelles.explode(6, this.heros.x, this.heros.y - 10);
    if (this.donnees.pieces % PIECES_POUR_UNE_VIE === 0) {
      this.donnees.vies++;                 // une vie toutes les 10 pièces
      this.viesGagnees++;
      this.sound.play("platformer-vie");
      this.events.emit("vie");
    }
  }

  private toucherLeBoss(boss: Boss) {
    this.sound.play("platformer-boss");
    this.cameras.main.shake(250, 0.012);   // ça secoue !
    this.etincelles.explode(16, boss.x, boss.body.top);
    if (boss.hp > 0) {
      return;
    }
    // Battu : il explose, et le niveau est gagné un instant plus tard
    this.enJeu = false;
    this.monde.boss = null;
    vibrer(this, "fort");
    this.cameras.main.flash(300, 255, 255, 255);
    this.etincelles.explode(60, boss.x, boss.y);
    this.tweens.add({ targets: boss, scale: 1.6, alpha: 0, angle: 30, duration: 500, onComplete: () => boss.destroy() });
    this.time.delayedCall(700, () => this.gagner(true));
  }

  // Aïe : une petite chute de dessin animé (il saute, puis tombe à travers tout), puis la suite selon le mode
  mourir() {
    if (!this.enJeu) {
      return;
    }
    this.enJeu = false;
    this.sound.play("platformer-aie");
    vibrer(this, "moyen");
    this.cameras.main.shake(200, 0.008);
    const corps = this.heros.body;
    corps.checkCollision.none = true;
    corps.setVelocity(0, SAUT * 0.6).setGravityY(0);
    this.heros.setTint(0xff5a5a).setTintMode(Phaser.TintModes.FILL).anims.stop();
    this.cameras.main.stopFollow();

    this.time.delayedCall(900, () => {
      const d = this.donnees;
      if (d.mode === "infini") {
        // L'Infini ne recommence pas le monde : les pièces prises ne reviennent pas, on garde ce qu'elles
        // ont rapporté
        d.vies--;
        if (d.vies <= 0) {
          this.finir("perdu");
        } else {
          this.deuxiemeChance();
        }
        return;
      }
      // L'Aventure (et le test) : le niveau recommence et ses pièces reviennent. On le rejoue comme si
      // on ne l'avait jamais commencé : le score et le compte des pièces reprennent leur valeur du début,
      // et les vies gagnées avec ces pièces s'en vont (on les regagnera en les reprenant). Sinon, mourir
      // exprès ferait gonfler le score, et les mêmes pièces donneraient des vies sans fin.
      d.score = this.auDebut.score;
      d.pieces = this.auDebut.pieces;
      if (d.mode === "test") {
        this.scene.restart(d);             // en test, on recommence sans compter les vies
        return;
      }
      d.vies -= 1 + this.viesGagnees;
      if (d.vies <= 0) {
        this.finir("perdu");
      } else {
        this.scene.restart(d);
      }
    });
  }

  // L'Infini : au lieu de tout recommencer, on revient sur la plateforme la plus proche
  private deuxiemeChance() {
    const proche = this.monde.plusProcheDe(this.heros.x);
    if (!proche) {
      this.finir("perdu");
      return;
    }
    this.heros.clearTint();
    this.heros.body.checkCollision.none = false;
    this.heros.poserA(proche.x + proche.w / 2, proche.y);
    this.camera.suivre();
    // Il clignote, et aucun ennemi ne le touche tant qu'il clignote : il a le temps de s'écarter
    this.intouchable = true;
    this.time.delayedCall(INTOUCHABLE, () => (this.intouchable = false));
    this.tweens.add({ targets: this.heros, alpha: 0.3, duration: 100, yoyo: true, repeat: Math.round(INTOUCHABLE / 200) - 1 });
    this.enJeu = true;
  }

  gagner(bossBattu = false) {
    if (!this.enJeu && !bossBattu) {
      return;
    }
    this.enJeu = false;
    const d = this.donnees;
    this.feter();
    this.heros.body.setVelocity(0, SAUT * 0.5);   // un petit saut de joie
    if (d.mode === "aventure" && d.numero < d.niveaux.length - 1) {
      this.time.delayedCall(600, () => fonduPuis(this, () => this.scene.restart({ ...d, numero: d.numero + 1 })));
    } else {
      this.time.delayedCall(400, () => this.finir("gagne"));
    }
  }

  // Gagner, c'est une fête : des confettis jaillissent du drapeau, il claque au vent, la caméra s'approche
  // un peu dans un éclair doux, et quatre notes montent (le son de la pièce, de plus en plus aigu : do mi sol do)
  private feter() {
    const drapeau = this.monde.drapeauVu;
    const x = drapeau?.x ?? this.heros.x;
    const y = drapeau ? drapeau.y - drapeau.displayHeight : this.heros.y;
    this.confettis.explode(70, x, y);
    if (drapeau) {
      this.tweens.killTweensOf(drapeau);
      this.tweens.add({ targets: drapeau, scaleX: drapeau.scaleX * 0.6, duration: 110, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }
    const camera = this.cameras.main;
    camera.flash(200, 255, 250, 210);
    camera.zoomTo(ZOOM * 1.12, 600, Phaser.Math.Easing.Sine.Out);
    [1, 1.26, 1.5, 2].forEach((rate, i) => this.time.delayedCall(i * 85, () => this.sound.play("platformer-piece", { rate })));
    this.time.delayedCall(340, () => this.sound.play("platformer-vie"));
  }

  private finir(fin: Fin) {
    this.enJeu = false;
    const d = this.donnees;
    let nouveauRecord = false;
    if (d.mode === "infini" && this.distance > this.record) {
      this.record = this.distance;
      ecrire(RECORD_INFINI, this.distance);
      nouveauRecord = true;
    }
    if (this.dansLAventure && d.score > (lire<number>(MEILLEUR_SCORE) ?? 0)) {
      ecrire(MEILLEUR_SCORE, d.score);
      nouveauRecord = true;
    }
    // Mon aventure a son record à elle, remis à zéro quand ses niveaux changent (niveaux.ts)
    if (d.mode === "aventure" && d.campagne === "mon-aventure" && garderLeRecord(d.score)) {
      nouveauRecord = true;
    }
    this.fini = true;
    this.physics.pause();
    this.scene.launch("platformer-fin", { fin, nouveauRecord });
  }

  // Après la fin : la même partie, depuis le début
  rejouer() {
    const d = this.donnees;
    this.scene.stop("platformer-fin");
    if (d.mode === "aventure") {
      const niveaux = chargerTous(d.campagne ?? "aventure");   // relus : l'éditeur a pu changer Mon aventure
      if (niveaux.length > 0) {
        this.scene.restart({ ...d, niveaux, numero: 0, score: 0, vies: VIES, pieces: 0 });
        return;
      }
    }
    this.scene.restart({ ...d, numero: 0, score: 0, vies: d.mode === "infini" ? 1 : VIES, pieces: 0 });
  }

  // Le menu, ou l'éditeur si on testait un de ses niveaux
  quitter() {
    if (this.quitte) {
      return;                              // déjà en route (la fin et la pause n'ont pas la même garde)
    }
    this.quitte = true;
    fonduPuis(this, () => {
      this.scene.stop("platformer-tableau");
      this.scene.stop("platformer-fin");
      this.scene.start(this.donnees.mode === "test" ? "platformer-editeur" : "platformer-menu");
    });
  }
}
