// L'arrivée : les résultats, par-dessus la course (qui s'est mise en pause derrière).

import Phaser from "phaser";
import type { Course } from "./Course";
import { chrono } from "../circuits";
import { LARGEUR, HAUTEUR, POLICE } from "../../../socle/style";
import { estTactile } from "../../../socle/tactile";
import { surTouche } from "../../../socle/clavier";

const enCouleur = (couleur: number) => "#" + couleur.toString(16).padStart(6, "0");

export class Arrivee extends Phaser.Scene {
  constructor() {
    super("voiture-arrivee");
  }

  create() {
    const course = this.scene.get("voiture-course") as Course;
    const texte = (y: number, contenu: string, taille: number, couleur: string) =>
      this.add.text(LARGEUR / 2, y, contenu, {
        fontFamily: POLICE, fontSize: taille + "px", fontStyle: "bold", color: couleur,
      }).setOrigin(0.5);

    this.add.rectangle(0, 0, LARGEUR, HAUTEUR, 0x000000, 0.6).setOrigin(0);
    const lignes: Phaser.GameObjects.Text[] = [];

    if (course.mode === "chrono") {
      lignes.push(texte(190, "Arrivée !", 60, "#ff7a1a"));
      lignes.push(texte(270, "Course en " + chrono(course.joueur.tempsTotal), 28, "#ffffff"));
      lignes.push(texte(320, "Record du tour : " + chrono(course.record!.temps), 24, "#ffd479"));
    } else {
      const premier = course.classement[0];
      const titre = premier === course.joueur ? "Tu gagnes !" : premier.nom + " gagne !";
      lignes.push(texte(120, titre, 54, enCouleur(premier.couleur)));
      course.classement.forEach((voiture, i) => {
        const temps = voiture.fini ? chrono(voiture.tempsTotal) : "en course";
        lignes.push(texte(200 + i * 44, (i + 1) + ". " + voiture.nom + "   " + temps, 24, enCouleur(voiture.couleur)));
      });
    }

    // Les lignes arrivent l'une après l'autre : un tween par ligne, chacune un peu plus tard
    lignes.forEach((ligne, i) => {
      ligne.setAlpha(0).y += 30;
      this.tweens.add({ targets: ligne, alpha: 1, y: ligne.y - 30, duration: 350, delay: i * 120, ease: "Cubic.Out" });
    });

    const suite = texte(470, estTactile() ? "Touche l'écran pour continuer" : "Entrée : continuer", 20, "#e9e4f0")
      .setAlpha(0);

    // On attend un peu avant d'écouter : le pouce était peut-être encore sur les commandes
    this.time.delayedCall(1000, () => {
      this.tweens.add({ targets: suite, alpha: 1, duration: 300 });
      let fini = false;
      const continuer = () => {
        if (!fini) {
          fini = true;
          course.quitter();
        }
      };
      surTouche(this, "ENTER", continuer);
      this.input.once("pointerup", continuer);
      this.input.gamepad?.once("down", continuer);
    });
  }
}
