// Les morceaux d'interface de l'éditeur : un bouton, une fenêtre, taper un nom, poser une question.
// Chacun est un Container : un fond et un texte qui bougent ensemble, et qu'on détruit d'un coup.

import Phaser from "phaser";
import { POLICE } from "../../../socle/style";
import { estTactile } from "../../../socle/tactile";

export const PANNEAU = 0x201f2a;
export const BORD = 0x3e3c4e;
export const TEXTE = "#e6e6f0";
export const GRIS = "#9694a5";
export const ALERTE = "#ef6464";
export const CHOISI = 0xff7a1a;

// L'aide du bouton sous la souris : la barre du bas l'affiche
export const SURVOL = "survol";

export class Bouton extends Phaser.GameObjects.Container {
  readonly fond: Phaser.GameObjects.Rectangle;
  private etiquette: Phaser.GameObjects.Text;
  private actif = true;
  private choisi = false;

  // x, y : le coin haut gauche. « dessin » : une image dans le bouton (la palette), au lieu d'un texte.
  constructor(scene: Phaser.Scene, x: number, y: number, largeur: number, hauteur: number, texte: string,
    private action: () => void, private aide = "", dessin?: Phaser.GameObjects.GameObject) {
    super(scene, x, y);
    this.fond = scene.add.rectangle(0, 0, largeur, hauteur, 0x2e2c3c).setOrigin(0).setStrokeStyle(1, BORD);
    this.etiquette = scene.add.text(largeur / 2, hauteur / 2, texte, {
      fontFamily: POLICE, fontSize: hauteur < 30 ? "13px" : "15px", color: TEXTE,
    }).setOrigin(0.5);
    this.add([this.fond, this.etiquette]);
    if (dessin) {
      this.add(dessin);
    }
    scene.add.existing(this);
    this.fond.setInteractive({ useHandCursor: true });
    this.fond.on("pointerover", () => {
      this.fond.setFillStyle(this.choisi ? CHOISI : 0x3c3a4e);
      scene.events.emit(SURVOL, this.aide);
    });
    this.fond.on("pointerout", () => {
      this.montrer();
      scene.events.emit(SURVOL, "");
    });
    this.fond.on("pointerup", () => {
      if (this.actif) {
        this.action();
      }
    });
  }

  setTexte(texte: string): this {
    this.etiquette.setText(texte);
    return this;
  }

  setActif(actif: boolean): this {
    this.actif = actif;
    this.montrer();
    return this;
  }

  setChoisi(choisi: boolean): this {
    this.choisi = choisi;
    this.montrer();
    return this;
  }

  private montrer() {
    this.fond.setFillStyle(this.choisi ? CHOISI : 0x2e2c3c);
    this.fond.setStrokeStyle(this.choisi ? 2 : 1, this.choisi ? 0xffffff : BORD);
    this.setAlpha(this.actif ? 1 : 0.4);
  }
}

// Une fenêtre par-dessus l'éditeur : un voile sombre qui arrête les clics, un cadre, un titre.
// Échap la ferme. Les fenêtres reçoivent le clavier tant qu'elles sont ouvertes (touche()).
export class Fenetre extends Phaser.GameObjects.Container {
  ouverte = true;
  protected cadre: { x: number; y: number; largeur: number; hauteur: number };

  constructor(scene: Phaser.Scene, titre: string, largeur: number, hauteur: number) {
    super(scene, 0, 0);
    const { width, height } = scene.scale;
    this.cadre = { x: (width - largeur) / 2, y: (height - hauteur) / 2, largeur, hauteur };
    const voile = scene.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0).setInteractive();
    const fond = scene.add.rectangle(this.cadre.x, this.cadre.y, largeur, hauteur, PANNEAU).setOrigin(0)
      .setStrokeStyle(2, BORD);
    const texte = scene.add.text(width / 2, this.cadre.y + 22, titre, {
      fontFamily: POLICE, fontSize: "19px", fontStyle: "bold", color: TEXTE,
    }).setOrigin(0.5);
    this.add([voile, fond, texte]);
    scene.add.existing(this);
    this.setDepth(100);
  }

  // Un bouton placé par rapport au coin de la fenêtre
  bouton(x: number, y: number, largeur: number, hauteur: number, texte: string, action: () => void): Bouton {
    const bouton = new Bouton(this.scene, this.cadre.x + x, this.cadre.y + y, largeur, hauteur, texte, action);
    this.add(bouton);
    return bouton;
  }

  ecrire(x: number, y: number, texte: string, couleur = TEXTE, taille = 15): Phaser.GameObjects.Text {
    const objet = this.scene.add.text(this.cadre.x + x, this.cadre.y + y, texte, {
      fontFamily: POLICE, fontSize: taille + "px", color: couleur, wordWrap: { width: this.cadre.largeur - 2 * x },
    });
    this.add(objet);
    return objet;
  }

  // Une touche du clavier : Échap ferme
  touche(evenement: KeyboardEvent) {
    if (evenement.key === "Escape") {
      this.fermer();
    }
  }

  fermer() {
    this.ouverte = false;
    this.scene.events.emit(SURVOL, "");
    this.destroy();
  }
}

// Taper un nom. Au doigt, il n'y a pas de clavier à l'écran dans un canvas : on demande au navigateur
// (window.prompt), qui sait faire apparaître celui du téléphone.
export class Saisie extends Fenetre {
  private texte: string;
  private champ: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, titre: string, texte: string, private valider: (texte: string) => void) {
    super(scene, titre, 420, 160);
    this.texte = texte;
    const fond = scene.add.rectangle(this.cadre.x + 20, this.cadre.y + 50, 380, 36, 0x16151d).setOrigin(0).setStrokeStyle(1, BORD);
    this.champ = scene.add.text(this.cadre.x + 30, this.cadre.y + 68, "", { fontFamily: POLICE, fontSize: "18px", color: "#ffffff" })
      .setOrigin(0, 0.5);
    this.add([fond, this.champ]);
    this.bouton(200, 106, 96, 34, "Annuler", () => this.fermer());
    this.bouton(304, 106, 96, 34, "OK", () => this.ok());
    this.montrer();
    // Un curseur qui clignote : un tween sur rien d'autre qu'un nombre
    this.clignote = scene.tweens.addCounter({
      from: 0, to: 1, duration: 500, yoyo: true, repeat: -1, onUpdate: (t) => this.montrer(t.getValue()! > 0.5),
    });
  }

  private clignote: Phaser.Tweens.Tween;

  // Une saisie au doigt : la fenêtre du navigateur, tout de suite
  static auDoigt(titre: string, texte: string, valider: (texte: string) => void): boolean {
    if (!estTactile()) {
      return false;
    }
    const reponse = window.prompt(titre, texte);
    if (reponse !== null) {
      valider(reponse.trim());
    }
    return true;
  }

  private montrer(curseur = true) {
    if (this.ouverte && this.champ.active) {
      this.champ.setText(this.texte + (curseur ? "|" : ""));
    }
  }

  private ok() {
    this.fermer();
    this.valider(this.texte.trim());
  }

  touche(evenement: KeyboardEvent) {
    if (evenement.key === "Enter") {
      this.ok();
    } else if (evenement.key === "Backspace") {
      this.texte = this.texte.slice(0, -1);
    } else if (evenement.key.length === 1 && !evenement.ctrlKey && this.texte.length < 30) {
      this.texte += evenement.key;         // une lettre, un chiffre, une espace...
    } else {
      super.touche(evenement);
    }
    this.montrer();
  }

  fermer() {
    this.clignote.remove();
    super.fermer();
  }
}

// Une question : Oui fait l'action, Non ferme
export class Question extends Fenetre {
  constructor(scene: Phaser.Scene, titre: string, phrase: string, oui: () => void, motOui = "Oui") {
    super(scene, titre, 440, 170);
    this.ecrire(20, 50, phrase);
    this.bouton(220, 118, 96, 34, "Non", () => this.fermer());
    this.bouton(324, 118, 96, 34, motOui, () => {
      this.fermer();
      oui();
    });
  }
}
