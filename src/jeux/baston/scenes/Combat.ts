// Le combat : l'arène, les deux robots, les coups, les manches, et le « jus ».
// Le tableau de bord (vies, jauges, annonces, commandes au doigt) est une autre scène, par-dessus.
//
// Une manche = une vie de cette scène : à la manche suivante, on la redémarre (scene.restart)
// avec le score, et tout repart propre (robots neufs, jauges vides, tirs effacés).

import Phaser from "phaser";
import { Robot } from "../Robot";
import { MODELES } from "../modeles";
import { cerveau } from "../ordi";
import { aucuneCommande, lireManette, manettes, Clavier, type Commandes, type Cote } from "../commandes";
import { compterUnMatch, type DonneesDeCombat } from "../partie";
import { dessinerArene } from "../decor";
import {
  SOL, GRAVITE, DEPART, BLEU, ORANGE, MANCHES_GAGNANTES, DUREE_ANNONCE, DUREE_KO,
  SECOUSSE, RALENTI, COULEUR_ETINCELLES, BOITES, AIDE_MOBILE, PROFONDEUR,
} from "../reglages";
import { HAUTEUR, POLICE } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { estTactile } from "../../../socle/tactile";
import { fonduPuis } from "../../../socle/retour";
import { elargir } from "../../../socle/largeur";

// « debut » : on annonce la manche, personne ne bouge. « ko » : on peut encore bouger, plus se battre.
// « fini » : le match est joué, tout s'arrête.
export type Phase = "debut" | "combat" | "ko" | "fini";

// Qui joue un robot : une fonction qui fabrique ses commandes à chaque image
type Pilote = (duree: number) => Commandes;

export class Combat extends Phaser.Scene {
  solo = false;
  phase: Phase = "debut";
  manches: Record<Cote, number> = { gauche: 0, droite: 0 };
  modeles: Record<Cote, number> = { gauche: 0, droite: 0 };
  gauche!: Robot;
  droite!: Robot;
  pilotes = {} as Record<Cote, Pilote>;
  derniersOrdres: Record<Cote, Commandes> = { gauche: aucuneCommande(), droite: aucuneCommande() };
  // Les doigts sur les commandes du tableau de bord : celles qu'ils tiennent, et celles qu'ils ont
  // touchées depuis la dernière image (une tape très brève, posée et levée entre deux images, compte aussi)
  tactile: Commandes = aucuneCommande();
  appuis = new Set<keyof Commandes>();

  private auDoigt = false;
  private enPartance = false;              // on quitte déjà la scène (un double appui ne la quitte pas deux fois)
  private vitesse = 1;                     // 1 : normal ; moins : ralenti
  private ralenti = 0;                     // millisecondes (vraies) de ralenti qui restent
  private clavier!: Clavier;
  private etincelles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private boites?: Phaser.GameObjects.Graphics;
  private etiquettes: Phaser.GameObjects.Text[] = [];

  constructor() {
    // La physique Arcade, avec la gravité des robots. useTree: false, car avec si peu de corps,
    // les parcourir tous est plus simple et toujours à jour.
    super({
      key: "baston-combat",
      physics: { default: "arcade", arcade: { gravity: { x: 0, y: GRAVITE }, useTree: false } },
    });
  }

  init(donnees: DonneesDeCombat) {
    this.solo = donnees.solo;
    this.modeles = { ...donnees.modeles };
    this.manches = { ...donnees.manches };
    this.phase = "debut";
    this.enPartance = false;
    this.vitesse = 1;
    this.ralenti = 0;
    this.auDoigt = estTactile();
    this.tactile = aucuneCommande();
    this.appuis.clear();
    this.derniersOrdres = { gauche: aucuneCommande(), droite: aucuneCommande() };
    this.etiquettes = [];
    this.boites = undefined;
  }

  create() {
    // Au doigt, l'arène prend toute la largeur du téléphone. Elle la garde jusqu'à la fin de la manche
    // (on ne déplace pas les bords d'un combat en cours) : un téléphone qu'on tourne, ou le plein écran,
    // comptent à la manche suivante.
    elargir(this);
    const largeur = this.scale.width;
    const milieu = largeur / 2;
    dessinerArene(this);
    // Le monde de la physique, les minuteries et les tweens survivent à scene.restart : on remet
    // leur temps à la normale (le ralenti du K.O. d'avant) et on relance la physique (arrêtée à la fin d'un match)
    this.physics.world.timeScale = 1;
    this.physics.resume();
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    // Le monde s'arrête au sol : les robots tombent dessus, et ne sortent pas par les côtés
    this.physics.world.setBounds(0, 0, largeur, SOL);
    this.cameras.main.setBounds(0, 0, largeur, HAUTEUR).fadeIn(250);

    // Le même écart entre eux, quelle que soit la largeur : de part et d'autre du milieu
    this.gauche = new Robot(this, milieu - DEPART, "bleu", BLEU, MODELES[this.modeles.gauche]);
    this.droite = new Robot(this, milieu + DEPART, "orange", ORANGE, MODELES[this.modeles.droite]);
    this.gauche.regarder(this.droite);
    this.droite.regarder(this.gauche);
    for (const robot of [this.gauche, this.droite]) {
      robot.on("special", () => this.cameras.main.flash(150, 255, 240, 200));
    }

    // Les étincelles des coups : un émetteur qui attend, et qu'on fait exploser à chaque coup
    this.etincelles = this.add.particles(0, 0, "etincelle", {
      emitting: false,
      lifespan: { min: 250, max: 500 },
      speedX: { min: -360, max: 360 },
      speedY: { min: -480, max: -120 },
      gravityY: 1800,                      // elles retombent, comme les robots
      scale: { start: 0.8, end: 0.2 },
      tint: COULEUR_ETINCELLES,
    }).setDepth(PROFONDEUR.etincelles);

    this.preparerLesPilotes();
    surTouche(this, "ESC", () => this.quitter());
    // Le bouton Start d'une manette (le 9 d'une manette « standard ») : on quitte aussi
    this.input.gamepad?.on("down", (_manette: Phaser.Input.Gamepad.Gamepad, bouton: Phaser.Input.Gamepad.Button) => {
      if (bouton.index === 9) {
        this.quitter();
      }
    });

    if (BOITES) {
      this.boites = this.add.graphics().setDepth(PROFONDEUR.boites);
    }

    // Le tableau de bord par-dessus (ou redémarré, s'il était déjà là : une nouvelle manche)
    this.scene.launch("baston-tableau");
    this.events.emit("phase", "debut");
    this.time.delayedCall(DUREE_ANNONCE, () => this.changerDePhase("combat"));
  }

  // Le bleu : le clavier (ses touches, et les flèches aussi quand on est seul) et la première manette.
  // L'orange : ses touches et la deuxième manette, ou le cerveau de l'ordinateur.
  private preparerLesPilotes() {
    this.clavier = new Clavier(this);
    this.pilotes.gauche = () => {
      const commandes = this.clavier.lire("gauche");
      if (this.solo) {
        this.clavier.lire("droite", commandes);
      }
      lireManette(manettes(this)[0], commandes);
      if (this.auDoigt) {
        for (const nom of Object.keys(commandes) as (keyof Commandes)[]) {
          commandes[nom] ||= this.tactile[nom] || this.appuis.has(nom);
        }
      }
      return commandes;
    };
    if (this.solo) {
      const aide = this.auDoigt ? AIDE_MOBILE.frappe : 1;
      this.pilotes.droite = (duree) => cerveau(this.droite, this.gauche, duree, aide);
    } else {
      this.pilotes.droite = () => lireManette(manettes(this)[1], this.clavier.lire("droite"));
    }
  }

  update(_temps: number, delta: number) {
    // Le ralenti se compte en vraies millisecondes
    if (this.ralenti > 0) {
      this.ralenti -= delta;
      if (this.ralenti <= 0) {
        this.changerDeVitesse(1);
        this.cameras.main.zoomTo(1, 400, Phaser.Math.Easing.Sine.InOut);
        this.cameras.main.pan(this.scale.width / 2, HAUTEUR / 2, 400, Phaser.Math.Easing.Sine.InOut);
      }
    }
    // Les secondes de jeu de cette image : moins qu'en vrai pendant le ralenti, et jamais de grand bond
    const duree = Math.min(delta / 1000, 0.05) * this.vitesse;

    // Les commandes de chacun, lues à chaque image (le tableau de bord les montre, même pendant l'annonce)
    for (const cote of ["gauche", "droite"] as Cote[]) {
      this.derniersOrdres[cote] = this.pilotes[cote](duree);
    }
    this.appuis.clear();
    this.clavier.oublierLesAppuis();

    if (this.phase === "combat" || this.phase === "ko") {
      this.bougerLesRobots(duree);
    }
    if (this.phase === "combat") {
      this.echangerLesCoups();
    }
    this.dessinerLesBoites();
  }

  private bougerLesRobots(duree: number) {
    this.gauche.mettreAJour(this.derniersOrdres.gauche, duree);
    this.droite.mettreAJour(this.derniersOrdres.droite, duree);
    this.gauche.regarder(this.droite);     // chacun se tourne vers l'autre
    this.droite.regarder(this.gauche);
  }

  // D'abord les coups de cette image, puis ce qu'ils font : s'ils frappent ensemble, les deux touchent
  private echangerLesCoups() {
    const poingGauche = this.gauche.poing();
    const poingDroite = this.droite.poing();
    this.echanger(this.gauche, this.droite, poingGauche);
    this.echanger(this.droite, this.gauche, poingDroite);

    if (this.gauche.etat === "ko" || this.droite.etat === "ko") {
      // Le robot encore debout gagne la manche ; s'ils tombent ensemble, personne
      if (this.gauche.etat !== "ko") this.manches.gauche++;
      if (this.droite.etat !== "ko") this.manches.droite++;
      this.changerDePhase("ko");
      // Une minuterie de la scène : elle suit le temps du jeu, le ralenti l'allonge
      this.time.delayedCall(DUREE_KO, () => this.finirLaManche());
    }
  }

  // L'attaquant essaie de toucher la cible ; si elle a perdu de la vie, on fait du spectacle
  private echanger(attaquant: Robot, cible: Robot, poing: Phaser.Geom.Rectangle | null) {
    const avant = cible.vie;
    attaquant.toucher(cible, poing);
    const degats = avant - cible.vie;
    if (degats <= 0) {
      return;
    }
    // Plus le coup fait mal, plus l'écran tremble longtemps (un tour de 1/60 s par point de dégât)
    this.cameras.main.shake(degats * 1000 / 60, SECOUSSE / this.scale.width);
    this.sound.play("baston-coup");
    this.etincelles.explode(degats * 2, cible.centreX, cible.body.y + 30);
    if (cible.etat === "ko") {
      this.sound.play("baston-ko");
      this.ralentir(cible);
    }
    this.events.emit("coup", cible, degats);
  }

  // Le K.O., au ralenti : la physique, les minuteries, les tweens, les animations et les particules
  // ont chacun leur échelle de temps. La caméra s'approche du robot qui tombe.
  private ralentir(cible: Robot) {
    this.ralenti = RALENTI.duree;
    this.changerDeVitesse(RALENTI.vitesse);
    const camera = this.cameras.main;
    camera.flash(250, 255, 255, 255);
    // Les effets de caméra ne connaissent pas les noms d'ease des tweens (« Sine.Out ») : on leur
    // donne directement la fonction, sinon ils plantent
    camera.zoomTo(1.3, 300, Phaser.Math.Easing.Sine.Out);
    camera.pan(cible.centreX, cible.body.y, 300, Phaser.Math.Easing.Sine.Out);
  }

  private changerDeVitesse(vitesse: number) {
    this.vitesse = vitesse;
    this.physics.world.timeScale = 1 / vitesse;   // attention : pour la physique, plus grand = plus lent
    this.time.timeScale = vitesse;
    this.tweens.timeScale = vitesse;
    this.etincelles.timeScale = vitesse;
    this.gauche.anims.timeScale = vitesse;
    this.droite.anims.timeScale = vitesse;
  }

  private changerDePhase(phase: Phase) {
    this.phase = phase;
    this.events.emit("phase", phase);
  }

  private finirLaManche() {
    if (this.manches.gauche >= MANCHES_GAGNANTES || this.manches.droite >= MANCHES_GAGNANTES) {
      // Le match est fini : tout s'arrête derrière l'écran de fin
      this.changerDePhase("fini");
      this.physics.pause();
      if (this.solo) {
        compterUnMatch(this.manches.gauche >= MANCHES_GAGNANTES);
      }
      this.scene.launch("baston-fin");
      return;
    }
    // Une nouvelle manche : la même scène, redémarrée avec le score
    if (this.enPartance) {
      return;                              // on a quitté pendant le K.O.
    }
    this.enPartance = true;
    const donnees: DonneesDeCombat = { solo: this.solo, modeles: this.modeles, manches: this.manches };
    fonduPuis(this, () => this.scene.restart(donnees));
  }

  // Revanche : les mêmes robots, un nouveau match
  revanche() {
    if (this.enPartance) {
      return;
    }
    this.enPartance = true;
    this.scene.stop("baston-fin");
    const donnees: DonneesDeCombat = { solo: this.solo, modeles: this.modeles, manches: { gauche: 0, droite: 0 } };
    fonduPuis(this, () => this.scene.restart(donnees));
  }

  // Quitter vers une autre scène du jeu (le titre, ou le choix des robots)
  quitter(vers: "baston-titre" | "baston-choix" = "baston-titre") {
    if (this.enPartance) {
      return;
    }
    this.enPartance = true;
    fonduPuis(this, () => {
      this.scene.stop("baston-tableau");
      this.scene.stop("baston-fin");
      this.scene.start(vers, { solo: this.solo });
    });
  }

  // Pour régler le jeu (BOITES dans reglages.ts) : les hurtbox en vert, les hitbox en rouge, les états
  private dessinerLesBoites() {
    if (!this.boites) {
      return;
    }
    const g = this.boites.clear();
    this.etiquettes.forEach((texte) => texte.destroy());
    this.etiquettes = [];
    for (const robot of [this.gauche, this.droite]) {
      const corps = robot.hurtbox();
      g.lineStyle(2, 0x50e678).strokeRectShape(corps);
      const poing = robot.poing();
      if (poing) {
        g.lineStyle(2, 0xf03c3c).strokeRectShape(poing);
      }
      this.etiquettes.push(this.add.text(corps.centerX, corps.y - 6, robot.etat, {
        fontFamily: POLICE, fontSize: "14px", color: "#ffffff",
      }).setOrigin(0.5, 1).setDepth(PROFONDEUR.boites));
    }
  }
}
