// L'éditeur de niveaux de l'Aventure : il assemble les morceaux (editeur/), comme dans l'atelier.
//
// DEUX CAMÉRAS : la principale ne montre que la zone du niveau (son « viewport »), et c'est elle qui
// zoome et défile ; une deuxième, par-dessus et immobile, montre les panneaux et les boutons. Chaque
// objet n'est vu que par l'une des deux (camera.ignore) : les fonctions niveau() et ui() s'en chargent.
// Le pointeur se traduit en position du niveau avec la caméra principale (getWorldPoint) : zoom et
// défilement sont défaits pour nous.
//
// L'état de l'éditeur (le niveau ouvert, Annuler, le zoom...) est rangé dans la scène elle-même. Phaser
// garde le même objet d'une visite à l'autre : après un test, on retrouve l'éditeur tel qu'on l'a laissé.
// Ses règles : on n'enregistre que ce qui a changé ; un niveau abîmé est sauté ; le départ ne s'efface pas.

import Phaser from "phaser";
import {
  UNIQUES, calerLeTrajet, estUnePlateforme, rectDe, nomDe, probleme, type APoser, type Element,
} from "../elements";
import { Genres, LES_FORCES, MAXIMUM, type Fiche } from "../genres";
import * as niveaux from "../niveaux";
import { Historique } from "../editeur/Historique";
import {
  Selection, Gomme, Main, Poser, AIMANT, dessinerLaSelection, dessinerLesTrajets,
  type NomDOutil, type Outil, type Point, type PourLesOutils,
} from "../editeur/outils";
import { Bouton, Fenetre, Saisie, SURVOL, PANNEAU, BORD, TEXTE, GRIS, ALERTE } from "../editeur/interface";
import { FenetreDesNiveaux, FenetreDuGenre, type PourLesFenetres } from "../editeur/fenetres";
import { texturePour, ECHELLE_TUILE } from "../textures";
import { lancerLaMusique } from "../son";
import { basculerLeSon, sonAllume } from "../../../socle/son";
import type { DonneesDeNiveau } from "./Niveau";
import { FOND, HAUTEUR_MONDE, VIES, SAUVEGARDE } from "../reglages";
import { LARGEUR, HAUTEUR, POLICE } from "../../../socle/style";
import { fonduPuis } from "../../../socle/retour";

// L'écran de l'éditeur : la barre du haut, le panneau de gauche, la zone du niveau, le niveau en petit
// (l'aperçu), et la barre du bas
const HAUT = 44;
const GAUCHE = 212;
const BAS = 24;
const BANDE = 30;
const ZONE = new Phaser.Geom.Rectangle(GAUCHE, HAUT, LARGEUR - GAUCHE, HAUTEUR - HAUT - BAS - BANDE);
const APERCU = new Phaser.Geom.Rectangle(GAUCHE, ZONE.bottom, ZONE.width, BANDE);
const ZOOMS = [0.5, 0.75, 0.92, 1, 1.25, 1.5, 2];   // 0.92 : tout le haut du niveau tient dans la zone

// Ce qu'on peut poser, en plus des plateformes de chaque genre
const SORTES: APoser[] = [["mobile"], ["piece"], ["ennemi", "marcheur"], ["ennemi", "volant"], ["ennemi", "sauteur"],
  ["depart"], ["drapeau"], ["boss"]];
const IMAGE_DE: Record<string, string> = {
  piece: "platformer-piece", marcheur: "platformer-ennemi", volant: "platformer-volant", sauteur: "platformer-sauteur",
  depart: "platformer-heros", drapeau: "platformer-drapeau", boss: "platformer-boss",
};

interface EtatDuNiveau {
  elements: Element[];
  largeur: number;
}

export class Editeur extends Phaser.Scene implements PourLesOutils, PourLesFenetres {
  // ===== L'état, gardé d'une visite à l'autre
  nom = "";
  largeur = 1200;
  elements: Element[] = [];
  selection: Element[] = [];
  aPoser: APoser = ["plateforme", "normale"];
  noms: string[] = [];
  genres = new Genres();
  private ouvert = false;                  // un niveau est-il déjà ouvert (une visite d'avant) ?
  private historique = new Historique<EtatDuNiveau>();
  private outils: Record<NomDOutil, Outil> = { selection: new Selection(), gomme: new Gomme(), main: new Main(), poser: new Poser() };
  private outil: NomDOutil = "selection";
  private aimant = true;
  private pressePapiers: Element[] = [];
  private modifie = false;
  private zoomChoisi = 2;                  // le numéro dans ZOOMS
  private vueGardee = { x: -40, y: 0 };

  // ===== Ce qui est refait à chaque visite
  private ui!: Phaser.Cameras.Scene2D.Camera;
  private dessinsDuNiveau: Phaser.GameObjects.GameObject[] = [];
  private dessus!: Phaser.GameObjects.Graphics;
  private grille!: Phaser.GameObjects.Graphics;
  private apercu!: Phaser.GameObjects.Graphics;
  private barreDuBas!: Phaser.GameObjects.Text;
  private alerte!: Phaser.GameObjects.Text;
  private nomAffiche!: Phaser.GameObjects.Text;
  private longueur!: Phaser.GameObjects.Text;
  private boutons: Partial<Record<string, Bouton>> = {};
  private palette: [APoser, Bouton][] = [];
  private proprietes: Phaser.GameObjects.GameObject[] = [];
  private hautDesProprietes = 0;
  private fenetres: Fenetre[] = [];
  private objetsDesPanneaux: Phaser.GameObjects.GameObject[] = [];
  private geste: "outil" | "gomme" | "vue" | "apercu" | null = null;
  private dernierPointeur: Point = { x: 0, y: 0 };
  private message = "";
  private finDuMessage = 0;
  private survol = "";
  private aMettreAJour = true;
  private touchesVue!: Phaser.Types.Input.Keyboard.CursorKeys;
  private ctrl!: Phaser.Input.Keyboard.Key;
  private maj!: Phaser.Input.Keyboard.Key;
  private parti = false;

  constructor() {
    super("platformer-editeur");
  }

  create() {
    this.dessinsDuNiveau = [];
    this.boutons = {};
    this.palette = [];
    this.proprietes = [];
    this.fenetres = [];
    this.geste = null;
    this.parti = false;
    this.genres = new Genres();
    lancerLaMusique(this);

    // La caméra principale ne montre que la zone du niveau ; une deuxième, par-dessus, les panneaux
    const vue = this.cameras.main;
    vue.setViewport(ZONE.x, ZONE.y, ZONE.width, ZONE.height).setBackgroundColor(0x111018);
    this.ui = this.cameras.add(0, 0, LARGEUR, HAUTEUR);

    this.grille = this.niveau(this.add.graphics().setDepth(-1));
    this.dessus = this.niveau(this.add.graphics().setDepth(10));
    this.construireLesPanneaux();

    this.noms = niveaux.liste();
    if (!this.ouvert) {
      this.ouvrirLePremier();
    } else {
      this.cadrerLaCamera();
      this.allerA(this.vueGardee.x, this.vueGardee.y);   // on retrouve la vue telle qu'on l'a laissée
    }
    this.ecouter();
    this.changer();
    vue.fadeIn(250);
    this.ui.fadeIn(250);
  }

  // ===== Les deux caméras : chaque objet n'est vu que par l'une d'elles

  private niveau<T extends Phaser.GameObjects.GameObject>(objet: T): T {
    this.ui.ignore(objet);
    return objet;
  }

  private surLEcran<T extends Phaser.GameObjects.GameObject>(objet: T): T {
    this.cameras.main.ignore(objet);
    return objet;
  }

  get zoom(): number {
    return this.cameras.main.zoom;
  }

  get multiple(): boolean {
    return this.maj.isDown;
  }

  // ================================================================ Les panneaux

  private texte(x: number, y: number, contenu: string, couleur = GRIS, taille = 13): Phaser.GameObjects.Text {
    return this.surLEcran(this.add.text(x, y, contenu, { fontFamily: POLICE, fontSize: taille + "px", color: couleur }));
  }

  private bouton(cle: string, x: number, y: number, l: number, h: number, texte: string, action: () => void, aide = "",
    dessin?: Phaser.GameObjects.GameObject): Bouton {
    const bouton = this.surLEcran(new Bouton(this, x, y, l, h, texte, action, aide, dessin));
    this.boutons[cle] = bouton;
    return bouton;
  }

  private construireLesPanneaux() {
    // Ce qui est construit ici sera détruit d'un coup si la palette change (un genre de plus)
    const avant = new Set(this.children.list);
    // Les fonds : en haut, à gauche, en bas
    this.surLEcran(this.add.rectangle(0, 0, LARGEUR, HAUT, PANNEAU).setOrigin(0));
    this.surLEcran(this.add.rectangle(0, HAUT, GAUCHE, HAUTEUR - HAUT, PANNEAU).setOrigin(0));
    this.surLEcran(this.add.rectangle(0, HAUTEUR - BAS, LARGEUR, BAS, 0x16151d).setOrigin(0));
    this.surLEcran(this.add.rectangle(GAUCHE, HAUT, ZONE.width, ZONE.height + BANDE).setOrigin(0).setStrokeStyle(1, BORD));
    this.barreDuBas = this.texte(10, HAUTEUR - BAS / 2, "", TEXTE).setOrigin(0, 0.5);
    this.alerte = this.texte(ZONE.x + 10, ZONE.y + 8, "", ALERTE, 15).setStroke("#111018", 4);

    // La barre du haut, de gauche à droite. Chaque bouton reçoit son action : une méthode de l'éditeur.
    let x = 8;
    const enHaut = (cle: string, largeur: number, texte: string, action: () => void, aide: string) => {
      this.bouton(cle, x, 7, largeur, 30, texte, action, aide);
      x += largeur + 4;
    };
    enHaut("menu", 56, "Menu", () => this.revenirAuMenu(), "Revenir au menu du jeu");
    enHaut("niveaux", 70, "Niveaux", () => this.ouvrirLesNiveaux(), "Tous les niveaux de l'Aventure : les ouvrir, les ranger, les renommer");
    enHaut("nouveau", 74, "Nouveau", () => this.demanderUnNouveauNiveau(), "Un nouveau niveau (N)");
    enHaut("enregistrer", 94, "Enregistrer", () => this.enregistrer(), "Enregistrer ce niveau (Ctrl+S)");
    x += 6;
    enHaut("annuler", 70, "Annuler", () => this.annuler(), "Annuler le dernier geste (Ctrl+Z)");
    enHaut("retablir", 70, "Rétablir", () => this.retablir(), "Refaire ce qu'on a annulé (Ctrl+Y)");
    x += 6;
    enHaut("avant", 28, "<", () => this.changerDeNiveau(-1), "Le niveau d'avant (Page haut)");
    this.nomAffiche = this.texte(x + 75, 22, "", TEXTE, 15).setOrigin(0.5);
    x += 154;
    enHaut("apres", 28, ">", () => this.changerDeNiveau(1), "Le niveau d'après (Page bas)");
    this.bouton("son", LARGEUR - 236, 7, 56, 30, "", () => {
      basculerLeSon(this, SAUVEGARDE);
      this.changer();
    }, "Couper le son, ou le remettre (M)");
    this.bouton("moins", LARGEUR - 172, 7, 30, 30, "−", () => this.zoomer(-1), "Dézoomer (molette)");
    this.bouton("plus", LARGEUR - 138, 7, 30, 30, "+", () => this.zoomer(1), "Zoomer (molette)");
    this.bouton("tester", LARGEUR - 100, 7, 92, 30, "▶ Tester", () => this.tester(), "Jouer ce niveau tout de suite (Tab)");

    // À gauche : les outils
    let y = HAUT + 8;
    this.bouton("selection", 8, y, 66, 28, "Sélection", () => this.choisirLOutil("selection"),
      "Choisir, glisser, redimensionner (les coins) ; entourer pour en prendre plusieurs (S)");
    this.bouton("gomme", 78, y, 62, 28, "Gomme", () => this.choisirLOutil("gomme"),
      "Gomme : efface ce qu'elle touche (G) ; le clic droit efface aussi, avec tous les outils");
    this.bouton("main", 144, y, 60, 28, "Main", () => this.choisirLOutil("main"),
      "Main : glisser le niveau pour le faire défiler (H) ; à la souris, le bouton du milieu fait pareil");
    y += 32;
    this.bouton("copier", 8, y, 64, 26, "Copier", () => this.copier(), "Copier ce qui est choisi (Ctrl+C)");
    this.bouton("coller", 76, y, 62, 26, "Coller", () => this.coller(), "Coller ce qu'on a copié (Ctrl+V)");
    this.bouton("supprimer", 142, y, 62, 26, "Suppr.", () => this.supprimer(this.selection), "Supprimer ce qui est choisi (Suppr)");

    // Les plateformes : un bouton par genre, six par rangée
    y += 34;
    this.texte(8, y, "Plateformes (clic droit : le genre)");
    y += 16;
    Object.keys(this.genres.fiches).forEach((genre, i) => {
      const fiche = this.genres.fiche(genre);
      const dessin = this.add.tileSprite(3, 3, 26, 26, texturePour(this, genre, fiche)).setOrigin(0).setTileScale(ECHELLE_TUILE);
      const bouton = this.bouton("genre-" + genre, 8 + (i % 6) * 33, y + Math.floor(i / 6) * 33, 32, 32, "",
        () => this.choisirAPoser(["plateforme", genre]), `Plateforme « ${genre} » : glisse pour la tracer (clic droit : modifier le genre)`, dessin);
      bouton.fond.on("pointerdown", (p: Phaser.Input.Pointer) => {
        if (p.rightButtonDown()) {
          this.ouvrirUneFenetre(new FenetreDuGenre(this, this, genre));
        }
      });
      this.palette.push([["plateforme", genre], bouton]);
    });
    y += Math.ceil(Object.keys(this.genres.fiches).length / 6) * 33 + 2;
    this.bouton("+genre", 8, y, 96, 24, "+ Genre", () => this.demanderUnGenre(), "Inventer un genre de plateforme")
      .setActif(Object.keys(this.genres.fiches).length < MAXIMUM);
    this.bouton("modifier", 108, y, 96, 24, "Modifier", () => this.modifierLeGenre(), "Modifier le genre de plateforme choisi");

    // Les autres éléments à poser
    y += 30;
    this.texte(8, y, "Objets");
    y += 16;
    SORTES.forEach((sorte, i) => {
      const cle = sorte[sorte.length - 1]!;
      const dessin = sorte[0] === "mobile"
        ? this.add.tileSprite(3, 10, 26, 12, "platformer-mobile").setOrigin(0).setTileScale(ECHELLE_TUILE)
        : this.add.image(16, 16, IMAGE_DE[cle], 0);
      if (dessin instanceof Phaser.GameObjects.Image) {
        dessin.setScale(Math.min(24 / dessin.width, 24 / dessin.height));
      }
      const bouton = this.bouton("sorte-" + cle, 8 + (i % 6) * 33, y + Math.floor(i / 6) * 33, 32, 32, "",
        () => this.choisirAPoser(sorte), this.nomDeSorte(sorte) + " : touche le niveau pour le poser", dessin);
      this.palette.push([sorte, bouton]);
    });
    y += 70;

    // La longueur du niveau et l'aimant
    this.longueur = this.texte(8, y + 5, "", TEXTE);
    this.bouton("raccourcir", 136, y, 32, 24, "−", () => this.allonger(-200), "200 pixels de moins, à droite");
    this.bouton("allonger", 172, y, 32, 24, "+", () => this.allonger(200), "200 pixels de plus, à droite");
    y += 28;
    this.bouton("aimant", 8, y, 196, 24, "", () => {
      this.aimant = !this.aimant;
      this.changer();
    }, "Avec l'aimant, tout se pose sur une grille de 10 pixels");
    this.hautDesProprietes = y + 32;

    // L'aperçu : tout le niveau en petit. Le toucher y emmène la vue.
    this.apercu = this.surLEcran(this.add.graphics());
    this.objetsDesPanneaux = this.children.list.filter((objet) => !avant.has(objet));
  }

  private nomDeSorte(sorte: APoser): string {
    return nomDe({ sorte: sorte[0], x: 0, y: 0, type: sorte[1] as Element["type"] });
  }

  // Les réglages de l'élément choisi, sous le panneau de gauche
  private construireLesProprietes() {
    this.proprietes.forEach((objet) => objet.destroy());
    this.proprietes = [];
    if (this.selection.length !== 1) {
      return;
    }
    const e = this.selection[0];
    let y = this.hautDesProprietes;
    const ligne = (contenu: string, couleur = TEXTE) => {
      this.proprietes.push(this.texte(8, y + 4, contenu, couleur));
      y += 20;
    };
    const bouton = (texte: string, action: () => void) => {
      this.proprietes.push(this.surLEcran(new Bouton(this, 8, y, 196, 24, texte, action)));
      y += 28;
    };
    const reglage = (texte: string, moins: () => void, plus: () => void) => {
      this.proprietes.push(
        this.texte(8, y + 5, texte, TEXTE),
        this.surLEcran(new Bouton(this, 136, y, 32, 24, "−", moins)),
        this.surLEcran(new Bouton(this, 172, y, 32, 24, "+", plus)),
      );
      y += 28;
    };
    ligne(nomDe(e) + (e.sorte === "plateforme" ? " « " + e.genre + " »" : ""), "#ffb070");
    if (e.sorte === "mobile") {
      bouton(e.axe === "x" ? "Va de gauche à droite" : "Va de haut en bas", () => this.regler(() => {
        e.axe = e.axe === "x" ? "y" : "x";
      }));
      reglage("Distance : " + e.dist, () => this.regler(() => this.borner(e, "dist", -20, 20, 600)), () => this.regler(() => this.borner(e, "dist", 20, 20, 600)));
      reglage("Vitesse : " + e.v, () => this.regler(() => this.borner(e, "v", -1, 1, 6)), () => this.regler(() => this.borner(e, "v", 1, 1, 6)));
    } else if (e.sorte === "boss" || (e.sorte === "ennemi" && e.type === "marcheur")) {
      ligne("Tire les carrés blancs : son trajet", GRIS);
      bouton("Caler sur la plateforme", () => this.regler(() => calerLeTrajet(e, this.elements, (g) => this.genres.solide(g))));
      if (e.sorte === "boss") {
        reglage("Vies : " + e.hp, () => this.regler(() => this.borner(e, "hp", -1, 1, 10)), () => this.regler(() => this.borner(e, "hp", 1, 1, 10)));
      }
    } else if (e.sorte === "ennemi" && e.type === "volant") {
      ligne("Tire les carrés blancs :", GRIS);
      ligne("son cadre de vol.", GRIS);
    } else if (e.sorte === "ennemi") {
      ligne("Il rebondit sur place.", GRIS);
      bouton("Caler sur la plateforme", () => this.regler(() => calerLeTrajet(e, this.elements, (g) => this.genres.solide(g))));
    } else if (e.sorte === "plateforme") {
      const effet = this.genres.effet(e.genre!);
      const forces = LES_FORCES[effet];
      if (forces) {                        // la force de son effet : « Elle glisse : Beaucoup »
        reglage(forces[0] + " : " + forces[1][e.force! - 1].toLowerCase(),
          () => this.regler(() => this.borner(e, "force", -1, 1, 3)), () => this.regler(() => this.borner(e, "force", 1, 1, 3)));
      }
      if (effet === "tapis") {
        bouton(e.sens === 1 ? "Vers la droite →" : "← Vers la gauche", () => this.regler(() => {
          e.sens = -(e.sens ?? 1);
        }));
      }
      ligne("Choisis un genre pour la changer.", GRIS);
    }
  }

  private borner(e: Element, cle: "dist" | "v" | "hp" | "force", pas: number, min: number, max: number) {
    e[cle] = Math.min(Math.max((e[cle] ?? 0) + pas, min), max);
  }

  // Un bouton des réglages : on retient le niveau (pour Annuler), on change, on redessine
  private regler(changement: () => void) {
    this.retenir();
    changement();
    this.changer();
  }

  // ================================================================ Tout redessiner

  // Le niveau a changé (ou ce qui est choisi, ou un bouton) : on redessine à l'image suivante, une seule fois
  changer() {
    this.aMettreAJour = true;
  }

  private mettreAJourLAffichage() {
    this.aMettreAJour = false;
    this.dessinerLeNiveau();
    this.construireLesProprietes();

    const b = this.boutons;
    for (const nom of ["selection", "gomme", "main"] as NomDOutil[]) {
      b[nom]!.setChoisi(this.outil === nom);
    }
    for (const [sorte, bouton] of this.palette) {
      bouton.setChoisi(this.outil === "poser" && sorte.join() === this.aPoser.join());
    }
    b.annuler!.setActif(this.historique.peutAnnuler);
    b.retablir!.setActif(this.historique.peutRetablir);
    b.copier!.setActif(this.selection.length > 0);
    b.supprimer!.setActif(this.selection.length > 0);
    b.coller!.setActif(this.pressePapiers.length > 0);
    b.aimant!.setTexte(this.aimant ? "Aimant : oui" : "Aimant : non");
    b.son!.setTexte(sonAllume(SAUVEGARDE) ? "Son" : "Muet");
    this.nomAffiche.setText(this.nom + (this.modifie ? " ★" : ""));
    this.longueur.setText("Longueur : " + this.largeur);
    this.alerte.setText(probleme(this.elements));
  }

  // Les éléments du niveau : refaits à chaque changement (un niveau, c'est quelques dizaines d'objets)
  private dessinerLeNiveau() {
    this.dessinsDuNiveau.forEach((objet) => objet.destroy());
    this.dessinsDuNiveau = [];
    const ajouter = <T extends Phaser.GameObjects.GameObject>(objet: T) => {
      this.dessinsDuNiveau.push(this.niveau(objet));
      return objet;
    };
    // Le niveau lui-même : son fond, et la fin à droite
    ajouter(this.add.rectangle(0, 0, this.largeur, HAUTEUR_MONDE, FOND).setOrigin(0).setDepth(-2));
    for (const e of this.elements.filter(estUnePlateforme)) {
      const r = rectDe(e);
      if (e.sorte === "mobile") {
        ajouter(this.add.tileSprite(r.x, r.y, r.w, r.h, "platformer-mobile").setOrigin(0).setTileScale(ECHELLE_TUILE));
      } else {
        const fiche = this.genres.fiche(e.genre!);
        ajouter(this.add.tileSprite(r.x, r.y, r.w, r.h, texturePour(this, e.genre!, fiche)).setOrigin(0)
          .setTileScale(e.sens === -1 ? -ECHELLE_TUILE : ECHELLE_TUILE, ECHELLE_TUILE).setAlpha(fiche.solide ? 1 : 0.7));
      }
    }
    for (const e of this.elements.filter((e) => !estUnePlateforme(e))) {
      const r = rectDe(e);
      const image = ajouter(this.add.image(r.x, r.y, IMAGE_DE[e.sorte === "ennemi" ? e.type! : e.sorte], 0).setOrigin(0));
      image.setDisplaySize(r.w, r.h);
    }
  }

  // Ce qui change à chaque image : la grille, la sélection, les trajets, l'outil, l'aperçu
  private dessinerLeDessus() {
    const z = this.zoom;
    const g = this.dessus.clear();
    g.lineStyle(2 / z, 0xffffff, 0.35).strokeRect(0, 0, this.largeur, HAUTEUR_MONDE);   // le bord du niveau
    dessinerLesTrajets(g, this);
    dessinerLaSelection(g, this);
    this.outils[this.outil].dessiner(g, this);

    const grille = this.grille.clear();
    grille.lineStyle(1 / z, 0x30364a, 0.8);
    const vue = this.cameras.main.worldView;
    const pas = z >= 1 ? 20 : 40;
    for (let x = Math.max(0, Math.floor(vue.x / pas) * pas); x <= Math.min(this.largeur, vue.right); x += pas) {
      grille.lineBetween(x, 0, x, HAUTEUR_MONDE);
    }
    for (let y = 0; y <= HAUTEUR_MONDE; y += pas) {
      grille.lineBetween(Math.max(0, vue.x), y, Math.min(this.largeur, vue.right), y);
    }

    // L'aperçu : chaque élément en petit, et le cadre de ce qu'on voit
    const a = this.apercu.clear();
    const ex = APERCU.width / this.largeur;
    const ey = APERCU.height / HAUTEUR_MONDE;
    a.fillStyle(0x16151d).fillRect(APERCU.x, APERCU.y, APERCU.width, APERCU.height);
    for (const e of this.elements) {
      const r = rectDe(e);
      const couleur = e.sorte === "plateforme" ? this.couleurDe(this.genres.fiche(e.genre!))
        : e.sorte === "mobile" ? 0x96c878 : e.sorte === "piece" ? 0xffd23f : e.sorte === "depart" ? 0x50aaf0
          : e.sorte === "drapeau" ? 0xff7a1a : 0xe0485c;
      a.fillStyle(couleur).fillRect(APERCU.x + r.x * ex, APERCU.y + r.y * ey, Math.max(2, r.w * ex), Math.max(2, r.h * ey));
    }
    a.lineStyle(1, 0xffffff).strokeRect(APERCU.x + Math.max(0, vue.x) * ex, APERCU.y + 1,
      Math.min(vue.width, this.largeur) * ex, APERCU.height - 2);
  }

  private couleurDe(fiche: Fiche): number {
    return (fiche.couleur[0] << 16) | (fiche.couleur[1] << 8) | fiche.couleur[2];
  }

  // ================================================================ La vue : zoom et défilement

  private cadrerLaCamera() {
    const vue = this.cameras.main;
    vue.setZoom(ZOOMS[this.zoomChoisi]);
    // Un peu de marge autour du niveau : on voit où il commence et où il finit
    vue.setBounds(-60, -40, this.largeur + 120, HAUTEUR_MONDE + 80);
  }

  // Zoomer autour d'un point de l'écran (la souris), sans que le niveau sous elle ne bouge
  zoomer(sens: number, autour?: Point) {
    const vue = this.cameras.main;
    const ecran = autour ?? { x: ZONE.centerX, y: ZONE.centerY };
    const avant = vue.getWorldPoint(ecran.x, ecran.y);
    this.zoomChoisi = Phaser.Math.Clamp(this.zoomChoisi + sens, 0, ZOOMS.length - 1);
    vue.setZoom(ZOOMS[this.zoomChoisi]);
    vue.preRender();                       // la caméra recalcule sa matrice tout de suite (sinon : à l'image suivante)
    const apres = vue.getWorldPoint(ecran.x, ecran.y);
    vue.setScroll(vue.scrollX + avant.x - apres.x, vue.scrollY + avant.y - apres.y);
  }

  glisserLaVue(dx: number, dy: number) {
    const vue = this.cameras.main;
    vue.setScroll(vue.scrollX + dx / vue.zoom, vue.scrollY + dy / vue.zoom);
  }

  // Montrer ce point du niveau au milieu de la vue
  private allerA(x: number, y: number) {
    this.cameras.main.centerOn(x, y);
  }

  // ================================================================ Le pointeur et le clavier

  private ecouter() {
    this.input.mouse?.disableContextMenu();
    this.events.on(SURVOL, (aide: string) => {
      this.survol = aide;
    });

    this.input.on("pointerdown", (p: Phaser.Input.Pointer, sous: Phaser.GameObjects.GameObject[]) => {
      if (this.fenetre || this.geste || sous.length > 0) {
        return;                            // une fenêtre, un geste déjà commencé, ou un bouton : pas pour le niveau
      }
      this.dernierPointeur = { x: p.x, y: p.y };
      if (APERCU.contains(p.x, p.y)) {     // dans l'aperçu : on y va
        this.geste = "apercu";
        this.allerVersLApercu(p.x);
      } else if (!ZONE.contains(p.x, p.y)) {
        return;
      } else if (p.middleButtonDown()) {   // le bouton du milieu : glisser la vue
        this.geste = "vue";
      } else if (p.rightButtonDown()) {    // le clic droit gomme, quel que soit l'outil
        this.geste = "gomme";
        this.outils.gomme.appuyer(this, this.versLeNiveau(p), p);
      } else {                             // sinon, l'outil choisi s'en occupe
        this.geste = "outil";
        this.outils[this.outil].appuyer(this, this.versLeNiveau(p), p);
      }
      this.changer();
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!p.isDown || !this.geste) {
        return;
      }
      if (this.geste === "outil") {
        this.outils[this.outil].bouger(this, this.versLeNiveau(p), p);
      } else if (this.geste === "gomme") {
        this.outils.gomme.bouger(this, this.versLeNiveau(p), p);
      } else if (this.geste === "vue") {
        this.glisserLaVue(this.dernierPointeur.x - p.x, this.dernierPointeur.y - p.y);
      } else {
        this.allerVersLApercu(p.x);
      }
      this.dernierPointeur = { x: p.x, y: p.y };
      this.changer();
    });
    const relacher = () => {
      if (this.geste === "outil") {
        this.outils[this.outil].relacher(this);
      } else if (this.geste === "gomme") {
        this.outils.gomme.relacher(this);
      }
      this.geste = null;
      this.changer();
    };
    this.input.on("pointerup", relacher);
    this.input.on("pointerupoutside", relacher);
    this.input.on("wheel", (p: Phaser.Input.Pointer, _sous: unknown, _dx: number, dy: number) => {
      if (!this.fenetre && !this.geste && ZONE.contains(p.x, p.y)) {
        this.zoomer(dy < 0 ? 1 : -1, p);   // la molette zoome, autour de la souris
      }
    });

    const clavier = this.input.keyboard!;
    this.touchesVue = clavier.createCursorKeys();
    this.ctrl = clavier.addKey("CTRL");
    this.maj = clavier.addKey("SHIFT");
    // Les touches qui ont un sens pour le navigateur (Tab change de champ, Ctrl+S enregistre la page) : pour nous
    clavier.addCapture("TAB");
    // Les raccourcis. Comme surTouche (du socle) : Phaser 4.2 peut envoyer deux fois le même appui ;
    // il nous faut en plus Ctrl et la lettre tapée, que surTouche ne donne pas.
    const dejaVus = new WeakSet<KeyboardEvent>();
    clavier.on("keydown", (evenement: KeyboardEvent) => {
      if (dejaVus.has(evenement)) {
        return;
      }
      dejaVus.add(evenement);
      this.touche(evenement);
    });
  }

  private versLeNiveau(p: Point): Point {
    const point = this.cameras.main.getWorldPoint(p.x, p.y);
    return { x: point.x, y: point.y };
  }

  private allerVersLApercu(x: number) {
    this.allerA((x - APERCU.x) / APERCU.width * this.largeur, this.cameras.main.midPoint.y);
  }

  private touche(evenement: KeyboardEvent) {
    if (this.fenetre) {                    // une fenêtre ouverte reçoit tout
      this.fenetre.touche(evenement);
      this.changer();
      return;
    }
    if (this.geste) {
      return;                              // pendant un geste, le clavier attend
    }
    const ctrl = evenement.ctrlKey || evenement.metaKey;
    const touche = evenement.key.length === 1 ? evenement.key.toLowerCase() : evenement.key;
    // Chaque raccourci, avec la méthode qu'il lance. La clé : « ctrl+z », ou la touche seule.
    const raccourcis: Record<string, () => void> = {
      "ctrl+z": () => this.annuler(),
      "ctrl+y": () => this.retablir(),
      "ctrl+s": () => this.enregistrer(),
      "ctrl+c": () => this.copier(),
      "ctrl+v": () => this.coller(),
      "n": () => this.demanderUnNouveauNiveau(),
      "Delete": () => this.supprimer(this.selection),
      "Backspace": () => this.supprimer(this.selection),
      "Tab": () => this.tester(),
      "PageUp": () => this.changerDeNiveau(-1),
      "PageDown": () => this.changerDeNiveau(1),
      "s": () => this.choisirLOutil("selection"),
      "g": () => this.choisirLOutil("gomme"),
      "h": () => this.choisirLOutil("main"),
      "m": () => basculerLeSon(this, SAUVEGARDE),
      "Escape": () => this.choisir([]),
    };
    const action = raccourcis[(ctrl ? "ctrl+" : "") + touche];
    if (action) {
      evenement.preventDefault();          // Ctrl+S n'enregistre pas la page web
      action();
      this.changer();
    }
  }

  update(_temps: number, delta: number) {
    // Les flèches font glisser la vue
    const t = this.touchesVue;
    if (!this.fenetre && !this.ctrl.isDown) {
      const dx = (t.right.isDown ? 1 : 0) - (t.left.isDown ? 1 : 0);
      const dy = (t.down.isDown ? 1 : 0) - (t.up.isDown ? 1 : 0);
      if (dx || dy) {
        this.glisserLaVue(dx * delta * 0.8, dy * delta * 0.8);
      }
    }
    if (this.aMettreAJour) {
      this.mettreAJourLAffichage();
    }
    this.dessinerLeDessus();
    this.barreDuBas.setText(this.time.now < this.finDuMessage ? this.message
      : this.survol || this.outils[this.outil].aide(this));
    const vue = this.cameras.main.midPoint;
    this.vueGardee = { x: vue.x, y: vue.y };
  }

  // ================================================================ Ce que demandent les outils

  aimanter(valeur: number): number {
    return this.aimant ? Math.round(valeur / AIMANT) * AIMANT : Math.round(valeur);
  }

  // L'élément sous le pointeur. Les petits passent avant les plateformes (souvent dessous), et on les
  // attrape même un peu à côté : jusqu'à 12 pixels d'écran, quel que soit le zoom. Le plus proche gagne ;
  // s'il y en a plusieurs sous le pointeur, celui du dessus (le dernier posé).
  elementSous(p: Point): Element | null {
    let proche: Element | null = null;
    let distance = 12 / this.zoom;
    for (const e of [...this.elements].reverse()) {
      if (!estUnePlateforme(e)) {
        const r = rectDe(e);
        // De combien le pointeur déborde du rectangle, du côté où il déborde le plus (0 : dedans)
        const d = Math.max(r.x - p.x, p.x - r.x - r.w, r.y - p.y, p.y - r.y - r.h, 0);
        if (d < distance) {
          proche = e;
          distance = d;
        }
      }
    }
    if (proche) {
      return proche;
    }
    const marge = 3;
    return [...this.elements].reverse().find((e) => {
      const r = rectDe(e);
      return estUnePlateforme(e) && p.x >= r.x - marge && p.x <= r.x + r.w + marge && p.y >= r.y - marge && p.y <= r.y + r.h + marge;
    }) ?? null;
  }

  fiche(genre: string): Fiche {
    return this.genres.fiche(genre);
  }

  choisir(elements: Element[]) {
    this.selection = elements;
    this.changer();
  }

  choisirLOutil(nom: NomDOutil) {
    this.outil = nom;
    this.changer();
  }

  // Un genre choisi pendant que des plateformes sont sélectionnées : elles en changent
  private choisirAPoser(sorte: APoser) {
    const plateformes = this.selection.filter((e) => e.sorte === "plateforme");
    if (sorte[0] === "plateforme" && this.outil === "selection" && plateformes.length > 0) {
      this.retenir();
      plateformes.forEach((e) => {
        e.genre = sorte[1];
      });
      this.dire("Genre changé : « " + sorte[1] + " »");
      this.changer();
      return;
    }
    this.aPoser = sorte;
    this.choisirLOutil("poser");
  }

  dire(message: string) {
    this.message = message;
    this.finDuMessage = this.time.now + 2500;
  }

  // ================================================================ Annuler

  // Avant chaque changement : on retient le niveau, et il n'est plus comme dans sa sauvegarde
  retenir() {
    this.historique.retenir({ elements: this.elements, largeur: this.largeur });
    this.modifie = true;
    this.changer();
  }

  annuler() {
    this.remettre(this.historique.annuler({ elements: this.elements, largeur: this.largeur }));
  }

  retablir() {
    this.remettre(this.historique.retablir({ elements: this.elements, largeur: this.largeur }));
  }

  private remettre(etat: EtatDuNiveau | null) {
    if (!etat) {
      return;
    }
    this.abandonnerLeGeste();
    this.elements = etat.elements;
    this.largeur = etat.largeur;
    this.selection = [];                   // les éléments choisis n'existent plus : ce sont d'autres copies
    this.modifie = true;
    this.cadrerLaCamera();
    this.changer();
  }

  private abandonnerLeGeste() {
    this.geste = null;
    Object.values(this.outils).forEach((outil) => outil.abandonner());
  }

  // ================================================================ Modifier le niveau

  // Efface ces éléments, sauf le départ : un niveau sans départ ne se jouerait pas
  supprimer(elements: Element[]) {
    const effaces = elements.filter((e) => e.sorte !== "depart");
    if (effaces.length < elements.length) {
      this.dire("Le départ reste : déplace-le plutôt");
    }
    if (effaces.length === 0) {
      return;
    }
    this.retenir();
    this.elements = this.elements.filter((e) => !effaces.includes(e));
    this.choisir([]);
  }

  private copier() {
    if (this.selection.length > 0) {
      this.pressePapiers = structuredClone(this.selection);
      this.dire("Copié ! « Coller » en pose une copie à côté");
      this.changer();
    }
  }

  private coller() {
    const copies = structuredClone(this.pressePapiers).filter((e) => !UNIQUES.includes(e.sorte));
    if (copies.length === 0) {
      return;                              // pas de deuxième départ, drapeau ou boss
    }
    this.retenir();
    // Chaque copie se décale vers la droite (avec son trajet), sans sortir du niveau
    const decalage = Math.min(40, ...copies.map((e) => this.largeur - rectDe(e).x - rectDe(e).w));
    for (const e of copies) {
      for (const cle of ["x", "xmin", "xmax"] as const) {
        if (e[cle] !== undefined) {
          e[cle]! += decalage;
        }
      }
    }
    this.elements.push(...copies);
    this.pressePapiers = structuredClone(copies);   // coller encore : la copie suivante se décale encore
    this.outil = "selection";
    this.choisir(copies);
  }

  // Le niveau ne raccourcit jamais sous ses éléments : ils resteraient au-delà de la fin
  private allonger(pixels: number) {
    const lePlusLoin = Math.max(800, ...this.elements.map((e) => rectDe(e).x + rectDe(e).w));
    const largeur = this.largeur + pixels;
    if (largeur < lePlusLoin || largeur > 20000) {
      this.dire(`Le niveau va au moins jusqu'à son dernier élément (${lePlusLoin}), et au plus à 20 000`);
      return;
    }
    this.retenir();
    this.largeur = largeur;
    this.cadrerLaCamera();
  }

  // ================================================================ Ouvrir, enregistrer

  // Ouvre un niveau. Renvoie false s'il est abîmé : on reste sur l'ancien.
  ouvrir(nom: string): boolean {
    const niveau = niveaux.charger(nom);
    if (!niveau) {
      this.dire("Le niveau « " + nom + " » est abîmé");
      return false;
    }
    this.abandonnerLeGeste();
    this.nom = nom;
    this.largeur = niveau.largeur;
    this.elements = niveau.elements;
    if (!this.elements.some((e) => e.sorte === "depart")) {   // un niveau a toujours un départ
      this.elements.push({ sorte: "depart", x: 60, y: 400 });
    }
    this.historique.vider();               // on n'annule pas vers un autre niveau
    this.selection = [];
    this.modifie = false;
    this.ouvert = true;
    this.cadrerLaCamera();
    this.allerA(this.cameras.main.worldView.width / 2 - 40, HAUTEUR_MONDE / 2);   // la vue part du début du niveau
    this.changer();
    return true;
  }

  private ouvrirLePremier() {
    if (this.noms.some((nom) => this.ouvrir(nom))) {
      return;
    }
    let nom = "Mon niveau";
    while (!niveaux.nomLibre(nom, this.noms)) {
      nom += " bis";
    }
    this.creerLeNiveau(nom);
    this.ouvrir(nom);
  }

  // Le niveau tel qu'on l'enregistre et tel que le jeu le joue : une copie, que le jeu peut changer
  niveauOuvert() {
    return { nom: this.nom, largeur: this.largeur, elements: structuredClone(this.elements) };
  }

  enregistrer() {
    niveaux.enregistrer(this.niveauOuvert());
    if (!this.noms.includes(this.nom)) {
      this.noms.push(this.nom);
      niveaux.ranger(this.noms);
    }
    this.modifie = false;
    this.dire("Niveau « " + this.nom + " » enregistré");
    this.changer();
  }

  // En partant (autre niveau, menu, test) : on n'enregistre que si quelque chose a changé
  private rangerSiModifie() {
    if (this.modifie) {
      this.enregistrer();
    }
  }

  private changerDeNiveau(sens: number) {
    this.rangerSiModifie();
    const numero = Math.max(0, this.noms.indexOf(this.nom));
    for (let pas = 1; pas <= this.noms.length; pas++) {   // un niveau abîmé est sauté
      if (this.ouvrir(this.noms[Phaser.Math.Wrap(numero + sens * pas, 0, this.noms.length)])) {
        return;
      }
    }
  }

  // Un niveau tout neuf : un sol, un départ, un drapeau. Il s'ajoute à la fin de l'Aventure.
  private creerLeNiveau(nom: string) {
    niveaux.enregistrer({
      nom, largeur: 1200, elements: [
        { sorte: "plateforme", x: 0, y: 440, w: 1200, h: 40, genre: "normale", force: 2, sens: 1 },
        { sorte: "depart", x: 60, y: 400 },
        { sorte: "drapeau", x: 1140, y: 400 },
      ],
    });
    this.noms = [...niveaux.liste().filter((autre) => autre !== nom), nom];
    niveaux.ranger(this.noms);
  }

  private demanderUnNouveauNiveau() {
    const valider = (nom: string) => {
      if (!niveaux.nomLibre(nom, this.noms)) {
        this.dire("Ce nom est vide, trop long ou déjà pris");
        return;
      }
      this.rangerSiModifie();
      this.creerLeNiveau(nom);
      this.ouvrir(nom);
      this.dire("Nouveau niveau : « " + nom + " », à la fin de l'Aventure");
    };
    if (!Saisie.auDoigt("Le nom du nouveau niveau", "", valider)) {
      this.ouvrirUneFenetre(new Saisie(this, "Le nom du nouveau niveau", "", valider));
    }
  }

  renommerUnNiveau(ancien: string, nouveau: string) {
    if (!niveaux.nomLibre(nouveau, this.noms.filter((nom) => nom !== ancien))) {
      this.dire("Ce nom est vide, trop long ou déjà pris");
      return;
    }
    if (ancien === this.nom) {
      this.rangerSiModifie();
    }
    niveaux.renommer(ancien, nouveau);
    this.noms = niveaux.liste();
    if (ancien === this.nom) {
      this.nom = nouveau;
    }
    this.changer();
  }

  supprimerUnNiveau(nom: string) {
    if (this.noms.length <= 1) {
      this.dire("C'est le dernier niveau : il reste");
      return;
    }
    niveaux.supprimer(nom);
    this.noms = niveaux.liste();
    if (nom === this.nom) {
      this.modifie = false;                // surtout ne pas le réenregistrer : il est supprimé
      this.ouvrirLePremier();
    }
  }

  deplacerUnNiveau(numero: number, sens: number) {
    const autre = numero + sens;
    if (autre >= 0 && autre < this.noms.length) {
      [this.noms[numero], this.noms[autre]] = [this.noms[autre], this.noms[numero]];   // ils échangent leur place
      niveaux.ranger(this.noms);
    }
  }

  remettreLesNiveauxDeDepart() {
    this.rangerSiModifie();
    niveaux.remettreLesNiveauxDeDepart();
    this.noms = niveaux.liste();
    this.ouvrir(this.noms.includes(this.nom) ? this.nom : this.noms[0]);
  }

  private ouvrirLesNiveaux() {
    this.rangerSiModifie();
    this.noms = niveaux.liste();
    this.ouvrirUneFenetre(new FenetreDesNiveaux(this, this));
  }

  // Les fenêtres s'empilent (une question par-dessus la fenêtre des niveaux) : le clavier va à celle du dessus
  ouvrirUneFenetre(fenetre: Fenetre) {
    this.surLEcran(fenetre);
    this.fenetres.push(fenetre);
    fenetre.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.fenetres = this.fenetres.filter((autre) => autre !== fenetre);
      this.changer();
    });
  }

  private get fenetre(): Fenetre | null {
    return this.fenetres[this.fenetres.length - 1] ?? null;
  }

  // ================================================================ Les genres de plateforme

  private demanderUnGenre() {
    const valider = (nom: string) => {
      if (!this.genres.nomLibre(nom)) {
        this.dire(`Ce nom est vide ou déjà pris (ou il y a déjà ${MAXIMUM} genres)`);
        return;
      }
      this.genres.ajouter(nom);
      this.aPoser = ["plateforme", nom];
      this.outil = "poser";
      this.refaireLesPanneaux();
      this.ouvrirUneFenetre(new FenetreDuGenre(this, this, nom));
    };
    if (!Saisie.auDoigt("Le nom du nouveau genre de plateforme", "", valider)) {
      this.ouvrirUneFenetre(new Saisie(this, "Le nom du nouveau genre de plateforme", "", valider));
    }
  }

  private modifierLeGenre() {
    if (this.aPoser[0] === "plateforme") {
      this.ouvrirUneFenetre(new FenetreDuGenre(this, this, this.aPoser[1]!));
    } else {
      this.dire("Choisis d'abord une plateforme dans la palette");
    }
  }

  changerLeGenre(nom: string, changement: Partial<Fiche>) {
    Object.assign(this.genres.fiches[nom], changement);
    this.genres.enregistrer();
    this.genres.charger();                 // la normale reste solide et sans effet, quoi qu'on fasse
    this.refaireLesPanneaux();
  }

  // Ses plateformes redeviennent normales, dans TOUS les niveaux
  supprimerLeGenre(nom: string) {
    this.rangerSiModifie();
    for (const autre of this.noms) {
      const niveau = niveaux.charger(autre);
      if (niveau?.elements.some((e) => e.genre === nom)) {
        niveau.elements.forEach((e) => {
          if (e.genre === nom) {
            e.genre = "normale";
          }
        });
        niveaux.enregistrer(niveau);
      }
    }
    this.genres.supprimer(nom);
    if (this.aPoser.join() === ["plateforme", nom].join()) {
      this.aPoser = ["plateforme", "normale"];
    }
    this.ouvrir(this.nom);
    this.refaireLesPanneaux();
    this.dire("Le genre « " + nom + " » est supprimé : ses plateformes sont redevenues normales");
  }

  // Un genre de plus ou de moins, ou une couleur changée : la palette est refaite
  private refaireLesPanneaux() {
    this.objetsDesPanneaux.forEach((objet) => objet.destroy());
    this.proprietes.forEach((objet) => objet.destroy());
    this.boutons = {};
    this.palette = [];
    this.proprietes = [];
    this.construireLesPanneaux();
    this.changer();
  }

  // ================================================================ Partir

  private partir(action: () => void) {
    if (this.parti) {
      return;
    }
    this.parti = true;
    this.ui.fade(200, 0, 0, 0, true);      // fonduPuis n'assombrit que la caméra principale
    fonduPuis(this, action);
  }

  private revenirAuMenu() {
    this.rangerSiModifie();
    this.partir(() => this.scene.start("platformer-menu"));
  }

  // Le bouton Tester : le jeu joue CE niveau, avec ses vraies règles. Échap ramène ici.
  tester() {
    const souci = probleme(this.elements);
    if (souci) {
      this.dire(souci);
      return;
    }
    this.rangerSiModifie();
    const donnees: DonneesDeNiveau = { mode: "test", niveaux: [this.niveauOuvert()], numero: 0, score: 0, vies: VIES, pieces: 0 };
    this.partir(() => this.scene.start("platformer-niveau", donnees));
  }
}
