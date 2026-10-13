// Un niveau en solo : l'Aventure (les niveaux à la suite), l'Infini (un monde sans fin) ou le test
// d'un niveau de l'éditeur. Le tableau de bord (score, vies, commandes au doigt) est une autre scène,
// lancée par-dessus : elle ne bouge pas avec la caméra.
//
// Perdre une vie ou passer au niveau suivant, c'est relancer CETTE scène (this.scene.restart) avec le
// score et les vies du moment : le monde repart tout neuf, les pièces et les plateformes fragiles reviennent.

import Phaser from "phaser";
import type { Niveau as DonneesDuNiveau } from "../elements";
import { Monde } from "../Monde";
import { Heros } from "../Heros";
import { Commandes } from "../commandes";
import { Generateur } from "../generateur";
import { Genres } from "../genres";
import { chargerTous } from "../niveaux";
import { toucheDuSon } from "../son";
import { creerLeDecor, defilerLeDecor } from "../decor";
import type { Boss } from "../Ennemis";
import {
  FOND, ZOOM, HAUTEUR_MONDE, LARGEUR_VUE, PIECES_POUR_UNE_VIE, VIES, SAUVEGARDE, SAUT,
} from "../reglages";
import { lire, ecrire } from "../../../socle/sauvegarde";
import { surTouche } from "../../../socle/clavier";
import { fonduPuis } from "../../../socle/retour";

export type Mode = "aventure" | "infini" | "test";

export interface DonneesDeNiveau {
  mode: Mode;
  niveaux: DonneesDuNiveau[];              // l'Aventure, ou le seul niveau testé ; vide pour l'Infini
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
  private quitte = false;
  private generateur: Generateur | null = null;
  private genres!: Genres;
  private etincelles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private decor: Phaser.GameObjects.TileSprite[] = [];

  constructor() {
    // La physique Arcade, avec la gravité de l'atelier. 120 pas par seconde au lieu de 60 : un héros qui
    // retombe d'un grand ressort avance de 13 pixels par pas, et ne traverse pas une plateforme de 20.
    super({ key: "platformer-niveau", physics: { default: "arcade", arcade: { gravity: { x: 0, y: 3600 }, fps: 120 } } });
  }

  init(donnees: DonneesDeNiveau) {
    this.donnees = { ...donnees };
    this.enJeu = true;
    this.quitte = false;
    this.distance = 0;
    this.record = lireLeRecord();
    this.generateur = null;
  }

  get niveau(): DonneesDuNiveau | null {
    return this.donnees.niveaux[this.donnees.numero] ?? null;
  }

  create() {
    this.genres = new Genres();
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
      },
      touche: () => this.mourir(),
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

    // Le monde : des murs à gauche et à droite, mais ni plafond ni plancher (on tombe dans le vide)
    this.physics.world.setBounds(0, -HAUTEUR_MONDE, largeur, 3 * HAUTEUR_MONDE);
    this.physics.world.setBoundsCollision(true, true, false, false);

    // La caméra montre les 480 pixels de haut du monde, agrandis pour remplir l'écran, et suit le héros
    const camera = this.cameras.main;
    camera.setBackgroundColor(FOND).setZoom(ZOOM).setBounds(0, 0, largeur, HAUTEUR_MONDE);
    camera.startFollow(this.heros, true, 0.15, 0.15);
    camera.fadeIn(300);

    this.commandes = new Commandes(this, "seul");
    surTouche(this, "ESC", () => this.quitter());
    toucheDuSon(this);
    this.input.gamepad?.on("down", (_m: Phaser.Input.Gamepad.Gamepad, bouton: Phaser.Input.Gamepad.Button) => {
      if (bouton.index === 9 || bouton.index === 8) {   // Start ou Select : on s'en va
        this.quitter();
      }
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
    const terrain = this.monde.terrain(this.heros);
    if (terrain.mortel) {
      this.mourir();
      return;
    }
    this.heros.avancer(this.commandes.lire(), terrain, duree);
    if (this.heros.aSaute) {
      this.sound.play("platformer-saut");
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
    this.cameras.main.shake(200, 0.008);
    const corps = this.heros.body;
    corps.checkCollision.none = true;
    corps.setVelocity(0, SAUT * 0.6).setGravityY(0);
    this.heros.setTint(0xff5a5a).setTintMode(Phaser.TintModes.FILL).anims.stop();
    this.cameras.main.stopFollow();

    this.time.delayedCall(900, () => {
      const d = this.donnees;
      if (d.mode === "test") {
        this.scene.restart(d);             // en test, on recommence sans compter
        return;
      }
      d.vies--;
      if (d.vies <= 0) {
        this.finir("perdu");
      } else if (d.mode === "infini") {
        this.deuxiemeChance();
      } else {
        this.scene.restart(d);             // l'Aventure : on recommence le niveau
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
    this.cameras.main.startFollow(this.heros, true, 0.15, 0.15);
    this.tweens.add({ targets: this.heros, alpha: 0.3, duration: 100, yoyo: true, repeat: 4 });
    this.enJeu = true;
  }

  gagner(bossBattu = false) {
    if (!this.enJeu && !bossBattu) {
      return;
    }
    this.enJeu = false;
    const d = this.donnees;
    this.sound.play("platformer-vie");
    this.heros.body.setVelocity(0, SAUT * 0.5);   // un petit saut de joie
    if (d.mode === "aventure" && d.numero < d.niveaux.length - 1) {
      this.time.delayedCall(600, () => fonduPuis(this, () => this.scene.restart({ ...d, numero: d.numero + 1 })));
    } else {
      this.time.delayedCall(400, () => this.finir("gagne"));
    }
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
    if (d.mode === "aventure" && d.score > (lire<number>(MEILLEUR_SCORE) ?? 0)) {
      ecrire(MEILLEUR_SCORE, d.score);
      nouveauRecord = true;
    }
    this.physics.pause();
    this.scene.launch("platformer-fin", { fin, nouveauRecord });
  }

  // Après la fin : la même partie, depuis le début
  rejouer() {
    const d = this.donnees;
    this.scene.stop("platformer-fin");
    if (d.mode === "aventure") {
      const niveaux = chargerTous();
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
      return;                              // Échap pendant la fin : la fin et le niveau l'entendent tous les deux
    }
    this.quitte = true;
    fonduPuis(this, () => {
      this.scene.stop("platformer-tableau");
      this.scene.stop("platformer-fin");
      this.scene.start(this.donnees.mode === "test" ? "platformer-editeur" : "platformer-menu");
    });
  }
}
