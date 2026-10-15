// Le jeu du vrai Tamagotchi : 5 manches, il va regarder à gauche ou à droite, devine de quel côté.
// Trois manches gagnées lui rendent un cœur de Moral (Ecran.finDuJeu). Il se joue sur l'écran de la
// console, par-dessus l'écran du Tamago (qui est en pause pendant ce temps). Échap, B ou ✕ l'arrêtent
// en route, sans rien gagner ni perdre (comme sur le vrai).

import Phaser from "phaser";
import type { Ecran } from "./Ecran";
import { formeDe } from "../vie";
import { habillage as h, places } from "../habillage";
import { surTouche } from "../../../socle/clavier";
import { toucheDuSon } from "../../../socle/son";
import { surManette, MANETTE } from "../../../socle/manette";
import { boutonFermer } from "../../../socle/boutonArcade";

const MANCHES = 5;

export class Jeu extends Phaser.Scene {
  manche = 0;
  gagnees = 0;
  attend = false;                          // on attend ta réponse
  private fini = false;
  private creature!: Phaser.GameObjects.Text;
  private titre!: Phaser.GameObjects.Text;
  private score!: Phaser.GameObjects.Text;
  private centre = places(960).centre;     // le milieu de l'écran de la console (le jeu peut être élargi)

  constructor() {
    super("tamago-jeu");
  }

  create() {
    const ecran = this.scene.get("tamago-ecran") as Ecran;
    this.manche = 0;
    this.gagnees = 0;
    this.attend = false;
    this.fini = false;
    const { ecran: ECRAN, centre: CENTRE_ECRAN, echelle } = places(this.scale.width);
    const taille = (n: number) => Math.round(n * echelle) + "px";
    this.centre = CENTRE_ECRAN;

    // Un fond qui recouvre l'écran de la console
    this.add.rectangle(ECRAN.x + 3, ECRAN.y + 3, ECRAN.largeur - 6, ECRAN.hauteur - 6, h.ecran.fond).setOrigin(0);
    this.titre = this.add.text(CENTRE_ECRAN.x, ECRAN.y + 26, "", {
      fontFamily: h.pixel, fontSize: taille(11), color: h.ecran.texte, align: "center",
    }).setOrigin(0.5);
    this.score = this.add.text(CENTRE_ECRAN.x, ECRAN.y + ECRAN.hauteur - 22, "", {
      fontFamily: h.police, fontSize: taille(18), color: h.ecran.texte,
    }).setOrigin(0.5);
    this.creature = this.add.text(CENTRE_ECRAN.x, CENTRE_ECRAN.y + 40, formeDe(ecran.etat).emoji, { fontSize: taille(72), padding: { top: 10 } })
      .setOrigin(0.5, 1);

    // Les deux flèches : à toucher, ou ← →
    for (const [cote, x] of [["gauche", ECRAN.x + 60], ["droite", ECRAN.x + ECRAN.largeur - 60]] as const) {
      const fleche = this.add.text(x, CENTRE_ECRAN.y + 10, cote === "gauche" ? "◀" : "▶", {
        fontFamily: h.police, fontSize: taille(54), color: h.accent,
      }).setOrigin(0.5).setPadding(16).setInteractive({ useHandCursor: true });
      fleche.on("pointerup", () => this.deviner(cote));
    }
    boutonFermer(this, ECRAN.x + ECRAN.largeur - 24, ECRAN.y + 20, () => this.arreter(), { police: h.police, couleur: h.ecran.texte, taille: 20 });
    surTouche(this, "LEFT", () => this.deviner("gauche"));
    surTouche(this, "RIGHT", () => this.deviner("droite"));
    surTouche(this, "ESC", () => this.arreter());
    surManette(this, MANETTE.GAUCHE, () => this.deviner("gauche"));
    surManette(this, MANETTE.DROITE, () => this.deviner("droite"));
    surManette(this, MANETTE.B, () => this.arreter());
    // M coupe le son ici aussi : l'écran, en pause dessous, n'entend plus le clavier
    toucheDuSon(this, "tamago", () => ecran.montrerLeSon());
    this.mancheSuivante();
  }

  private mancheSuivante() {
    this.manche++;
    this.attend = true;
    this.creature.setX(this.centre.x).setFlipX(false);
    this.titre.setText(`MANCHE ${this.manche}/${MANCHES}\nGAUCHE OU DROITE ?`);
    this.score.setText("Gagnées : " + "⭐".repeat(this.gagnees) + "▫️".repeat(MANCHES - this.gagnees));
  }

  // Ta réponse : il regarde d'un côté au hasard (les tests peuvent choisir son hasard)
  deviner(cote: "gauche" | "droite") {
    if (!this.attend) {
      return;
    }
    this.attend = false;
    const ecran = this.scene.get("tamago-ecran") as Ecran;
    const regarde = ecran.hasard() < 0.5 ? "gauche" : "droite";
    const gagne = regarde === cote;
    if (gagne) {
      this.gagnees++;
    }
    this.creature.setFlipX(regarde === "droite");
    this.tweens.add({ targets: this.creature, x: this.centre.x + (regarde === "gauche" ? -50 : 50), duration: 200 });
    this.sound.play(gagne ? "tamago-joie" : "tamago-non", { volume: 0.6 });
    this.titre.setText(gagne ? "GAGNÉ !" : "RATÉ !");
    this.score.setText("Gagnées : " + "⭐".repeat(this.gagnees) + "▫️".repeat(MANCHES - this.gagnees));
    this.time.delayedCall(900, () => {
      if (this.manche < MANCHES) {
        this.mancheSuivante();
      } else {
        this.finir();
      }
    });
  }

  private finir() {
    this.fini = true;
    this.titre.setText(this.gagnees >= 3 ? `BRAVO ! ${this.gagnees}/${MANCHES}` : `PERDU... ${this.gagnees}/${MANCHES}`);
    this.time.delayedCall(900, () => {
      const ecran = this.scene.get("tamago-ecran") as Ecran;
      this.scene.stop();
      ecran.finDuJeu(this.gagnees);
    });
  }

  // Arrêté en route : la partie ne compte pas
  private arreter() {
    if (this.fini) {
      return;
    }
    this.fini = true;
    const ecran = this.scene.get("tamago-ecran") as Ecran;
    this.scene.stop();
    ecran.jeuArrete();
  }
}
