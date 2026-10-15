// L'atelier : personnaliser un véhicule de l'équipe. Son nom, puis les rubriques que le thème déclare
// (la robe et la corne d'une licorne, la carrosserie et la décalco d'une voiture...).
// Chaque changement est gardé tout de suite (course/<theme>/perso/<numero>).

import Phaser from "phaser";
import type { Rubrique } from "../theme";
import {
  themeEnCours, preferences, apparenceDe, nomGarde, changerApparence, remettreApparence,
} from "../sauvegarde";
import { jouer } from "../son";
import { titre, ecrire, bouton, touche, zone, enNombre, textureCadre, couleurDuNom, assombrir, menuElargi } from "../interface";
import { surChaqueTouche } from "../../../socle/clavier";
import { surManette, MANETTE } from "../../../socle/manette";
import { estTactile } from "../../../socle/tactile";
import { fonduPuis } from "../../../socle/retour";

// Les lignes : le véhicule, son nom, les rubriques du thème, et « remettre comme à l'origine »
type Ligne = { genre: "vehicule" } | { genre: "nom" } | { genre: "rubrique"; rubrique: Rubrique } | { genre: "remettre" };

const LIGNE = { x: 445, y: 70, w: 485, h: 50, ecart: 58 };
const VALEUR_X = 760;
const NOM_MAX = 14;

interface Rangee {
  ligne: Ligne;
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
  private choisie = 1;
  private rangees: Rangee[] = [];
  private vehicule!: Phaser.GameObjects.Sprite;
  private nom!: Phaser.GameObjects.Text;
  private feuille = 0;                     // l'atelier alterne entre deux feuilles (voir montrerLeVehicule)
  private curseurVisible = true;
  private parti = false;

  constructor() {
    super("course-atelier");
  }

  create() {
    const theme = themeEnCours();
    const c = theme.habillage.couleurs;
    this.numero = preferences.joueurs[0];
    this.choisie = 1;
    this.rangees = [];
    this.parti = false;

    menuElargi(this);                      // au doigt, toute la largeur du téléphone
    this.cameras.main.fadeIn(250);
    theme.habillage.fond(this);
    titre(this, 38, theme.mots.atelier, 40);

    this.add.image(225, 297, textureCadre(this, 390, 455, 26, c.fondCarte));
    this.vehicule = this.add.sprite(225, 262, "__DEFAULT").setRotation(-Math.PI / 2).setScale(this.echelle());
    this.tweens.add({ targets: this.vehicule, y: 254, duration: 314, yoyo: true, repeat: -1, ease: "Sine.Out" });
    this.nom = ecrire(this, 225, 488, "", 34, c.accent, { contour: true });

    const lignes: Ligne[] = [
      { genre: "vehicule" }, { genre: "nom" },
      ...theme.rubriques.map((rubrique): Ligne => ({ genre: "rubrique", rubrique })),
      { genre: "remettre" },
    ];
    lignes.forEach((ligne, i) => this.creerLigne(ligne, i));

    if (!estTactile()) {
      ecrire(this, 450, 506, "↑ ↓ : choisir   ·   ← → : changer", 14, c.texteDoux, { origine: [0, 0.5] });
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
    surManette(this, MANETTE.HAUT, () => this.choisir(this.choisie - 1));
    surManette(this, MANETTE.BAS, () => this.choisir(this.choisie + 1));
    surManette(this, MANETTE.GAUCHE, () => this.changer(-1));
    surManette(this, MANETTE.DROITE, () => this.changer(1));
    surManette(this, MANETTE.A, () => this.toucherLaLigne(this.choisie, 0));
    surManette(this, [MANETTE.B, MANETTE.START], () => this.terminer());   // Start : c'est fini, on garde tout

    this.montrerTout();
  }

  private echelle(): number {
    const dessin = themeEnCours().vehicule;
    return 2.9 * dessin.echellePortrait / 3;
  }

  private creerLigne(ligne: Ligne, i: number) {
    const theme = themeEnCours();
    const c = theme.habillage.couleurs;
    const y = LIGNE.y + i * LIGNE.ecart;
    const cy = y + LIGNE.h / 2;
    const fond = this.add.image(LIGNE.x + LIGNE.w / 2, cy, textureCadre(this, LIGNE.w, LIGNE.h, 20, c.fondLigne));
    const rangee: Rangee = { ligne, fond, fleches: [], valeur: this.add.container(VALEUR_X, cy) };
    zone(this, LIGNE.x, y, LIGNE.w, LIGNE.h, () => this.toucherLaLigne(i, 0));
    if (ligne.genre === "remettre") {
      rangee.texte = ecrire(this, 687, cy, "↺  Remettre comme à l'origine" + touche(" (Entrée)"), 18, c.texteDoux);
    } else {
      const vehicule = theme.mots.vehicule;
      const libelle = ligne.genre === "vehicule" ? vehicule[0].toUpperCase() + vehicule.slice(1)
        : ligne.genre === "nom" ? "Son nom" : ligne.rubrique.libelle;
      rangee.texte = ecrire(this, LIGNE.x + 16, cy, libelle, 19, c.texte, { origine: [0, 0.5] });
    }
    if (ligne.genre === "vehicule" || ligne.genre === "rubrique") {
      rangee.fleches.push(ecrire(this, 615, cy, "◀", 18, c.texteClair, { gras: false }));
      rangee.fleches.push(ecrire(this, 905, cy, "▶", 18, c.texteClair, { gras: false }));
      zone(this, 575, y, 85, LIGNE.h, () => this.toucherLaLigne(i, -1));
      zone(this, 860, y, 70, LIGNE.h, () => this.toucherLaLigne(i, 1));
    }
    this.rangees.push(rangee);
  }

  private montrerTout() {
    const c = themeEnCours().habillage.couleurs;
    this.montrerLeVehicule();
    this.rangees.forEach((rangee, i) => {
      this.montrerLaValeur(i);
      const choisie = i === this.choisie;
      rangee.fond.setTexture(choisie
        ? textureCadre(this, LIGNE.w, LIGNE.h, 20, c.fondChoisi, 3)
        : textureCadre(this, LIGNE.w, LIGNE.h, 20, c.fondLigne));
      for (const f of rangee.fleches) {
        f.setColor(choisie ? c.accent2 : c.texteClair);
      }
      if (rangee.ligne.genre === "remettre") {
        rangee.texte?.setColor(choisie ? c.accent : c.texteDoux);
      }
    });
  }

  // Le grand véhicule. Sa feuille est redessinée à chaque changement ; pour ne jamais retirer une texture
  // encore affichée, on dessine dans l'autre des deux feuilles, puis on change de feuille.
  private montrerLeVehicule() {
    const dessin = themeEnCours().vehicule;
    const apparence = apparenceDe(this.numero);
    this.feuille = 1 - this.feuille;
    const cle = dessin.texture(this, apparence, 3, "course-atelier-" + this.feuille);
    this.vehicule.setTexture(cle, 0);
    if (dessin.anime) {
      this.vehicule.play(cle + "-anim");
    }
    this.nom.setText(apparence.nom).setColor(couleurDuNom(apparence));
  }

  private montrerLaValeur(i: number) {
    const theme = themeEnCours();
    const c = theme.habillage.couleurs;
    const { ligne, valeur: boite } = this.rangees[i];
    boite.removeAll(true);
    const apparence = apparenceDe(this.numero);
    const choisie = i === this.choisie;
    if (ligne.genre === "vehicule") {
      boite.add(ecrire(this, 0, 0, "n° " + (this.numero + 1) + " : " + apparence.nom, 18, c.texte));
    } else if (ligne.genre === "nom") {
      const curseur = choisie && this.curseurVisible && !estTactile() ? "|" : "";
      boite.add(ecrire(this, 0, 0, nomGarde(this.numero) + curseur, 22, c.accent));
      if (choisie || estTactile()) {
        boite.add(ecrire(this, 145, 14, estTactile() ? "touche pour changer" : "tape au clavier", 11, c.texteClair, { origine: [1, 0.5] }));
      }
    } else if (ligne.genre === "rubrique") {
      const { rubrique } = ligne;
      const v = apparence[rubrique.cle];
      if (rubrique.montrer === "couleur" && typeof v === "string") {
        boite.add(this.add.circle(0, 0, 16, enNombre(v)).setStrokeStyle(3, enNombre(assombrir(v, 0.14))));
      } else if (rubrique.montrer === "couleurs" && Array.isArray(v)) {
        v.forEach((couleur, k) => boite.add(this.add.circle((k - (v.length - 1) / 2) * 22, 0, 10, enNombre(couleur))
          .setStrokeStyle(1.5, enNombre(c.texteClair))));
      } else if (typeof rubrique.montrer === "function") {
        boite.add(ecrire(this, 0, 0, rubrique.montrer(String(v)), 18, c.texte));
      }
    }
  }

  private choisir(i: number) {
    this.choisie = Phaser.Math.Wrap(i, 0, this.rangees.length);
    jouer(this, "menu");
    this.montrerTout();
  }

  // Au doigt : toucher une ligne la choisit ; ses flèches changent la valeur ; le nom se tape dans une fenêtre
  private toucherLaLigne(i: number, sens: number) {
    this.choisie = i;
    const ligne = this.rangees[i].ligne;
    if (sens !== 0) {
      this.changer(sens);
    } else if (ligne.genre === "nom") {
      this.montrerTout();
      this.demanderLeNom();
    } else if (ligne.genre === "remettre") {
      this.remettre();
    } else {
      this.changer(1);
    }
  }

  private demanderLeNom() {
    const nom = window.prompt("Son nom :", apparenceDe(this.numero).nom);
    if (nom !== null && nom.trim() !== "") {
      changerApparence(this.numero, "nom", nom.trim().slice(0, NOM_MAX));
      this.montrerTout();
    }
  }

  private remettre() {
    remettreApparence(this.numero);
    jouer(this, "atelier");
    this.montrerTout();
  }

  private changer(sens: number) {
    const ligne = this.rangees[this.choisie].ligne;
    if (ligne.genre === "nom" || ligne.genre === "remettre") {
      this.montrerTout();
      return;
    }
    jouer(this, "menu");
    if (ligne.genre === "vehicule") {
      this.numero = Phaser.Math.Wrap(this.numero + sens, 0, themeEnCours().equipe.length);
    } else {
      const { rubrique } = ligne;
      changerApparence(this.numero, rubrique.cle, suivant(rubrique.choix, apparenceDe(this.numero)[rubrique.cle], sens));
    }
    this.montrerTout();
    // Le véhicule fait un petit bond de joie
    this.tweens.add({ targets: this.vehicule, scale: { from: this.echelle() * 1.08, to: this.echelle() }, duration: 250, ease: "Back.Out" });
  }

  private touche(e: KeyboardEvent) {
    const ligne = this.rangees[this.choisie].ligne;
    if (e.code === "Escape" || ((e.code === "Enter" || e.code === "NumpadEnter") && ligne.genre !== "remettre")) {
      this.terminer();
    } else if (e.code === "ArrowUp") {
      this.choisir(this.choisie - 1);
    } else if (e.code === "ArrowDown") {
      this.choisir(this.choisie + 1);
    } else if (ligne.genre === "nom") {
      const nom = nomGarde(this.numero);
      if (e.code === "Backspace") {
        e.preventDefault();
        changerApparence(this.numero, "nom", nom.slice(0, -1));
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && nom.length < NOM_MAX) {
        changerApparence(this.numero, "nom", nom + e.key);
      }
      this.curseurVisible = true;
      this.montrerTout();
    } else if (ligne.genre === "remettre") {
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
      jouer(this, "menu");
      fonduPuis(this, () => this.scene.start("course-menu"));
    }
  }
}
