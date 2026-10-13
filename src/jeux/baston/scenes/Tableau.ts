// Le tableau de bord : une scène lancée par-dessus le combat (this.scene.launch).
// Sa caméra ne tremble pas et ne zoome pas avec celle du combat : les barres de vie, les annonces
// et les commandes au doigt restent nettes et à leur place.

import Phaser from "phaser";
import type { Combat, Phase } from "./Combat";
import type { Robot } from "../Robot";
import { TOUCHES, etiquette, manettes, type Cote, type NomDeCommande } from "../commandes";
import { enCouleur } from "../decor";
import { VIE, JAUGE, SOL, GRIS, JAUNE, MANCHES_GAGNANTES } from "../reglages";
import { LARGEUR, POLICE } from "../../../socle/style";
import { estTactile } from "../../../socle/tactile";

const BARRE = { largeur: 300, marge: 20 };

// Les commandes au doigt : se déplacer à gauche du téléphone, se battre à droite
const COMMANDES: { action: NomDeCommande; x: number; y: number; rayon: number; icone: string }[] = [
  { action: "gauche", x: 82, y: 466, rayon: 62, icone: "◀" },
  { action: "droite", x: 222, y: 466, rayon: 62, icone: "▶" },
  { action: "frapper", x: 866, y: 462, rayon: 62, icone: "👊" },
  { action: "saut", x: 735, y: 488, rayon: 46, icone: "▲" },
  { action: "tirer", x: 770, y: 368, rayon: 42, icone: "⚡" },
  { action: "special", x: 888, y: 322, rayon: 44, icone: "★" },
];

interface Barres {
  vie: Phaser.GameObjects.Rectangle;
  traine: Phaser.GameObjects.Rectangle;    // la vie perdue reste un instant en blanc, puis fond
  jauge: Phaser.GameObjects.Rectangle;
  manches: Phaser.GameObjects.Arc[];
  vieAffichee: number;
}

export class Tableau extends Phaser.Scene {
  private combat!: Combat;
  private barres = {} as Record<Cote, Barres>;
  private grosTexte!: Phaser.GameObjects.Text;
  private sousTitre!: Phaser.GameObjects.Text;
  private cases = {} as Record<Cote, Phaser.GameObjects.Rectangle[]>;
  private boutonSpecial?: Phaser.GameObjects.Arc;
  private doigts = new Map<number, NomDeCommande>();   // pour chaque doigt posé : la commande qu'il tient

  constructor() {
    super("baston-tableau");
  }

  create() {
    this.combat = this.scene.get("baston-combat") as Combat;
    this.doigts.clear();
    this.boutonSpecial = undefined;

    this.barres.gauche = this.creerBarres("gauche", this.combat.gauche);
    this.barres.droite = this.creerBarres("droite", this.combat.droite);

    this.grosTexte = this.add.text(LARGEUR / 2, 170, "", {
      fontFamily: POLICE, fontSize: "96px", fontStyle: "bold", color: "#ffffff",
      stroke: "#1c1a25", strokeThickness: 10,
    }).setOrigin(0.5).setAlpha(0);
    this.sousTitre = this.add.text(LARGEUR / 2, 245, "", {
      fontFamily: POLICE, fontSize: "26px", fontStyle: "bold", color: "#ffffff",
      stroke: "#1c1a25", strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0);

    // Le bouton pour revenir au titre, en haut au milieu (entre les deux barres de vie)
    this.add.text(LARGEUR / 2, 30, "✕", { fontFamily: POLICE, fontSize: "28px", color: "#ffffff" })
      .setOrigin(0.5).setPadding(10).setInteractive({ useHandCursor: true })
      .on("pointerup", () => this.combat.quitter());

    if (estTactile()) {
      this.creerCommandes();
    } else {
      this.creerCases("gauche", BARRE.marge);
      this.creerCases("droite", LARGEUR - 5 * 62 - BARRE.marge + 4);
    }

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
    const x = aDroite ? LARGEUR - BARRE.marge : BARRE.marge;
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

  private creerCommandes() {
    for (const commande of COMMANDES) {
      const { x, y, rayon } = commande;
      const rond = this.add.circle(x, y, rayon, 0xffffff, 0.18).setStrokeStyle(3, 0xffffff, 0.7);
      // La zone sensible est un peu plus grande que le bouton (un pouce, ça déborde).
      // Ses coordonnées se comptent depuis le coin haut gauche du rond.
      rond.setInteractive(new Phaser.Geom.Circle(rayon, rayon, rayon * 1.25), Phaser.Geom.Circle.Contains);
      rond.setData("action", commande.action);
      // Un doigt se pose sur le bouton, ou y glisse en restant appuyé : il le tient.
      // Il le lâche en se levant, ou en glissant hors du bouton.
      rond.on("pointerdown", (doigt: Phaser.Input.Pointer) => this.tenir(doigt, commande.action));
      rond.on("pointerover", (doigt: Phaser.Input.Pointer) => {
        if (doigt.isDown) {
          this.tenir(doigt, commande.action);
        }
      });
      rond.on("pointerout", (doigt: Phaser.Input.Pointer) => this.lacher(doigt));
      this.add.text(x, y, commande.icone, {
        fontFamily: POLICE, fontSize: Math.round(rayon * 0.75) + "px", color: "#ffffff",
      }).setOrigin(0.5).setAlpha(0.9);
      if (commande.action === "special") {
        this.boutonSpecial = rond;
      }
    }
    this.input.on("pointerup", (doigt: Phaser.Input.Pointer) => this.lacher(doigt));
  }

  private tenir(doigt: Phaser.Input.Pointer, action: NomDeCommande) {
    this.doigts.set(doigt.id, action);
    this.combat.appuis.add(action);
    this.recompterLesDoigts();
  }

  private lacher(doigt: Phaser.Input.Pointer) {
    this.doigts.delete(doigt.id);
    this.recompterLesDoigts();
  }

  private recompterLesDoigts() {
    const tenues = new Set(this.doigts.values());
    for (const commande of COMMANDES) {
      this.combat.tactile[commande.action] = tenues.has(commande.action);
    }
    for (const objet of this.children.list) {
      if (objet instanceof Phaser.GameObjects.Arc && objet.getData("action")) {
        objet.setFillStyle(0xffffff, tenues.has(objet.getData("action")) ? 0.45 : 0.18);
      }
    }
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
    if (this.boutonSpecial) {
      const pret = this.combat.gauche.jauge >= JAUGE;
      this.boutonSpecial.setStrokeStyle(pret ? 6 : 3, pret ? JAUNE : 0xffffff, pret ? 1 : 0.4);
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
