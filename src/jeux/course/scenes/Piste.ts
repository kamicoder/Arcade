// La course : la piste, les objets, les véhicules, les caméras (une, ou deux en écran partagé).
// Le thème dessine (son DecorDeCourse) ; le jeu fait avancer les véhicules (Coureur.ts).
// Le tableau de bord (compteurs, carte, messages, commandes au doigt) est une autre scène, lancée
// par-dessus : elle ne bouge pas avec les caméras.

import Phaser from "phaser";
import type { EtatDuGrandPrix } from "./GrandPrix";
import { POINTS_GRAND_PRIX } from "./GrandPrix";
import { preparerCircuit, type Circuit } from "../circuits";
import { texturePiste } from "../piste";
import {
  Coureur, bousculer, ordreDeCourse, resultatsDeCourse, type Monde, type ObjetEnCourse, type Instant,
} from "../Coureur";
import type { DecorDeCourse, Evenement, Moteur, Niveau, Conduite, Theme, VueDuCoureur } from "../theme";
import {
  themeEnCours, preferences, apparenceDe, lireRecord, ecrireRecord, circuitParId, aidesDeLaCourse,
} from "../sauvegarde";
import { jouer, musicien } from "../son";
import { TouchesPhysiques } from "../../../socle/touchesPhysiques";
import { surChaqueTouche } from "../../../socle/clavier";
import { estTactile } from "../../../socle/tactile";
import { LARGEUR, HAUTEUR } from "../../../socle/style";

export type Mode = "grandprix" | "course" | "duo" | "chrono";

export interface DonneesDeCourse {
  mode: Mode;
  circuitId: string;
  rivaux: number[];                        // les numéros des véhicules de l'ordinateur
  niveau: number;                          // leur vitesse, avant le niveau choisi au menu
  grandPrix?: EtatDuGrandPrix;
}

export const TOURS = 3;

// Les touches de chaque joueur, par leur place sur le clavier (KeyW est le Z d'un clavier français) :
// Z Q S D tombe sous les doigts quel que soit le clavier
const COMMANDES = [
  { avancer: "ArrowUp", reculer: "ArrowDown", gauche: "ArrowLeft", droite: "ArrowRight" },
  { avancer: "KeyW", reculer: "KeyS", gauche: "KeyA", droite: "KeyD" },
];
const TURBO_J1 = ["Enter", "NumpadEnter", "ShiftRight", "ControlRight"];
const TURBO_SEUL = ["Space", "ShiftLeft"];           // le turbo de J1 quand il est seul, celui de J2 sinon

// Une manette « standard » : A accélérer, B freiner, X ou RB le turbo, Start la pause
const MANETTE = { avancer: 0, reculer: 1, turbo: [2, 5], pause: 9 };

export class Piste extends Phaser.Scene implements Monde {
  theme!: Theme;
  donnees!: DonneesDeCourse;
  circuit!: Circuit;
  conduite!: Conduite;
  aides!: Niveau;
  enChrono = false;
  coureurs: Coureur[] = [];
  joueurs: Coureur[] = [];
  vues: VueDuCoureur[] = [];
  objets: ObjetEnCourse[] = [];
  decor!: DecorDeCourse;

  enCourse = false;                        // faux pendant le compte à rebours, et une fois la course finie
  finie = false;
  arrivees = 0;
  // Le contre-la-montre : le record du circuit et son fantôme
  meilleurTour: number | null = null;
  fantome: Instant[] = [];
  fantomeIndex = 0;
  nouveauRecord = false;
  ombre?: ReturnType<DecorDeCourse["fantome"]>;
  // Les doigts sur les commandes : le tableau de bord les met à jour
  tactile = { gauche: false, droite: false, reculer: false };

  private auDoigt = false;
  private touches!: TouchesPhysiques;      // les touches tenues, par leur place sur le clavier
  private moteurs: Moteur[] = [];          // un par joueur : chacun entend le sien monter dans les aigus
  private zoomDeBase = 1;

  constructor() {
    super("course-piste");
  }

  init(donnees: DonneesDeCourse) {
    this.theme = themeEnCours();
    this.donnees = donnees;
    this.circuit = preparerCircuit(circuitParId(donnees.circuitId), this.theme);
    this.conduite = this.theme.conduite;
    this.auDoigt = estTactile();
    this.aides = aidesDeLaCourse(this.auDoigt);
    this.enChrono = donnees.mode === "chrono";
    this.coureurs = [];
    this.joueurs = [];
    this.vues = [];
    this.objets = [];
    this.moteurs = [];
    this.enCourse = false;
    this.finie = false;
    this.arrivees = 0;
    this.nouveauRecord = false;
    this.fantomeIndex = 0;
    this.tactile = { gauche: false, droite: false, reculer: false };
    this.ombre = undefined;
    const record = this.enChrono ? lireRecord(this.circuit.modele.id) : null;
    this.meilleurTour = record ? record.temps : null;
    this.fantome = record?.fantome ?? [];
  }

  create() {
    // Le thème habille la course : la piste d'abord (il la peint), puis les objets et les véhicules
    this.add.image(0, 0, texturePiste(this, this.circuit)).setOrigin(0).setDepth(0);
    this.decor = this.theme.decor({
      scene: this, circuit: this.circuit, joueurs: this.joueurs,
      annoncer: (texte, couleur, coureur) => this.annoncer(texte, couleur, coureur),
    });
    this.creerObjets();
    this.creerCoureurs();
    this.creerCameras();
    this.ecouterLesCommandes();
    this.creerMoteurs();

    musicien.jouer("course");
    this.scene.launch("course-tableau");
  }

  // ===== La mise en place =====

  private creerObjets() {
    for (const { type, place } of this.circuit.objets) {
      this.objets.push({ type, image: this.decor.objet(type, place) });
    }
  }

  private creerCoureurs() {
    const d = this.donnees;
    const deux = d.mode === "duo";
    const nombre = deux ? 2 : 1;
    const total = nombre + d.rivaux.length;
    const ecarts = this.theme.ecartsRivaux;
    for (let j = 0; j < nombre; j++) {
      this.joueurs.push(this.engager(preferences.joueurs[j], true, j + 1, 1, j, total));
    }
    const rivaux = d.rivaux.map((numero, k) => this.engager(
      numero, false, 0, (d.niveau + ecarts[k % ecarts.length]) * this.aides.rivaux, nombre + k, total));
    this.coureurs = [...this.joueurs, ...rivaux];
    for (const c of this.coureurs) {
      this.vues.push(this.decor.vue(c, deux && c.humain));
    }
    ordreDeCourse(this.coureurs).forEach((c, i) => {
      c.place = i + 1;                     // sur la grille, déjà : la première ligne devant
    });
    if (this.enChrono) {
      this.ombre = this.decor.fantome();
      this.ombre.objet.setVisible(false);
    }
  }

  // Un véhicule sur la grille de départ : les joueurs devant, deux par rangée
  private engager(numero: number, humain: boolean, joueur: number, niveau: number, place: number, total: number) {
    const ecart = this.conduite.grille.decalage;
    const decalage = total === 1 ? 0 : (place % 2 === 0 ? -ecart : ecart);
    return new Coureur(this, { numero, apparence: apparenceDe(numero), humain, joueur, niveau }, decalage, Math.floor(place / 2));
  }

  // Seul : la caméra principale suit le véhicule. À deux : l'écran coupé en deux moitiés, une caméra
  // par moitié (viewport), chacune suit son joueur. Elles filment la même scène, chacune à sa place.
  private creerCameras() {
    const { largeur, hauteur } = this.circuit.modele;
    const reglage = this.theme.camera;
    const principale = this.cameras.main;
    const cameras = [principale];
    this.zoomDeBase = 1;
    if (this.joueurs.length === 2) {
      this.zoomDeBase = 0.8;               // une moitié d'écran, c'est étroit : on prend un peu de recul
      principale.setViewport(0, 0, LARGEUR / 2 - 2, HAUTEUR);
      cameras.push(this.cameras.add(LARGEUR / 2 + 2, 0, LARGEUR / 2 - 2, HAUTEUR));
    }
    cameras.forEach((camera, j) => {
      const vue = this.vues[j].objet;
      if (reglage.fond) {
        camera.setBackgroundColor(reglage.fond);
      }
      camera.setZoom(this.zoomDeBase).setBounds(0, 0, largeur, hauteur);
      camera.centerOn(vue.x, vue.y);
      camera.startFollow(vue, false, reglage.suivi, reglage.suivi);
      camera.fadeIn(300);
    });
  }

  private creerMoteurs() {
    const moteur = this.theme.moteur;
    if (!moteur) {
      return;
    }
    this.moteurs = this.joueurs.map(() => moteur(this, this.auDoigt, this.joueurs.length));
    // Les sons ne sont pas des objets de la scène : il faut les détruire nous-mêmes quand elle s'arrête
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.moteurs.forEach((m) => m.detruire()));
  }

  private ecouterLesCommandes() {
    const clavier = this.input.keyboard!;
    // Les flèches et l'espace ne doivent pas faire défiler la page
    clavier.addCapture("UP,DOWN,LEFT,RIGHT,SPACE,ENTER");
    this.touches = new TouchesPhysiques(this);
    surChaqueTouche(this, (e) => this.appui(e));

    // La fenêtre perd la main : on met en pause (TouchesPhysiques, lui, lâche toutes les touches)
    const mettreDeCote = () => {
      if (this.enCourse) {
        this.mettreEnPause();
      }
    };
    this.game.events.on(Phaser.Core.Events.BLUR, mettreDeCote);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(Phaser.Core.Events.BLUR, mettreDeCote));

    this.input.gamepad?.on("down", (manette: Phaser.Input.Gamepad.Gamepad, bouton: Phaser.Input.Gamepad.Button) => {
      const joueur = this.joueurs[manette.index];
      if (MANETTE.turbo.includes(bouton.index) && joueur && this.enCourse) {
        joueur.lancerTurbo();
      } else if (bouton.index === MANETTE.pause) {
        this.mettreEnPause();
      }
    });
  }

  // Échap et P se reconnaissent à leur lettre ; le turbo, à la place de la touche
  private appui(e: KeyboardEvent) {
    if (e.repeat) {
      return;
    }
    if (e.code === "Escape") {
      this.quitter();
    } else if (e.key === "p" || e.key === "P") {
      this.mettreEnPause();
    } else if (this.enCourse) {
      const seul = this.joueurs.length === 1;
      if (TURBO_J1.includes(e.code) || (seul && TURBO_SEUL.includes(e.code))) {
        this.joueurs[0].lancerTurbo();
      } else if (!seul && TURBO_SEUL.includes(e.code)) {
        this.joueurs[1].lancerTurbo();
      }
    }
  }

  // Le tableau de bord est prêt : 3, 2, 1, partez ! Une minuterie qui se répète, et un événement
  // à chaque seconde pour le tableau de bord
  tableauPret() {
    const gp = this.donnees.grandPrix;
    if (gp) {
      this.annoncer("Course " + (gp.etape + 1) + " sur " + this.theme.grandPrix.length, this.theme.habillage.couleurs.accent2);
    }
    let reste = 3;
    this.events.emit("compte", reste);
    jouer(this, "bip");
    this.moteurs.forEach((m) => m.demarrer());
    this.time.addEvent({
      delay: 1000,
      repeat: 2,
      callback: () => {
        reste--;
        this.events.emit("compte", reste);
        if (reste > 0) {
          jouer(this, "bip");
        } else {
          this.enCourse = true;
          this.annoncer("Partez !", this.theme.habillage.couleurs.accent);
          jouer(this, "partez");
        }
      },
    });
  }

  // ===== La course =====

  update(_temps: number, delta: number) {
    const horloge = this.time.now / 1000;
    const duree = Math.min(delta / 1000, 0.05);   // après un gros ralentissement, rien ne fait de bond
    if (this.enCourse) {
      for (const c of this.coureurs) {
        if (c.aide) {
          this.lireLesCommandes(c);
        }
        c.conduire(duree);
        c.toucherLesObjets();
        if (c.aFiniUnTour()) {
          this.finirUnTour(c);
        }
      }
      bousculer(this.coureurs, this.conduite);
      ordreDeCourse(this.coureurs).forEach((c, i) => {
        c.place = i + 1;
      });
      this.avancerLeFantome();
    }
    for (const vue of this.vues) {
      vue.actualiser(horloge, this.enCourse ? duree : 0);
    }
    this.decor.apresImage?.();
    this.suivreAvecLesCameras();
  }

  // Les caméras regardent un peu devant leur joueur (et reculent quand il va vite, si le thème le veut)
  private suivreAvecLesCameras() {
    const reglage = this.theme.camera;
    this.cameras.cameras.forEach((camera, j) => {
      const c = this.joueurs[j];
      if (!c) {
        return;
      }
      const x = Phaser.Math.Linear(camera.followOffset.x, -c.vx * reglage.regard, reglage.lissage);
      const y = Phaser.Math.Linear(camera.followOffset.y, -c.vy * reglage.regard, reglage.lissage);
      camera.setFollowOffset(x, y);
      if (reglage.recul > 0) {
        const vite = Math.min(1, Math.hypot(c.vx, c.vy) / this.conduite.turbo.vitesse);
        camera.setZoom(Phaser.Math.Linear(camera.zoom, this.zoomDeBase * (1 - reglage.recul * vite), 0.03));
      }
      this.moteurs[j]?.regler(Math.abs(c.vitesse) / this.conduite.turbo.vitesse);
    });
  }

  // Le clavier, la manette, et les doigts sur les commandes du tableau de bord
  private lireLesCommandes(c: Coureur) {
    const j = c.joueur - 1;
    const touches = COMMANDES[j];
    const t = this.touches;
    const e = c.entrees;
    e.avancer = t.tenue(touches.avancer);
    e.reculer = t.tenue(touches.reculer);
    e.gauche = t.tenue(touches.gauche);
    e.droite = t.tenue(touches.droite);
    const manette = this.input.gamepad?.getPad(j);
    if (manette) {
      e.avancer ||= manette.isButtonDown(MANETTE.avancer) || manette.R2 > 0.2;
      e.reculer ||= manette.isButtonDown(MANETTE.reculer) || manette.L2 > 0.2;
      e.gauche ||= manette.left || manette.leftStick.x < -0.3;
      e.droite ||= manette.right || manette.leftStick.x > 0.3;
    }
    if (j === 0 && this.auDoigt && this.joueurs.length === 1) {
      // Au doigt, le véhicule avance tout seul : on n'a que deux pouces
      e.gauche ||= this.tactile.gauche;
      e.droite ||= this.tactile.droite;
      e.reculer ||= this.tactile.reculer;
      e.avancer = !e.reculer;
    }
  }

  private finirUnTour(c: Coureur) {
    const couleurs = this.theme.habillage.couleurs;
    if (this.enChrono && (this.meilleurTour === null || c.tempsTour < this.meilleurTour)) {
      if (this.meilleurTour !== null) {
        this.nouveauRecord = true;
        this.annoncer("Nouveau record !", couleurs.record);
        jouer(this, "record");
      }
      this.meilleurTour = c.tempsTour;
      this.fantome = c.enregistrement;
      ecrireRecord(this.circuit.modele.id, { temps: this.meilleurTour, fantome: this.fantome });
    }
    if (c.tour === TOURS) {
      this.franchirLArrivee(c);
      return;
    }
    c.tour++;
    c.tempsTour = 0;
    c.enregistrement = [];
    if (c.humain) {
      this.fantomeIndex = 0;
      jouer(this, "tour");
      if (c.tour === TOURS) {
        this.annoncer(this.joueurs.length === 1 ? "Dernier tour !" : c.nom + " : dernier tour !", this.theme.couleur(c.apparence), c);
        musicien.rythme = 1.18;
      }
    }
  }

  private franchirLArrivee(c: Coureur) {
    this.arrivees++;
    c.franchirLArrivee(this.arrivees);
    if (!c.humain) {
      return;
    }
    jouer(this, c.rang === 1 && !this.enChrono ? "victoire" : "tour");
    if (this.joueurs.every((j) => j.fini)) {
      // Tous les joueurs ont fini : la course s'arrête un peu après (les rivaux passent la ligne)
      this.time.delayedCall(this.enChrono ? 600 : 2500, () => this.terminer());
    }
  }

  // Le fantôme rejoue le record : il avance jusqu'au moment du tour où en est le joueur
  private avancerLeFantome() {
    const f = this.fantome;
    if (!this.ombre || f.length === 0) {
      return;
    }
    const t = this.joueurs[0].tempsTour;
    while (this.fantomeIndex < f.length - 1 && f[this.fantomeIndex + 1].t <= t) {
      this.fantomeIndex++;
    }
    this.ombre.objet.setVisible(t < f[f.length - 1].t);
    this.ombre.placer(f[this.fantomeIndex]);
  }

  private terminer() {
    if (this.finie) {
      return;
    }
    this.finie = true;
    this.enCourse = false;
    this.moteurs.forEach((m) => m.arreter());
    const enGrandPrix = this.donnees.mode === "grandprix";
    const resultats = resultatsDeCourse(this.coureurs, TOURS * this.circuit.longueur, enGrandPrix ? POINTS_GRAND_PRIX : []);
    const gp = this.donnees.grandPrix;
    if (gp) {
      for (const r of resultats) {
        gp.points[r.coureur.numero] = (gp.points[r.coureur.numero] ?? 0) + r.points;
      }
    }
    musicien.jouer("menu");
    this.scene.stop("course-tableau");
    this.scene.launch("course-arrivee", { resultats });
    this.scene.pause();                    // la course reste affichée, figée, derrière les résultats
  }

  mettreEnPause() {
    if (this.finie || !this.scene.isActive()) {
      return;
    }
    this.moteurs.forEach((m) => m.arreter());
    this.scene.pause();
    this.scene.pause("course-tableau");
    this.scene.launch("course-pause");
  }

  reprendre() {
    // Pendant la pause, la scène n'entendait plus le clavier : une touche lâchée entre-temps passerait
    // pour encore tenue. On repart d'un clavier neuf (on ne tient que ce qu'on enfonce à nouveau).
    this.touches = new TouchesPhysiques(this);
    this.scene.stop("course-pause");
    this.scene.resume("course-tableau");
    this.scene.resume();
    if (this.enCourse) {
      this.moteurs.forEach((m) => m.demarrer());
    }
  }

  // Revenir au menu (Échap, « Menu », ou après les résultats)
  quitter() {
    for (const autre of ["course-tableau", "course-pause", "course-arrivee"]) {
      this.scene.stop(autre);
    }
    this.scene.start("course-menu");
  }

  rejouer() {
    this.scene.stop("course-arrivee");
    this.scene.restart(this.donnees);
  }

  annoncer(texte: string, couleur: string, coureur?: Coureur) {
    const vue = coureur ? this.joueurs.indexOf(coureur) : -1;
    this.events.emit("annonce", texte, couleur, vue);
  }

  // ===== Ce que les véhicules demandent au monde (voir Monde dans Coureur.ts) =====

  // L'objet disparaît, et une minuterie le fait revenir (en grossissant)
  ramasser(objet: ObjetEnCourse) {
    const image = objet.image as unknown as Phaser.GameObjects.Image;
    image.setVisible(false);
    this.time.delayedCall((objet.type.retour ?? 0) * 1000, () => {
      image.setVisible(true).setScale(0);
      this.tweens.add({ targets: image, scale: 1, duration: 300, ease: "Back.Out" });
    });
  }

  reagir(c: Coureur, evenement: Evenement) {
    this.decor.reagir(c, evenement);
  }
}
