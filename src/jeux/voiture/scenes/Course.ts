// La course : la piste, les voitures, la caméra. Le tableau de bord (compteurs, commandes au doigt)
// est une autre scène, lancée par-dessus : elle ne bouge pas avec la caméra.
// À deux, l'écran est coupé en deux : une caméra par joueur, chacune avec sa moitié d'écran.

import Phaser from "phaser";
import { preparerCircuit, type Circuit, type ModeleDeCircuit } from "../circuits";
import { Voiture, RAYON, type Pilote, type Piste, type Instant } from "../Voiture";
import { texturePiste } from "../textures";
import {
  TOURS, JOUEUR, RIVAUX, JOUEURS_DUO, COMMANDES_SEUL, COMMANDES_DUO, AIDE_MOBILE, RETOUR_BIDON,
  VITESSE_NITRO, SAUVEGARDE, PROFONDEUR, type Commandes,
} from "../reglages";
import { compterLesPoints, type GrandPrix } from "../grandPrix";
import { estTactile } from "../../../socle/tactile";
import { lire, ecrire } from "../../../socle/sauvegarde";
import { surTouche } from "../../../socle/clavier";
import { TouchesPhysiques } from "../../../socle/touchesPhysiques";
import { LARGEUR, HAUTEUR } from "../../../socle/style";

export type Mode = "chrono" | "course" | "duo" | "grandprix";

export interface DonneesDeCourse {
  modele: ModeleDeCircuit;
  mode: Mode;
  niveau: number;                          // le niveau des rivaux
  grandPrix?: GrandPrix;                   // en Grand Prix : où on en est, et les points de chacun
}

export interface RecordDuCircuit {
  temps: number;
  fantome: Instant[];
}

export function lireLeRecord(modele: ModeleDeCircuit): RecordDuCircuit | null {
  return lire<RecordDuCircuit>(SAUVEGARDE + "/" + modele.id);
}

type Son = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

export class Course extends Phaser.Scene implements Piste {
  circuit!: Circuit;
  mode!: Mode;
  voitures: Voiture[] = [];
  joueurs: Voiture[] = [];                 // celles qu'on conduit : une, ou deux à deux
  joueur!: Voiture;                        // la première
  classement: Voiture[] = [];
  record: RecordDuCircuit | null = null;
  grandPrix?: GrandPrix;
  enCourse = false;                        // faux pendant le compte à rebours et après l'arrivée

  // Les doigts sur les commandes : le tableau de bord les met à jour
  tactile = { gauche: false, droite: false, reculer: false, nitro: false };

  private niveau = 1;
  private auDoigt = false;
  private fantome?: Phaser.GameObjects.Image;
  private fantomeIndex = 0;
  private sol!: Phaser.GameObjects.RenderTexture;
  private solAMettreAJour = false;
  private fumee!: Phaser.GameObjects.Particles.ParticleEmitter;
  private etincelles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private touches!: TouchesPhysiques;
  private commandes: Commandes[] = [];     // les touches de chaque joueur
  private camerasDesJoueurs: Phaser.Cameras.Scene2D.Camera[] = [];
  private zoomDeBase = 1;
  private moteurs: Son[] = [];             // un moteur par joueur : chacun entend le sien monter dans les aigus

  constructor() {
    // Cette scène a besoin de la physique Arcade : on la demande dans sa configuration
    super({ key: "voiture-course", physics: { default: "arcade", arcade: { debug: false } } });
  }

  // init reçoit ce que le menu a passé à this.scene.start("voiture-course", donnees)
  init(donnees: DonneesDeCourse) {
    this.circuit = preparerCircuit(donnees.modele);
    this.mode = donnees.mode;
    this.niveau = donnees.niveau;
    this.grandPrix = donnees.grandPrix;
    this.record = lireLeRecord(donnees.modele);
    this.voitures = [];
    this.joueurs = [];
    this.fantome = undefined;
    this.enCourse = false;
    this.fantomeIndex = 0;
    this.auDoigt = estTactile();
    this.tactile = { gauche: false, droite: false, reculer: false, nitro: false };
  }

  create() {
    const { largeur, hauteur } = this.circuit.modele;

    this.add.image(0, 0, texturePiste(this, this.circuit)).setOrigin(0).setDepth(PROFONDEUR.piste);
    // Les marques de pneus : une RenderTexture, une image sur laquelle on peut dessiner pendant le jeu
    this.sol = this.add.renderTexture(0, 0, largeur, hauteur).setOrigin(0).setDepth(PROFONDEUR.traces);

    this.creerEffets();
    this.creerVoitures();
    this.creerObjets();

    // Le monde a des bords : les voitures s'y arrêtent, la caméra n'en sort pas
    this.physics.world.setBounds(0, 0, largeur, hauteur);
    // Les voitures se bousculent. La physique détecte qu'elles se touchent (overlap), et c'est nous
    // qui décidons de la réaction : un collider les ferait rebondir comme des boules de billard.
    // Un Group les réunit : un groupe contre lui-même, chaque paire n'est testée qu'une fois.
    const peloton = this.add.group(this.voitures);
    this.physics.add.overlap(peloton, peloton, (a, b) => this.bousculer(a as Voiture, b as Voiture));

    this.placerLesCameras();

    // Les touches se lisent par leur place sur le clavier : à deux, Z Q S D sur un AZERTY,
    // W A S D sur un QWERTY, c'est la même main gauche au même endroit
    this.touches = new TouchesPhysiques(this);
    this.commandes = this.joueurs.length === 2 ? COMMANDES_DUO : [COMMANDES_SEUL];
    // Les flèches et Espace ne doivent pas faire défiler la page
    this.input.keyboard!.addCapture("UP,DOWN,LEFT,RIGHT,SPACE");
    surTouche(this, "ESC", () => this.quitter());

    this.moteurs = this.joueurs.map(() => this.sound.add(this.auDoigt ? "voiture-moteur-mobile" : "voiture-moteur", {
      loop: true,
      volume: this.auDoigt ? 0.6 : 0.25 / this.joueurs.length,
    }) as Son);
    // Le son n'est pas un objet de la scène : il faut le détruire nous-mêmes quand elle s'arrête
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.moteurs.forEach((moteur) => moteur.destroy()));

    this.scene.launch("voiture-tableau");
    this.compterJusquAuDepart();
  }

  // Seul : la caméra principale suit la voiture. À deux : l'écran coupé en deux moitiés, une caméra
  // par moitié (setViewport), chacune suit son joueur. Elles filment la même scène, chacune à sa place.
  private placerLesCameras() {
    const { largeur, hauteur } = this.circuit.modele;
    const principale = this.cameras.main;
    if (this.joueurs.length === 2) {
      principale.setViewport(0, 0, LARGEUR / 2, HAUTEUR);
      this.camerasDesJoueurs = [principale, this.cameras.add(LARGEUR / 2, 0, LARGEUR / 2, HAUTEUR)];
      this.zoomDeBase = 0.8;               // une moitié d'écran, c'est étroit : on prend un peu de recul
    } else {
      this.camerasDesJoueurs = [principale];
      this.zoomDeBase = 1;
    }
    this.camerasDesJoueurs.forEach((camera, i) => {
      camera.setBounds(0, 0, largeur, hauteur);
      camera.setZoom(this.zoomDeBase);
      camera.startFollow(this.joueurs[i], true, 0.12, 0.12);   // elle suit la voiture, avec un peu de retard
      camera.fadeIn(300);
    });
  }

  private creerEffets() {
    this.fumee = this.add.particles(0, 0, "etincelle", {
      emitting: false,
      lifespan: 600,
      speed: { min: 5, max: 30 },
      scale: { start: 1.2, end: 2.5 },
      alpha: { start: 0.35, end: 0 },
      tint: 0xdddddd,
    }).setDepth(PROFONDEUR.fumee);
    this.etincelles = this.add.particles(0, 0, "etincelle", {
      emitting: false,
      lifespan: 500,
      speed: { min: 80, max: 200 },
      scale: { start: 1, end: 0 },
    }).setDepth(PROFONDEUR.gerbes);
  }

  private creerVoitures() {
    const pilotes: Pilote[] = this.mode === "duo"
      ? JOUEURS_DUO.map((j) => ({ ...j, niveau: 1, joueur: true }))
      : [{ ...JOUEUR, niveau: 1, joueur: true }];
    if (this.mode === "course" || this.mode === "grandprix") {
      const niveau = this.auDoigt ? this.niveau * AIDE_MOBILE.rivaux : this.niveau;
      for (const rival of RIVAUX) {
        pilotes.push({ ...rival, niveau, joueur: false });
      }
    }
    // La grille de départ : deux voitures par rangée, à gauche puis à droite
    pilotes.forEach((pilote, i) => {
      const decalage = pilotes.length > 1 ? 35 * (2 * (i % 2) - 1) : 0;
      this.voitures.push(new Voiture(this, this, pilote, decalage, Math.floor(i / 2)));
    });
    this.joueurs = this.voitures.filter((v) => v.joueur);
    this.joueur = this.joueurs[0];
    this.joueur.aidee = this.auDoigt && this.joueurs.length === 1;
    this.classement = this.voitures.slice();

    if (this.mode === "chrono" && this.record) {
      this.fantome = this.add.image(0, 0, this.joueur.texture.key)
        .setTint(0xffffff).setTintMode(Phaser.TintModes.FILL).setAlpha(0.4).setVisible(false).setDepth(PROFONDEUR.fantome);
    }
  }

  // Les objets de la route ont un corps immobile (static) : la physique nous prévient quand
  // une voiture passe dessus (overlap), sans la bloquer comme le ferait un mur (collider).
  private creerObjets() {
    const c = this.circuit;
    const objets = (liste: typeof c.bidons, texture: string, rayon: number) => {
      const groupe = this.physics.add.staticGroup();
      for (const e of liste) {
        const objet = groupe.create(e.x, e.y, texture) as Phaser.Physics.Arcade.Image;
        objet.setRotation(e.angle).setDepth(PROFONDEUR.objets);
        // Un corps rond, centré sur l'image (le décalage se compte depuis son coin)
        objet.body!.setCircle(rayon, objet.width / 2 - rayon, objet.height / 2 - rayon);
      }
      return groupe;
    };

    const huiles = objets(c.huiles, "voiture-huile", 17);
    const fleches = objets(c.fleches, "voiture-fleche", 30);
    const bidons = objets(c.bidons, "voiture-bidon", 20);

    this.physics.add.overlap(this.voitures, huiles, (voiture) => {
      const v = voiture as Voiture;
      if (this.enCourse && v.glisser()) {
        this.gerbe(v.x, v.y, 0x16141a);
      }
    });
    this.physics.add.overlap(this.voitures, fleches, (voiture) => {
      if (this.enCourse) {
        (voiture as Voiture).prendreUneFleche();
      }
    });
    this.physics.add.overlap(this.voitures, bidons, (voiture, objet) => {
      const v = voiture as Voiture;
      const bidon = objet as Phaser.Physics.Arcade.Image;
      v.ramasserUnBidon();
      this.gerbe(bidon.x, bidon.y, 0xffd23f);
      if (v.joueur) {
        this.sound.play("voiture-bip", { rate: 2.5 });
      }
      // Le bidon disparaît (plus d'image, plus de corps), et une minuterie le fait revenir
      bidon.disableBody(false, true);
      this.time.delayedCall(RETOUR_BIDON * 1000, () => bidon.enableBody(false, 0, 0, true, true));
    });
  }

  // 3, 2, 1, partez ! Une minuterie qui se répète, et un événement à chaque seconde pour le tableau de bord
  private compterJusquAuDepart() {
    let reste = 3;
    this.events.emit("compte", reste);
    this.sound.play("voiture-bip");
    this.moteurs.forEach((moteur) => moteur.play());
    this.time.addEvent({
      delay: 1000,
      repeat: 2,                           // 1 fois + 2 répétitions : 2, 1, 0
      callback: () => {
        reste--;
        this.events.emit("compte", reste);
        this.sound.play("voiture-bip", { rate: reste > 0 ? 1 : 2 });
        if (reste === 0) {
          this.enCourse = true;
        }
      },
    });
  }

  update(_temps: number, delta: number) {
    if (!this.enCourse) {
      return;
    }
    const duree = Math.min(delta / 1000, 0.05);   // après un gros ralentissement, rien ne fait de bond

    for (const voiture of this.voitures) {
      if (!voiture.ordinateur) {
        this.lireLesEntrees(voiture, this.joueurs.indexOf(voiture));
      }
      voiture.conduire(duree);
      if (voiture.aFiniUnTour()) {
        this.finirUnTour(voiture);
      }
      if (!this.enCourse) {
        return;                            // l'arrivée vient d'être franchie
      }
    }
    this.classer();
    this.avancerLeFantome();

    if (this.solAMettreAJour) {
      this.sol.render();                   // dessine d'un coup toutes les marques de cette image
      this.solAMettreAJour = false;
    }

    this.joueurs.forEach((joueur, i) => {
      // Le moteur monte dans les aigus avec la vitesse
      this.moteurs[i].setRate(0.6 + Math.abs(joueur.vitesse) / VITESSE_NITRO * 1.6);

      // La caméra regarde un peu devant la voiture, et recule quand elle va vite
      const camera = this.camerasDesJoueurs[i];
      const v = joueur.body.velocity;
      camera.followOffset.x = Phaser.Math.Linear(camera.followOffset.x, -v.x * 0.25, 0.05);
      camera.followOffset.y = Phaser.Math.Linear(camera.followOffset.y, -v.y * 0.25, 0.05);
      const zoom = this.zoomDeBase * (1 - 0.15 * Math.min(1, v.length() / VITESSE_NITRO));
      camera.setZoom(Phaser.Math.Linear(camera.zoom, zoom, 0.03));
    });
  }

  // Le clavier, la manette, et les doigts sur les commandes du tableau de bord.
  // n : le numéro du joueur. À deux, chacun ses touches et sa manette (la première, la deuxième).
  private lireLesEntrees(voiture: Voiture, n: number) {
    const c = this.commandes[n];
    const t = this.touches;
    const manette = n === 0 ? this.input.gamepad?.pad1 : this.input.gamepad?.pad2;
    const e = voiture.entrees;
    e.avancer = t.tenue(c.avancer);
    e.reculer = t.tenue(c.reculer);
    e.gauche = t.tenue(c.gauche);
    e.droite = t.tenue(c.droite);
    e.nitro = t.tenue(c.nitro);
    if (manette) {
      // A ou la gâchette droite : accélérer. B ou la gâchette gauche : freiner. X : la nitro.
      e.avancer ||= manette.A || manette.R2 > 0.2;
      e.reculer ||= manette.B || manette.L2 > 0.2;
      e.gauche ||= manette.left || manette.leftStick.x < -0.3;
      e.droite ||= manette.right || manette.leftStick.x > 0.3;
      e.nitro ||= manette.X || manette.R1 > 0;
    }
    if (this.auDoigt && this.joueurs.length === 1) {
      // Au doigt, la voiture accélère toute seule tant qu'on ne freine pas
      e.gauche ||= this.tactile.gauche;
      e.droite ||= this.tactile.droite;
      e.reculer ||= this.tactile.reculer;
      e.nitro ||= this.tactile.nitro;
      e.avancer = !e.reculer;
    }
  }

  private finirUnTour(voiture: Voiture) {
    if (voiture.joueur) {
      this.sound.play("voiture-bip", { rate: 1.5 });
    }
    if (this.mode === "chrono" && voiture.joueur && (!this.record || voiture.tempsTour < this.record.temps)) {
      this.record = { temps: voiture.tempsTour, fantome: voiture.enregistrement };
      ecrire(SAUVEGARDE + "/" + this.circuit.modele.id, this.record);
      this.events.emit("record", this.record.temps);
    }
    if (voiture.tour === TOURS) {
      voiture.franchirLArrivee(this.voitures.filter((v) => v.fini).length + 1);
      // La course s'arrête quand tous les joueurs sont arrivés. À deux, le premier arrivé fait
      // un tour d'honneur (l'ordinateur le conduit) en attendant l'autre.
      if (this.joueurs.every((j) => j.fini)) {
        this.arrivee();
      }
      return;
    }
    voiture.tour++;
    voiture.tempsTour = 0;
    voiture.enregistrement = [];
    if (voiture.joueur) {
      this.fantomeIndex = 0;
    }
  }

  // Deux voitures l'une dans l'autre : on les écarte, et elles échangent la part de leur vitesse
  // qui les rapproche (celle de derrière ralentit, celle de devant est poussée)
  private bousculer(a: Voiture, b: Voiture) {
    const pa = a.body.center;
    const pb = b.body.center;
    const distance = Phaser.Math.Distance.BetweenPoints(pa, pb);
    if (distance === 0 || distance >= 2 * RAYON) {
      return;
    }
    const ux = (pb.x - pa.x) / distance;   // la direction de a vers b, longue de 1
    const uy = (pb.y - pa.y) / distance;
    const pousse = (2 * RAYON - distance) / 2;
    a.body.position.x -= ux * pousse;
    a.body.position.y -= uy * pousse;
    b.body.position.x += ux * pousse;
    b.body.position.y += uy * pousse;
    const va = a.body.velocity;
    const vb = b.body.velocity;
    const choc = (va.x - vb.x) * ux + (va.y - vb.y) * uy;
    if (choc > 0) {
      va.x -= ux * choc;
      va.y -= uy * choc;
      vb.x += ux * choc;
      vb.y += uy * choc;
    }
  }

  // D'abord les voitures arrivées, dans l'ordre, puis les autres selon le chemin parcouru
  private classer() {
    this.classement.sort((a, b) => {
      if (a.fini && b.fini) {
        return a.place - b.place;
      }
      if (a.fini !== b.fini) {
        return a.fini ? -1 : 1;
      }
      return b.progres - a.progres;
    });
  }

  // Le fantôme rejoue le record : il avance jusqu'au moment du tour où en est le joueur
  private avancerLeFantome() {
    if (!this.fantome || !this.record) {
      return;
    }
    const f = this.record.fantome;
    const t = this.joueur.tempsTour;
    while (this.fantomeIndex < f.length - 1 && f[this.fantomeIndex + 1].t <= t) {
      this.fantomeIndex++;
    }
    const instant = f[this.fantomeIndex];
    this.fantome.setVisible(t < f[f.length - 1].t).setPosition(instant.x, instant.y).setRotation(instant.angle);
  }

  private arrivee() {
    this.enCourse = false;
    this.moteurs.forEach((moteur) => moteur.stop());
    this.classer();
    this.physics.pause();
    this.scene.launch("voiture-arrivee");
  }

  // Après l'écran d'arrivée : le menu, ou en Grand Prix le classement avec les points de cette course
  apresLArrivee() {
    if (this.mode !== "grandprix" || !this.grandPrix) {
      this.quitter();
      return;
    }
    const grandPrix = compterLesPoints(this.grandPrix, this.classement.map((v) => v.nom));
    this.scene.stop("voiture-tableau");
    this.scene.stop("voiture-arrivee");
    this.scene.start("voiture-grandprix", grandPrix);
  }

  quitter() {
    this.scene.stop("voiture-tableau");
    this.scene.stop("voiture-arrivee");
    this.scene.start("voiture-menu");
  }

  // ===== Ce que les voitures demandent à la piste =====

  marquerLeSol(x: number, y: number) {
    this.sol.stamp("voiture-pneu", undefined, x, y, { alpha: 0.35 });
    this.solAMettreAJour = true;
  }

  fumer(x: number, y: number) {
    this.fumee.emitParticleAt(x, y);
  }

  gerbe(x: number, y: number, couleur: number) {
    this.etincelles.particleTint = couleur;
    this.etincelles.explode(12, x, y);
  }
}
