// L'écran du Tamago : la console en forme d'œuf, son écran, la créature, ses crottes, et les huit
// boutons de soin. C'est la scène du jeu : le Tamago ne vit que quand elle tourne (update avance sa vie).
// Quand on s'en va (le Hub, un autre onglet, le téléphone verrouillé), Phaser ne l'appelle plus : il dort.
//
// Toute la logique est dans vie.ts ; ici, on la montre. Les soins passent par agir(), les événements de
// la vie (une crotte, un appel, une évolution...) par reagir().

import Phaser from "phaser";
import {
  nouvelEtat, avancer, relire, formeDe, ageEnAnnees, taperLOeuf, nourrir, donnerUneFriandise, peutJouer,
  finirLeJeu, nettoyer, soigner, gronder, caresser, type Etat, type Evenement, type Reponse, type Hasard, type Fin,
} from "../vie";
import { replique, parleDeCrotte, parleDuRoi, merci, REFUS, bonjour } from "../repliques";
import { garderEnSouvenir, recevoirUnVisiteur, ETAT } from "../souvenirs";
import { habillage as h, CONSOLE, ECRAN, CENTRE_ECRAN } from "../habillage";
import { COEURS, PAROLE_MIN, PAROLE_MAX, SECONDE } from "../reglages";
import { appliquerLeSon, quitterLeTamago, basculerLeSon, sonAllume, toucheDuSon } from "../son";
import { LARGEUR } from "../../../socle/style";
import { lire, ecrire } from "../../../socle/sauvegarde";
import { surTouche } from "../../../socle/clavier";
import { retourAuHub } from "../../../socle/retour";
import { boutonArcade } from "../../../socle/boutonArcade";

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

// Les places dans l'écran
const SOL = ECRAN.y + ECRAN.hauteur - 50;  // le bas de la créature et des crottes
const CREATURE_X = CENTRE_ECRAN.x - 40;
const BOUTONS_Y = 412;
const SAUVER_TOUTES_LES = 5 * SECONDE;
const RAPPEL_D_APPEL = 10 * SECONDE;       // un appel bipe de nouveau tant qu'on n'y répond pas

interface Bouton {
  fond: Phaser.GameObjects.Arc;
  icone: Phaser.GameObjects.Text;
}

export class Ecran extends Phaser.Scene {
  etat!: Etat;
  hasard: Hasard = Math.random;            // les tests peuvent le remplacer
  private creature!: Phaser.GameObjects.Text;
  private nom!: Phaser.GameObjects.Text;
  private age!: Phaser.GameObjects.Text;
  private statut!: Phaser.GameObjects.Text;
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
  private boutonDuSon!: Phaser.GameObjects.Text;
  private avantParole = PAROLE_MIN;
  private avantSauvegarde = SAUVER_TOUTES_LES;
  private avantRappel = 0;
  private bulleJusqua = 0;
  private enDepart = false;                // l'animation de son départ : on ne touche plus à rien
  private quitte = false;

  constructor() {
    super("tamago-ecran");
  }

  create() {
    this.etat = relire(lire(ETAT)) ?? nouvelEtat();
    this.crottes = [];
    this.roi = null;
    this.boutons = [];
    this.enDepart = false;
    this.quitte = false;
    appliquerLeSon(this);
    this.cameras.main.setBackgroundColor(h.fond).fadeIn(300);

    this.dessinerLaConsole();
    this.creerLEcran();
    this.creerLesBoutons();

    boutonArcade(this, () => this.quitter(), { police: h.police, fond: 0x1e1e5a, fondAlpha: 0.8 });
    this.boutonDuSon = this.add.text(LARGEUR - 20, 20, "", { fontFamily: h.police, fontSize: "18px", color: h.ecran.doux })
      .setOrigin(1, 0).setPadding(8).setInteractive({ useHandCursor: true }).setDepth(1000);
    this.boutonDuSon.on("pointerup", () => {
      basculerLeSon(this);
      this.montrerLeSon();
    });
    this.montrerLeSon();

    this.ecouterLeClavierEtLaManette();
    this.ecouterLesAllersEtRetours();
    this.afficher();
    this.creature.setText(formeDe(this.etat).emoji);
    if (this.etat.stade !== "oeuf") {
      // Il dormait pendant ton absence
      this.time.delayedCall(400, () => this.dire(bonjour(this.hasard)));
    } else {
      this.dire(this.etat.tapes === 0 ? "Tape l'œuf pour le réchauffer !" : "Encore un peu !");
    }
  }

  // —— Le décor ——

  // La console en forme d'œuf : une ellipse plus étroite en haut, un halo néon, l'écran et ses lignes
  private dessinerLaConsole() {
    const points: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const y = Math.cos(a);
      const largeur = y < 0 ? 0.86 + 0.14 * (1 + y) : 1;   // le haut se resserre
      points.push(new Phaser.Math.Vector2(CONSOLE.x + Math.sin(a) * CONSOLE.rx * largeur, CONSOLE.y - y * CONSOLE.ry));
    }
    const g = this.add.graphics();
    g.lineStyle(14, h.console.halo, 0.18).strokePoints(points, true);
    g.fillStyle(h.console.couleur).fillPoints(points, true);
    g.lineStyle(4, h.console.bord, 0.9).strokePoints(points, true);
    g.fillStyle(h.ecran.fond).fillRoundedRect(ECRAN.x, ECRAN.y, ECRAN.largeur, ECRAN.hauteur, 16);
    g.lineStyle(3, h.ecran.bord, 0.8).strokeRoundedRect(ECRAN.x, ECRAN.y, ECRAN.largeur, ECRAN.hauteur, 16);
    // Les lignes d'un vieil écran, par-dessus tout ce qui s'y dessine
    const lignes = this.add.graphics().setDepth(50);
    lignes.fillStyle(0x000000, 0.12);
    for (let y = ECRAN.y + 4; y < ECRAN.y + ECRAN.hauteur - 4; y += 4) {
      lignes.fillRect(ECRAN.x + 4, y, ECRAN.largeur - 8, 1);
    }
    this.add.text(CONSOLE.x, 58, "TAMAGO-XTREME", { fontFamily: h.pixel, fontSize: "16px", color: h.accent })
      .setOrigin(0.5).setShadow(0, 0, h.accent, 8, true, true);
  }

  private creerLEcran() {
    const style = { fontFamily: h.pixel, fontSize: "11px", color: h.ecran.texte };
    this.nom = this.add.text(ECRAN.x + 16, ECRAN.y + 16, "", style);
    this.age = this.add.text(ECRAN.x + ECRAN.largeur - 16, ECRAN.y + 16, "", style).setOrigin(1, 0);
    this.statut = this.add.text(CENTRE_ECRAN.x, ECRAN.y + ECRAN.hauteur - 22, "", {
      fontFamily: h.police, fontSize: "17px", color: h.ecran.texte,
    }).setOrigin(0.5);
    this.iconeAppel = this.add.text(ECRAN.x + ECRAN.largeur - 22, ECRAN.y + 50, "📣", { fontSize: "24px" }).setOrigin(0.5).setVisible(false);
    this.tweens.add({ targets: this.iconeAppel, alpha: 0.2, duration: 300, yoyo: true, repeat: -1 });
    this.iconeMalade = this.add.text(CREATURE_X + 52, SOL - 92, "🤒", { fontSize: "26px" }).setOrigin(0.5).setVisible(false);

    // La créature : un emoji qui sautille. Toucher, c'est la caresser (ou réchauffer l'œuf).
    this.creature = this.add.text(CREATURE_X, SOL, "", { fontSize: "80px", padding: { top: 12 } })
      .setOrigin(0.5, 1).setInteractive({ useHandCursor: true });
    this.creature.on("pointerup", () => this.agir("caresser"));
    this.tweens.add({ targets: this.creature, scaleY: 0.92, duration: 450, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    this.time.addEvent({ delay: 2600, loop: true, callback: () => this.promener() });

    // La bulle : ce qu'il dit
    this.fondBulle = this.add.rectangle(0, 0, 100, 40, h.bulle.fond).setRounded(12);
    this.texteBulle = this.add.text(0, 0, "", {
      fontFamily: h.police, fontSize: "15px", color: h.bulle.texte, align: "center", wordWrap: { width: 300 },
    }).setOrigin(0.5);
    this.bulle = this.add.container(CENTRE_ECRAN.x, ECRAN.y + 74, [this.fondBulle, this.texteBulle]).setDepth(20).setVisible(false);

    this.etincelles = this.add.particles(0, 0, "etincelle", {
      emitting: false, lifespan: 600, speed: { min: 60, max: 180 }, scale: { start: 1.2, end: 0 },
      tint: [0xff2d95, 0x00f3ff, 0x39ff14, 0xfff700], blendMode: "ADD",
    }).setDepth(30);
  }

  private creerLesBoutons() {
    const ecart = 62;
    ACTIONS.forEach((action, i) => {
      const x = CONSOLE.x + (i - (ACTIONS.length - 1) / 2) * ecart;
      const fond = this.add.circle(x, BOUTONS_Y, 26, 0x2a2a70).setStrokeStyle(3, h.console.bord, 0.5)
        .setInteractive({ useHandCursor: true });
      const icone = this.add.text(x, BOUTONS_Y, action.emoji, { fontSize: "26px", padding: { top: 4 } }).setOrigin(0.5);
      this.add.text(x, BOUTONS_Y + 40, action.nom, { fontFamily: h.police, fontSize: "12px", color: h.ecran.doux }).setOrigin(0.5);
      fond.on("pointerover", () => this.choisir(i));
      fond.on("pointerup", () => {
        this.choisir(i);
        this.agir(action.id);
      });
      this.boutons.push({ fond, icone });
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

  private montrerLeSon() {
    this.boutonDuSon.setText(sonAllume() ? "🔊 Son (M)" : "🔇 Muet (M)");
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
    toucheDuSon(this, () => this.montrerLeSon());
    this.input.gamepad?.on("down", (_m: Phaser.Input.Gamepad.Gamepad, bouton: Phaser.Input.Gamepad.Button) => {
      switch (bouton.index) {
        case 14: this.choisir(this.choisi - 1); break;
        case 15: this.choisir(this.choisi + 1); break;
        case 0: this.agir(ACTIONS[this.choisi].id); break;
        case 1: this.quitter(); break;
      }
    });
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

  // L'écran suit l'état : le nom, l'âge, les cœurs, les crottes, les icônes
  private afficher() {
    const e = this.etat;
    const forme = formeDe(e);
    this.nom.setText(forme.nom.toUpperCase());
    this.age.setText(e.stade === "oeuf" ? "" : ageEnAnnees(e) + (ageEnAnnees(e) > 1 ? " ANS" : " AN"));
    const coeurs = (n: number) => h.coeur.plein.repeat(n) + h.coeur.vide.repeat(COEURS - n);
    this.statut.setText(e.stade === "oeuf" ? "" : `🍙 ${coeurs(e.ventre)}     💖 ${coeurs(e.moral)}`);
    this.iconeAppel.setVisible(!!e.appel);
    this.iconeMalade.setVisible(e.malade > 0).setX(this.creature.x + 52);

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
      // La couronne sur la tête : deux lignes d'un même texte
      this.roi = this.add.text(ECRAN.x + ECRAN.largeur - 70, SOL, "👑\n💩", {
        fontSize: "50px", align: "center", lineSpacing: -18, padding: { top: 20 },
      }).setOrigin(0.5, 1).setScale(0);
      this.tweens.add({ targets: this.roi, scale: 1, duration: 500, ease: "Back.Out" });
      this.tweens.add({ targets: this.roi, angle: { from: -6, to: 6 }, duration: 400, yoyo: true, repeat: -1 });
    } else if (e.roiCaca === null && this.roi) {
      this.etincelles.explode(40, this.roi.x, this.roi.y - 30);
      this.tweens.killTweensOf(this.roi);
      this.roi.destroy();
      this.roi = null;
    }
  }

  private ajouterUneCrotte() {
    const i = this.crottes.length;
    const x = ECRAN.x + ECRAN.largeur - 44 - (i % 2) * 44;
    const y = SOL - Math.floor(i / 2) * 6;
    const crotte = this.add.text(x, y, "💩", { fontSize: "30px", padding: { top: 6 } }).setOrigin(0.5, 1).setScale(0);
    this.tweens.add({ targets: crotte, scale: 1, duration: 300, ease: "Back.Out" });
    // Une crotte vivante se dandine
    this.tweens.add({ targets: crotte, angle: { from: -8, to: 8 }, duration: 500 + i * 90, yoyo: true, repeat: -1 });
    this.crottes.push(crotte);
  }

  // Il se promène un peu dans l'écran (pas sur ses crottes)
  private promener() {
    if (this.etat.stade === "oeuf" || this.enDepart) {
      return;
    }
    const x = Phaser.Math.Between(ECRAN.x + 70, ECRAN.x + ECRAN.largeur - 150);
    this.creature.setFlipX(x > this.creature.x);
    this.tweens.add({ targets: this.creature, x, duration: 900, ease: "Sine.InOut" });
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
      this.dire("Il bouge !!!");
      this.tweens.add({ targets: this.creature, x: CREATURE_X + 4, duration: 50, yoyo: true, repeat: -1 });
    } else {
      this.dire(["Toc.", "Toc toc.", "Ça chauffe...", "Encore une fois !"][this.etat.tapes - 1] ?? "", 1200);
    }
    this.sauver();
  }

  // Un objet (un repas, une friandise, un médicament) vole jusqu'à lui
  private donner(emoji: string, son: string, texte: string) {
    const objet = this.add.text(CENTRE_ECRAN.x + 120, ECRAN.y + 60, emoji, { fontSize: "34px" }).setOrigin(0.5).setDepth(10);
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
    const eponge = this.add.text(ECRAN.x + 20, SOL - 20, "🧽", { fontSize: "36px" }).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: eponge, x: ECRAN.x + ECRAN.largeur - 20, duration: 450, onComplete: () => eponge.destroy() });
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
        this.creature.setPosition(CREATURE_X, SOL).setScale(1).setAngle(0);
        this.tweens.add({ targets: this.creature, scaleY: 0.92, duration: 450, yoyo: true, repeat: -1, ease: "Sine.InOut" });
        this.sound.play("tamago-eclosion");
        this.cameras.main.flash(300, 255, 255, 255);
        this.etincelles.explode(40, this.creature.x, this.creature.y - 40);
        this.creature.setText(formeDe(this.etat).emoji);
        this.dire("Piou ?");
        break;
      case "evolution":
        this.sound.play("tamago-evolution");
        this.cameras.main.flash(500, 255, 255, 255);
        this.etincelles.explode(60, this.creature.x, this.creature.y - 40);
        this.creature.setText(ev.forme.emoji);
        this.tweens.add({ targets: this.creature, scale: { from: 0.3, to: 1 }, duration: 600, ease: "Back.Out" });
        this.dire(`~ ÉVOLUTION ~\n${ev.forme.nom} ${ev.forme.emoji}, ${ev.forme.caractere} !`, 4500);
        break;
      case "crotte":
        this.sound.play("tamago-prout");
        break;
      case "roi-caca":
        this.sound.play("tamago-roi");
        this.cameras.main.shake(400, 0.01);
        this.time.delayedCall(300, () => this.dire("👑💩 " + parleDuRoi(this.hasard) + "\n(Nettoie-le 5 fois !)", 4000));
        break;
      case "malade":
        this.dire("Je me sens pas bien...");
        break;
      case "appel":
        this.avantRappel = 0;              // le bip part tout de suite
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
    this.sound.play("tamago-surprise");
    const objet = this.add.text(ECRAN.x + 30, ECRAN.y + 70, emoji, { fontSize: "44px" }).setOrigin(0.5).setDepth(10).setAlpha(0);
    this.tweens.chain({
      targets: objet,
      tweens: [
        { alpha: 1, x: CENTRE_ECRAN.x + 90, duration: 900, ease: "Sine.Out" },
        { y: ECRAN.y + 60, duration: 300, yoyo: true, repeat: 2 },
        { alpha: 0, x: ECRAN.x + ECRAN.largeur - 30, duration: 700, delay: 900, onComplete: () => objet.destroy() },
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
    garderEnSouvenir(this.etat);
    const forme = formeDe(this.etat);
    const ans = ageEnAnnees(this.etat);
    // Le nouvel œuf est déjà sauvé : un départ coupé en plein milieu ne fait rien perdre
    ecrire(ETAT, nouvelEtat());
    this.sound.play("tamago-depart");
    this.tweens.killTweensOf(this.creature);
    if (cause === "vieillesse") {
      const soucoupe = this.add.text(this.creature.x, ECRAN.y - 40, "🛸", { fontSize: "56px" }).setOrigin(0.5).setDepth(10);
      this.tweens.chain({
        targets: soucoupe,
        tweens: [
          { y: SOL - 150, duration: 1200, ease: "Sine.Out" },
          { y: ECRAN.y - 60, duration: 1500, delay: 600, ease: "Sine.In", onComplete: () => soucoupe.destroy() },
        ],
      });
      this.tweens.add({ targets: this.creature, y: SOL - 110, scale: 0.4, alpha: 0, duration: 1500, delay: 1300 });
    } else {
      this.creature.setFlipX(true);
      this.tweens.add({ targets: this.creature, x: ECRAN.x + ECRAN.largeur + 60, alpha: 0, duration: 1600, delay: 500, ease: "Quad.In" });
    }
    const pourquoi = {
      vieillesse: `${forme.nom} est reparti sur sa planète, à ${ans} ans.\nIl ne t'oubliera jamais.`,
      faim: `${forme.nom} s'est enfui chez le voisin,\nqui a des croquettes.`,
      maladie: `${forme.nom} est parti se soigner\nchez sa grand-mère, sur sa planète.`,
    }[cause];
    this.dire(pourquoi, 6000);
    this.time.delayedCall(4000, () => {
      this.dire("Un nouvel œuf t'attend !\nTape-le pour le réchauffer.", 4000);
      this.etat = nouvelEtat();
      this.creature.setText(formeDe(this.etat).emoji).setPosition(CREATURE_X, SOL).setAlpha(1).setScale(1).setFlipX(false);
      this.tweens.add({ targets: this.creature, scaleY: 0.92, duration: 450, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      this.enDepart = false;
      this.afficher();
    });
  }

  quitter() {
    if (this.quitte) {
      return;
    }
    this.quitte = true;
    this.sauver();
    quitterLeTamago(this);
    retourAuHub(this);
  }
}

