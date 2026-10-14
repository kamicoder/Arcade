// Le tableau de bord : une scène lancée par-dessus le combat (this.scene.launch).
// Sa caméra ne tremble pas et ne zoome pas avec celle du combat : les barres de vie, les annonces
// et les commandes au doigt restent nettes et à leur place.
// Tout se place d'après la largeur du jeu (this.scale.width) : au doigt, elle dépasse 960.

import Phaser from "phaser";
import type { Combat, Phase } from "./Combat";
import type { Robot } from "../Robot";
import { TOUCHES, manettes, type Cote, type NomDeCommande } from "../commandes";
import { etiquette } from "../../../socle/touchesPhysiques";
import { enCouleur } from "../decor";
import { VIE, JAUGE, SOL, GRIS, JAUNE, MANCHES_GAGNANTES } from "../reglages";
import { HAUTEUR, POLICE } from "../../../socle/style";
import { BoutonsAuDoigt } from "../../../socle/doigts";
import { estTactile } from "../../../socle/tactile";

const BARRE = { largeur: 300, marge: 20 };

// Au doigt, la main gauche : un joystick qui apparaît là où le pouce se pose, n'importe où sur la
// moitié gauche de l'écran, et disparaît quand il se lève. Les distances sont en pixels du jeu
// (sur un téléphone en paysage, un pixel du jeu fait environ 0,7 pixel de l'écran).
const STICK = {
  rayon: 80,                               // jusqu'où le pouce pousse ; plus loin, la base le suit
  pouce: 38,                               // le rond qui suit le pouce
  zoneMorte: 22,                           // le pouce tremble un peu : en dessous, on ne marche pas
  saut: 45,                                // poussé vers le haut de plus que ça : un saut...
  rearmer: 25,                             // ... et un seul : il faut redescendre sous ça pour resauter
};

// La main droite : trois gros boutons dans le coin, placés depuis le bord droit (dx) pour suivre la
// largeur de l'écran. Le coup de poing, le plus gros, juste sous le pouce ; le tir à sa gauche ;
// le coup spécial au-dessus, éteint tant que la jauge n'est pas pleine.
type Bouton = "frapper" | "tirer" | "special";
const BOUTONS: { action: Bouton; dx: number; y: number; rayon: number; icone: string }[] = [
  { action: "frapper", dx: 112, y: 438, rayon: 74, icone: "👊" },
  { action: "tirer", dx: 270, y: 480, rayon: 50, icone: "⚡" },
  { action: "special", dx: 104, y: 272, rayon: 52, icone: "★" },
];
const SENSIBLE = 1.25;                     // la zone sensible déborde du rond : un pouce, ça déborde

interface Barres {
  vie: Phaser.GameObjects.Rectangle;
  traine: Phaser.GameObjects.Rectangle;    // la vie perdue reste un instant en blanc, puis fond
  jauge: Phaser.GameObjects.Rectangle;
  manches: Phaser.GameObjects.Arc[];
  vieAffichee: number;
}

interface Stick {
  doigt: number;                           // le doigt qui le tient (Pointer.id)
  sens: -1 | 0 | 1;                        // où il fait marcher
  sautArme: boolean;                       // une poussée vers le haut fera-t-elle sauter ?
}

export class Tableau extends Phaser.Scene {
  private combat!: Combat;
  private barres = {} as Record<Cote, Barres>;
  private grosTexte!: Phaser.GameObjects.Text;
  private sousTitre!: Phaser.GameObjects.Text;
  private cases = {} as Record<Cote, Phaser.GameObjects.Rectangle[]>;
  // Au doigt
  private ronds = new Map<Bouton, { rond: Phaser.GameObjects.Arc; icone: Phaser.GameObjects.Text }>();
  private doigts: BoutonsAuDoigt<Bouton> | null = null;   // quel doigt tient quel bouton (socle/doigts.ts)
  private stick?: Stick;
  private zoneDuStick?: Phaser.GameObjects.Zone;
  private baseDuStick!: Phaser.GameObjects.Arc;
  private pouce!: Phaser.GameObjects.Arc;
  private specialPret = false;
  private pulsation?: Phaser.Tweens.Tween;

  constructor() {
    super("baston-tableau");
  }

  create() {
    this.combat = this.scene.get("baston-combat") as Combat;
    this.ronds.clear();
    this.doigts = null;
    this.stick = undefined;
    this.zoneDuStick = undefined;
    this.specialPret = false;
    this.pulsation = undefined;
    const largeur = this.scale.width;

    this.barres.gauche = this.creerBarres("gauche", this.combat.gauche);
    this.barres.droite = this.creerBarres("droite", this.combat.droite);

    this.grosTexte = this.add.text(largeur / 2, 170, "", {
      fontFamily: POLICE, fontSize: "96px", fontStyle: "bold", color: "#ffffff",
      stroke: "#1c1a25", strokeThickness: 10,
    }).setOrigin(0.5).setAlpha(0);
    this.sousTitre = this.add.text(largeur / 2, 245, "", {
      fontFamily: POLICE, fontSize: "26px", fontStyle: "bold", color: "#ffffff",
      stroke: "#1c1a25", strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0);

    if (estTactile()) {
      this.creerCommandes();
    } else {
      this.creerCases("gauche", BARRE.marge);
      this.creerCases("droite", largeur - 5 * 62 - BARRE.marge + 4);
    }

    // Le bouton pour revenir au titre, en haut au milieu (entre les deux barres de vie). Créé après
    // la zone du joystick, il passe dessus : un doigt posé sur le ✕ ne fait pas apparaître le joystick.
    this.add.text(largeur / 2, 30, "✕", { fontFamily: POLICE, fontSize: "28px", color: "#ffffff" })
      .setOrigin(0.5).setPadding(10).setInteractive({ useHandCursor: true })
      .on("pointerup", () => this.combat.quitter());

    // On écoute le combat. Ses écouteurs ne disparaissent pas quand CETTE scène s'arrête : on les retire.
    this.combat.events.on("phase", this.montrerLaPhase, this);
    this.combat.events.on("coup", this.secouerLaBarre, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.combat.events.off("phase", this.montrerLaPhase, this);
      this.combat.events.off("coup", this.secouerLaBarre, this);
    });
    this.montrerLaPhase(this.combat.phase);
  }

  // La barre de vie, la jauge dessous, et les manches gagnées. Celles de l'orange partent de la droite.
  private creerBarres(cote: Cote, robot: Robot): Barres {
    const aDroite = cote === "droite";
    const x = aDroite ? this.scale.width - BARRE.marge : BARRE.marge;
    const origine = aDroite ? 1 : 0;
    const fond = (y: number, hauteur: number) =>
      this.add.rectangle(x, y, BARRE.largeur, hauteur, GRIS).setOrigin(origine, 0).setRounded(hauteur / 3);
    fond(20, 20);
    const traine = this.add.rectangle(x, 20, BARRE.largeur, 20, 0xffffff).setOrigin(origine, 0).setRounded(6);
    const vie = this.add.rectangle(x, 20, BARRE.largeur, 20, robot.teinte).setOrigin(origine, 0).setRounded(6);
    fond(46, 8);
    const jauge = this.add.rectangle(x, 46, 0, 8, JAUNE).setOrigin(origine, 0);

    const manches: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < MANCHES_GAGNANTES; i++) {
      const cx = aDroite ? x - 10 - i * 26 : x + 10 + i * 26;
      const gagnee = i < this.combat.manches[cote];
      manches.push(this.add.circle(cx, 72, 9, gagnee ? JAUNE : GRIS));
    }
    this.add.text(aDroite ? x - 70 : x + 70, 72, robot.modele.nom, {
      fontFamily: POLICE, fontSize: "16px", fontStyle: "bold", color: enCouleur(robot.teinte),
    }).setOrigin(origine, 0.5);
    return { vie, traine, jauge, manches, vieAffichee: robot.vie };
  }

  // Une case par touche, allumée quand elle est enfoncée : on voit si le clavier suit
  // (à deux sur un clavier, certaines touches ensemble ne passent pas : le « ghosting »)
  private creerCases(cote: Cote, x: number) {
    const touches = Object.values(TOUCHES[cote]);
    this.cases[cote] = touches.map((touche, i) => {
      const fond = this.add.rectangle(x + i * 62, SOL + 30, 58, 30, GRIS).setOrigin(0).setRounded(6);
      this.add.text(x + i * 62 + 29, SOL + 45, etiquette(touche), {
        fontFamily: POLICE, fontSize: "16px", fontStyle: "bold", color: "#ffffff",
      }).setOrigin(0.5);
      return fond;
    });
    // Sous les cases : la manette de ce joueur, ou l'ordinateur qui joue l'orange
    const ordinateur = this.combat.solo && cote === "droite";
    const rang = cote === "gauche" ? 0 : 1;
    const manette = manettes(this)[rang];
    const texte = ordinateur ? "L'ordinateur joue l'orange" : manette ? "+ " + manette.id.slice(0, 32) : "";
    this.add.text(x, SOL + 70, texte, { fontFamily: POLICE, fontSize: "14px", color: "#b4b9c8" });
  }

  // ===== Les commandes au doigt =====

  private creerCommandes() {
    const largeur = this.scale.width;

    // La main gauche. La zone où le pouce se pose : toute la moitié gauche, invisible.
    this.zoneDuStick = this.add.zone(0, 0, largeur / 2, HAUTEUR).setOrigin(0).setInteractive()
      .on("pointerdown", (doigt: Phaser.Input.Pointer) => this.poserLeStick(doigt));
    this.baseDuStick = this.add.circle(0, 0, STICK.rayon, 0xffffff, 0.08)
      .setStrokeStyle(3, 0xffffff, 0.35).setVisible(false);
    this.pouce = this.add.circle(0, 0, STICK.pouce, 0xffffff, 0.3)
      .setStrokeStyle(2, 0xffffff, 0.6).setVisible(false);

    // La main droite. Le pouce du joystick, lui, ne prend jamais un bouton en passant ; une tape posée
    // et levée entre deux images compte quand même (combat.appuis)
    this.doigts = new BoutonsAuDoigt<Bouton>(this, {
      quandChange: () => this.mettreAJourLesCommandes(),
      quandPose: (action) => this.combat.appuis.add(action),
      ignorer: (doigt) => doigt.id === this.stick?.doigt,
    });
    for (const bouton of BOUTONS) {
      const x = largeur - bouton.dx;
      const { y, rayon, action } = bouton;
      const rond = this.add.circle(x, y, rayon, 0xffffff, 0.15).setStrokeStyle(3, 0xffffff, 0.6);
      this.doigts.ajouter(rond, action, SENSIBLE);
      const icone = this.add.text(x, y, bouton.icone, {
        fontFamily: POLICE, fontSize: Math.round(rayon * 0.8) + "px", color: "#ffffff",
      }).setOrigin(0.5);
      this.ronds.set(action, { rond, icone });
    }

    // Les doigts bougent et se lèvent n'importe où, même hors du jeu
    this.input.on("pointermove", (doigt: Phaser.Input.Pointer) => {
      if (doigt.id === this.stick?.doigt) {
        this.bougerLeStick(doigt);
      }
    });
    const lever = (doigt: Phaser.Input.Pointer) => {
      if (doigt.id === this.stick?.doigt) {
        this.lacherLeStick();
      }
    };
    this.input.on("pointerup", lever);
    this.input.on("pointerupoutside", lever);
    this.peindreLesBoutons();
  }

  // Le pouce se pose : la base du joystick apparaît dessous
  private poserLeStick(doigt: Phaser.Input.Pointer) {
    if (this.stick) {
      return;                              // un seul joystick : un autre doigt à gauche ne compte pas
    }
    this.stick = { doigt: doigt.id, sens: 0, sautArme: true };
    this.baseDuStick.setPosition(doigt.x, doigt.y).setVisible(true);
    this.pouce.setPosition(doigt.x, doigt.y).setVisible(true);
  }

  private bougerLeStick(doigt: Phaser.Input.Pointer) {
    const stick = this.stick!;
    const base = this.baseDuStick;
    let dx = doigt.x - base.x;
    let dy = doigt.y - base.y;
    // Trop loin : la base suit le pouce. Repartir dans l'autre sens ne demande alors qu'un petit geste.
    const distance = Math.hypot(dx, dy);
    if (distance > STICK.rayon) {
      const exces = 1 - STICK.rayon / distance;
      base.x += dx * exces;
      base.y += dy * exces;
      dx = doigt.x - base.x;
      dy = doigt.y - base.y;
    }
    this.pouce.setPosition(doigt.x, doigt.y);

    stick.sens = dx < -STICK.zoneMorte ? -1 : dx > STICK.zoneMorte ? 1 : 0;
    // Le saut est un appui, pas une touche tenue : un saut par poussée vers le haut, pas une rafale.
    // L'appui est retenu jusqu'à la prochaine image du combat (même une poussée très brève compte).
    if (dy < -STICK.saut && stick.sautArme) {
      stick.sautArme = false;
      this.combat.appuis.add("saut");
    } else if (dy > -STICK.rearmer) {
      stick.sautArme = true;
    }
    this.mettreAJourLesCommandes();
  }

  private lacherLeStick() {
    this.stick = undefined;
    this.baseDuStick.setVisible(false);
    this.pouce.setVisible(false);
    this.mettreAJourLesCommandes();
  }

  // Ce que les doigts tiennent, pour le combat : il le lit à chaque image
  private mettreAJourLesCommandes() {
    const tactile = this.combat.tactile;
    const sens = this.stick?.sens ?? 0;
    tactile.gauche = sens < 0;
    tactile.droite = sens > 0;
    const tenus = this.doigts?.tenues() ?? new Set<Bouton>();
    for (const { action } of BOUTONS) {
      tactile[action] = tenus.has(action);
    }
    this.peindreLesBoutons();
  }

  // Un bouton tenu s'éclaire. Le coup spécial reste éteint tant que la jauge n'est pas pleine,
  // puis il s'allume en jaune et bat comme un cœur.
  private peindreLesBoutons() {
    const tenus = this.doigts?.tenues() ?? new Set<Bouton>();
    for (const [action, { rond, icone }] of this.ronds) {
      const tenu = tenus.has(action);
      if (action === "special" && !this.specialPret) {
        rond.setFillStyle(0xffffff, 0.05).setStrokeStyle(3, 0xffffff, 0.25);
        icone.setAlpha(0.3);
      } else if (action === "special") {
        rond.setFillStyle(JAUNE, tenu ? 0.55 : 0.3).setStrokeStyle(5, JAUNE, 1);
        icone.setAlpha(1);
      } else {
        rond.setFillStyle(0xffffff, tenu ? 0.4 : 0.15).setStrokeStyle(3, 0xffffff, 0.6);
        icone.setAlpha(0.9);
      }
    }
  }

  private allumerLeSpecial(pret: boolean) {
    this.specialPret = pret;
    const special = this.ronds.get("special")!;
    this.pulsation?.stop();
    this.pulsation = undefined;
    special.rond.setScale(1);
    special.icone.setScale(1);
    if (pret) {
      this.pulsation = this.tweens.add({
        targets: [special.rond, special.icone],
        scale: 1.12,
        duration: 380,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });
    }
    this.peindreLesBoutons();
  }

  // Le match est fini : l'écran de fin passe par-dessus, les commandes s'effacent
  private rangerLesCommandes() {
    if (!this.zoneDuStick) {
      return;
    }
    this.zoneDuStick.disableInteractive();
    this.lacherLeStick();
    this.doigts?.toutLacher();
    for (const { rond, icone } of this.ronds.values()) {
      rond.disableInteractive().setVisible(false);
      icone.setVisible(false);
    }
    this.mettreAJourLesCommandes();
  }

  // Les annonces : « Manche 2 », « Combat ! », « K.O. ! »
  private montrerLaPhase(phase: Phase) {
    const m = this.combat.manches;
    if (phase === "debut") {
      this.annoncer("Manche " + (m.gauche + m.droite + 1), "");
    } else if (phase === "combat") {
      this.annoncer("Combat !", "", 700);
    } else if (phase === "ko") {
      const g = this.combat.gauche.etat === "ko";
      const d = this.combat.droite.etat === "ko";
      let qui = "Double K.O. : personne ne gagne la manche";
      if (!g) qui = this.combat.solo ? "Tu gagnes la manche !" : "Manche au robot bleu !";
      if (!d) qui = this.combat.solo ? "Manche pour l'ordinateur" : "Manche au robot orange !";
      this.annoncer("K.O. !", qui);
      // Le rond de la manche gagnée s'allume, et grossit d'un coup
      for (const cote of ["gauche", "droite"] as Cote[]) {
        const rond = this.barres[cote].manches[m[cote] - 1];
        if (rond && rond.fillColor !== JAUNE) {
          rond.setFillStyle(JAUNE);
          this.tweens.add({ targets: rond, scale: { from: 2.2, to: 1 }, duration: 500, ease: "Back.Out" });
        }
      }
    } else {
      this.grosTexte.setAlpha(0);
      this.sousTitre.setAlpha(0);
    }
    if (phase === "fini") {
      this.rangerLesCommandes();
    }
  }

  // Un gros texte qui arrive en grossissant ; avec une durée, il s'efface ensuite
  private annoncer(texte: string, sousTitre: string, duree = 0) {
    this.tweens.killTweensOf([this.grosTexte, this.sousTitre]);
    this.grosTexte.setText(texte).setAlpha(1).setScale(1.8);
    this.tweens.add({ targets: this.grosTexte, scale: 1, duration: 350, ease: "Back.Out" });
    this.sousTitre.setText(sousTitre).setAlpha(sousTitre ? 1 : 0);
    if (duree > 0) {
      this.tweens.add({ targets: [this.grosTexte, this.sousTitre], alpha: 0, delay: duree, duration: 300 });
    }
  }

  // Un coup encaissé : la barre de vie sursaute
  private secouerLaBarre(cible: Robot) {
    const barres = cible === this.combat.gauche ? this.barres.gauche : this.barres.droite;
    this.tweens.add({ targets: barres.vie, y: { from: 24, to: 20 }, duration: 150, ease: "Bounce.Out" });
  }

  update(temps: number, delta: number) {
    for (const cote of ["gauche", "droite"] as Cote[]) {
      const robot = this.combat[cote];
      const b = this.barres[cote];
      // setSize, et pas « width = » : un rectangle ne redessine ses coins arrondis et ne recalcule
      // son origine (à droite pour l'orange) que dans setSize
      b.vie.setSize(BARRE.largeur * robot.vie / VIE, 20);
      // La traîne rattrape la vie doucement : on voit ce que le coup a coûté
      b.vieAffichee = Math.max(robot.vie, b.vieAffichee - 30 * delta / 1000);
      b.traine.setSize(BARRE.largeur * b.vieAffichee / VIE, 20);
      b.jauge.setSize(BARRE.largeur * robot.jauge / JAUGE, 8);
      // La jauge pleine clignote en blanc
      const pleine = robot.jauge >= JAUGE;
      b.jauge.setFillStyle(pleine && Math.floor(temps / 150) % 2 === 0 ? 0xffffff : JAUNE);
      this.allumerLesCases(cote);
    }
    // Au doigt, le bouton du coup spécial s'allume quand la jauge est pleine
    const pret = this.combat.gauche.jauge >= JAUGE;
    if (this.ronds.has("special") && pret !== this.specialPret) {
      this.allumerLeSpecial(pret);
    }
  }

  private allumerLesCases(cote: Cote) {
    const cases = this.cases[cote];
    if (!cases) {
      return;
    }
    // Ce que chacun a demandé à la dernière image (pour l'orange, seul : ce que demande l'ordinateur)
    const commandes = this.combat.derniersOrdres[cote];
    const noms = Object.keys(TOUCHES[cote]) as NomDeCommande[];
    const teinte = this.combat[cote].teinte;
    cases.forEach((fond, i) => fond.setFillStyle(commandes[noms[i]] ? teinte : GRIS));
  }
}
