// Le choix des robots : chacun change de modèle avec ses touches gauche et droite, et valide en frappant.
// Contre l'ordinateur, il choisit au hasard, et il est prêt tout de suite.

import Phaser from "phaser";
import { MODELES } from "../modeles";
import { TOUCHES, Clavier, manettes, type Cote } from "../commandes";
import { etiquette } from "../../../socle/touchesPhysiques";
import { lireLeChoix, ecrireLeChoix, type DonneesDeCombat } from "../partie";
import { dessinerArene, enCouleur } from "../decor";
import { cleDePlanche, cleDAnimation, type CouleurDeRobot } from "../textures";
import { BLEU, ORANGE, GRIS, JAUNE } from "../reglages";
import { POLICE } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { surManette, MANETTE, VALIDER } from "../../../socle/manette";
import { estTactile } from "../../../socle/tactile";
import { fonduPuis } from "../../../socle/retour";
import { elargir, suivreLaLargeur } from "../../../socle/largeur";

const PANNEAU = { largeur: 420, hauteur: 400, y: 60 };
const COULEUR: Record<Cote, CouleurDeRobot> = { gauche: "bleu", droite: "orange" };
const TEINTE: Record<Cote, number> = { gauche: BLEU, droite: ORANGE };

// Les caractéristiques, en barres : chacune comparée au meilleur des modèles
const CARACTERISTIQUES = [
  { nom: "Vitesse", valeur: (n: number) => MODELES[n].vitesse },
  { nom: "Saut", valeur: (n: number) => -MODELES[n].saut },
  { nom: "Coup de poing", valeur: (n: number) => MODELES[n].degats },
];

interface Panneau {
  robot: Phaser.GameObjects.Sprite;
  nom: Phaser.GameObjects.Text;
  barres: Phaser.GameObjects.Rectangle[];
  special: Phaser.GameObjects.Text;
  bouton: Phaser.GameObjects.Rectangle;
  etat: Phaser.GameObjects.Text;
}

export class Choix extends Phaser.Scene {
  private solo = false;
  private choix: Record<Cote, number> = { gauche: 0, droite: 0 };
  private prets: Record<Cote, boolean> = { gauche: false, droite: false };
  private panneaux = {} as Record<Cote, Panneau>;
  private sticks: Record<Cote, number> = { gauche: 0, droite: 0 };   // le sens où chaque stick était poussé
  private parti = false;

  constructor() {
    super("baston-choix");
  }

  init(donnees: { solo: boolean }) {
    this.solo = donnees.solo;
    this.choix = lireLeChoix();
    this.prets = { gauche: false, droite: false };
    this.sticks = { gauche: 0, droite: 0 };
    this.parti = false;
  }

  create() {
    elargir(this);
    suivreLaLargeur(this);
    dessinerArene(this);
    this.cameras.main.fadeIn(250);
    this.add.text(this.scale.width / 2, 30, "Choisissez vos robots !", {
      fontFamily: POLICE, fontSize: "30px", fontStyle: "bold", color: "#ffffff",
    }).setOrigin(0.5);

    for (const cote of ["gauche", "droite"] as Cote[]) {
      this.panneaux[cote] = this.creerPanneau(cote);
    }

    // Contre l'ordinateur : il choisit au hasard, et il est prêt
    if (this.solo) {
      this.choix.droite = Phaser.Math.Between(0, MODELES.length - 1);
      this.prets.droite = true;
    }
    this.montrer("gauche");
    this.montrer("droite");

    // Le clavier : les touches de chaque joueur (à leur place sur le clavier). Seul contre
    // l'ordinateur, on peut aussi prendre les flèches et Entrée (le joueur orange n'en a plus besoin).
    const joueurDesFleches: Cote = this.solo ? "gauche" : "droite";
    new Clavier(this, (code) => {
      if (code === TOUCHES.gauche.gauche) this.changer("gauche", -1);
      if (code === TOUCHES.gauche.droite) this.changer("gauche", 1);
      if (code === TOUCHES.gauche.frapper) this.valider("gauche");
      if (code === TOUCHES.droite.gauche) this.changer(joueurDesFleches, -1);
      if (code === TOUCHES.droite.droite) this.changer(joueurDesFleches, 1);
      if (code === TOUCHES.droite.frapper) this.valider(joueurDesFleches);
    });
    if (this.solo) {
      surTouche(this, "ENTER", () => this.valider("gauche"));
    }
    surTouche(this, "ESC", () => this.retour());

    // Les manettes : la première pour le bleu, la deuxième pour l'orange. La croix change de modèle,
    // A ou X valide, B revient au titre.
    // Chaque manette commande son côté
    const pourSonCote = (action: (cote: Cote) => void) => (manette: Phaser.Input.Gamepad.Gamepad) => {
      const cote = this.coteDeLaManette(manette);
      if (cote) {
        action(cote);
      }
    };
    surManette(this, MANETTE.GAUCHE, pourSonCote((cote) => this.changer(cote, -1)));
    surManette(this, MANETTE.DROITE, pourSonCote((cote) => this.changer(cote, 1)));
    surManette(this, [...VALIDER, MANETTE.X], pourSonCote((cote) => this.valider(cote)));
    surManette(this, MANETTE.B, pourSonCote(() => this.retour()));

    const retour = this.add.text(20, 16, "← Retour", { fontFamily: POLICE, fontSize: "18px", color: "#a49cb4" })
      .setInteractive({ useHandCursor: true });
    retour.on("pointerup", () => this.retour());
  }

  // Le stick gauche aussi change de modèle : un coup de stick, un modèle (on attend qu'il revienne au milieu)
  update() {
    for (const manette of manettes(this)) {
      const cote = this.coteDeLaManette(manette);
      if (!cote) {
        continue;
      }
      const sens = manette.leftStick.x < -0.5 ? -1 : manette.leftStick.x > 0.5 ? 1 : 0;
      if (sens !== 0 && this.sticks[cote] === 0) {
        this.changer(cote, sens);
      }
      this.sticks[cote] = sens;
    }
  }

  private coteDeLaManette(manette: Phaser.Input.Gamepad.Gamepad): Cote | null {
    const rang = manettes(this).indexOf(manette);
    if (rang === 0) return "gauche";
    if (rang === 1 && !this.solo) return "droite";
    return null;
  }

  private creerPanneau(cote: Cote): Panneau {
    // Chaque panneau au milieu de sa moitié de l'écran
    const cx = this.scale.width * (cote === "gauche" ? 1 / 4 : 3 / 4);
    const haut = PANNEAU.y;
    const ordinateur = this.solo && cote === "droite";
    this.add.rectangle(cx, haut + PANNEAU.hauteur / 2, PANNEAU.largeur, PANNEAU.hauteur, 0x1c1a25, 0.75)
      .setRounded(16).setStrokeStyle(3, TEINTE[cote]);
    const qui = ordinateur ? "L'ordinateur" : cote === "gauche" ? "Joueur bleu" : "Joueur orange";
    this.add.text(cx, haut + 24, qui, {
      fontFamily: POLICE, fontSize: "18px", fontStyle: "bold", color: enCouleur(TEINTE[cote]),
    }).setOrigin(0.5);

    const robot = this.add.sprite(cx, haut + 175, cleDePlanche(COULEUR[cote])).setOrigin(0.5, 1).setScale(4)
      .setFlipX(cote === "droite");
    robot.play(cleDAnimation(COULEUR[cote], "repos"));

    // Les flèches pour changer de modèle (au doigt et à la souris)
    if (!ordinateur) {
      for (const sens of [-1, 1]) {
        this.add.text(cx + sens * 175, haut + 120, sens < 0 ? "◀" : "▶", {
          fontFamily: POLICE, fontSize: "34px", color: enCouleur(TEINTE[cote]),
        }).setOrigin(0.5).setPadding(18).setInteractive({ useHandCursor: true })
          .on("pointerup", () => this.changer(cote, sens));
      }
    }

    const nom = this.add.text(cx, haut + 205, "", {
      fontFamily: POLICE, fontSize: "28px", fontStyle: "bold", color: "#ffffff",
    }).setOrigin(0.5);
    const barres = CARACTERISTIQUES.map((caracteristique, i) => {
      const y = haut + 245 + i * 26;
      this.add.text(cx - 175, y, caracteristique.nom, { fontFamily: POLICE, fontSize: "16px", color: "#c9c4d8" })
        .setOrigin(0, 0.5);
      this.add.rectangle(cx - 40, y, 210, 12, GRIS).setOrigin(0, 0.5).setRounded(6);
      return this.add.rectangle(cx - 40, y, 0, 12, TEINTE[cote]).setOrigin(0, 0.5).setRounded(6);
    });
    const special = this.add.text(cx, haut + 330, "", { fontFamily: POLICE, fontSize: "16px", color: "#ffd479" })
      .setOrigin(0.5);

    const bouton = this.add.rectangle(cx, haut + 370, 240, 44, GRIS).setRounded(12);
    const etat = this.add.text(cx, haut + 370, "", {
      fontFamily: POLICE, fontSize: "20px", fontStyle: "bold", color: "#ffffff",
    }).setOrigin(0.5);
    if (!ordinateur) {
      bouton.setInteractive({ useHandCursor: true }).on("pointerup", () => this.valider(cote));
    }
    return { robot, nom, barres, special, bouton, etat };
  }

  // Le panneau montre le modèle choisi : son nom, ses barres, son coup spécial, et s'il est prêt
  private montrer(cote: Cote) {
    const p = this.panneaux[cote];
    const n = this.choix[cote];
    p.nom.setText(MODELES[n].nom);
    CARACTERISTIQUES.forEach((caracteristique, i) => {
      const meilleur = Math.max(...MODELES.map((_, k) => caracteristique.valeur(k)));
      // Les barres glissent jusqu'à leur nouvelle longueur. Changer « width » ne suffit pas à un
      // rectangle arrondi : seul setSize redessine ses coins. Le tween appelle donc setSize à chaque pas.
      const barre = p.barres[i];
      this.tweens.add({
        targets: barre,
        width: 210 * caracteristique.valeur(n) / meilleur,
        duration: 200,
        onUpdate: () => barre.setSize(barre.width, barre.height),
      });
    });
    p.special.setText("Spécial : " + MODELES[n].special.toLowerCase());

    const ordinateur = this.solo && cote === "droite";
    if (this.prets[cote]) {
      p.etat.setText(ordinateur ? "Il a choisi !" : "Prêt !").setColor("#1c1a25");
      p.bouton.setFillStyle(JAUNE);
    } else {
      const touche = estTactile() ? "Touche ici" : (this.solo ? "Entrée" : etiquette(TOUCHES[cote].frapper));
      p.etat.setText(touche + " pour valider").setColor("#ffffff");
      p.bouton.setFillStyle(GRIS);
    }
  }

  private changer(cote: Cote, sens: number) {
    if (this.prets[cote] || this.parti) {
      return;                              // déjà prêt : son choix est fait
    }
    this.choix[cote] = Phaser.Math.Wrap(this.choix[cote] + sens, 0, MODELES.length);
    this.montrer(cote);
    const robot = this.panneaux[cote].robot;
    robot.play(cleDAnimation(COULEUR[cote], "marche"));
    robot.playAfterDelay(cleDAnimation(COULEUR[cote], "repos"), 400);
  }

  private valider(cote: Cote) {
    if (this.prets[cote] || this.parti) {
      return;
    }
    this.prets[cote] = true;
    this.montrer(cote);
    const p = this.panneaux[cote];
    // Il frappe dans le vide, une fois, pour dire « je suis prêt »
    p.robot.play(cleDAnimation(COULEUR[cote], "attaque"));
    p.robot.playAfterDelay(cleDAnimation(COULEUR[cote], "repos"), 330);
    this.tweens.add({ targets: [p.bouton, p.etat], scale: { from: 1.25, to: 1 }, duration: 250, ease: "Back.Out" });

    if (this.prets.gauche && this.prets.droite) {
      this.parti = true;
      ecrireLeChoix(this.solo ? { gauche: this.choix.gauche, droite: lireLeChoix().droite } : this.choix);
      const donnees: DonneesDeCombat = { solo: this.solo, modeles: { ...this.choix }, manches: { gauche: 0, droite: 0 } };
      this.time.delayedCall(500, () => fonduPuis(this, () => this.scene.start("baston-combat", donnees)));
    }
  }

  private retour() {
    if (!this.parti) {
      this.parti = true;
      fonduPuis(this, () => this.scene.start("baston-titre"));
    }
  }
}
