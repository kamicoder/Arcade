// L'atelier des licornes : son nom, sa robe, sa crinière, sa corne, un accessoire.
// Chaque changement est gardé tout de suite (licornes-perso, comme l'ancien jeu).

import Phaser from "phaser";
import { LICORNES, COULEURS_CORPS, CRINIERES, CORNES, ACCESSOIRES, NOMS_ACCESSOIRES } from "../donnees";
import { COULEURS } from "../reglages";
import { preferences, lookDe, changerLook, remettreLook } from "../sauvegarde";
import { sons } from "../sons";
import { textureCadre, textureDeLicorne } from "../textures";
import { fondDeMenu, titre, ecrire, bouton, touche, zone, enNombre } from "../interface";
import { surChaqueTouche } from "../clavier";
import { estTactile } from "../../../socle/tactile";
import { fonduPuis } from "../../../socle/retour";

type Rubrique = "licorne" | "nom" | "corps" | "criniere" | "corne" | "accessoire" | "remettre";

const RUBRIQUES: Rubrique[] = ["licorne", "nom", "corps", "criniere", "corne", "accessoire", "remettre"];
const LIBELLES: Record<Rubrique, string> = {
  licorne: "Licorne", nom: "Son nom", corps: "Sa robe", criniere: "Sa crinière",
  corne: "Sa corne", accessoire: "Accessoire", remettre: "",
};
const LIGNE = { x: 445, y: 70, w: 485, h: 50, ecart: 58 };
const VALEUR_X = 760;

interface Ligne {
  fond: Phaser.GameObjects.Image;
  fleches: Phaser.GameObjects.Text[];
  valeur: Phaser.GameObjects.Container;
  texte?: Phaser.GameObjects.Text;         // le libellé, ou « Remettre comme à l'origine »
}

// La valeur suivante (ou précédente) d'une liste, en revenant au début après la fin
function suivant<T>(liste: T[], valeur: T, sens: number): T {
  const i = liste.findIndex((v) => JSON.stringify(v) === JSON.stringify(valeur));
  return liste[Phaser.Math.Wrap((i < 0 ? 0 : i) + sens, 0, liste.length)];
}

export class Atelier extends Phaser.Scene {
  private numero = 0;
  private rubrique = 1;
  private lignes: Ligne[] = [];
  private licorne!: Phaser.GameObjects.Sprite;
  private nom!: Phaser.GameObjects.Text;
  private feuille = 0;                     // l'atelier alterne entre deux feuilles de galop (voir montrerLaLicorne)
  private curseurVisible = true;
  private parti = false;

  constructor() {
    super("licorne-atelier");
  }

  create() {
    this.numero = preferences.choix[0];
    this.rubrique = 1;
    this.lignes = [];
    this.parti = false;

    this.cameras.main.fadeIn(250);
    fondDeMenu(this);
    titre(this, 38, "Atelier des licornes", 40);

    this.add.image(225, 297, textureCadre(this, 390, 455, 26, "rgba(255,255,255,0.6)"));
    this.licorne = this.add.sprite(225, 262, "__DEFAULT").setRotation(-Math.PI / 2).setScale(2.9 / 3);
    this.tweens.add({ targets: this.licorne, y: 254, duration: 314, yoyo: true, repeat: -1, ease: "Sine.Out" });
    this.nom = ecrire(this, 225, 488, "", 34, COULEURS.rose, { contour: true });

    RUBRIQUES.forEach((rubrique, i) => this.creerLigne(rubrique, i));

    if (!estTactile()) {
      ecrire(this, 450, 506, "↑ ↓ : choisir   ·   ← → : changer", 14, COULEURS.texteDoux, { origine: [0, 0.5] });
    }
    bouton(this, 750, 486, 180, 40, "Terminé" + touche(" (Échap)"), () => this.terminer());

    // Le curseur du nom clignote : une minuterie qui se répète
    this.time.addEvent({
      delay: 500, loop: true, callback: () => {
        this.curseurVisible = !this.curseurVisible;
        this.montrerLaValeur(1);
      },
    });

    // Une seule écoute pour tout le clavier : sur la ligne du nom, les lettres s'écrivent
    surChaqueTouche(this, (e) => this.touche(e));
    this.input.gamepad?.on("down", (_m: Phaser.Input.Gamepad.Gamepad, b: Phaser.Input.Gamepad.Button) => {
      switch (b.index) {
        case 12: this.choisirRubrique(this.rubrique - 1); break;
        case 13: this.choisirRubrique(this.rubrique + 1); break;
        case 14: this.changer(-1); break;
        case 15: this.changer(1); break;
        case 0: this.toucherLaLigne(this.rubrique, 0); break;
        case 1: this.terminer(); break;
      }
    });

    this.montrerTout();
  }

  private creerLigne(rubrique: Rubrique, i: number) {
    const y = LIGNE.y + i * LIGNE.ecart;
    const cy = y + LIGNE.h / 2;
    const fond = this.add.image(LIGNE.x + LIGNE.w / 2, cy, textureCadre(this, LIGNE.w, LIGNE.h, 20, "rgba(255,255,255,0.45)"));
    const ligne: Ligne = { fond, fleches: [], valeur: this.add.container(VALEUR_X, cy) };
    zone(this, LIGNE.x, y, LIGNE.w, LIGNE.h, () => this.toucherLaLigne(i, 0));
    if (rubrique === "remettre") {
      ligne.texte = ecrire(this, 687, cy, "↺  Remettre comme à l'origine" + touche(" (Entrée)"), 18, COULEURS.texteDoux);
    } else {
      ligne.texte = ecrire(this, LIGNE.x + 16, cy, LIBELLES[rubrique], 19, COULEURS.texte, { origine: [0, 0.5] });
    }
    if (rubrique !== "nom" && rubrique !== "remettre") {
      ligne.fleches.push(ecrire(this, 615, cy, "◀", 18, "#cdb8e6", { gras: false }));
      ligne.fleches.push(ecrire(this, 905, cy, "▶", 18, "#cdb8e6", { gras: false }));
      zone(this, 575, y, 85, LIGNE.h, () => this.toucherLaLigne(i, -1));
      zone(this, 860, y, 70, LIGNE.h, () => this.toucherLaLigne(i, 1));
    }
    this.lignes.push(ligne);
  }

  private montrerTout() {
    this.montrerLaLicorne();
    RUBRIQUES.forEach((_r, i) => this.montrerLaValeur(i));
    this.lignes.forEach((ligne, i) => {
      const choisie = i === this.rubrique;
      ligne.fond.setTexture(choisie
        ? textureCadre(this, LIGNE.w, LIGNE.h, 20, "#ffffff", 3)
        : textureCadre(this, LIGNE.w, LIGNE.h, 20, "rgba(255,255,255,0.45)"));
      for (const f of ligne.fleches) {
        f.setColor(choisie ? COULEURS.violet : "#cdb8e6");
      }
      if (RUBRIQUES[i] === "remettre") {
        ligne.texte?.setColor(choisie ? COULEURS.rose : COULEURS.texteDoux);
      }
    });
  }

  // La grande licorne. Sa feuille de galop est redessinée à chaque changement ; pour ne jamais retirer
  // une texture encore affichée, on dessine dans l'autre des deux feuilles, puis on change de feuille.
  private montrerLaLicorne() {
    const look = lookDe(this.numero);
    this.feuille = 1 - this.feuille;
    const cle = textureDeLicorne(this, look, 3, "licorne-atelier-" + this.feuille);
    this.licorne.setTexture(cle).play(cle + "-galop");
    this.nom.setText(look.nom).setColor(look.criniere[0] === "#ffffff" ? look.ombre : look.criniere[0]);
  }

  private montrerLaValeur(i: number) {
    const rubrique = RUBRIQUES[i];
    const boite = this.lignes[i].valeur;
    boite.removeAll(true);
    const look = lookDe(this.numero);
    const choisie = i === this.rubrique;
    if (rubrique === "licorne") {
      boite.add(ecrire(this, 0, 0, "n° " + (this.numero + 1) + " : " + look.nom, 18, COULEURS.texte));
    } else if (rubrique === "nom") {
      const curseur = choisie && this.curseurVisible && !estTactile() ? "|" : "";
      boite.add(ecrire(this, 0, 0, look.nom + curseur, 22, COULEURS.rose));
      if (choisie || estTactile()) {
        boite.add(ecrire(this, 145, 14, estTactile() ? "touche pour changer" : "tape au clavier", 11, COULEURS.texteClair, { origine: [1, 0.5] }));
      }
    } else if (rubrique === "corps") {
      boite.add(this.add.circle(0, 0, 16, enNombre(look.corps)).setStrokeStyle(3, enNombre(look.ombre)));
    } else if (rubrique === "criniere") {
      const n = look.criniere.length;
      look.criniere.forEach((c, k) => boite.add(this.add.circle((k - (n - 1) / 2) * 22, 0, 10, enNombre(c)).setStrokeStyle(1.5, 0xd8c8ec)));
    } else if (rubrique === "corne") {
      boite.add(ecrire(this, 0, 0, (CORNES.find((c) => c.couleur === look.corne) ?? CORNES[0]).nom, 19, COULEURS.texte));
    } else if (rubrique === "accessoire") {
      boite.add(ecrire(this, 0, 0, NOMS_ACCESSOIRES[look.accessoire] ?? NOMS_ACCESSOIRES.aucun, 17, COULEURS.texte));
    }
  }

  private choisirRubrique(i: number) {
    this.rubrique = Phaser.Math.Wrap(i, 0, RUBRIQUES.length);
    sons.menu();
    this.montrerTout();
  }

  // Au doigt : toucher une ligne la choisit ; ses flèches changent la valeur ; le nom se tape dans une fenêtre
  private toucherLaLigne(i: number, sens: number) {
    this.rubrique = i;
    const rubrique = RUBRIQUES[i];
    if (sens !== 0) {
      this.changer(sens);
    } else if (rubrique === "nom") {
      this.montrerTout();
      this.demanderLeNom();
    } else if (rubrique === "remettre") {
      this.remettre();
    } else {
      this.changer(1);
    }
  }

  private demanderLeNom() {
    const nom = window.prompt("Le nom de ta licorne :", lookDe(this.numero).nom);
    if (nom !== null && nom.trim() !== "") {
      changerLook(this.numero, (l) => {
        l.nom = nom.trim().slice(0, 14);
      });
      this.montrerTout();
    }
  }

  private remettre() {
    remettreLook(this.numero);
    sons.etoile();
    this.montrerTout();
  }

  private changer(sens: number) {
    const rubrique = RUBRIQUES[this.rubrique];
    if (rubrique === "nom" || rubrique === "remettre") {
      this.montrerTout();
      return;
    }
    sons.menu();
    if (rubrique === "licorne") {
      this.numero = Phaser.Math.Wrap(this.numero + sens, 0, LICORNES.length);
    } else {
      changerLook(this.numero, (l) => {
        if (rubrique === "corps") {
          l.corps = suivant(COULEURS_CORPS, l.corps, sens);
        } else if (rubrique === "criniere") {
          l.criniere = suivant(CRINIERES, l.criniere, sens);
        } else if (rubrique === "corne") {
          l.corne = suivant(CORNES.map((c) => c.couleur), l.corne, sens);
        } else if (rubrique === "accessoire") {
          l.accessoire = suivant(ACCESSOIRES, l.accessoire, sens);
        }
      });
    }
    this.montrerTout();
    // La licorne fait un petit bond de joie
    this.tweens.add({ targets: this.licorne, scale: { from: 2.9 / 3 * 1.08, to: 2.9 / 3 }, duration: 250, ease: "Back.Out" });
  }

  private touche(e: KeyboardEvent) {
    const rubrique = RUBRIQUES[this.rubrique];
    if (e.code === "Escape" || ((e.code === "Enter" || e.code === "NumpadEnter") && rubrique !== "remettre")) {
      this.terminer();
    } else if (e.code === "ArrowUp") {
      this.choisirRubrique(this.rubrique - 1);
    } else if (e.code === "ArrowDown") {
      this.choisirRubrique(this.rubrique + 1);
    } else if (rubrique === "nom") {
      if (e.code === "Backspace") {
        e.preventDefault();
        changerLook(this.numero, (l) => {
          l.nom = l.nom.slice(0, -1);
        });
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        changerLook(this.numero, (l) => {
          if (l.nom.length < 14) {
            l.nom += e.key;
          }
        });
      }
      this.curseurVisible = true;
      this.montrerTout();
    } else if (rubrique === "remettre") {
      if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space") {
        this.remettre();
      }
    } else if (e.code === "ArrowLeft") {
      this.changer(-1);
    } else if (e.code === "ArrowRight") {
      this.changer(1);
    }
  }

  private terminer() {
    if (!this.parti) {
      this.parti = true;
      sons.menu();
      fonduPuis(this, () => this.scene.start("licorne-menu"));
    }
  }
}
