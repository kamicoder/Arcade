// La partie : la grille, sa caméra, et tout ce qui la fait réagir (souris, doigts, clavier, manette).
// La barre du haut (compteurs, smiley, bouton du doigt) est une autre scène, par-dessus : elle ne
// bouge pas quand la caméra de la grille zoome ou glisse. La fin de partie aussi.
//
// La grille vit dans le « monde » de la scène, à sa vraie taille (48 pixels par case). C'est la
// caméra qui la fait tenir à l'écran : elle dézoome pour le niveau Difficile à la souris, et au doigt,
// elle garde des cases assez grosses pour un pouce, quitte à ce qu'on fasse glisser la grille.

import Phaser from "phaser";
import { Grille, hasardAvecGraine, type Coup, type Position } from "../grille";
import { NIVEAUX, estUnRecord, type Niveau } from "../niveaux";
import { Tuile } from "../Tuile";
import { TAILLE, COULEURS } from "../textures";
import { LARGEUR, HAUTEUR } from "../../../socle/style";
import { surTouche, surChaqueTouche } from "../../../socle/clavier";
import { surManette, MANETTE } from "../../../socle/manette";
import { estTactile } from "../../../socle/tactile";
import { fonduPuis } from "../../../socle/retour";

export const HAUT_BARRE = 56;              // la barre du haut ; la grille se montre en dessous
export const BAS_AIDE = 24;                // la ligne d'aide du clavier, en bas (pas au doigt)
const MARGE = 10;                          // un peu d'air autour de la grille, dans le monde
const DOIGT = 38;                          // la plus petite case au doigt, en pixels CSS (un bon centimètre)
const APPUI_LONG = 350;                    // ms : un doigt qui reste posé plante un drapeau
const GLISSE = 12;                         // pixels d'écran : au-delà, le doigt fait glisser la grille

export interface DonneesDePartie {
  niveau: number;                          // l'indice dans NIVEAUX
}

export type Visage = "smiley" | "smiley_oh" | "smiley_gagne" | "smiley_perdu";

// Pour les tests : jeu.registry.set(MINES_IMPOSEES, [{ r, c }, ...]) choisit les mines de la
// prochaine partie, et jeu.registry.set(GRAINE, 42) rend le hasard prévisible
export const MINES_IMPOSEES = "demineur-mines-imposees";
export const GRAINE = "demineur-graine";

// Ce qu'un doigt ou la souris est en train de faire
type Geste =
  | { type: "rien" }
  | { type: "appui"; pointeur: number; x: number; y: number; cible: Position | null; centre: Phaser.Math.Vector2 }
  | { type: "glisse"; pointeur: number; x: number; y: number; centre: Phaser.Math.Vector2 }
  | { type: "pince"; ecart: number; zoom: number }
  | { type: "fait" };                      // l'appui long a déjà agi : on attend que le doigt se lève

export class Partie extends Phaser.Scene {
  niveau!: Niveau;
  grille!: Grille;
  modeDrapeau = false;                     // au doigt : un toucher plante un drapeau au lieu de creuser
  private numeroNiveau = 0;
  private tuiles: Tuile[][] = [];
  private calque!: Phaser.GameObjects.Container;   // toutes les tuiles : on les jette d'un coup
  private debut: number | null = null;
  private fin: number | null = null;
  private minuterieFin?: Phaser.Time.TimerEvent;   // la fin de partie qui attend la fin des animations
  private curseur!: Phaser.GameObjects.Image;
  private posCurseur: Position = { r: 0, c: 0 };
  private voile!: Phaser.GameObjects.Image;        // la case survolée par la souris s'éclaire
  private anneau!: Phaser.GameObjects.Arc;         // l'appui long qui se charge sous le doigt
  private chargeAppui?: Phaser.Tweens.Tween;
  private minuterieAppui?: Phaser.Time.TimerEvent;
  private enfoncee: Tuile | null = null;
  private geste: Geste = { type: "rien" };
  private zoomMin = 1;
  private zoomMax = 2;
  private centre = new Phaser.Math.Vector2();      // ce que la caméra regarde, dans le monde
  private poussiere!: Phaser.GameObjects.Particles.ParticleEmitter;
  private feu!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fumee!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super("demineur-partie");
  }

  init(donnees: DonneesDePartie) {
    this.numeroNiveau = donnees.niveau ?? 0;
    this.modeDrapeau = false;
    this.geste = { type: "rien" };
    this.enfoncee = null;
  }

  create() {
    const camera = this.cameras.main;
    camera.setBackgroundColor(COULEURS.fond);
    // La caméra ne montre que la place sous la barre (et au-dessus de l'aide, au clavier)
    const bas = estTactile() ? HAUTEUR : HAUTEUR - BAS_AIDE;
    camera.setViewport(0, HAUT_BARRE, LARGEUR, bas - HAUT_BARRE);
    camera.fadeIn(250);

    this.creerEffets();
    this.ecouterLaSourisEtLesDoigts();
    this.ecouterLeClavierEtLaManette();

    this.scene.launch("demineur-barre");
    this.nouvellePartie(this.numeroNiveau);
  }

  // ===== Une partie

  nouvellePartie(numero = this.numeroNiveau) {
    this.scene.stop("demineur-fin");
    this.numeroNiveau = numero;
    this.niveau = NIVEAUX[numero];
    const graine = this.registry.get(GRAINE) as number | undefined;
    this.grille = new Grille(this.niveau.rangees, this.niveau.colonnes, this.niveau.mines,
      graine === undefined ? Math.random : hasardAvecGraine(graine));
    this.debut = null;
    this.fin = null;
    // Rejouer pendant l'explosion : la fin de l'ancienne partie ne doit pas tomber sur la nouvelle
    this.minuterieFin?.remove();
    this.minuterieFin = undefined;
    this.annulerLeGeste();

    // Les anciennes tuiles s'en vont toutes ensemble : détruire le Container détruit ses enfants
    this.calque?.destroy();
    this.calque = this.add.container(0, 0).setDepth(0);
    this.tuiles = [];
    for (let r = 0; r < this.niveau.rangees; r++) {
      const ligne: Tuile[] = [];
      for (let c = 0; c < this.niveau.colonnes; c++) {
        const tuile = new Tuile(this, r, c);
        this.calque.add(tuile);
        tuile.apparaitre(Math.min((r + c) * 14, 500));
        ligne.push(tuile);
      }
      this.tuiles.push(ligne);
    }

    this.posCurseur = { r: Math.floor(this.niveau.rangees / 2), c: Math.floor(this.niveau.colonnes / 2) };
    this.placerLeCurseur();
    this.cadrerLaGrille();
    this.events.emit("visage", "smiley");
    this.events.emit("niveau", this.niveau);
  }

  // Le temps de jeu, en millisecondes : depuis le premier clic, arrêté à la fin
  tempsEcoule(): number {
    if (this.debut === null) {
      return 0;
    }
    return (this.fin ?? this.time.now) - this.debut;
  }

  basculerLeMode() {
    this.modeDrapeau = !this.modeDrapeau;
    this.events.emit("mode", this.modeDrapeau);
  }

  quitter() {
    fonduPuis(this, () => {
      this.scene.stop("demineur-barre");
      this.scene.stop("demineur-fin");
      this.scene.start("demineur-menu");
    });
  }

  // Pour les tests : où est le centre d'une case, en pixels du jeu (960 × 540)
  ecranDeCase(r: number, c: number) {
    const camera = this.cameras.main;
    const vue = camera.worldView;
    return {
      x: camera.x + ((c + 0.5) * TAILLE - vue.x) * camera.zoom,
      y: camera.y + ((r + 0.5) * TAILLE - vue.y) * camera.zoom,
    };
  }

  // ===== Jouer

  private creuser(r: number, c: number) {
    const imposees = this.registry.get(MINES_IMPOSEES) as Position[] | undefined;
    const coup = this.grille.clic(r, c, imposees);
    if (coup.premier) {
      this.debut = this.time.now;          // le chrono part au premier clic
    }
    if (coup.ouvertes.length === 0) {
      return;
    }
    this.animerLesOuvertures(coup);
    if (coup.boum) {
      this.exploser(coup.boum);
    } else if (coup.issue === "gagne") {
      this.gagner({ r, c });
    }
  }

  private marquer(r: number, c: number) {
    const avant = this.grille.case(r, c).etat;
    const apres = this.grille.basculer(r, c);
    if (apres === avant) {
      return;
    }
    this.tuiles[r][c].marquer(apres);
    this.sound.play("demineur-clic", { rate: apres === "drapeau" ? 1.6 : 1.2, volume: 0.6 });
    if (apres === "drapeau") {
      navigator.vibrate?.(25);             // un petit « tac » dans la main, au doigt
    }
  }

  // Chaque case s'ouvre à son tour : la cascade déferle comme une onde depuis la case cliquée
  private animerLesOuvertures(coup: Coup) {
    const PAR_VAGUE = 28;
    let vagueMax = 0;
    for (const { r, c, vague } of coup.ouvertes) {
      const explosee = coup.boum !== null && coup.boum.r === r && coup.boum.c === c;
      this.tuiles[r][c].ouvrir(this.grille.case(r, c), vague * PAR_VAGUE, explosee);
      vagueMax = Math.max(vagueMax, vague);
    }
    const premiere = coup.ouvertes[0];
    const ici = this.centreDeCase(premiere.r, premiere.c);
    this.poussiere.explode(coup.ouvertes.length > 1 ? 14 : 6, ici.x, ici.y);

    // Un clic par case... mais pas cent à la fois : quelques clics de plus en plus aigus pour la cascade
    this.sound.play("demineur-clic", { volume: 0.8 });
    for (let k = 1; k <= Math.min(vagueMax, 6); k++) {
      this.time.delayedCall(k * PAR_VAGUE * 1.5, () => {
        this.sound.play("demineur-clic", { rate: 1 + k * 0.12, volume: 0.5 });
      });
    }
  }

  private exploser(boum: Position) {
    this.fin = this.time.now;
    this.events.emit("visage", "smiley_perdu");
    const ici = this.centreDeCase(boum.r, boum.c);
    this.sound.play("demineur-boum");
    this.feu.explode(50, ici.x, ici.y);
    this.fumee.explode(16, ici.x, ici.y);
    this.cameras.main.shake(350, 0.012);
    this.cameras.main.flash(180, 255, 120, 60);

    // Les autres mines se montrent l'une après l'autre, des plus proches aux plus lointaines
    const distance = (p: Position) => Math.hypot(p.r - boum.r, p.c - boum.c);
    const mines = this.grille.minesCachees().sort((a, b) => distance(a) - distance(b));
    const pas = Math.min(60, 1200 / Math.max(1, mines.length));
    mines.forEach((p, k) => this.tuiles[p.r][p.c].ouvrir(this.grille.case(p.r, p.c), 300 + k * pas));
    const finDesMines = 300 + mines.length * pas;
    this.grille.drapeauxFaux().forEach((p, k) => this.tuiles[p.r][p.c].barrer(finDesMines + k * 80));

    this.minuterieFin = this.time.delayedCall(finDesMines + 700, () => this.finir(false));
  }

  private gagner(derniere: Position) {
    this.fin = this.time.now;
    this.events.emit("visage", "smiley_gagne");
    this.sound.play("demineur-victoire");
    // Les mines restantes reçoivent leur drapeau, et toute la grille sautille depuis la dernière case
    for (const p of this.grille.toutesLesMines()) {
      this.tuiles[p.r][p.c].marquer("drapeau");
    }
    this.tuiles.forEach((ligne) => ligne.forEach((tuile) => {
      tuile.sautiller(300 + Math.hypot(tuile.r - derniere.r, tuile.c - derniere.c) * 40);
    }));
    this.minuterieFin = this.time.delayedCall(900, () => this.finir(true));
  }

  private finir(gagne: boolean) {
    const temps = this.tempsEcoule();
    this.scene.launch("demineur-fin", {
      gagne,
      temps,
      niveau: this.numeroNiveau,
      record: gagne && estUnRecord(this.niveau, temps),
    });
  }

  // ===== La souris et les doigts

  private ecouterLaSourisEtLesDoigts() {
    // Le clic droit plante un drapeau : le menu du navigateur ne doit pas s'ouvrir par-dessus
    this.input.mouse?.disableContextMenu();

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.poser(p));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.bouger(p));
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => this.lever(p));
    this.input.on("pointerupoutside", (p: Phaser.Input.Pointer) => this.lever(p));
    // La molette zoome (vers la souris), comme les deux doigts qui s'écartent
    this.input.on("wheel", (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.zoomer(this.cameras.main.zoom * (dy > 0 ? 0.9 : 1.1), p);
    });
  }

  // Le pointeur est-il sur la grille (et pas sur la barre, ni sur un de ses boutons) ?
  private surLaGrille(p: Phaser.Input.Pointer): boolean {
    const barre = this.scene.get("demineur-barre") as { occupe?: (x: number, y: number) => boolean };
    const camera = this.cameras.main;
    return p.y >= camera.y && p.y < camera.y + camera.height
      && !barre.occupe?.(p.x, p.y)
      && !this.scene.isActive("demineur-fin");
  }

  private caseSous(p: Phaser.Input.Pointer): Position | null {
    const monde = this.cameras.main.getWorldPoint(p.x, p.y);
    const r = Math.floor(monde.y / TAILLE);
    const c = Math.floor(monde.x / TAILLE);
    return this.grille.dedans(r, c) ? { r, c } : null;
  }

  private poser(p: Phaser.Input.Pointer) {
    if (!this.surLaGrille(p)) {
      return;
    }
    this.cacherLeCurseur();
    const autre = this.autreDoigt(p);
    if (autre) {
      // Un deuxième doigt : on pince pour zoomer, et on oublie le toucher du premier
      this.annulerLeGeste();
      this.geste = { type: "pince", ecart: Phaser.Math.Distance.Between(p.x, p.y, autre.x, autre.y), zoom: this.cameras.main.zoom };
      return;
    }
    const cible = this.caseSous(p);
    if (p.rightButtonDown()) {
      if (cible) {
        this.marquer(cible.r, cible.c);
      }
      return;
    }
    if (p.button !== 0) {
      return;                              // la molette enfoncée : rien
    }
    this.geste = { type: "appui", pointeur: p.id, x: p.x, y: p.y, cible, centre: this.centre.clone() };
    if (cible && this.grille.issue === "") {
      this.enfoncer(cible);
      this.events.emit("visage", "smiley_oh");   // « oh ! » : va-t-il tomber sur une mine ?
      if (p.wasTouch) {
        this.chargerAppuiLong(cible);
      }
    }
  }

  private bouger(p: Phaser.Input.Pointer) {
    const geste = this.geste;
    if (geste.type === "pince") {
      const autre = this.autreDoigt(p);
      if (autre) {
        const ecart = Phaser.Math.Distance.Between(p.x, p.y, autre.x, autre.y);
        this.zoomer(geste.zoom * ecart / Math.max(1, geste.ecart));
      }
      return;
    }
    if ((geste.type === "appui" || geste.type === "glisse") && geste.pointeur === p.id) {
      const dx = p.x - geste.x;
      const dy = p.y - geste.y;
      if (geste.type === "appui" && Math.hypot(dx, dy) > GLISSE) {
        // Le doigt (ou la souris enfoncée) a bougé : ce n'est plus un toucher, on fait glisser la grille
        this.annulerAppuiLong();
        this.enfoncer(null);
        this.events.emit("visage", this.visageEnJeu());
        this.geste = { type: "glisse", pointeur: p.id, x: geste.x, y: geste.y, centre: geste.centre };
      }
      if (this.geste.type === "glisse") {
        const zoom = this.cameras.main.zoom;
        this.centre.set(geste.centre.x - dx / zoom, geste.centre.y - dy / zoom);
        this.cadrer();
      }
      return;
    }
    // La souris qui survole : la case s'éclaire
    if (!p.wasTouch && geste.type === "rien") {
      const cible = this.surLaGrille(p) ? this.caseSous(p) : null;
      const fermee = cible && this.grille.case(cible.r, cible.c).etat !== "ouverte" && this.grille.issue === "";
      this.voile.setVisible(!!fermee);
      if (cible) {
        this.voile.setPosition((cible.c + 0.5) * TAILLE, (cible.r + 0.5) * TAILLE);
      }
    }
  }

  private lever(p: Phaser.Input.Pointer) {
    const geste = this.geste;
    if (geste.type === "pince") {
      if (!this.autreDoigt(p)) {
        this.geste = { type: "rien" };
      }
      return;
    }
    if (geste.type === "fait") {
      this.geste = { type: "rien" };       // l'appui long a déjà agi
      return;
    }
    if ((geste.type === "appui" || geste.type === "glisse") && geste.pointeur !== p.id) {
      return;                              // un autre doigt que celui qui joue
    }
    if (geste.type === "appui" && geste.cible) {
      const ici = this.caseSous(p);
      // On agit sur la case où l'on a appuyé, si l'on y est encore
      if (ici && ici.r === geste.cible.r && ici.c === geste.cible.c) {
        this.toucher(ici, p.wasTouch && this.modeDrapeau);
      }
    }
    this.annulerLeGeste();
  }

  // Un toucher (ou un clic gauche) : creuser, ou planter un drapeau en mode drapeau.
  // Sur un chiffre déjà ouvert, c'est toujours l'accord, quel que soit le mode.
  private toucher(cible: Position, drapeau: boolean) {
    if (drapeau && this.grille.case(cible.r, cible.c).etat !== "ouverte") {
      this.marquer(cible.r, cible.c);
    } else {
      this.creuser(cible.r, cible.c);
    }
  }

  // L'appui long fait l'inverse du toucher : un drapeau en mode pelle, creuser en mode drapeau
  private chargerAppuiLong(cible: Position) {
    const ici = this.centreDeCase(cible.r, cible.c);
    this.anneau.setPosition(ici.x, ici.y).setVisible(true).setScale(0.3).setAlpha(0.9);
    this.chargeAppui = this.tweens.add({ targets: this.anneau, scale: 1, duration: APPUI_LONG, ease: "Quad.Out" });
    this.minuterieAppui = this.time.delayedCall(APPUI_LONG, () => {
      this.enfoncer(null);
      this.anneau.setVisible(false);
      this.geste = { type: "fait" };
      this.events.emit("visage", this.visageEnJeu());
      this.toucher(cible, !this.modeDrapeau);
    });
  }

  private annulerAppuiLong() {
    this.minuterieAppui?.remove();
    this.chargeAppui?.stop();
    this.minuterieAppui = undefined;
    this.chargeAppui = undefined;
    this.anneau?.setVisible(false);
  }

  private annulerLeGeste() {
    this.annulerAppuiLong();
    this.enfoncer(null);
    this.geste = { type: "rien" };
    if (this.grille) {
      this.events.emit("visage", this.visageEnJeu());
    }
  }

  private enfoncer(cible: Position | null) {
    this.enfoncee?.enfoncer(false);
    this.enfoncee = cible ? this.tuiles[cible.r][cible.c] : null;
    this.enfoncee?.enfoncer(true);
  }

  private autreDoigt(p: Phaser.Input.Pointer): Phaser.Input.Pointer | undefined {
    return this.input.manager.pointers.find((autre) => autre !== p && autre.isDown && autre.wasTouch);
  }

  private visageEnJeu(): Visage {
    const issue = this.grille.issue;
    return issue === "perdu" ? "smiley_perdu" : issue === "gagne" ? "smiley_gagne" : "smiley";
  }

  // ===== La caméra

  // Le zoom qui fait tenir toute la grille, et au doigt, celui qui garde les cases assez grosses
  private cadrerLaGrille() {
    const camera = this.cameras.main;
    const largeur = this.niveau.colonnes * TAILLE + 2 * MARGE;
    const hauteur = this.niveau.rangees * TAILLE + 2 * MARGE;
    const toutVoir = Math.min(camera.width / largeur, camera.height / hauteur, 1.3);
    let zoom = toutVoir;
    if (estTactile()) {
      // displayScale : combien de pixels du jeu dans un pixel CSS de l'écran
      const pixelsCss = 1 / this.scale.displayScale.x;
      zoom = Math.max(toutVoir, DOIGT / (TAILLE * pixelsCss));
    }
    this.zoomMin = toutVoir;
    this.zoomMax = Math.max(zoom * 1.6, 1.6);
    camera.setZoom(zoom);
    // Au départ, on regarde le milieu de la grille
    this.centre.set(this.niveau.colonnes * TAILLE / 2, this.niveau.rangees * TAILLE / 2);
    this.cadrer();
  }

  private zoomer(zoom: number, vers?: Phaser.Input.Pointer) {
    const camera = this.cameras.main;
    const avant = vers ? camera.getWorldPoint(vers.x, vers.y) : null;
    camera.setZoom(Phaser.Math.Clamp(zoom, this.zoomMin, this.zoomMax));
    if (vers && avant) {
      // Le point sous la souris reste sous la souris : on décale la caméra d'autant qu'il a bougé
      camera.preRender();
      const apres = camera.getWorldPoint(vers.x, vers.y);
      this.centre.x += avant.x - apres.x;
      this.centre.y += avant.y - apres.y;
    }
    this.cadrer();
  }

  // La caméra regarde « centre », sans laisser la grille sortir de l'écran ; une grille plus petite
  // que l'écran reste au milieu. Au doigt, une grille qui défile peut aller un peu plus loin à droite
  // et en bas : les dernières cases sortent de sous le bouton du mode.
  private cadrer() {
    const camera = this.cameras.main;
    const vueL = camera.width / camera.zoom;
    const vueH = camera.height / camera.zoom;
    const largeur = this.niveau.colonnes * TAILLE;
    const hauteur = this.niveau.rangees * TAILLE;
    const margeFin = estTactile() ? 110 : MARGE;
    const borner = (valeur: number, taille: number, vue: number) =>
      taille + 2 * MARGE <= vue ? taille / 2 : Phaser.Math.Clamp(valeur, vue / 2 - MARGE, taille + margeFin - vue / 2);
    this.centre.set(borner(this.centre.x, largeur, vueL), borner(this.centre.y, hauteur, vueH));
    camera.centerOn(this.centre.x, this.centre.y);
  }

  // Le curseur du clavier est sorti de l'écran : la caméra le suit
  private montrerLaCase(p: Position) {
    const camera = this.cameras.main;
    const vueL = camera.width / camera.zoom;
    const vueH = camera.height / camera.zoom;
    const x = (p.c + 0.5) * TAILLE;
    const y = (p.r + 0.5) * TAILLE;
    const marge = TAILLE * 1.5;
    this.centre.x = Phaser.Math.Clamp(this.centre.x, x + marge - vueL / 2, x - marge + vueL / 2);
    this.centre.y = Phaser.Math.Clamp(this.centre.y, y + marge - vueH / 2, y - marge + vueH / 2);
    this.cadrer();
  }

  // ===== Le clavier et la manette

  private ecouterLeClavierEtLaManette() {
    const action = (faire: () => void) => () => {
      // Pendant la fin de partie (et la saisie du nom), c'est elle qui écoute le clavier
      if (!this.scene.isActive("demineur-fin")) {
        faire();
      }
    };
    // Le curseur : les flèches, ou les touches de la main gauche reconnues à leur place (KeyW, KeyA...,
    // Z Q S D sur un AZERTY, W A S D sur un QWERTY : socle/touchesPhysiques.ts)
    const deplacements: Record<string, [number, number]> = {
      ArrowLeft: [0, -1], KeyA: [0, -1],
      ArrowRight: [0, 1], KeyD: [0, 1],
      ArrowUp: [-1, 0], KeyW: [-1, 0],
      ArrowDown: [1, 0], KeyS: [1, 0],
    };
    surChaqueTouche(this, (evenement) => {
      const deplacement = deplacements[evenement.code];
      if (deplacement) {
        action(() => this.deplacerLeCurseur(deplacement[0], deplacement[1]))();
      }
    });
    surTouche(this, "SPACE", action(() => this.agirAuCurseur(false)));
    surTouche(this, "ENTER", action(() => this.agirAuCurseur(false)));
    surTouche(this, "F", action(() => this.agirAuCurseur(true)));
    surTouche(this, "X", action(() => this.agirAuCurseur(true)));
    surTouche(this, "R", action(() => this.nouvellePartie()));
    surTouche(this, "ONE", action(() => this.nouvellePartie(0)));
    surTouche(this, "TWO", action(() => this.nouvellePartie(1)));
    surTouche(this, "THREE", action(() => this.nouvellePartie(2)));
    surTouche(this, "ESC", action(() => this.quitter()));

    // La manette : la croix déplace, A creuse, X ou Y plante un drapeau, B revient aux niveaux
    // La manette (sauf quand la fin est affichée : elle a ses boutons). En partie, Start relance.
    const enPartie = (action: () => void) => () => {
      if (!this.scene.isActive("demineur-fin")) {
        action();
      }
    };
    surManette(this, MANETTE.HAUT, enPartie(() => this.deplacerLeCurseur(-1, 0)));
    surManette(this, MANETTE.BAS, enPartie(() => this.deplacerLeCurseur(1, 0)));
    surManette(this, MANETTE.GAUCHE, enPartie(() => this.deplacerLeCurseur(0, -1)));
    surManette(this, MANETTE.DROITE, enPartie(() => this.deplacerLeCurseur(0, 1)));
    surManette(this, MANETTE.A, enPartie(() => this.agirAuCurseur(false)));
    surManette(this, [MANETTE.X, MANETTE.Y], enPartie(() => this.agirAuCurseur(true)));
    surManette(this, MANETTE.B, enPartie(() => this.quitter()));
    surManette(this, MANETTE.START, enPartie(() => this.nouvellePartie()));
  }

  private deplacerLeCurseur(dr: number, dc: number) {
    // Le premier appui montre seulement le curseur, là où il était
    if (this.curseur.visible) {
      this.posCurseur = {
        r: Phaser.Math.Clamp(this.posCurseur.r + dr, 0, this.niveau.rangees - 1),
        c: Phaser.Math.Clamp(this.posCurseur.c + dc, 0, this.niveau.colonnes - 1),
      };
    }
    this.voile.setVisible(false);
    this.placerLeCurseur(true);
    this.montrerLaCase(this.posCurseur);
  }

  private agirAuCurseur(drapeau: boolean) {
    if (!this.curseur.visible) {
      this.placerLeCurseur(true);          // d'abord, on montre où l'on est
      return;
    }
    const { r, c } = this.posCurseur;
    if (drapeau) {
      this.marquer(r, c);
    } else {
      this.creuser(r, c);
    }
  }

  private placerLeCurseur(visible = this.curseur?.visible ?? false) {
    const x = (this.posCurseur.c + 0.5) * TAILLE;
    const y = (this.posCurseur.r + 0.5) * TAILLE;
    if (visible && this.curseur.visible) {
      // Le curseur glisse jusqu'à la case : un tween court, qu'on remplace à chaque appui
      this.tweens.killTweensOf(this.curseur);
      this.tweens.add({ targets: this.curseur, x, y, duration: 70, ease: "Quad.Out" });
    } else {
      this.curseur.setPosition(x, y);
    }
    this.curseur.setVisible(visible);
  }

  private cacherLeCurseur() {
    this.curseur.setVisible(false);
  }

  // ===== Les effets

  private centreDeCase(r: number, c: number) {
    return { x: (c + 0.5) * TAILLE, y: (r + 0.5) * TAILLE };
  }

  private creerEffets() {
    // Au-dessus des tuiles (les tuiles sont dans un Container de profondeur 0)
    this.voile = this.add.image(0, 0, "demineur-voile").setScale(0.5).setAlpha(0.22).setVisible(false).setDepth(1);
    this.curseur = this.add.image(0, 0, "demineur-curseur").setScale(0.5).setVisible(false).setDepth(2);
    this.tweens.add({ targets: this.curseur, alpha: 0.55, duration: 450, yoyo: true, repeat: -1 });
    this.anneau = this.add.circle(0, 0, TAILLE * 0.75).setStrokeStyle(5, 0xffc83d).setVisible(false).setDepth(3);

    // La poussière d'une case qui s'ouvre, le feu et la fumée de l'explosion
    this.poussiere = this.add.particles(0, 0, "etincelle", {
      emitting: false,
      lifespan: 450,
      speed: { min: 40, max: 140 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: [0x8fa0e0, 0xc8d0ff, 0xffffff],
    }).setDepth(4);
    this.feu = this.add.particles(0, 0, "etincelle", {
      emitting: false,
      lifespan: { min: 400, max: 900 },
      speed: { min: 120, max: 480 },
      scale: { start: 2.2, end: 0 },
      tint: [0xffe14d, 0xff9a2e, 0xff4d2e],
      blendMode: "ADD",
    }).setDepth(5);
    this.fumee = this.add.particles(0, 0, "etincelle", {
      emitting: false,
      lifespan: 1400,
      speed: { min: 20, max: 90 },
      scale: { start: 2, end: 6 },
      alpha: { start: 0.45, end: 0 },
      tint: 0x55505f,
    }).setDepth(4);
  }
}
