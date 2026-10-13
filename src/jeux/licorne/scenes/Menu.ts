// Le menu des licornes : la licorne de chaque joueuse (◀ ▶ pour en changer), les modes de jeu, le niveau.

import Phaser from "phaser";
import { licorneQuiGalope } from "./Arrivee";
import { donneesDeLEtape } from "./GrandPrix";
import type { GrandPrix } from "./Course";
import { LICORNES } from "../donnees";
import { NIVEAUX, COULEURS } from "../reglages";
import { melanger } from "../circuits";
import { preferences, lookDe, garderLesChoix, garderLeNiveau } from "../sauvegarde";
import { sons, musicien } from "../sons";
import { textureCadre, textureDeLicorne } from "../textures";
import { fondDeMenu, titre, ecrire, bouton, touche, zone, boutonSon, Annonces } from "../interface";
import { surChaqueTouche } from "../clavier";
import { LARGEUR } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { estTactile } from "../../../socle/tactile";
import { retourAuHub, fonduPuis } from "../../../socle/retour";

type IdMode = "gp" | "duo" | "chrono" | "atelier" | "editeur";

const MODES: { id: IdMode; nom: string; detail: string }[] = [
  { id: "gp", nom: "Grand Prix", detail: "5 courses contre 3 licornes, de plus en plus corsées" },
  { id: "duo", nom: "Course à deux", detail: "L'écran est partagé : chacune sa moitié" },
  { id: "chrono", nom: "Contre la montre", detail: "Bats ton record et ton fantôme" },
  { id: "atelier", nom: "Atelier des licornes", detail: "Son nom, ses couleurs, ses accessoires" },
  { id: "editeur", nom: "Dessiner un circuit", detail: "Place les points à la souris" },
];

interface Carte {
  licorne: Phaser.GameObjects.Sprite;
  nom: Phaser.GameObjects.Text;
}

interface Ligne {
  fond: Phaser.GameObjects.Image;
  texte: Phaser.GameObjects.Text;
}

export class Menu extends Phaser.Scene {
  private choisi = 0;                      // gardé d'une visite à l'autre
  private auDoigt = false;
  private modes = MODES;
  private cartes: Carte[] = [];
  private lignes: Ligne[] = [];
  private detail!: Phaser.GameObjects.Text;
  private niveau!: Phaser.GameObjects.Container;
  private parti = false;

  constructor() {
    super("licorne-menu");
  }

  create(donnees?: { annonce?: string }) {
    this.auDoigt = estTactile();
    // Au doigt, on joue seule : pas de course à deux
    this.modes = this.auDoigt ? MODES.filter((m) => m.id !== "duo") : MODES;
    this.choisi = Math.min(this.choisi, this.modes.length - 1);
    this.cartes = [];
    this.lignes = [];
    this.parti = false;
    musicien.jouer("menu");

    this.cameras.main.fadeIn(250);
    fondDeMenu(this);
    titre(this, 46, "La Course des Licornes", 50);
    ecrire(this, 14, 14, "← Arcade", 16, COULEURS.texteDoux, { origine: [0, 0] })
      .setInteractive({ useHandCursor: true }).on("pointerup", () => retourAuHub(this));

    if (this.auDoigt) {
      this.creerCarte(0, 250, "Ta licorne", "");
    } else {
      this.creerCarte(0, 150, "Joueur 1", "←  →");
      this.creerCarte(1, 810, "Joueur 2", "Q  D");
    }
    this.creerModes();

    const appel = ecrire(this, LARGEUR / 2, 418, this.auDoigt ? "Touche un mode pour jouer !" : "Entrée : c'est parti !", 28,
      COULEURS.rose, { contour: true });
    this.tweens.add({ targets: appel, alpha: 0.4, duration: 785, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    ecrire(this, LARGEUR / 2, 456, touche("↑ ↓ : choisir    ·    ") + "Ramasse les étoiles ★ pour le turbo arc-en-ciel", 16, COULEURS.texteDoux);
    if (!this.auDoigt) {
      ecrire(this, LARGEUR / 2, 482, "Flèches arc-en-ciel : petit turbo   ·   Bonbon : géante !   ·   Nuage d'orage : la tête qui tourne",
        14, COULEURS.texteClair);
    }
    this.creerBoutonNiveau();
    const annonces = new Annonces(this, [{ x: LARGEUR / 2, taille: 40 }], 200);
    boutonSon(this, annonces);
    if (donnees?.annonce) {
      annonces.annoncer(donnees.annonce, COULEURS.rose);
    }

    this.ecouterClavierEtManette();
    this.choisir(this.choisi, false);
  }

  private creerCarte(joueur: number, x: number, libelle: string, touches: string) {
    this.add.image(x, 236, textureCadre(this, 230, 300, 24, "rgba(255,255,255,0.55)"));
    ecrire(this, x, 108, libelle, 19, COULEURS.texteDoux);
    const look = lookDe(preferences.choix[joueur]);
    const licorne = licorneQuiGalope(this, x, 232, look, 1.8);
    // Elle sautille : un tween qui monte et redescend, sans fin
    this.tweens.add({ targets: licorne, y: 226, duration: 262, yoyo: true, repeat: -1, ease: "Sine.Out" });
    const nom = ecrire(this, x, 338, "", 24, COULEURS.rose, { contour: true });
    ecrire(this, x, 368, this.auDoigt ? "◀                    ▶" : "◀  " + touches + "  ▶", this.auDoigt ? 22 : 15, COULEURS.texteDoux);
    // Toucher la moitié gauche ou droite de la carte change de licorne
    zone(this, x - 115, 86, 115, 300, () => this.changerLicorne(joueur, -1));
    zone(this, x, 86, 115, 300, () => this.changerLicorne(joueur, 1));
    this.cartes[joueur] = { licorne, nom };
    this.montrerLicorne(joueur);
  }

  private montrerLicorne(joueur: number) {
    const carte = this.cartes[joueur];
    if (!carte) {
      return;
    }
    const look = lookDe(preferences.choix[joueur]);
    const cle = textureDeLicorne(this, look);
    if (carte.licorne.texture.key !== cle) {
      carte.licorne.setTexture(cle).play(cle + "-galop");
    }
    // Un nom blanc sur blanc ne se lirait pas : on prend alors l'ombre de la robe
    carte.nom.setText(look.nom).setColor(look.criniere[0] === "#ffffff" ? look.ombre : look.criniere[0]);
  }

  private creerModes() {
    const x = this.auDoigt ? 610 : LARGEUR / 2;
    const ecart = this.auDoigt ? 66 : 54;
    this.modes.forEach((mode, i) => {
      const y = 92 + i * ecart + 23;
      const fond = this.add.image(x, y, textureCadre(this, 320, 46, 23, "rgba(255,255,255,0.45)"))
        .setInteractive({ useHandCursor: true });
      const texte = ecrire(this, x, y + 1, mode.nom, 21, "#7a5a9c");
      fond.on("pointerover", () => this.choisir(i));
      fond.on("pointerup", () => {
        this.choisir(i);
        this.valider();
      });
      this.lignes.push({ fond, texte });
    });
    this.detail = ecrire(this, x, 92 + this.modes.length * ecart + 8, "", 17, COULEURS.texte);
  }

  private creerBoutonNiveau() {
    const libelle = () => (this.auDoigt ? "" : "Niveau : ") + NIVEAUX[preferences.niveau].nom + touche(" (N)");
    const [w, h, y] = this.auDoigt ? [200, 42, 486] : [230, 34, 494];
    const changer = () => {
      preferences.niveau = (preferences.niveau + 1) % NIVEAUX.length;
      garderLeNiveau();
      sons.menu();
      this.niveau.destroy();
      this.niveau = bouton(this, 16, y, w, h, libelle(), changer, true);
    };
    this.niveau = bouton(this, 16, y, w, h, libelle(), changer, true);
    surTouche(this, "N", changer);
  }

  private ecouterClavierEtManette() {
    surTouche(this, "UP", () => this.choisir(this.choisi - 1));
    surTouche(this, "DOWN", () => this.choisir(this.choisi + 1));
    surTouche(this, "LEFT", () => this.changerLicorne(0, -1));
    surTouche(this, "RIGHT", () => this.changerLicorne(0, 1));
    surTouche(this, "ENTER", () => this.valider());
    surTouche(this, "SPACE", () => this.valider());
    surTouche(this, "ESC", () => retourAuHub(this));
    // Les touches de J2 : là où sont Z Q S D sur un clavier français, W A S D sur un anglais
    surChaqueTouche(this, (e) => {
      if (e.code === "KeyW") {
        this.choisir(this.choisi - 1);
      } else if (e.code === "KeyS") {
        this.choisir(this.choisi + 1);
      } else if (e.code === "KeyA") {
        this.changerLicorne(1, -1);
      } else if (e.code === "KeyD") {
        this.changerLicorne(1, 1);
      }
    });
    this.input.gamepad?.on("down", (_m: Phaser.Input.Gamepad.Gamepad, bouton: Phaser.Input.Gamepad.Button) => {
      switch (bouton.index) {
        case 12: this.choisir(this.choisi - 1); break;
        case 13: this.choisir(this.choisi + 1); break;
        case 14: this.changerLicorne(0, -1); break;
        case 15: this.changerLicorne(0, 1); break;
        case 0: this.valider(); break;
        case 1: retourAuHub(this); break;
      }
    });
  }

  private choisir(i: number, avecSon = true) {
    const avant = this.choisi;
    this.choisi = Phaser.Math.Wrap(i, 0, this.modes.length);   // après le dernier, on revient au premier
    if (avecSon && avant !== this.choisi) {
      sons.menu();
    }
    this.lignes.forEach(({ fond, texte }, j) => {
      const elu = j === this.choisi;
      fond.setTexture(elu ? textureCadre(this, 320, 46, 23, "#ffffff", 4) : textureCadre(this, 320, 46, 23, "rgba(255,255,255,0.45)"));
      texte.setFontSize(elu ? 24 : 21).setColor(elu ? COULEURS.rose : "#7a5a9c");
      if (elu && avant !== this.choisi) {
        this.tweens.add({ targets: [fond, texte], scale: { from: 1.06, to: 1 }, duration: 200, ease: "Back.Out" });
      }
    });
    const mode = this.modes[this.choisi];
    this.detail.setText(this.auDoigt && mode.id === "editeur" ? "Place les points du bout du doigt" : mode.detail);
  }

  private changerLicorne(joueur: number, sens: number) {
    const choix = preferences.choix;
    if (!this.cartes[joueur]) {
      return;                              // au doigt, pas de carte pour la joueuse 2
    }
    const autre = choix[1 - joueur];
    do {
      choix[joueur] = Phaser.Math.Wrap(choix[joueur] + sens, 0, LICORNES.length);
    } while (choix[joueur] === autre && !this.auDoigt);
    // Au doigt, on joue seule : toutes les licornes sont permises, et la joueuse 2 prend la suivante
    if (choix[0] === choix[1]) {
      choix[1] = (choix[0] + 1) % LICORNES.length;
    }
    garderLesChoix();
    sons.menu();
    this.montrerLicorne(0);
    this.montrerLicorne(1);
    const carte = this.cartes[joueur];
    this.tweens.add({ targets: carte.licorne, angle: { from: -90 + 12 * sens, to: -90 }, duration: 250, ease: "Back.Out" });
  }

  private valider() {
    if (this.parti) {
      return;
    }
    this.parti = true;
    sons.menu();
    const id = this.modes[this.choisi].id;
    fonduPuis(this, () => {
      if (id === "gp") {
        this.scene.start("licorne-course", donneesDeLEtape(nouveauGrandPrix()));
      } else if (id === "duo" || id === "chrono") {
        this.scene.start("licorne-circuits", { mode: id });
      } else {
        this.scene.start("licorne-" + id);
      }
    });
  }
}

// Des licornes que personne n'a prises, au hasard
export function licornesLibres(prises: number[], nombre: number): number[] {
  const libres = LICORNES.map((_l, i) => i).filter((i) => !prises.includes(i));
  return melanger(libres).slice(0, nombre);
}

function nouveauGrandPrix(): GrandPrix {
  const joueuse = preferences.choix[0];
  const rivales = licornesLibres([joueuse], 3);
  const points: Record<number, number> = { [joueuse]: 0 };
  for (const r of rivales) {
    points[r] = 0;
  }
  return { etape: 0, rivales, points };
}
