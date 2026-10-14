// Le titre : deux robots qui se toisent, et le choix du mode (contre l'ordinateur, ou à deux).

import Phaser from "phaser";
import { dessinerArene, enCouleur } from "../decor";
import { ListeDeBoutons, type Choix } from "../../../socle/listeDeBoutons";
import { lireLeBilan } from "../partie";
import { manettes, TOUCHES, type Cote } from "../commandes";
import { etiquette } from "../../../socle/touchesPhysiques";
import { cleDePlanche, cleDAnimation } from "../textures";
import { SOL, ECHELLE, ORANGE } from "../reglages";
import { POLICE } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { surManette, MANETTE } from "../../../socle/manette";
import { estTactile } from "../../../socle/tactile";
import { retourAuHub, fonduPuis } from "../../../socle/retour";
import { elargir, suivreLaLargeur } from "../../../socle/largeur";
import { boutonArcade } from "../../../socle/boutonArcade";

export class Titre extends Phaser.Scene {
  private parti = false;

  constructor() {
    super("baston-titre");
  }

  create() {
    this.parti = false;
    // Au doigt, la baston prend toute la largeur du téléphone (voir socle/largeur.ts)
    elargir(this);
    suivreLaLargeur(this);
    const milieu = this.scale.width / 2;   // la baston peut être plus large que 960 (au doigt)
    dessinerArene(this);
    this.cameras.main.fadeIn(250);

    const titre = this.add.text(milieu, 70, "La baston de robots", {
      fontFamily: POLICE, fontSize: "54px", fontStyle: "bold", color: "#ffffff",
      stroke: "#1c1a25", strokeThickness: 8,
    }).setOrigin(0.5);
    // Le titre arrive d'en haut et rebondit : un tween avec un « ease » qui dépasse puis revient
    titre.y -= 120;
    this.tweens.add({ targets: titre, y: titre.y + 120, duration: 600, ease: "Bounce.Out" });

    // Les deux robots, chacun dans son coin, qui respirent (leur animation « repos »)
    const bleu = this.add.sprite(150, SOL, cleDePlanche("bleu")).setOrigin(0.5, 1).setScale(ECHELLE * 1.5);
    bleu.play(cleDAnimation("bleu", "repos"));
    const orange = this.add.sprite(this.scale.width - 150, SOL, cleDePlanche("orange")).setOrigin(0.5, 1)
      .setScale(ECHELLE * 1.5).setFlipX(true);
    orange.play(cleDAnimation("orange", "repos"));
    // De temps en temps, l'un frappe dans le vide, puis reprend son souffle
    this.time.addEvent({
      delay: 1400,
      loop: true,
      callback: () => {
        const robot = Phaser.Math.RND.pick([bleu, orange]);
        const couleur = robot === bleu ? "bleu" : "orange";
        robot.play(cleDAnimation(couleur, "attaque"));
        robot.playAfterDelay(cleDAnimation(couleur, "repos"), 330);
      },
    });

    boutonArcade(this);

    // À deux, il faut deux mains sur un clavier, ou deux manettes : au doigt seul, on ne le propose pas
    const choix: Choix[] = [
      { nom: "Contre l'ordinateur", aide: estTactile() ? "Toi contre lui" : "O", action: () => this.lancer(true) },
    ];
    if (!estTactile() || manettes(this).length >= 2) {
      choix.push({ nom: "À deux", aide: "D", action: () => this.lancer(false) });
    }
    new ListeDeBoutons(this, choix, { x: milieu, y: 190, largeur: 380, hauteur: 70, ecart: 90 }, { couleur: ORANGE });
    surTouche(this, "O", () => this.lancer(true));
    surTouche(this, "D", () => this.lancer(false));
    surTouche(this, "ESC", () => retourAuHub(this));
    surManette(this, MANETTE.B, () => retourAuHub(this));

    const bilan = lireLeBilan();
    if (bilan.victoires + bilan.defaites > 0) {
      this.add.text(milieu, 380, `Contre l'ordinateur : ${bilan.victoires} gagné${bilan.victoires > 1 ? "s" : ""}, ${bilan.defaites} perdu${bilan.defaites > 1 ? "s" : ""}`, {
        fontFamily: POLICE, fontSize: "18px", fontStyle: "bold", color: "#ffd479",
      }).setOrigin(0.5);
    }

    const aide = estTactile()
      ? "Pouce gauche : glisse pour marcher et sauter.     Pouce droit : frappe, tire, et le coup spécial !"
      : "Bleu : " + touches("gauche") + "     Orange : " + touches("droite") + "     Manettes : A saute, X frappe, Y tire";
    this.add.text(milieu, 470, aide, { fontFamily: POLICE, fontSize: "16px", color: "#e9e4f0" }).setOrigin(0.5);
    if (!estTactile()) {
      this.add.text(milieu, 496, "Tirer avec la jauge pleine : le coup spécial !", {
        fontFamily: POLICE, fontSize: "15px", color: enCouleur(ORANGE),
      }).setOrigin(0.5);
    }
  }

  private lancer(solo: boolean) {
    if (this.parti) {
      return;
    }
    this.parti = true;
    fonduPuis(this, () => this.scene.start("baston-choix", { solo }));
  }
}

// Les touches d'un joueur, comme elles sont écrites sur le clavier : « Q D Z F G »
function touches(cote: Cote) {
  return Object.values(TOUCHES[cote]).map(etiquette).join(" ");
}
