// Le mode 2 joueurs : une course en écran partagé. Chaque joueur a SON monde sans fin (le monde du
// joueur 2 est rangé 1000 pixels sous celui du joueur 1) et SA caméra, qui ne montre que sa moitié
// d'écran. Une pièce ou un ennemi écrasé : un point. Touché ou tombé : retour au début, à zéro point.
// Le premier à 15 points gagne.

import Phaser from "phaser";
import { Monde } from "../Monde";
import { Heros } from "../Heros";
import { CameraDevant } from "../camera";
import { Commandes, type Joueur } from "../commandes";
import { Generateur } from "../generateur";
import { Genres } from "../genres";
import { FOND, ZOOM, HAUTEUR_MONDE, OBJECTIF_DUO, SAUVEGARDE } from "../reglages";
import { HAUTEUR } from "../../../socle/style";
import { toucheDuSon } from "../../../socle/son";
import { fonduPuis } from "../../../socle/retour";
import { mettreEnPause } from "../../../socle/pause";
import { vibrer, type Force } from "../../../socle/vibration";

const DECALAGE = 1000;                     // le monde du joueur 2 est rangé sous celui du joueur 1
const INFINI = 10_000_000;

interface Coureur {
  nom: string;
  monde: Monde;
  heros: Heros;
  commandes: Commandes;
  camera: Phaser.Cameras.Scene2D.Camera;
  regard: CameraDevant;                    // sa caméra regarde devant lui
  generateur: Generateur;
  score: number;
  aRefaire: boolean;                       // touché : son monde sera refait à l'image suivante
}

export class Duo extends Phaser.Scene {
  coureurs: Coureur[] = [];
  enJeu = false;                           // faux une fois la course gagnée : la fin est affichée
  ouvrirLaPause: () => void = () => {};    // pour le ⏸ du tableau de bord
  private quitte = false;

  constructor() {
    super({ key: "platformer-duo", physics: { default: "arcade", arcade: { gravity: { x: 0, y: 3600 }, fps: 120 } } });
  }

  create() {
    this.coureurs = [];
    this.enJeu = true;
    this.quitte = false;
    const genres = new Genres();
    this.physics.world.setBounds(0, -HAUTEUR_MONDE, INFINI, DECALAGE + 3 * HAUTEUR_MONDE);
    this.physics.world.setBoundsCollision(true, false, false, false);

    // Deux caméras sur le même écran : chacune a sa moitié (son « viewport ») et suit son joueur
    const moitie = this.scale.width / 2;
    const cameras = [this.cameras.main.setViewport(0, 0, moitie, HAUTEUR), this.cameras.add(moitie, 0, moitie, HAUTEUR)];
    const joueurs: [string, Joueur, string][] = [["J1 (bleu)", "j1", "platformer-heros"], ["J2 (orange)", "j2", "platformer-heros2"]];
    joueurs.forEach(([nom, joueur, planche], i) => {
      const dy = i * DECALAGE;
      const monde = new Monde(this, genres, dy);
      const heros = new Heros(this, 40, 360 + dy, planche).setDepth(3);
      const coureur: Coureur = {
        nom, monde, heros, commandes: new Commandes(this, joueur), camera: cameras[i], regard: new CameraDevant(cameras[i], heros),
        generateur: new Generateur("duo"), score: 0, aRefaire: false,
      };
      monde.brancher(heros, {
        piece: () => this.marquer(coureur),
        ecrase: () => {
          this.marquer(coureur);
          this.vibrer(coureur, "leger");
        },
        touche: () => this.repartir(coureur),
        rebond: () => this.vibrer(coureur, "leger"),
      });
      cameras[i].setBackgroundColor(FOND).setZoom(ZOOM).setBounds(0, dy, INFINI, HAUTEUR_MONDE);
      coureur.regard.suivre();
      cameras[i].fadeIn(300);
      this.coureurs.push(coureur);
      this.preparer(coureur);
    });

    toucheDuSon(this, SAUVEGARDE);
    // Échap, P, Start sur l'une ou l'autre manette, le ⏸, ou le jeu qui perd la main : la pause
    this.ouvrirLaPause = mettreEnPause(this, {
      autres: ["platformer-tableau"],
      quitter: () => this.quitter(),
      possible: () => this.enJeu && !this.quitte,
      son: SAUVEGARDE,
      couleur: 0x5fd068,
    });
    this.scene.launch("platformer-tableau");
  }

  // Un monde tout neuf, et le joueur au début
  private preparer(c: Coureur) {
    c.monde.detruire();
    c.generateur = new Generateur("duo");
    c.monde.ajouter(c.generateur.depart());
    c.monde.ajouter(c.generateur.suite(600));
    c.heros.poserA(55, 400 + c.monde.dy);
    c.score = 0;
    c.aRefaire = false;
  }

  // Seule la manette de ce joueur vibre (au clavier, rien)
  private vibrer(c: Coureur, force: Force) {
    const manette = c.commandes.manette;
    if (manette) {
      vibrer(this, force, manette);
    }
  }

  private marquer(c: Coureur) {
    c.score++;
    this.sound.play("platformer-piece");
    if (c.score >= OBJECTIF_DUO && this.enJeu) {
      this.enJeu = false;
      this.physics.pause();
      this.sound.play("platformer-vie");
      this.scene.launch("platformer-fin", { fin: "gagne", gagnant: c.nom });
    }
  }

  // Touché ou tombé : retour au début, zéro point. Le monde est refait à l'image suivante : un ennemi
  // touché l'est pendant que la physique passe ses objets en revue, ce n'est pas le moment de les détruire.
  private repartir(c: Coureur) {
    if (c.aRefaire) {
      return;
    }
    c.aRefaire = true;
    this.sound.play("platformer-aie");
    this.vibrer(c, "moyen");
    c.camera.flash(250, 255, 80, 80);
    c.camera.shake(150, 0.01);
  }

  update(_temps: number, delta: number) {
    if (!this.enJeu) {
      return;
    }
    const duree = Math.min(delta / 1000, 0.05);
    for (const c of this.coureurs) {
      if (c.aRefaire) {
        this.preparer(c);
      }
      const vue = c.camera.worldView;
      c.monde.ajouter(c.generateur.suite(vue.right + 300));
      c.monde.oublierAvant(vue.left - 200);
      c.monde.avancer(duree);
      c.regard.avancer(duree);
      c.heros.avancer(c.commandes.lire(), c.monde.terrain(c.heros), duree);
      if (c.heros.aSaute) {
        this.sound.play("platformer-saut", { volume: 0.6, rate: c.heros.doubleSaut ? 1.35 : 1 });
      }
      if (c.heros.body.top > c.monde.dy + HAUTEUR_MONDE) {
        this.repartir(c);
      }
    }
  }

  rejouer() {
    this.scene.stop("platformer-fin");
    this.scene.restart();
  }

  quitter() {
    if (this.quitte) {
      return;
    }
    this.quitte = true;
    this.coureurs[1].camera.fade(200, 0, 0, 0, true);   // fonduPuis n'assombrit que la caméra principale
    fonduPuis(this, () => {
      this.scene.stop("platformer-tableau");
      this.scene.stop("platformer-fin");
      this.scene.start("platformer-menu");
    });
  }
}
