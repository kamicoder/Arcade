// La course : le décor, les objets, les licornes, les caméras (une, ou deux en écran partagé).
// Le tableau de bord (compteurs, carte, messages, commandes au doigt) est une autre scène, lancée
// par-dessus : elle ne bouge pas avec les caméras.

import Phaser from "phaser";
import { preparerCircuit, type Circuit } from "../circuits";
import {
  Coureuse, bousculer, ordreDeCourse, resultatsDeCourse, type Monde, type Ramassable, type Instant,
} from "../Coureuse";
import { LicorneVue } from "../LicorneVue";
import { texturePiste, textureDeLicorne, imageDuGalop } from "../textures";
import { ECARTS_RIVALES, GRAND_PRIX, POINTS_GP, LOOK_FANTOME } from "../donnees";
import {
  TOURS, RETOUR_ETOILE, RETOUR_BONBON, TAILLE_LICORNE, PROFONDEUR, NIVEAUX, aidesDuNiveau, type Niveau,
} from "../reglages";
import { preferences, lookDe, lireRecord, ecrireRecord, circuitParId } from "../sauvegarde";
import { sons, musicien } from "../sons";
import { surChaqueTouche } from "../clavier";
import { TouchesPhysiques } from "../../../socle/touchesPhysiques";
import { estTactile } from "../../../socle/tactile";
import { LARGEUR, HAUTEUR } from "../../../socle/style";

export type Mode = "gp" | "duo" | "chrono";

export interface GrandPrix {
  etape: number;                           // la course en cours, de 0 à 4
  rivales: number[];
  points: Record<number, number>;          // pour chaque licorne (son numéro), ses points
}

export interface DonneesDeCourse {
  mode: Mode;
  circuitId: string;
  rivales: number[];                       // les numéros des licornes de l'ordinateur
  niveau: number;                          // leur vitesse, avant le niveau choisi au menu
  grandPrix?: GrandPrix;
}

// Les touches de chaque joueuse : les codes du clavier physique (KeyW est le Z d'un clavier français),
// comme dans l'ancien jeu, pour que ZQSD tombe sous les doigts quel que soit le clavier
const COMMANDES = [
  { avancer: "ArrowUp", reculer: "ArrowDown", gauche: "ArrowLeft", droite: "ArrowRight" },
  { avancer: "KeyW", reculer: "KeyS", gauche: "KeyA", droite: "KeyD" },
];
const TURBO_J1 = ["Enter", "NumpadEnter", "ShiftRight", "ControlRight"];
const TURBO_SEULE = ["Space", "ShiftLeft"];           // le turbo de J1 quand elle est seule, celui de J2 sinon

// Une manette « standard » : A galoper, B freiner, X ou RB le turbo, Start la pause
const MANETTE = { avancer: 0, reculer: 1, turbo: [2, 5], pause: 9 };

export class Course extends Phaser.Scene implements Monde {
  donnees!: DonneesDeCourse;
  circuit!: Circuit;
  aides!: Niveau;
  enChrono = false;
  licornes: Coureuse[] = [];
  joueuses: Coureuse[] = [];
  vues: LicorneVue[] = [];
  etoiles: Ramassable[] = [];
  bonbons: Ramassable[] = [];
  fleches: Phaser.GameObjects.Sprite[] = [];
  orages: Phaser.GameObjects.Container[] = [];

  enCourse = false;                        // faux pendant le compte à rebours, et une fois la course finie
  finie = false;
  arrivees = 0;
  // Le contre-la-montre : le record du circuit et son fantôme
  meilleurTour: number | null = null;
  fantome: Instant[] = [];
  fantomeIndex = 0;
  nouveauRecord = false;
  // Les doigts sur les commandes : le tableau de bord les met à jour
  tactile = { gauche: false, droite: false, reculer: false };

  private auDoigt = false;
  private touches!: TouchesPhysiques;      // les touches tenues, par leur place sur le clavier
  private ombre?: Phaser.GameObjects.Sprite;
  private traine!: Phaser.GameObjects.Particles.ParticleEmitter;
  private traineTurbo!: Phaser.GameObjects.Particles.ParticleEmitter;
  private gerbes!: Phaser.GameObjects.Particles.ParticleEmitter;
  private couleursGerbe = ["#ffffff"];
  private reserves = new Map<Coureuse, number>();

  constructor() {
    super("licorne-course");
  }

  init(donnees: DonneesDeCourse) {
    this.donnees = donnees;
    this.circuit = preparerCircuit(circuitParId(donnees.circuitId));
    this.auDoigt = estTactile();
    this.aides = aidesDuNiveau(NIVEAUX[preferences.niveau], this.auDoigt);
    this.enChrono = donnees.mode === "chrono";
    this.licornes = [];
    this.joueuses = [];
    this.vues = [];
    this.etoiles = [];
    this.bonbons = [];
    this.fleches = [];
    this.orages = [];
    this.enCourse = false;
    this.finie = false;
    this.arrivees = 0;
    this.nouveauRecord = false;
    this.fantomeIndex = 0;
    this.tactile = { gauche: false, droite: false, reculer: false };
    this.reserves.clear();
    this.ombre = undefined;
    const record = this.enChrono ? lireRecord(this.circuit.modele.id) : null;
    this.meilleurTour = record ? record.temps : null;
    this.fantome = record?.fantome ?? [];
  }

  create() {
    const { largeur, hauteur } = this.circuit.modele;
    this.add.image(0, 0, texturePiste(this, this.circuit)).setOrigin(0).setDepth(PROFONDEUR.decor);
    this.creerObjets();
    this.creerParticules();
    this.creerLicornes();
    this.creerCameras(largeur, hauteur);
    this.ecouterLesCommandes();

    musicien.jouer("course");
    this.scene.launch("licorne-tableau");
  }

  // ===== La mise en place =====

  private creerObjets() {
    const c = this.circuit;
    // Les flèches arc-en-ciel : une animation dont les couleurs défilent
    for (const f of c.fleches) {
      this.fleches.push(this.add.sprite(f.x, f.y, "licorne-fleche").setRotation(f.angle).setDepth(PROFONDEUR.fleches)
        .play("licorne-fleche"));
    }
    // Les bonbons flottent et se dandinent ; leur spirale tourne
    for (const b of c.bonbons) {
      const spirale = this.add.image(0, 0, "licorne-spirale");
      const bonbon = this.add.container(b.x, b.y, [this.add.image(0, 0, "licorne-bonbon"), spirale]).setDepth(PROFONDEUR.bonbons);
      this.tweens.add({ targets: spirale, angle: 360, duration: 2100, repeat: -1 });
      this.tweens.add({ targets: bonbon, y: b.y - 4, duration: 1050, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      this.tweens.add({
        targets: bonbon, rotation: { from: -0.5, to: 0.5 }, duration: 1570, yoyo: true, repeat: -1, ease: "Sine.InOut",
      });
      this.bonbons.push(bonbon);
    }
    // Les nuages d'orage : leur éclair clignote, et certains se balancent en travers de la route
    for (const o of c.orages) {
      const eclair = this.add.image(0, 0, "licorne-eclair").setOrigin(12 / 26, 17 / 40).setVisible(false);
      const orage = this.add.container(o.x, o.y, [this.add.image(0, 0, "licorne-orage").setOrigin(0.5, 40 / 84), eclair])
        .setDepth(PROFONDEUR.orages);
      this.time.addEvent({
        delay: 900,
        loop: true,
        startAt: (o.phase * 137) % 900,
        callback: () => {
          eclair.setVisible(true);
          this.time.delayedCall(280, () => eclair.setVisible(false));
        },
      });
      if (o.balancement > 0) {
        // Un aller-retour d'un bord à l'autre, en douceur (Sine) : le même balancement que sin(1,6 t)
        orage.setPosition(o.x - o.nx * o.balancement, o.y - o.ny * o.balancement);
        const balancement = this.tweens.add({
          targets: orage,
          x: o.x + o.nx * o.balancement,
          y: o.y + o.ny * o.balancement,
          duration: Math.PI / 1.6 * 1000,
          yoyo: true,
          repeat: -1,
          ease: "Sine.InOut",
        });
        balancement.seek((o.phase * 1000) % 3900);
      }
      this.orages.push(orage);
    }
    // Les étoiles tournent sur elles-mêmes et flottent
    for (const e of c.etoiles) {
      const etoile = this.add.image(e.x, e.y, "licorne-etoile").setDepth(PROFONDEUR.etoiles);
      this.tweens.add({ targets: etoile, angle: 360, duration: 4200, repeat: -1 });
      this.tweens.add({
        targets: etoile, y: e.y + 4, duration: 785, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: (e.x * 7) % 785,
      });
      this.etoiles.push(etoile);
    }
  }

  private creerParticules() {
    // La traînée arc-en-ciel : sa couleur tourne avec le temps. On sème les grains nous-mêmes
    // (emitParticleAt), au rythme de la vitesse de chaque licorne.
    const teinte = () => {
      const t = (this.time.now / 1000 * 220 + Math.random() * 40) % 360;
      return Phaser.Display.Color.HSLToColor(t / 360, 0.95, 0.72).color;
    };
    const traine = (grand: boolean) => this.add.particles(0, 0, "licorne-particules", {
      emitting: false,
      frame: ["rond", "rond", "etoile"],
      lifespan: grand ? 1000 : 600,
      speed: { min: 0, max: 21 },
      scale: grand ? { min: 0.67, max: 1.33 } : { min: 0.4, max: 0.8 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      tint: { onEmit: teinte },
    }).setDepth(PROFONDEUR.traine);
    this.traine = traine(false);
    this.traineTurbo = traine(true);
    // Les gerbes : des étoiles qui jaillissent d'un coup (explode), aux couleurs de l'événement
    let n = 0;
    this.gerbes = this.add.particles(0, 0, "licorne-particules", {
      emitting: false,
      frame: "etoile",
      lifespan: 700,
      speed: { min: 60, max: 200 },
      scale: { min: 0.53, max: 0.93 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      tint: { onEmit: () => Phaser.Display.Color.HexStringToColor(this.couleursGerbe[n++ % this.couleursGerbe.length]).color },
    }).setDepth(PROFONDEUR.traine);
  }

  private creerLicornes() {
    const d = this.donnees;
    const deux = d.mode === "duo";
    const nombre = deux ? 2 : 1;
    const total = nombre + d.rivales.length;
    for (let j = 0; j < nombre; j++) {
      this.joueuses.push(this.engager(preferences.choix[j], true, j + 1, 1, j, total));
    }
    const rivales = d.rivales.map((numero, k) => this.engager(
      numero, false, 0, (d.niveau + ECARTS_RIVALES[k % ECARTS_RIVALES.length]) * this.aides.rivales, nombre + k, total));
    this.licornes = [...this.joueuses, ...rivales];
    for (const l of this.licornes) {
      this.vues.push(new LicorneVue(this, l, deux && l.humaine));
    }
    ordreDeCourse(this.licornes).forEach((l, i) => {
      l.place = i + 1;                     // sur la grille, déjà : la première ligne devant
    });
    if (this.enChrono) {
      this.ombre = this.add.sprite(0, 0, textureDeLicorne(this, LOOK_FANTOME), 0)
        .setAlpha(0.4).setScale(TAILLE_LICORNE / 2).setDepth(PROFONDEUR.fantome).setVisible(false);
    }
  }

  // Une licorne sur la grille de départ : les joueuses devant, deux par rangée
  private engager(numero: number, humaine: boolean, joueur: number, niveau: number, place: number, total: number) {
    const decalage = total === 1 ? 0 : (place % 2 === 0 ? -38 : 38);
    return new Coureuse(this, { numero, look: lookDe(numero), humaine, joueur, niveau }, decalage, Math.floor(place / 2));
  }

  private creerCameras(largeur: number, hauteur: number) {
    const principale = this.cameras.main;
    principale.setBackgroundColor("#e9dcff");
    const cameras = [principale];
    if (this.joueuses.length === 2) {
      // L'écran partagé : deux caméras sur le même monde, chacune sa moitié et sa licorne
      principale.setViewport(0, 0, LARGEUR / 2 - 2, HAUTEUR).setZoom(0.8);
      cameras.push(this.cameras.add(LARGEUR / 2 + 2, 0, LARGEUR / 2 - 2, HAUTEUR).setZoom(0.8).setBackgroundColor("#e9dcff"));
    }
    cameras.forEach((camera, j) => {
      const vue = this.vues[j];
      camera.setBounds(0, 0, largeur, hauteur);
      camera.centerOn(vue.x, vue.y);
      camera.startFollow(vue, false, 0.1, 0.1);
      camera.fadeIn(300);
    });
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
      const joueuse = this.joueuses[manette.index];
      if (MANETTE.turbo.includes(bouton.index) && joueuse && this.enCourse) {
        joueuse.lancerTurbo();
      } else if (bouton.index === MANETTE.pause) {
        this.mettreEnPause();
      }
    });
  }

  private appui(e: KeyboardEvent) {
    if (e.repeat) {
      return;
    }
    if (e.code === "Escape") {
      this.quitter();
    } else if (e.code === "KeyP") {
      this.mettreEnPause();
    } else if (this.enCourse) {
      const seule = this.joueuses.length === 1;
      if (TURBO_J1.includes(e.code) || (seule && TURBO_SEULE.includes(e.code))) {
        this.joueuses[0].lancerTurbo();
      } else if (!seule && TURBO_SEULE.includes(e.code)) {
        this.joueuses[1].lancerTurbo();
      }
    }
  }

  // Le tableau de bord est prêt : 3, 2, 1, partez ! Une minuterie qui se répète, et un événement
  // à chaque seconde pour le tableau de bord
  tableauPret() {
    const gp = this.donnees.grandPrix;
    if (gp) {
      this.annoncer("Course " + (gp.etape + 1) + " sur " + GRAND_PRIX.length, "#b07cff");
    }
    let reste = 3;
    this.events.emit("compte", reste);
    sons.bip();
    this.time.addEvent({
      delay: 1000,
      repeat: 2,
      callback: () => {
        reste--;
        this.events.emit("compte", reste);
        if (reste > 0) {
          sons.bip();
        } else {
          this.enCourse = true;
          this.annoncer("Partez !", "#ff5e9e");
          sons.partez();
        }
      },
    });
  }

  // ===== La course =====

  update(_temps: number, delta: number) {
    const horloge = this.time.now / 1000;
    if (this.enCourse) {
      const duree = Math.min(delta / 1000, 0.05);   // après un gros ralentissement, rien ne fait de bond
      for (const l of this.licornes) {
        if (l.aidee) {
          this.lireLesCommandes(l);
        }
        l.conduire(duree);
        l.toucherLesObjets();
        this.semer(l, duree);
        if (l.aFiniUnTour()) {
          this.finirUnTour(l);
        }
      }
      bousculer(this.licornes);
      ordreDeCourse(this.licornes).forEach((l, i) => {
        l.place = i + 1;
      });
      this.avancerLeFantome();
    }
    for (const vue of this.vues) {
      vue.actualiser(horloge);
    }
    // Les caméras regardent un peu devant leur licorne
    this.cameras.cameras.forEach((camera, j) => {
      const l = this.joueuses[j];
      if (l) {
        camera.setFollowOffset(-l.vx * 0.35, -l.vy * 0.35);
      }
    });
  }

  // Le clavier, la manette, et les doigts sur les commandes du tableau de bord
  private lireLesCommandes(l: Coureuse) {
    const j = l.joueur - 1;
    const touches = COMMANDES[j];
    const t = this.touches;
    const e = l.entrees;
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
    if (j === 0 && this.auDoigt && this.joueuses.length === 1) {
      // Au doigt, la licorne galope toute seule : on n'a que deux pouces
      e.gauche ||= this.tactile.gauche;
      e.droite ||= this.tactile.droite;
      e.reculer ||= this.tactile.reculer;
      e.avancer = !e.reculer;
    }
  }

  // La traînée arc-en-ciel derrière elle : plus elle va vite, plus elle sème
  private semer(l: Coureuse, duree: number) {
    const vite = Math.abs(l.vitesse);
    let debit = 0;
    if (l.turbo > 0) {
      debit = 110;
    } else if (vite > 150) {
      debit = vite / (l.humaine ? 10 : 20);
    }
    if (l.geante > 0) {
      debit += 20;
    }
    let reserve = (this.reserves.get(l) ?? 0) + debit * duree;
    const e = l.echelle();
    const emetteur = l.turbo > 0 ? this.traineTurbo : this.traine;
    while (reserve >= 1) {
      reserve--;
      emetteur.emitParticleAt(
        l.x - Math.cos(l.angle) * 34 * e + (Math.random() - 0.5) * 14 * e,
        l.y - Math.sin(l.angle) * 34 * e + (Math.random() - 0.5) * 14 * e,
      );
    }
    this.reserves.set(l, reserve);
  }

  private finirUnTour(l: Coureuse) {
    if (this.enChrono && (this.meilleurTour === null || l.tempsTour < this.meilleurTour)) {
      if (this.meilleurTour !== null) {
        this.nouveauRecord = true;
        this.annoncer("Nouveau record !", "#ffb300");
        sons.record();
      }
      this.meilleurTour = l.tempsTour;
      this.fantome = l.enregistrement;
      ecrireRecord(this.circuit.modele.id, { temps: this.meilleurTour, fantome: this.fantome });
    }
    if (l.tour === TOURS) {
      this.franchirLArrivee(l);
      return;
    }
    l.tour++;
    l.tempsTour = 0;
    l.enregistrement = [];
    if (l.humaine) {
      this.fantomeIndex = 0;
      sons.tour();
      if (l.tour === TOURS) {
        this.annoncer(this.joueuses.length === 1 ? "Dernier tour !" : l.nom + " : dernier tour !", l.look.criniere[0], l);
        musicien.rythme = 1.18;
      }
    }
  }

  private franchirLArrivee(l: Coureuse) {
    this.arrivees++;
    l.franchirLArrivee(this.arrivees);
    if (!l.humaine) {
      return;
    }
    if (l.rang === 1) {
      sons.victoire();
    } else {
      sons.tour();
    }
    if (this.joueuses.every((j) => j.fini)) {
      // Toutes les joueuses ont fini : la course s'arrête un peu après (les rivales passent la ligne)
      this.time.delayedCall(this.enChrono ? 600 : 2500, () => this.terminer());
    }
  }

  // Le fantôme rejoue le record : il avance jusqu'au moment du tour où en est la joueuse
  private avancerLeFantome() {
    const f = this.fantome;
    if (!this.ombre || f.length === 0) {
      return;
    }
    const t = this.joueuses[0].tempsTour;
    while (this.fantomeIndex < f.length - 1 && f[this.fantomeIndex + 1].t <= t) {
      this.fantomeIndex++;
    }
    const instant = f[this.fantomeIndex];
    this.ombre.setVisible(t < f[f.length - 1].t)
      .setPosition(instant.x, instant.y).setRotation(instant.angle).setFrame(imageDuGalop(instant.t * 20));
  }

  private terminer() {
    if (this.finie) {
      return;
    }
    this.finie = true;
    this.enCourse = false;
    const enGrandPrix = this.donnees.mode === "gp";
    const resultats = resultatsDeCourse(this.licornes, TOURS * this.circuit.longueur, enGrandPrix ? POINTS_GP : []);
    const gp = this.donnees.grandPrix;
    if (gp) {
      for (const r of resultats) {
        gp.points[r.licorne.numero] = (gp.points[r.licorne.numero] ?? 0) + r.points;
      }
    }
    musicien.jouer("menu");
    this.scene.stop("licorne-tableau");
    this.scene.launch("licorne-arrivee", { resultats });
    this.scene.pause();                    // la course reste affichée, figée, derrière les résultats
  }

  mettreEnPause() {
    if (this.finie || !this.scene.isActive()) {
      return;
    }
    this.scene.pause();
    this.scene.pause("licorne-tableau");
    this.scene.launch("licorne-pause");
  }

  reprendre() {
    // Pendant la pause, la scène n'entendait plus le clavier : une touche lâchée entre-temps passerait
    // pour encore tenue. On repart d'un clavier neuf (on ne tient que ce qu'on enfonce à nouveau).
    this.touches = new TouchesPhysiques(this);
    this.scene.stop("licorne-pause");
    this.scene.resume("licorne-tableau");
    this.scene.resume();
  }

  // Revenir au menu (Échap, « Menu », ou après les résultats)
  quitter() {
    for (const autre of ["licorne-tableau", "licorne-pause", "licorne-arrivee"]) {
      this.scene.stop(autre);
    }
    this.scene.start("licorne-menu");
  }

  rejouer() {
    this.scene.stop("licorne-arrivee");
    this.scene.restart(this.donnees);
  }

  annoncer(texte: string, couleur: string, licorne?: Coureuse) {
    const vue = licorne ? this.joueuses.indexOf(licorne) : -1;
    this.events.emit("annonce", texte, couleur, vue);
  }

  gerbe(x: number, y: number, nombre: number, couleurs: string[]) {
    this.couleursGerbe = couleurs;
    this.gerbes.explode(nombre, x, y);
  }

  // ===== Ce que les licornes demandent au monde (voir Monde dans Coureuse.ts) =====

  sabot(_c: Coureuse, aigu: boolean) {
    sons.sabot(aigu);
  }

  pouf(c: Coureuse, x: number, y: number) {
    if (c.humaine) {
      sons.pouf();
    }
    this.gerbe(x, y, 8, ["#ffffff", "#ffd3ec"]);
  }

  repechee(c: Coureuse, avantX: number, avantY: number) {
    this.gerbe(avantX, avantY, 12, ["#ffffff", "#ffd3ec"]);
    this.gerbe(c.x, c.y, 18, ["#ffe066", "#ffffff", "#c47dff"]);
    if (c.humaine) {
      sons.etoile();
      this.annoncer("Hop ! Un petit coup de magie", c.look.criniere[0], c);
    }
  }

  etourdie(c: Coureuse) {
    this.gerbe(c.x, c.y, 10, ["#fff176", "#b39ddb"]);
  }

  etoile(c: Coureuse, etoile: Ramassable) {
    this.ramasser(etoile as Phaser.GameObjects.Image, RETOUR_ETOILE);
    this.gerbe(etoile.x, etoile.y, 14, ["#ffe066", "#ffffff"]);
    if (c.humaine) {
      sons.etoile();
    }
  }

  bonbon(c: Coureuse, bonbon: Ramassable) {
    this.ramasser(bonbon as Phaser.GameObjects.Container, RETOUR_BONBON);
    this.gerbe(bonbon.x, bonbon.y, 18, ["#ff4fa8", "#ffffff", "#ff9fd4"]);
    if (c.humaine) {
      sons.bonbon();
    }
  }

  // L'objet disparaît, et une minuterie le fait revenir (en grossissant)
  private ramasser(objet: Phaser.GameObjects.Image | Phaser.GameObjects.Container, retour: number) {
    objet.setVisible(false);
    this.time.delayedCall(retour * 1000, () => {
      objet.setVisible(true).setScale(0);
      this.tweens.add({ targets: objet, scale: 1, duration: 300, ease: "Back.Out" });
    });
  }

  fleche(c: Coureuse) {
    if (c.humaine) {
      sons.fleche();
    }
  }

  orage(c: Coureuse) {
    if (c.humaine) {
      sons.orage();
    }
  }

  turbo(c: Coureuse) {
    if (c.humaine) {
      sons.turbo();
    }
  }
}
