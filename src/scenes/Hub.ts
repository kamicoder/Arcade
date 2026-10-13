// Le Hub : le menu de l'Arcade, où l'on choisit son jeu.
// Au clavier (flèches + Entrée), à la manette (croix + A), à la souris ou au doigt.

import Phaser from "phaser";
import { CATALOGUE, type FicheDeJeu } from "../jeux/catalogue";
import { LARGEUR, HAUTEUR, COULEURS, POLICE } from "../socle/style";
import { surTouche } from "../socle/clavier";
import { fonduPuis } from "../socle/retour";
import { quandNouvelleVersion, installerNouvelleVersion } from "../socle/miseAJour";

const PAR_RANGEE = 3;
const CARTE_L = 240;
const CARTE_H = 170;
const ECART = 30;

interface Carte {
  fiche: FicheDeJeu;
  boite: Phaser.GameObjects.Container;     // tout ce qui bouge ensemble : le fond, l'emoji, le titre
  fond: Phaser.GameObjects.Rectangle;
}

export class Hub extends Phaser.Scene {
  private cartes: Carte[] = [];
  private choisie = 0;
  private lancement = false;               // un jeu est en train de se charger : on ne bouge plus

  constructor() {
    super("Hub");
  }

  // create() est appelée à chaque démarrage de la scène, donc aussi à chaque retour d'un jeu :
  // on repart d'un état propre
  create() {
    this.cartes = [];
    this.lancement = false;

    this.creerDecor();
    this.creerCartes();
    this.creerBoutonPleinEcran();
    this.ecouterClavierEtManette();
    this.choisir(Math.min(this.choisie, this.cartes.length - 1));

    this.cameras.main.fadeIn(250);

    // Une nouvelle version en ligne : on est au menu, c'est le bon moment pour l'installer.
    // On arrête d'écouter quand la scène s'arrête (SHUTDOWN), sinon on rechargerait en pleine partie.
    const arreter = quandNouvelleVersion(installerNouvelleVersion);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, arreter);
  }

  private creerDecor() {
    // Des étincelles qui montent doucement : un émetteur de particules
    this.add.particles(0, 0, "etincelle", {
      x: { min: 0, max: LARGEUR },
      y: HAUTEUR + 10,
      lifespan: 9000,
      speedY: { min: -60, max: -20 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: CATALOGUE.map((fiche) => fiche.couleur),
      frequency: 120,
      blendMode: "ADD",
    });

    this.add.text(LARGEUR / 2, 62, "L'Arcade", {
      fontFamily: POLICE, fontSize: "52px", fontStyle: "bold", color: COULEURS.texte,
    }).setOrigin(0.5);           // setOrigin(0.5) : x, y désignent le centre du texte, pas son coin

    this.add.text(LARGEUR / 2, HAUTEUR - 24, "Flèches et Entrée, manette, ou touche un jeu", {
      fontFamily: POLICE, fontSize: "16px", color: COULEURS.texteDoux,
    }).setOrigin(0.5);
  }

  private creerCartes() {
    const rangees = Math.ceil(CATALOGUE.length / PAR_RANGEE);
    const hautTotal = rangees * CARTE_H + (rangees - 1) * ECART;
    const haut = (HAUTEUR - hautTotal) / 2 + 30;

    CATALOGUE.forEach((fiche, i) => {
      const rangee = Math.floor(i / PAR_RANGEE);
      const colonne = i % PAR_RANGEE;
      const dansLaRangee = Math.min(PAR_RANGEE, CATALOGUE.length - rangee * PAR_RANGEE);
      const largeurRangee = dansLaRangee * CARTE_L + (dansLaRangee - 1) * ECART;
      const x = (LARGEUR - largeurRangee) / 2 + colonne * (CARTE_L + ECART) + CARTE_L / 2;
      const y = haut + rangee * (CARTE_H + ECART) + CARTE_H / 2;

      // Les positions des enfants d'un Container sont relatives à lui : (0, 0) est son centre
      const fond = this.add.rectangle(0, 0, CARTE_L, CARTE_H, COULEURS.carte)
        .setRounded(22)
        .setStrokeStyle(3, COULEURS.carteBord);
      const emoji = this.add.text(0, -18, fiche.emoji, { fontSize: "64px" }).setOrigin(0.5);
      const titre = this.add.text(0, 52, fiche.titre, {
        fontFamily: POLICE, fontSize: "20px", fontStyle: "bold", color: COULEURS.texte,
      }).setOrigin(0.5);
      const boite = this.add.container(x, y, [fond, emoji, titre]);

      if (!fiche.charger) {
        emoji.setAlpha(0.45);
        titre.setColor(COULEURS.texteDoux);
        const bientot = this.add.text(CARTE_L / 2 - 14, -CARTE_H / 2 + 12, "bientôt", {
          fontFamily: POLICE, fontSize: "14px", color: COULEURS.texteDoux,
        }).setOrigin(1, 0);
        boite.add(bientot);
      }

      // Le fond reçoit la souris et les doigts
      fond.setInteractive({ useHandCursor: true });
      fond.on("pointerover", () => this.choisir(i));
      fond.on("pointerup", () => {
        this.choisir(i);
        this.lancer();
      });

      this.cartes.push({ fiche, boite, fond });
    });
  }

  private creerBoutonPleinEcran() {
    if (!this.scale.fullscreen.available) {
      return;
    }
    const bouton = this.add.text(LARGEUR - 20, 20, "⛶", {
      fontFamily: POLICE, fontSize: "34px", color: COULEURS.texteDoux,
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    // Le navigateur n'accepte le plein écran qu'en réponse à un geste : pointerup, pas pointerdown
    bouton.on("pointerup", () => this.scale.toggleFullscreen());
  }

  private ecouterClavierEtManette() {
    surTouche(this, "LEFT", () => this.deplacer(-1, 0));
    surTouche(this, "RIGHT", () => this.deplacer(1, 0));
    surTouche(this, "UP", () => this.deplacer(0, -1));
    surTouche(this, "DOWN", () => this.deplacer(0, 1));
    surTouche(this, "ENTER", () => this.lancer());
    surTouche(this, "SPACE", () => this.lancer());

    // Les boutons d'une manette « standard » : 0 = A, 12 à 15 = la croix (haut, bas, gauche, droite)
    this.input.gamepad?.on("down", (_manette: Phaser.Input.Gamepad.Gamepad, bouton: Phaser.Input.Gamepad.Button) => {
      switch (bouton.index) {
        case 12: this.deplacer(0, -1); break;
        case 13: this.deplacer(0, 1); break;
        case 14: this.deplacer(-1, 0); break;
        case 15: this.deplacer(1, 0); break;
        case 0: this.lancer(); break;
      }
    });
  }

  private deplacer(dx: number, dy: number) {
    const i = Phaser.Math.Clamp(this.choisie + dx + dy * PAR_RANGEE, 0, this.cartes.length - 1);
    this.choisir(i);
  }

  private choisir(i: number) {
    if (this.lancement) {
      return;
    }
    this.choisie = i;
    this.cartes.forEach((carte, j) => {
      const elue = j === i;
      carte.fond.setStrokeStyle(elue ? 5 : 3, elue ? carte.fiche.couleur : COULEURS.carteBord);
      // Un tween : Phaser fait glisser la valeur jusqu'à la cible, image après image
      this.tweens.add({
        targets: carte.boite,
        scale: elue ? 1.08 : 1,
        duration: 140,
        ease: "Back.Out",
      });
    });
  }

  private async lancer() {
    if (this.lancement) {
      return;
    }
    const carte = this.cartes[this.choisie];

    if (!carte.fiche.charger) {
      // Pas encore là : la carte dit « non » de la tête
      this.tweens.add({
        targets: carte.boite,
        angle: { from: -4, to: 4 },
        duration: 60,
        yoyo: true,
        repeat: 2,
        onComplete: () => carte.boite.setAngle(0),
      });
      return;
    }

    this.lancement = true;
    const jeu = await carte.fiche.charger();
    // Les scènes du jeu rejoignent le jeu Phaser la première fois qu'on le lance
    for (const [nom, Scene] of Object.entries(jeu.scenes)) {
      if (!this.scene.manager.keys[nom]) {
        this.scene.add(nom, Scene);
      }
    }
    fonduPuis(this, () => this.scene.start(jeu.premiere, jeu.donnees));
  }
}
