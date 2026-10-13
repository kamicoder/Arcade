// L'arrivée : le classement de la course, par-dessus la course figée derrière.

import Phaser from "phaser";
import type { Course } from "./Course";
import type { Resultat } from "../Coureuse";
import { chrono, rangTexte } from "../circuits";
import { GRAND_PRIX } from "../donnees";
import { COULEURS } from "../reglages";
import { textureDeLicorne } from "../textures";
import { ecrire, titre, bouton, touche, confettis, arcEnCiel } from "../interface";
import { LARGEUR, HAUTEUR } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";

export const COULEURS_RANG = [COULEURS.or, COULEURS.argent, COULEURS.bronze];

// Une licorne qui galope sur place, tournée vers le haut (comme sur les menus) ou vers la droite
export function licorneQuiGalope(
  scene: Phaser.Scene, x: number, y: number, look: Parameters<typeof textureDeLicorne>[1], echelle: number, versLeHaut = true,
): Phaser.GameObjects.Sprite {
  const cle = textureDeLicorne(scene, look);
  return scene.add.sprite(x, y, cle).setScale(echelle / 2).setRotation(versLeHaut ? -Math.PI / 2 : 0)
    .play({ key: cle + "-galop", startFrame: Phaser.Math.Between(0, 15) });
}

export class Arrivee extends Phaser.Scene {
  constructor() {
    super("licorne-arrivee");
  }

  create(donnees: { resultats: Resultat[] }) {
    const course = this.scene.get("licorne-course") as Course;
    const { resultats } = donnees;
    const gp = course.donnees.grandPrix;

    if (course.joueuses.length === 2) {
      // Le trait blanc de l'écran partagé : il était au tableau de bord, qui vient de s'arrêter
      this.add.rectangle(LARGEUR / 2, 0, 4, HAUTEUR, 0xffffff).setOrigin(0.5, 0);
    }
    this.add.rectangle(0, 0, LARGEUR, HAUTEUR, 0xfff0fa, 0.82).setOrigin(0);
    const pluie = confettis(this, 0);
    if (resultats.some((r) => r.licorne.humaine && r.rang === 1)) {
      pluie.explode(90);
      pluie.frequency = 100;               // puis encore quelques-uns, tant qu'on reste là
      pluie.start();
    }

    const lignes: Phaser.GameObjects.GameObject[] = [];
    if (course.enChrono) {
      const l = course.joueuses[0];
      const licorne = licorneQuiGalope(this, LARGEUR / 2, 160, l.look, 1.8);
      // Elle saute de joie : un tween qui monte et redescend, sans fin
      this.tweens.add({ targets: licorne, y: 148, duration: 225, yoyo: true, repeat: -1, ease: "Sine.Out" });
      lignes.push(arcEnCiel(ecrire(this, LARGEUR / 2, 270, "Arrivée !", 64, COULEURS.rose, { contour: true })));
      lignes.push(ecrire(this, LARGEUR / 2, 330, "Course en " + chrono(l.tempsFinal), 28, COULEURS.texte, { contour: true }));
      lignes.push(ecrire(this, LARGEUR / 2, 368, "Record du tour : " + chrono(course.meilleurTour ?? 0), 22, COULEURS.orange, { contour: true }));
      if (course.nouveauRecord) {
        lignes.push(ecrire(this, LARGEUR / 2, 405, "✨ Nouveau record ! ✨", 24, COULEURS.rose, { contour: true }));
      }
    } else {
      const nom = course.circuit.modele.nom;
      lignes.push(titre(this, 48, gp ? "Course " + (gp.etape + 1) + "/" + GRAND_PRIX.length + " : " + nom : nom, 38));
      const hauteurLigne = Math.min(78, 360 / resultats.length);
      resultats.forEach((r, i) => lignes.push(this.ligne(r, i, 92 + i * hauteurLigne, hauteurLigne - 10, course, !!gp)));
    }

    // Les lignes arrivent l'une après l'autre : un tween par ligne, chacune un peu plus tard
    lignes.forEach((ligne, i) => {
      const objet = ligne as Phaser.GameObjects.Container;
      objet.setAlpha(0).y += 24;
      this.tweens.add({ targets: objet, alpha: 1, y: objet.y - 24, duration: 350, delay: i * 110, ease: "Cubic.Out" });
    });

    // On attend une seconde avant d'écouter : le pouce était peut-être encore sur les commandes
    this.time.delayedCall(1000, () => {
      let fini = false;
      const une = (action: () => void) => () => {
        if (!fini) {
          fini = true;
          action();
        }
      };
      const menu = une(() => course.quitter());
      const suite = gp ? une(() => this.versLeGrandPrix(course)) : menu;
      const rejouer = une(() => course.rejouer());
      const boutons = gp
        ? [bouton(this, LARGEUR / 2 - 200, 474, 400, 48, "Le classement du Grand Prix" + touche(" (Entrée)"), suite)]
        : [
          bouton(this, LARGEUR / 2 - 210, 474, 200, 48, "Rejouer" + touche(" (R)"), rejouer),
          bouton(this, LARGEUR / 2 + 10, 474, 200, 48, "Menu" + touche(" (Entrée)"), menu, true),
        ];
      for (const b of boutons) {
        b.setAlpha(0);
        this.tweens.add({ targets: b, alpha: 1, duration: 300 });
      }
      surTouche(this, "ENTER", suite);
      surTouche(this, "ESC", menu);
      if (!gp) {
        surTouche(this, "R", rejouer);
      }
      this.input.gamepad?.on("down", (_m: Phaser.Input.Gamepad.Gamepad, b: Phaser.Input.Gamepad.Button) => {
        if (b.index === 0) {
          suite();
        } else if (b.index === 1) {
          menu();
        }
      });
    });
  }

  private ligne(r: Resultat, i: number, y: number, h: number, course: Course, enGrandPrix: boolean) {
    const l = r.licorne;
    const fond = this.add.graphics().fillStyle(0xffffff, l.humaine ? 0.95 : 0.55).fillRoundedRect(-310, -h / 2, 620, h, 18);
    if (l.humaine) {
      fond.lineStyle(3, parseInt(l.look.criniere[0].slice(1), 16)).strokeRoundedRect(-310, -h / 2, 620, h, 18);
    }
    let nom = l.nom;
    if (l.humaine) {
      nom += course.joueuses.length === 2 ? "  (J" + l.joueur + ")" : "  (toi)";
    }
    const enfants: Phaser.GameObjects.GameObject[] = [
      fond,
      ecrire(this, -265, 0, rangTexte(r.rang), 28, COULEURS_RANG[i] ?? COULEURS.texteDoux, { contour: true }),
      licorneQuiGalope(this, -190, 0, l.look, Math.min(0.75, h / 70), false),
      ecrire(this, -135, 0, nom, 22, COULEURS.texte, { origine: [0, 0.5] }),
      ecrire(this, 170, 0, (r.estime ? "≈ " : "") + chrono(r.temps), 20, COULEURS.texteDoux, { origine: [1, 0.5] }),
    ];
    if (enGrandPrix) {
      enfants.push(ecrire(this, 280, 0, "+" + r.points, 22, COULEURS.rose, { origine: [1, 0.5] }));
    }
    return this.add.container(LARGEUR / 2, y + h / 2, enfants);
  }

  private versLeGrandPrix(course: Course) {
    const grandPrix = course.donnees.grandPrix!;
    course.scene.stop();
    this.scene.start("licorne-grand-prix", { grandPrix });
  }
}
