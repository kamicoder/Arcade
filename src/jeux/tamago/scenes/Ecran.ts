// L'écran du Tamago : la console en forme d'œuf, son écran, la créature, ses crottes, et les huit
// boutons de soin. C'est la scène du jeu : le Tamago ne vit que quand elle tourne (update avance sa vie).
// Quand on s'en va (le Hub, un autre onglet, le téléphone verrouillé), Phaser ne l'appelle plus : il dort.
//
// Toute la logique est dans vie.ts ; ici, on la montre. Les soins passent par agir(), les événements de
// la vie (une crotte, un appel, une évolution...) par reagir().
//
// Au doigt, le jeu prend la largeur du téléphone (socle/largeur.ts) : la console reste au milieu, et
// les huit boutons, plus gros, passent sur les côtés, sous les pouces.
//
// Pas de pause commune (socle/pause.ts) : partir, c'est déjà le mettre en pause (il dort), et le carnet
// arrête aussi sa vie le temps qu'on le lit.

import Phaser from "phaser";
import {
  nouvelEtat, avancer, relire, formeDe, ageEnTexte, avantDeGrandir, taperLOeuf, nourrir, donnerUneFriandise, peutJouer,
  finirLeJeu, nettoyer, nettoyerUne, soigner, gronder, caresser, type Etat, type Evenement, type Reponse, type Hasard, type Fin,
} from "../vie";
import { replique, parleDeCrotte, parleDuRoi, merci, REFUS, bonjour } from "../repliques";
import { garderEnSouvenir, recevoirUnVisiteur, ETAT } from "../souvenirs";
import { habillage as h, places } from "../habillage";
import { COEURS, PAROLE_MIN, PAROLE_MAX, SECONDE } from "../reglages";
import { lire, ecrire } from "../../../socle/sauvegarde";
import { surTouche } from "../../../socle/clavier";
import { surManette, MANETTE, VALIDER } from "../../../socle/manette";
import { retourAuHub } from "../../../socle/retour";
import { boutonArcade } from "../../../socle/boutonArcade";
import { appliquerLeSon, boutonDuSon, sonAllume } from "../../../socle/son";
import { elargir } from "../../../socle/largeur";
import { estTactile } from "../../../socle/tactile";
import { vibrer } from "../../../socle/vibration";

export type Action = "repas" | "friandise" | "jouer" | "nettoyer" | "soigner" | "gronder" | "caresser" | "carnet";

const ACTIONS: { id: Action; emoji: string; nom: string }[] = [
  { id: "repas", emoji: "🍙", nom: "Repas" },
  { id: "friandise", emoji: "🍬", nom: "Friandise" },
  { id: "jouer", emoji: "🎮", nom: "Jouer" },
  { id: "nettoyer", emoji: "🧽", nom: "Nettoyer" },
  { id: "soigner", emoji: "💊", nom: "Soigner" },
  { id: "gronder", emoji: "📢", nom: "Gronder" },
  { id: "caresser", emoji: "🤚", nom: "Caresser" },
  { id: "carnet", emoji: "📖", nom: "Carnet" },
];

const BOUTONS_Y = 412;                     // la rangée de boutons, sous l'écran (au clavier et à la souris)
const SAUVER_TOUTES_LES = 5 * SECONDE;
const DODO = SECONDE;                      // en partant, il s'endort le temps qu'on le voie, puis le Hub
const RAPPEL_D_APPEL = 10 * SECONDE;       // un appel bipe de nouveau tant qu'on n'y répond pas
const TEINTE_MALADE = 0x9dff9d;            // malade, il verdit

type Jauge = "ventre" | "moral";

interface Bouton {
  fond: Phaser.GameObjects.Arc;
  icone: Phaser.GameObjects.Text;
  anneau: Phaser.GameObjects.Arc;          // l'onde qui bat autour du bouton qui répond à un appel
}

interface Place {
  x: number;
  y: number;
  rayon: number;
  sensible: number;                        // la zone qui répond au doigt, en rayons du rond
}

export class Ecran extends Phaser.Scene {
  etat!: Etat;
  hasard: Hasard = Math.random;            // les tests peuvent le remplacer
  aide: Phaser.GameObjects.Text | null = null;       // l'aide des touches, au clavier
  bat: Action | null = null;                         // le bouton qui bat pendant un appel
  coeursPerdus = 0;                                  // les cœurs qu'on a vus tomber (les tests les comptent)
  private creature!: Phaser.GameObjects.Text;
  private nom!: Phaser.GameObjects.Text;
  private age!: Phaser.GameObjects.Text;
  private barre!: Phaser.GameObjects.Rectangle;      // la part faite de son stade
  private bientot!: Phaser.GameObjects.Text;         // « grandit bientôt »
  private coeurs: Record<Jauge, Phaser.GameObjects.Text[]> = { ventre: [], moral: [] };
  private iconesDesJauges: Phaser.GameObjects.Text[] = [];
  private boutonSon!: Phaser.GameObjects.Text;
  private iconeAppel!: Phaser.GameObjects.Text;
  private iconeMalade!: Phaser.GameObjects.Text;
  private bulle!: Phaser.GameObjects.Container;
  private texteBulle!: Phaser.GameObjects.Text;
  private fondBulle!: Phaser.GameObjects.Rectangle;
  private crottes: Phaser.GameObjects.Text[] = [];
  private roi: Phaser.GameObjects.Text | null = null;
  private boutons: Bouton[] = [];
  private choisi = 0;
  private etincelles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private avantParole = PAROLE_MIN;
  private avantSauvegarde = SAUVER_TOUTES_LES;
  private avantRappel = 0;
  private bulleJusqua = 0;
  private teinteDeMalade = false;
  private enDepart = false;                // l'animation de son départ : on ne touche plus à rien
  private quitte = false;
  // Les places, d'après la largeur du jeu (create)
  private console = places(960).console;
  private ecran = places(960).ecran;
  private centre = places(960).centre;
  private cotes = false;                   // les boutons sur les côtés (au doigt, un téléphone allongé)
  private k = 1;                           // l'échelle de ce que montre l'écran (plus grand avec les boutons sur les côtés)
  private sol = 0;                         // le bas de la créature et des crottes
  private creatureX = 0;

  constructor() {
    super("tamago-ecran");
  }

  // Une taille de l'écran de la console, à son échelle
  private px(n: number): number {
    return Math.round(n * this.k);
  }

  create() {
    elargir(this);
    const lieux = places(this.scale.width);
    ({ console: this.console, ecran: this.ecran, centre: this.centre } = lieux);
    this.cotes = lieux.cotes;              // (seul un jeu élargi, donc au doigt, en a la place)
    this.k = lieux.echelle;
    this.sol = this.ecran.y + this.ecran.hauteur - this.px(50);
    this.creatureX = this.centre.x - this.px(40);
    this.etat = relire(lire(ETAT)) ?? nouvelEtat();
    this.crottes = [];
    this.roi = null;
    this.boutons = [];
    this.bat = null;
    this.coeursPerdus = 0;
    this.teinteDeMalade = false;
    this.enDepart = false;
    this.quitte = false;
    appliquerLeSon(this, "tamago");
    this.cameras.main.setBackgroundColor(h.fond).fadeIn(300);

    this.dessinerLaConsole();
    this.creerLEcran();
    this.creerLesBoutons();

    boutonArcade(this, () => this.quitter(), { police: h.police, fond: 0x1e1e5a, fondAlpha: 0.8 });
    this.boutonSon = boutonDuSon(this, "tamago", { police: h.police, couleur: h.ecran.doux });
    this.ecrireLAide();

    this.ecouterLeClavierEtLaManette();
    this.ecouterLesAllersEtRetours();
    this.afficher();
    this.creature.setText(formeDe(this.etat).emoji);
    if (this.etat.stade !== "oeuf") {
      // Il dormait pendant ton absence
      this.time.delayedCall(400, () => this.dire(bonjour(this.hasard)));
    } else if (this.etat.eclosion !== null) {
      // On revient pendant l'éclosion : il bouge toujours
      this.tremblerLOeuf();
    } else {
      this.dire(this.etat.tapes === 0 ? "Tape l'œuf pour le réchauffer !" : "Encore un peu !");
    }
  }

  // —— Le décor ——

  // La console en forme d'œuf : une ellipse plus étroite en haut, un halo néon, l'écran et ses lignes
  private dessinerLaConsole() {
    const { console: c, ecran } = this;
    const points: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const y = Math.cos(a);
      const largeur = y < 0 ? 0.86 + 0.14 * (1 + y) : 1;   // le haut se resserre
      points.push(new Phaser.Math.Vector2(c.x + Math.sin(a) * c.rx * largeur, c.y - y * c.ry));
    }
    const g = this.add.graphics();
    g.lineStyle(14, h.console.halo, 0.18).strokePoints(points, true);
    g.fillStyle(h.console.couleur).fillPoints(points, true);
    g.lineStyle(4, h.console.bord, 0.9).strokePoints(points, true);
    g.fillStyle(h.ecran.fond).fillRoundedRect(ecran.x, ecran.y, ecran.largeur, ecran.hauteur, 16);
    g.lineStyle(3, h.ecran.bord, 0.8).strokeRoundedRect(ecran.x, ecran.y, ecran.largeur, ecran.hauteur, 16);
    // Les lignes d'un vieil écran, par-dessus tout ce qui s'y dessine
    const lignes = this.add.graphics().setDepth(50);
    lignes.fillStyle(0x000000, 0.12);
    for (let y = ecran.y + 4; y < ecran.y + ecran.hauteur - 4; y += 4) {
      lignes.fillRect(ecran.x + 4, y, ecran.largeur - 8, 1);
    }
    this.add.text(c.x, 58, "TAMAGO-XTREME", { fontFamily: h.pixel, fontSize: "16px", color: h.accent })
      .setOrigin(0.5).setShadow(0, 0, h.accent, 8, true, true);
  }

  private creerLEcran() {
    const ecran = this.ecran;
    const px = (n: number) => this.px(n);
    const taille = (n: number) => px(n) + "px";
    const style = { fontFamily: h.pixel, fontSize: taille(11), color: h.ecran.texte };
    const droite = ecran.x + ecran.largeur - px(16);
    this.nom = this.add.text(ecran.x + px(16), ecran.y + px(16), "", style);
    this.age = this.add.text(droite, ecran.y + px(16), "", style).setOrigin(1, 0);
    // La petite barre du stade, sous l'âge : elle se remplit jusqu'à ce qu'il grandisse
    this.add.rectangle(droite, ecran.y + px(33), px(96), px(6), 0xffffff, 0.15).setOrigin(1, 0);
    this.barre = this.add.rectangle(droite - px(96), ecran.y + px(33), px(96), px(6), h.console.bord).setOrigin(0, 0);
    this.bientot = this.add.text(droite, ecran.y + px(43), "", { fontFamily: h.police, fontSize: taille(12), color: h.accent })
      .setOrigin(1, 0).setVisible(false);
    this.tweens.add({ targets: this.bientot, alpha: 0.35, duration: 500, yoyo: true, repeat: -1 });

    // Les cœurs, un par un : celui qui part peut tomber
    const y = ecran.y + ecran.hauteur - px(22);
    this.iconesDesJauges = [];
    const rangee = (icone: string, x: number) => {
      this.iconesDesJauges.push(this.add.text(x, y, icone, { fontSize: taille(17) }).setOrigin(0.5));
      return Array.from({ length: COEURS }, (_, i) => this.add.text(x + px(28 + i * 24), y, h.coeur.vide, {
        fontFamily: h.police, fontSize: taille(20), color: h.ecran.texte,
      }).setOrigin(0.5));
    };
    this.coeurs = { ventre: rangee("🍙", this.centre.x - px(140)), moral: rangee("💖", this.centre.x + px(40)) };

    this.iconeAppel = this.add.text(ecran.x + ecran.largeur - px(22), ecran.y + px(78), "📣", { fontSize: taille(24) })
      .setOrigin(0.5).setVisible(false);
    this.tweens.add({ targets: this.iconeAppel, alpha: 0.2, duration: 300, yoyo: true, repeat: -1 });
    this.iconeMalade = this.add.text(this.creatureX + px(52), this.sol - px(92), "🤒", { fontSize: taille(26) }).setOrigin(0.5).setVisible(false);

    // La créature : un emoji qui sautille. Toucher, c'est la caresser (ou réchauffer l'œuf).
    this.creature = this.add.text(this.creatureX, this.sol, "", { fontSize: taille(80), padding: { top: px(12) } })
      .setOrigin(0.5, 1).setInteractive({ useHandCursor: true });
    this.creature.on("pointerup", () => this.agir("caresser"));
    this.sautiller();
    this.time.addEvent({ delay: 2600, loop: true, callback: () => this.promener() });
    // Comblé, des cœurs s'envolent de lui
    this.time.addEvent({ delay: 1400, loop: true, callback: () => this.coeurQuiFlotte() });

    // La bulle : ce qu'il dit
    this.fondBulle = this.add.rectangle(0, 0, 100, 40, h.bulle.fond).setRounded(12);
    this.texteBulle = this.add.text(0, 0, "", {
      fontFamily: h.police, fontSize: taille(15), color: h.bulle.texte, align: "center", wordWrap: { width: px(300) },
    }).setOrigin(0.5);
    // (sur le grand écran, un peu plus bas : ses lignes, plus hautes, passeraient sur « grandit bientôt »)
    this.bulle = this.add.container(this.centre.x, ecran.y + px(74) + (this.cotes ? 14 : 0), [this.fondBulle, this.texteBulle]).setDepth(20).setVisible(false);

    this.etincelles = this.add.particles(0, 0, "etincelle", {
      emitting: false, lifespan: 600, speed: { min: 60, max: 180 }, scale: { start: 1.2, end: 0 },
      tint: [0xff2d95, 0x00f3ff, 0x39ff14, 0xfff700], blendMode: "ADD",
    }).setDepth(30);
  }

  private sautiller() {
    this.tweens.add({ targets: this.creature, scaleY: 0.92, duration: 450, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  }

  // Au clavier et à la souris, une rangée sous l'écran. Au doigt, des boutons plus gros : sur les côtés
  // de la console, deux par deux sous chaque pouce, quand le téléphone en laisse la place ; sinon, la
  // rangée, un peu plus grosse. Leur zone sensible déborde du rond : un pouce ne vise pas au pixel près.
  private placesDesBoutons(): Place[] {
    const n = ACTIONS.length;
    const rangee = (ecart: number, rayon: number, sensible: number) => ACTIONS.map((_, i) =>
      ({ x: this.console.x + (i - (n - 1) / 2) * ecart, y: BOUTONS_Y, rayon, sensible }));
    if (!estTactile()) {
      return rangee(62, 26, 1);
    }
    if (!this.cotes) {
      return rangee(66, 29, 1.13);
    }
    const marge = this.console.x - this.console.rx;
    // Deux colonnes de chaque côté : à gauche les quatre premiers soins, à droite les quatre autres
    return ACTIONS.map((_, i) => {
      const cote = i < n / 2 ? marge / 2 : this.scale.width - marge / 2;
      const j = i % (n / 2);
      return { x: cote + (j % 2 === 0 ? -52 : 52), y: j < 2 ? 250 : 372, rayon: 38, sensible: 1.3 };
    });
  }

  private creerLesBoutons() {
    this.placesDesBoutons().forEach(({ x, y, rayon, sensible }, i) => {
      const action = ACTIONS[i];
      const anneau = this.add.circle(x, y, rayon).setStrokeStyle(4, 0xff2d95).setVisible(false);
      const fond = this.add.circle(x, y, rayon, 0x2a2a70).setStrokeStyle(3, h.console.bord, 0.5)
        .setInteractive({
          // La zone se compte depuis le coin haut gauche du rond
          hitArea: new Phaser.Geom.Circle(rayon, rayon, rayon * sensible),
          hitAreaCallback: Phaser.Geom.Circle.Contains,
          useHandCursor: true,
        });
      const icone = this.add.text(x, y, action.emoji, { fontSize: rayon + "px", padding: { top: 4 } }).setOrigin(0.5);
      this.add.text(x, y + rayon + 14, action.nom, {
        fontFamily: h.police, fontSize: rayon > 30 ? "15px" : "12px", color: h.ecran.doux,
      }).setOrigin(0.5);
      fond.on("pointerover", () => this.choisir(i));
      fond.on("pointerup", () => {
        this.choisir(i);
        this.agir(action.id);
      });
      this.boutons.push({ fond, icone, anneau });
    });
    this.choisir(this.choisi);
  }

  private choisir(i: number) {
    this.choisi = Phaser.Math.Wrap(i, 0, this.boutons.length);
    this.boutons.forEach((bouton, j) => {
      const elu = j === this.choisi;
      bouton.fond.setStrokeStyle(elu ? 4 : 3, elu ? 0xff2d95 : h.console.bord, elu ? 1 : 0.5);
      this.tweens.add({ targets: [bouton.fond, bouton.icone], scale: elu ? 1.12 : 1, duration: 120, ease: "Back.Out" });
    });
  }

  // Pendant un appel, le bouton qui y répond bat, comme un cœur : une onde part de lui
  private faireBattre(action: Action | null) {
    if (action === this.bat) {
      return;
    }
    if (this.bat) {
      const avant = this.boutons[ACTIONS.findIndex((a) => a.id === this.bat)].anneau;
      this.tweens.killTweensOf(avant);
      avant.setVisible(false);
    }
    this.bat = action;
    if (action) {
      const anneau = this.boutons[ACTIONS.findIndex((a) => a.id === action)].anneau;
      anneau.setVisible(true).setScale(1).setAlpha(1);
      this.tweens.add({ targets: anneau, scale: 1.6, alpha: 0, duration: 650, repeat: -1, repeatDelay: 250, ease: "Quad.Out" });
    }
  }

  // Au clavier, ce que font les touches (au doigt, tout se touche : pas besoin)
  private ecrireLAide() {
    if (estTactile()) {
      this.aide = null;
      return;
    }
    this.aide = this.add.text(16, 528, "1 à 8 : les soins\n← → puis Entrée : choisir\nM : le son · Échap : l'Arcade", {
      fontFamily: h.police, fontSize: "13px", color: h.ecran.doux, lineSpacing: 2,
    }).setOrigin(0, 1).setAlpha(0.8);
  }

  // Le bouton du son suit la touche M appuyée pendant le carnet ou le jeu (cet écran est alors en pause,
  // sa touche M à lui n'entend rien)
  montrerLeSon() {
    this.boutonSon.setText(sonAllume("tamago") ? "🔊 Son (M)" : "🔇 Muet (M)");
  }

  private ecouterLeClavierEtLaManette() {
    surTouche(this, "LEFT", () => this.choisir(this.choisi - 1));
    surTouche(this, "RIGHT", () => this.choisir(this.choisi + 1));
    surTouche(this, "ENTER", () => this.agir(ACTIONS[this.choisi].id));
    surTouche(this, "SPACE", () => this.agir(ACTIONS[this.choisi].id));
    surTouche(this, "ESC", () => this.quitter());
    // Les chiffres : chaque bouton directement (1 = Repas... 8 = Carnet)
    const chiffres = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT"];
    chiffres.forEach((touche, i) => {
      surTouche(this, touche, () => this.agir(ACTIONS[i].id));
      surTouche(this, "NUMPAD_" + touche, () => this.agir(ACTIONS[i].id));
    });
    surManette(this, MANETTE.GAUCHE, () => this.choisir(this.choisi - 1));
    surManette(this, MANETTE.DROITE, () => this.choisir(this.choisi + 1));
    surManette(this, VALIDER, () => this.agir(ACTIONS[this.choisi].id));
    surManette(this, MANETTE.B, () => this.quitter());
  }

  // Le jeu disparaît (un autre onglet, le téléphone qu'on verrouille) : on sauve, il s'endort.
  // Il revient : il se réveille et dit bonjour. Le jeu appartient à toute l'Arcade : on retire ces
  // écouteurs nous-mêmes en partant.
  private ecouterLesAllersEtRetours() {
    const cache = () => this.sauver();
    const revient = () => {
      if (this.etat.stade !== "oeuf" && !this.etat.fin) {
        this.dire(bonjour(this.hasard));
      }
    };
    this.game.events.on(Phaser.Core.Events.HIDDEN, cache);
    this.game.events.on(Phaser.Core.Events.VISIBLE, revient);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sauver();
      this.game.events.off(Phaser.Core.Events.HIDDEN, cache);
      this.game.events.off(Phaser.Core.Events.VISIBLE, revient);
    });
  }

  // —— Le temps ——

  update(_temps: number, delta: number) {
    // Une image très longue (un onglet qui revient) ne compte pas : il dormait
    this.avancerDe(Math.min(delta, 250));
  }

  // Le temps passe pour le Tamago : la vie avance, la scène montre ce qui s'est passé. Les tests
  // s'en servent pour avancer de plusieurs minutes d'un coup.
  avancerDe(duree: number) {
    if (this.enDepart) {
      return;
    }
    for (const evenement of avancer(this.etat, duree, this.hasard)) {
      this.reagir(evenement);
    }
    this.afficher();
    this.avantParole -= duree;
    if (this.avantParole <= 0) {
      this.avantParole = Phaser.Math.Between(PAROLE_MIN, PAROLE_MAX);
      this.parler();
    }
    this.avantRappel -= duree;
    if (this.etat.appel && !this.etat.appel.compte && this.avantRappel <= 0) {
      this.avantRappel = RAPPEL_D_APPEL;
      this.sound.play("tamago-appel");
    }
    this.avantSauvegarde -= duree;
    if (this.avantSauvegarde <= 0) {
      this.avantSauvegarde = SAUVER_TOUTES_LES;
      this.sauver();
    }
    if (this.time.now > this.bulleJusqua) {
      this.bulle.setVisible(false);
    }
  }

  private sauver() {
    if (!this.enDepart) {
      ecrire(ETAT, this.etat);
    }
  }

  // L'écran suit l'état : le nom, l'âge, le stade, les cœurs, les crottes, les icônes, son humeur
  private afficher() {
    const e = this.etat;
    const forme = formeDe(e);
    this.nom.setText(forme.nom.toUpperCase());
    this.age.setText(e.stade === "oeuf" ? "" : ageEnTexte(e.age).toUpperCase());
    const stade = avantDeGrandir(e);
    this.barre.setVisible(!!stade).setScale(stade?.fait ?? 0, 1).setFillStyle(stade?.bientot ? 0xff2d95 : h.console.bord);
    this.bientot.setVisible(!!stade?.bientot).setText(e.stade === "oeuf" ? "éclot bientôt" : "grandit bientôt");
    this.iconesDesJauges.forEach((icone) => icone.setVisible(e.stade !== "oeuf"));
    for (const jauge of ["ventre", "moral"] as const) {
      this.coeurs[jauge].forEach((coeur, i) => {
        const plein = e.stade !== "oeuf" && i < e[jauge];
        coeur.setText(plein ? h.coeur.plein : h.coeur.vide).setColor(plein ? h.ecran.texte : h.ecran.doux)
          .setVisible(e.stade !== "oeuf");
      });
    }
    this.iconeAppel.setVisible(!!e.appel);
    this.iconeMalade.setVisible(e.malade > 0).setX(this.creature.x + this.px(52));
    // Malade, il verdit
    if ((e.malade > 0) !== this.teinteDeMalade) {
      this.teinteDeMalade = e.malade > 0;
      if (this.teinteDeMalade) {
        this.creature.setTint(TEINTE_MALADE);
      } else {
        this.creature.clearTint();
      }
    }
    // Pendant un appel, le bon bouton bat (le moral : jouer, ou une friandise s'il est malade et ne joue pas)
    const appel = e.appel?.raison;
    this.faireBattre(appel === "ventre" ? "repas" : appel === "caprice" ? "gronder"
      : appel === "moral" ? (e.malade > 0 ? "friandise" : "jouer") : null);

    // Une crotte à l'écran pour chacune de l'état
    while (this.crottes.length < e.crottes.length) {
      this.ajouterUneCrotte();
    }
    while (this.crottes.length > e.crottes.length) {
      const crotte = this.crottes.pop()!;
      this.etincelles.explode(8, crotte.x, crotte.y - 14);
      this.tweens.killTweensOf(crotte);    // son dandinement ne s'arrête jamais tout seul
      crotte.destroy();
    }
    if (e.roiCaca !== null && !this.roi) {
      // La couronne sur la tête : deux lignes d'un même texte. Le taper, c'est le nettoyer.
      this.roi = this.add.text(this.ecran.x + this.ecran.largeur - this.px(70), this.sol, "👑\n💩", {
        fontSize: this.px(50) + "px", align: "center", lineSpacing: -this.px(18), padding: { top: this.px(20) },
      }).setOrigin(0.5, 1).setScale(0).setDepth(5).setInteractive({ useHandCursor: true });
      this.roi.on("pointerup", () => this.agir("nettoyer"));
      this.tweens.add({ targets: this.roi, scale: 1, duration: 500, ease: "Back.Out" });
      this.tweens.add({ targets: this.roi, angle: { from: -6, to: 6 }, duration: 400, yoyo: true, repeat: -1 });
    } else if (e.roiCaca === null && this.roi) {
      this.etincelles.explode(40, this.roi.x, this.roi.y - 30);
      this.tweens.killTweensOf(this.roi);
      this.roi.destroy();
      this.roi = null;
    }
  }

  // La place de la crotte n° i : deux colonnes contre le bord droit de l'écran
  private placeDeCrotte(i: number) {
    return {
      x: this.ecran.x + this.ecran.largeur - this.px(44) - (i % 2) * this.px(44),
      y: this.sol - Math.floor(i / 2) * this.px(6),
    };
  }

  // Une crotte : elle se dandine, et la toucher la nettoie (elle seule, comme dans XTREME)
  private ajouterUneCrotte() {
    const i = this.crottes.length;
    const { x, y } = this.placeDeCrotte(i);
    const crotte = this.add.text(x, y, "💩", { fontSize: this.px(30) + "px", padding: { top: this.px(6) } }).setOrigin(0.5, 1).setScale(0).setDepth(5);
    // Une zone plus grande que la crotte : au doigt, elle est petite
    crotte.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-10, -10, crotte.width + 20, crotte.height + 20),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    crotte.on("pointerup", () => this.nettoyerLaCrotte(crotte));
    this.tweens.add({ targets: crotte, scale: 1, duration: 300, ease: "Back.Out" });
    this.tweens.add({ targets: crotte, angle: { from: -8, to: 8 }, duration: 500 + i * 90, yoyo: true, repeat: -1 });
    this.crottes.push(crotte);
  }

  // Les crottes à l'écran vont dans le même ordre que celles de l'état : celle qu'on touche a le même
  // numéro dans les deux. Elle s'en va, les autres se resserrent.
  private nettoyerLaCrotte(crotte: Phaser.GameObjects.Text) {
    const i = this.crottes.indexOf(crotte);
    if (this.enDepart || this.quitte || i < 0) {
      return;
    }
    const reponse = nettoyerUne(this.etat, i);
    if (!reponse.ok) {
      this.refuser(reponse.refus);
      return;
    }
    this.sound.play("tamago-nettoie");
    this.crottes.splice(i, 1);
    this.etincelles.explode(8, crotte.x, crotte.y - 14);
    this.tweens.killTweensOf(crotte);
    crotte.destroy();
    this.crottes.forEach((reste, j) => this.tweens.add({ targets: reste, ...this.placeDeCrotte(j), duration: 200 }));
    if (this.etat.crottes.length === 0) {
      this.dire(merci("nettoyer", this.hasard), 1800);
    }
    this.afficher();
    this.sauver();
  }

  // Il se promène un peu dans l'écran (pas sur ses crottes)
  private promener() {
    if (this.etat.stade === "oeuf" || this.enDepart) {
      return;
    }
    const x = Phaser.Math.Between(this.ecran.x + this.px(70), this.promenadeMax());
    this.creature.setFlipX(x > this.creature.x);
    this.tweens.add({ targets: this.creature, x, duration: 900, ease: "Sine.InOut" });
  }

  // Le plus à droite où il se promène : sa zone (pour la caresse) s'arrête avant celle de la crotte la
  // plus à gauche (placeDeCrotte : 88 px du bord, une vingtaine de demi-largeur, 10 de marge), sinon
  // au doigt on caresserait en voulant nettoyer
  promenadeMax(): number {
    const zoneDesCrottes = this.ecran.x + this.ecran.largeur - this.px(88 + 22) - 10;
    return Math.round(zoneDesCrottes - this.creature.width / 2 - 6);
  }

  // Comblé : rien ne lui manque, rien ne traîne
  comble(): boolean {
    const e = this.etat;
    return e.stade !== "oeuf" && !e.fin && e.ventre === COEURS && e.moral === COEURS && e.malade === 0
      && e.crottes.length === 0 && e.roiCaca === null && !e.appel;
  }

  private coeurQuiFlotte() {
    if (!this.comble() || this.enDepart || this.quitte) {
      return;
    }
    const coeur = this.add.text(this.creature.x + Phaser.Math.Between(-30, 30), this.creature.y - this.px(80), h.coeur.plein, {
      fontFamily: h.police, fontSize: this.px(22) + "px", color: h.accent,
    }).setOrigin(0.5).setDepth(15);
    this.tweens.add({ targets: coeur, y: coeur.y - 60, x: coeur.x + Phaser.Math.Between(-20, 20), alpha: 0, duration: 1400,
      ease: "Sine.Out", onComplete: () => coeur.destroy() });
  }

  // Un cœur perdu : il clignote, et un cœur cassé tombe de sa place
  private perdreUnCoeur(jauge: Jauge) {
    const coeur = this.coeurs[jauge][this.etat[jauge]];
    if (!coeur) {
      return;
    }
    this.coeursPerdus++;
    this.sound.play("tamago-non", { rate: 1.6, volume: 0.35 });
    this.tweens.add({ targets: coeur, alpha: 0.15, duration: 110, yoyo: true, repeat: 3, onComplete: () => coeur.setAlpha(1) });
    const eclat = this.add.text(coeur.x, coeur.y, h.coeur.plein, {
      fontFamily: h.police, fontSize: this.px(20) + "px", color: h.accent,
    }).setOrigin(0.5).setDepth(25);
    this.tweens.add({ targets: eclat, y: coeur.y + 40, angle: 35, scale: 1.5, alpha: 0, duration: 800, ease: "Quad.In",
      onComplete: () => eclat.destroy() });
  }

  // —— Parler ——

  dire(texte: string, duree = 3200) {
    if (!texte) {
      return;
    }
    this.texteBulle.setText(texte);
    this.fondBulle.setSize(this.texteBulle.width + 28, this.texteBulle.height + 16);
    this.bulle.setVisible(true).setScale(0.6);
    this.tweens.add({ targets: this.bulle, scale: 1, duration: 200, ease: "Back.Out" });
    this.bulleJusqua = this.time.now + duree;
  }

  private parler() {
    const e = this.etat;
    if (e.stade === "oeuf" || e.fin) {
      return;
    }
    // Parfois, c'est une crotte (ou le ROI CACA) qui parle
    if (e.roiCaca !== null && this.hasard() < 0.6) {
      this.dire("👑💩 " + parleDuRoi(this.hasard));
    } else if (e.crottes.length > 0 && this.hasard() < 0.3) {
      this.dire("💩 " + parleDeCrotte(this.hasard));
    } else {
      this.dire(replique(e, this.hasard));
    }
  }

  // —— Les soins ——

  agir(action: Action) {
    if (this.enDepart || this.quitte) {
      return;
    }
    const e = this.etat;
    if (e.stade === "oeuf") {
      if (action !== "carnet") {
        this.rechaufferLOeuf();
        return;
      }
    }
    let reponse: Reponse;
    switch (action) {
      case "repas":
        reponse = nourrir(e);
        if (reponse.ok) this.donner("🍙", "tamago-miam", merci("repas", this.hasard));
        break;
      case "friandise":
        reponse = donnerUneFriandise(e);
        if (reponse.ok) this.donner("🍬", "tamago-miam", merci("friandise", this.hasard));
        break;
      case "jouer":
        reponse = peutJouer(e);
        if (reponse.ok) {
          this.sound.play("tamago-bip");
          this.ouvrir("tamago-jeu");
        }
        break;
      case "nettoyer":
        reponse = nettoyer(e);
        if (reponse.ok) this.reactionAuMenage(reponse.detail);
        break;
      case "soigner":
        reponse = soigner(e);
        if (reponse.ok) {
          this.donner("💊", reponse.detail === "gueri" ? "tamago-soin" : "tamago-bip",
            reponse.detail === "gueri" ? merci("soin", this.hasard) : "Beurk. Encore une dose...");
        }
        break;
      case "gronder":
        reponse = gronder(e);
        if (reponse.ok) {
          this.sound.play("tamago-gronde");
          this.cameras.main.shake(150, 0.004);
          this.tweens.add({ targets: this.creature, scaleY: 0.7, duration: 150, yoyo: true });
          this.dire(merci("gronder", this.hasard));
        }
        break;
      case "caresser":
        reponse = caresser(e);
        if (reponse.ok) {
          this.sound.play("tamago-joie", { volume: 0.5 });
          this.etincelles.explode(10, this.creature.x, this.creature.y - 60);
          this.tweens.add({ targets: this.creature, angle: { from: -10, to: 10 }, duration: 90, yoyo: true, repeat: 2,
            onComplete: () => this.creature.setAngle(0) });
          this.dire(merci("caresse", this.hasard), 1800);
        }
        break;
      case "carnet":
        this.sound.play("tamago-bip");
        this.ouvrir("tamago-carnet");
        return;
    }
    if (!reponse.ok) {
      this.refuser(reponse.refus);
    }
    this.afficher();
    this.sauver();
  }

  private rechaufferLOeuf() {
    if (!taperLOeuf(this.etat)) {
      return;
    }
    this.sound.play("tamago-tape", { rate: 1 + this.etat.tapes * 0.1 });
    this.tweens.add({ targets: this.creature, angle: { from: -15, to: 15 }, duration: 70, yoyo: true, repeat: 1,
      onComplete: () => this.creature.setAngle(0) });
    if (this.etat.eclosion !== null) {
      this.tremblerLOeuf();
    } else {
      this.dire(["Toc.", "Toc toc.", "Ça chauffe...", "Encore une fois !"][this.etat.tapes - 1] ?? "", 1200);
    }
    this.afficher();
    this.sauver();
  }

  // Il va éclore : l'œuf tremble sans s'arrêter
  private tremblerLOeuf() {
    this.dire("Il bouge !!!");
    this.tweens.add({ targets: this.creature, x: this.creatureX + 4, duration: 50, yoyo: true, repeat: -1 });
  }

  // Un objet (un repas, une friandise, un médicament) vole jusqu'à lui
  private donner(emoji: string, son: string, texte: string) {
    const objet = this.add.text(this.centre.x + 120, this.ecran.y + 60, emoji, { fontSize: this.px(34) + "px" }).setOrigin(0.5).setDepth(10);
    this.tweens.add({
      targets: objet, x: this.creature.x, y: this.creature.y - 50, scale: 0.4, duration: 400, ease: "Quad.In",
      onComplete: () => {
        objet.destroy();
        this.sound.play(son);
        this.tweens.add({ targets: this.creature, scale: 1.15, duration: 100, yoyo: true });
        this.dire(texte, 2000);
      },
    });
  }

  private reactionAuMenage(detail?: string) {
    this.sound.play("tamago-nettoie");
    const eponge = this.add.text(this.ecran.x + 20, this.sol - 20, "🧽", { fontSize: "36px" }).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: eponge, x: this.ecran.x + this.ecran.largeur - 20, duration: 450, onComplete: () => eponge.destroy() });
    if (detail === "roi-touche" && this.roi) {
      this.roi.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      this.time.delayedCall(80, () => this.roi?.clearTint());
      this.cameras.main.shake(120, 0.006);
      this.dire(`👑💩 ${parleDuRoi(this.hasard)} (encore ${this.etat.roiCaca} coups)`, 1500);
    } else if (detail === "roi-vaincu") {
      this.sound.play("tamago-joie");
      this.dire("LE ROI EST MORT. VIVE LE PROPRE !");
    } else {
      this.dire(merci("nettoyer", this.hasard), 1800);
    }
  }

  private refuser(refus: keyof typeof REFUS) {
    this.sound.play("tamago-non");
    this.tweens.add({ targets: this.creature, angle: { from: -12, to: 12 }, duration: 80, yoyo: true, repeat: 2,
      onComplete: () => this.creature.setAngle(0) });
    this.dire(REFUS[refus], 2200);
  }

  // Le jeu ou le carnet, par-dessus : la vie s'arrête pendant ce temps (la scène est en pause)
  private ouvrir(scene: string) {
    this.sauver();
    this.scene.pause();
    this.scene.launch(scene);
  }

  // Le jeu de gauche-droite est fini (Jeu.ts)
  finDuJeu(manchesGagnees: number) {
    finirLeJeu(this.etat, manchesGagnees);
    this.scene.resume();
    this.sound.play(manchesGagnees >= 3 ? "tamago-joie" : "tamago-bip");
    this.dire(manchesGagnees >= 3 ? merci("jeu", this.hasard) : "Perdu... mais c'était drôle !");
    this.afficher();
    this.sauver();
  }

  // Le jeu arrêté en route : rien ne change
  jeuArrete() {
    this.scene.resume();
    this.dire("Déjà ? On jouera plus tard, alors.");
  }

  // —— Ce qui arrive dans sa vie ——

  private reagir(ev: Evenement) {
    switch (ev.type) {
      case "eclosion":
        this.tweens.killTweensOf(this.creature);
        this.creature.setPosition(this.creatureX, this.sol).setScale(1).setAngle(0);
        this.sautiller();
        this.sound.play("tamago-eclosion");
        vibrer(this, "moyen");
        this.cameras.main.flash(300, 255, 255, 255);
        this.etincelles.explode(40, this.creature.x, this.creature.y - 40);
        this.creature.setText(formeDe(this.etat).emoji);
        this.dire("Piou ?");
        break;
      case "evolution":
        this.sound.play("tamago-evolution");
        vibrer(this, "fort");
        this.cameras.main.flash(500, 255, 255, 255);
        this.etincelles.explode(60, this.creature.x, this.creature.y - 40);
        this.creature.setText(ev.forme.emoji);
        this.tweens.add({ targets: this.creature, scale: { from: 0.3, to: 1 }, duration: 600, ease: "Back.Out" });
        this.dire(`~ ÉVOLUTION ~\n${ev.forme.nom} ${ev.forme.emoji}, ${ev.forme.caractere} !`, 4500);
        break;
      case "coeur":
        this.perdreUnCoeur(ev.jauge);
        break;
      case "crotte":
        this.sound.play("tamago-prout");
        break;
      case "roi-caca":
        this.sound.play("tamago-roi");
        vibrer(this, "moyen");
        this.cameras.main.shake(400, 0.01);
        this.time.delayedCall(300, () => this.dire("👑💩 " + parleDuRoi(this.hasard) + "\n(Tape-le ou nettoie-le 5 fois !)", 4000));
        break;
      case "malade":
        this.dire("Je me sens pas bien...");
        break;
      case "appel":
        this.avantRappel = 0;              // le bip part tout de suite
        vibrer(this, "moyen");
        this.dire(ev.raison === "ventre" ? "J'AI FAIM !!!" : ev.raison === "moral" ? "Je m'ennuie... on joue ?"
          : "💢 " + replique(this.etat, this.hasard));
        if (ev.raison === "caprice") {
          this.tweens.add({ targets: this.creature, x: this.creature.x + 6, duration: 50, yoyo: true, repeat: 5 });
        }
        break;
      case "oubli":
        this.dire("😢 ...");
        break;
      case "caprice-passe":
        break;
      case "surprise":
        this.montrerLaSurprise(ev.surprise.emoji, ev.surprise.annonce, ev.surprise.replique, ev.surprise.visiteur);
        break;
      case "fin":
        this.partir(ev.cause);
        break;
    }
  }

  // Une surprise : son emoji passe dans l'écran, l'annonce s'affiche, il réagit
  private montrerLaSurprise(emoji: string, annonce: string, reaction: string, visiteur?: string) {
    const ecran = this.ecran;
    this.sound.play("tamago-surprise");
    const objet = this.add.text(ecran.x + 30, ecran.y + 70, emoji, { fontSize: this.px(44) + "px" }).setOrigin(0.5).setDepth(10).setAlpha(0);
    this.tweens.chain({
      targets: objet,
      tweens: [
        { alpha: 1, x: this.centre.x + 90, duration: 900, ease: "Sine.Out" },
        { y: ecran.y + 60, duration: 300, yoyo: true, repeat: 2 },
        { alpha: 0, x: ecran.x + ecran.largeur - 30, duration: 700, delay: 900, onComplete: () => objet.destroy() },
      ],
    });
    let texte = `${annonce}\n« ${reaction} »`;
    if (visiteur && recevoirUnVisiteur(visiteur, emoji)) {
      texte += "\n🌟 Nouvel ami dans le carnet !";
    }
    this.dire(texte, 4500);
  }

  // —— La fin : il s'en va, l'album le garde, un nouvel œuf l'attend ——

  private partir(cause: Fin) {
    this.enDepart = true;
    this.faireBattre(null);
    garderEnSouvenir(this.etat);
    const forme = formeDe(this.etat);
    const age = ageEnTexte(this.etat.age);
    // Le nouvel œuf est déjà sauvé : un départ coupé en plein milieu ne fait rien perdre
    ecrire(ETAT, nouvelEtat());
    this.sound.play("tamago-depart");
    this.tweens.killTweensOf(this.creature);
    this.creature.clearTint();
    this.teinteDeMalade = false;
    if (cause === "vieillesse") {
      const soucoupe = this.add.text(this.creature.x, this.ecran.y - 40, "🛸", { fontSize: "56px" }).setOrigin(0.5).setDepth(10);
      this.tweens.chain({
        targets: soucoupe,
        tweens: [
          { y: this.sol - 150, duration: 1200, ease: "Sine.Out" },
          { y: this.ecran.y - 60, duration: 1500, delay: 600, ease: "Sine.In", onComplete: () => soucoupe.destroy() },
        ],
      });
      this.tweens.add({ targets: this.creature, y: this.sol - 110, scale: 0.4, alpha: 0, duration: 1500, delay: 1300 });
    } else {
      this.creature.setFlipX(true);
      this.tweens.add({ targets: this.creature, x: this.ecran.x + this.ecran.largeur + 60, alpha: 0, duration: 1600, delay: 500, ease: "Quad.In" });
    }
    const pourquoi = {
      vieillesse: `${forme.nom} est reparti sur sa planète, à ${age}.\nIl ne t'oubliera jamais.`,
      faim: `${forme.nom} s'est enfui chez le voisin,\nqui a des croquettes.`,
      maladie: `${forme.nom} est parti se soigner\nchez sa grand-mère, sur sa planète.`,
    }[cause];
    this.dire(pourquoi, 6000);
    this.time.delayedCall(4000, () => {
      this.dire("Un nouvel œuf t'attend !\nTape-le pour le réchauffer.", 4000);
      this.etat = nouvelEtat();
      this.creature.setText(formeDe(this.etat).emoji).setPosition(this.creatureX, this.sol).setAlpha(1).setScale(1).setFlipX(false);
      this.sautiller();
      this.enDepart = false;
      this.afficher();
    });
  }

  // Partir, c'est le coucher : il s'endort (💤), l'écran de la console s'éteint, puis le Hub
  quitter() {
    if (this.quitte) {
      return;
    }
    this.quitte = true;
    this.sauver();
    if (this.etat.stade === "oeuf" || this.enDepart) {
      retourAuHub(this);
      return;
    }
    const zzz = this.add.text(this.creature.x + 44, this.creature.y - 90, "💤", { fontSize: this.px(30) + "px" }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: zzz, y: zzz.y - 30, duration: DODO, ease: "Sine.Out" });
    const { x, y, largeur, hauteur } = this.ecran;
    const nuit = this.add.rectangle(x, y, largeur, hauteur, 0x000000, 0).setOrigin(0).setDepth(40);
    this.tweens.add({ targets: nuit, fillAlpha: 0.6, duration: DODO });
    this.time.delayedCall(DODO, () => retourAuHub(this));
  }
}
