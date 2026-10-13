// Le menu : le véhicule de chaque joueur (◀ ▶ pour en changer), les modes de jeu, le niveau, le son.

import Phaser from "phaser";
import { avecChoixDuTheme } from "./Chargement";
import { nouveauGrandPrix, donneesDeLEtape } from "./GrandPrix";
import { THEMES } from "../themes";
import {
  themeEnCours, preferences, apparenceDe, garderLesJoueurs, garderLeNiveau,
} from "../sauvegarde";
import { jouer, musicien } from "../son";
import {
  titre, ecrire, bouton, touche, zone, boutonSon, Annonces, textureCadre, portrait, couleurDuNom,
} from "../interface";
import { LARGEUR } from "../../../socle/style";
import { surTouche, surChaqueTouche } from "../../../socle/clavier";
import { estTactile } from "../../../socle/tactile";
import { etiquette } from "../../../socle/touchesPhysiques";
import { retourAuHub, fonduPuis } from "../../../socle/retour";

export type IdMode = "grandprix" | "course" | "duo" | "chrono" | "atelier" | "editeur";

interface Mode {
  id: IdMode;
  nom: string;
  detail: string;
}

function modesDuTheme(): Mode[] {
  const theme = themeEnCours();
  const m = theme.mots;
  return [
    { id: "grandprix", nom: "Grand Prix", detail: theme.grandPrix.length + " courses contre 3 " + m.vehicules + ", de plus en plus corsées" },
    { id: "course", nom: "Contre l'ordinateur", detail: "Une course contre 3 " + m.vehicules + ", sur le circuit de ton choix" },
    { id: "duo", nom: "Course à deux", detail: "L'écran est partagé : chacun sa moitié" },
    { id: "chrono", nom: "Contre la montre", detail: "Bats ton record et ton fantôme" },
    { id: "atelier", nom: m.atelier, detail: m.atelierDetail },
    { id: "editeur", nom: "Dessiner un circuit", detail: "Place les points à la souris" },
  ];
}

interface Carte {
  vehicule: Phaser.GameObjects.Sprite;
  nom: Phaser.GameObjects.Text;
  x: number;
}

interface Ligne {
  fond: Phaser.GameObjects.Image;
  texte: Phaser.GameObjects.Text;
}

export class Menu extends Phaser.Scene {
  private choisi = 0;                      // gardé d'une visite à l'autre
  private themeVu = "";
  private auDoigt = false;
  modes: Mode[] = [];                      // public : les tests le lisent
  cartes: Carte[] = [];
  private lignes: Ligne[] = [];
  private detail!: Phaser.GameObjects.Text;
  private niveau!: Phaser.GameObjects.Container;
  private parti = false;

  constructor() {
    super("course-menu");
  }

  create(donnees?: { annonce?: string }) {
    const theme = themeEnCours();
    const c = theme.habillage.couleurs;
    this.auDoigt = estTactile();
    // Au doigt, on joue seul : pas de course à deux
    this.modes = modesDuTheme().filter((m) => !(this.auDoigt && m.id === "duo"));
    // Le mode choisi est gardé d'une visite à l'autre, mais un autre thème repart du premier
    this.choisi = this.themeVu === theme.id ? Math.min(this.choisi, this.modes.length - 1) : 0;
    this.themeVu = theme.id;
    this.cartes = [];
    this.lignes = [];
    this.parti = false;
    musicien.jouer("menu");

    this.cameras.main.fadeIn(250);
    theme.habillage.fond(this);
    titre(this, 46, theme.titre, 50);
    ecrire(this, 14, 14, "← Arcade", 16, c.texteDoux, { origine: [0, 0] })
      .setInteractive({ useHandCursor: true }).on("pointerup", () => retourAuHub(this));
    if (avecChoixDuTheme) {
      this.creerChoixDuTheme();
    }

    if (this.auDoigt) {
      this.creerCarte(0, 250, theme.mots.ta, "");
    } else {
      this.creerCarte(0, 150, "Joueur 1", "←  →");
      this.creerCarte(1, 810, "Joueur 2", etiquette("KeyA") + "  " + etiquette("KeyD"));
    }
    this.creerModes();

    const appel = ecrire(this, LARGEUR / 2, 430, this.auDoigt ? "Touche un mode pour jouer !" : "Entrée : c'est parti !", 26,
      c.accent, { contour: true });
    this.tweens.add({ targets: appel, alpha: 0.4, duration: 785, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    ecrire(this, LARGEUR / 2, 462, touche("↑ ↓ : choisir    ·    ") + theme.mots.astuce, 16, c.texteDoux);
    if (!this.auDoigt) {
      ecrire(this, LARGEUR / 2, 484, theme.mots.objets, 14, c.texteClair);
    }
    this.creerBoutonNiveau();
    const annonces = new Annonces(this, [{ x: LARGEUR / 2, taille: 40 }], 200);
    boutonSon(this, annonces);
    if (donnees?.annonce) {
      annonces.annoncer(donnees.annonce, c.accent);
    }

    this.ecouterClavierEtManette();
    this.choisir(this.choisi, false);
  }

  // Une seule carte de course dans l'Arcade : on choisit son thème ici (T)
  private creerChoixDuTheme() {
    const c = themeEnCours().habillage.couleurs;
    const changer = () => {
      if (this.parti) {
        return;
      }
      this.parti = true;
      const i = THEMES.indexOf(themeEnCours());
      const suivant = THEMES[(i + 1) % THEMES.length];
      fonduPuis(this, () => this.scene.start("course-chargement", { theme: suivant.id, choixDuTheme: true }));
    };
    const libelle = THEMES.map((t) => t.emoji).join(" ⇄ ") + touche(" (T)");
    ecrire(this, LARGEUR - 14, 14, libelle, 18, c.texteDoux, { origine: [1, 0] })
      .setInteractive({ useHandCursor: true }).on("pointerup", changer);
    surTouche(this, "T", changer);
  }

  private creerCarte(joueur: number, x: number, libelle: string, touches: string) {
    const c = themeEnCours().habillage.couleurs;
    this.add.image(x, 236, textureCadre(this, 230, 300, 24, c.fondCarte));
    ecrire(this, x, 108, libelle, 19, c.texteDoux);
    const vehicule = portrait(this, x, 232, apparenceDe(preferences.joueurs[joueur]), 1.8);
    // Il sautille : un tween qui monte et redescend, sans fin
    this.tweens.add({ targets: vehicule, y: 226, duration: 262, yoyo: true, repeat: -1, ease: "Sine.Out" });
    const nom = ecrire(this, x, 338, "", 24, c.accent, { contour: true });
    ecrire(this, x, 368, this.auDoigt ? "◀                    ▶" : "◀  " + touches + "  ▶", this.auDoigt ? 22 : 15, c.texteDoux);
    // Toucher la moitié gauche ou droite de la carte change de véhicule
    zone(this, x - 115, 86, 115, 300, () => this.changerVehicule(joueur, -1));
    zone(this, x, 86, 115, 300, () => this.changerVehicule(joueur, 1));
    this.cartes[joueur] = { vehicule, nom, x };
    this.montrerVehicule(joueur);
  }

  private montrerVehicule(joueur: number) {
    const carte = this.cartes[joueur];
    if (!carte) {
      return;
    }
    const apparence = apparenceDe(preferences.joueurs[joueur]);
    const dessin = themeEnCours().vehicule;
    const cle = dessin.texture(this, apparence);
    if (carte.vehicule.texture.key !== cle) {
      carte.vehicule.setTexture(cle, 0);
      if (dessin.anime) {
        carte.vehicule.play(cle + "-anim");
      }
    }
    carte.nom.setText(apparence.nom).setColor(couleurDuNom(apparence));
  }

  private creerModes() {
    const c = themeEnCours().habillage.couleurs;
    const x = this.auDoigt ? 610 : LARGEUR / 2;
    const ecart = this.auDoigt ? 56 : 50;
    const h = this.auDoigt ? 46 : 42;
    this.modes.forEach((mode, i) => {
      const y = 92 + i * ecart + 23;
      const fond = this.add.image(x, y, textureCadre(this, 320, h, h / 2, c.fondLigne))
        .setInteractive({ useHandCursor: true });
      const texte = ecrire(this, x, y + 1, mode.nom, 21, c.ligne);
      fond.on("pointerover", () => this.choisir(i));
      fond.on("pointerup", () => {
        this.choisir(i);
        this.valider();
      });
      this.lignes.push({ fond, texte });
    });
    this.detail = ecrire(this, x, 92 + this.modes.length * ecart + 8, "", 17, c.texte);
  }

  private creerBoutonNiveau() {
    const theme = themeEnCours();
    const libelle = () => (this.auDoigt ? "" : "Niveau : ") + theme.niveaux[preferences.niveau].nom + touche(" (N)");
    const [w, h, y] = this.auDoigt ? [200, 42, 486] : [230, 34, 494];
    const changer = () => {
      preferences.niveau = (preferences.niveau + 1) % theme.niveaux.length;
      garderLeNiveau();
      jouer(this, "menu");
      this.niveau.destroy();
      this.niveau = bouton(this, 16, y, w, h, libelle(), changer, true);
    };
    this.niveau = bouton(this, 16, y, w, h, libelle(), changer, true);
    surTouche(this, "N", changer);
  }

  private ecouterClavierEtManette() {
    surTouche(this, "UP", () => this.choisir(this.choisi - 1));
    surTouche(this, "DOWN", () => this.choisir(this.choisi + 1));
    surTouche(this, "LEFT", () => this.changerVehicule(0, -1));
    surTouche(this, "RIGHT", () => this.changerVehicule(0, 1));
    surTouche(this, "ENTER", () => this.valider());
    surTouche(this, "SPACE", () => this.valider());
    surTouche(this, "ESC", () => retourAuHub(this));
    // Les touches du joueur 2 : là où sont Z Q S D sur un clavier français, W A S D sur un anglais
    surChaqueTouche(this, (e) => {
      if (e.code === "KeyW") {
        this.choisir(this.choisi - 1);
      } else if (e.code === "KeyS") {
        this.choisir(this.choisi + 1);
      } else if (e.code === "KeyA") {
        this.changerVehicule(1, -1);
      } else if (e.code === "KeyD") {
        this.changerVehicule(1, 1);
      }
    });
    this.input.gamepad?.on("down", (_m: Phaser.Input.Gamepad.Gamepad, b: Phaser.Input.Gamepad.Button) => {
      switch (b.index) {
        case 12: this.choisir(this.choisi - 1); break;
        case 13: this.choisir(this.choisi + 1); break;
        case 14: this.changerVehicule(0, -1); break;
        case 15: this.changerVehicule(0, 1); break;
        case 0: this.valider(); break;
        case 1: retourAuHub(this); break;
      }
    });
  }

  private choisir(i: number, avecSon = true) {
    const c = themeEnCours().habillage.couleurs;
    const h = this.auDoigt ? 46 : 42;
    const avant = this.choisi;
    this.choisi = Phaser.Math.Wrap(i, 0, this.modes.length);   // après le dernier, on revient au premier
    if (avecSon && avant !== this.choisi) {
      jouer(this, "menu");
    }
    this.lignes.forEach(({ fond, texte }, j) => {
      const elu = j === this.choisi;
      fond.setTexture(elu ? textureCadre(this, 320, h, h / 2, c.fondChoisi, 4) : textureCadre(this, 320, h, h / 2, c.fondLigne));
      texte.setFontSize(elu ? 24 : 21).setColor(elu ? c.accent : c.ligne);
      if (elu && avant !== this.choisi) {
        this.tweens.add({ targets: [fond, texte], scale: { from: 1.06, to: 1 }, duration: 200, ease: "Back.Out" });
      }
    });
    const mode = this.modes[this.choisi];
    this.detail.setText(this.auDoigt && mode.id === "editeur" ? "Place les points du bout du doigt" : mode.detail);
  }

  private changerVehicule(joueur: number, sens: number) {
    const choix = preferences.joueurs;
    const nombre = themeEnCours().equipe.length;
    if (!this.cartes[joueur]) {
      return;                              // au doigt, pas de carte pour le joueur 2
    }
    const autre = choix[1 - joueur];
    do {
      choix[joueur] = Phaser.Math.Wrap(choix[joueur] + sens, 0, nombre);
    } while (choix[joueur] === autre && !this.auDoigt);
    // Au doigt, on joue seul : tous les véhicules sont permis, et le joueur 2 prend le suivant
    if (choix[0] === choix[1]) {
      choix[1] = (choix[0] + 1) % nombre;
    }
    garderLesJoueurs();
    jouer(this, "menu");
    this.montrerVehicule(0);
    this.montrerVehicule(1);
    const carte = this.cartes[joueur];
    this.tweens.add({ targets: carte.vehicule, angle: { from: -90 + 12 * sens, to: -90 }, duration: 250, ease: "Back.Out" });
  }

  private valider() {
    if (this.parti) {
      return;
    }
    this.parti = true;
    jouer(this, "menu");
    const id = this.modes[this.choisi].id;
    fonduPuis(this, () => {
      if (id === "grandprix") {
        this.scene.start("course-piste", donneesDeLEtape(nouveauGrandPrix()));
      } else if (id === "course" || id === "duo" || id === "chrono") {
        this.scene.start("course-circuits", { mode: id });
      } else {
        this.scene.start("course-" + id);
      }
    });
  }
}
