// Le Grand Prix : le classement entre deux courses, puis la remise des prix sur le podium.

import Phaser from "phaser";
import type { GrandPrix as EtatDuGrandPrix, DonneesDeCourse } from "./Course";
import { licorneQuiGalope, COULEURS_RANG } from "./Arrivee";
import { rangTexte } from "../circuits";
import { CIRCUITS, GRAND_PRIX } from "../donnees";
import { COULEURS } from "../reglages";
import { preferences, lookDe } from "../sauvegarde";
import { sons } from "../sons";
import { fondDeMenu, titre, ecrire, bouton, touche, enNombre } from "../interface";
import { LARGEUR } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { fonduPuis } from "../../../socle/retour";

// Le classement du Grand Prix, de la première à la dernière (à égalité, la joueuse d'abord)
export function classementDuGrandPrix(gp: EtatDuGrandPrix): number[] {
  const joueuse = preferences.choix[0];
  return Object.keys(gp.points).map(Number).sort((a, b) =>
    gp.points[b] - gp.points[a] || (a === joueuse ? -1 : b === joueuse ? 1 : 0));
}

// Une course du Grand Prix : les mêmes rivales tout du long, de plus en plus rapides
export function donneesDeLEtape(gp: EtatDuGrandPrix): DonneesDeCourse {
  const etape = GRAND_PRIX[gp.etape];
  return { mode: "gp", circuitId: etape.id, rivales: gp.rivales, niveau: etape.niveau, grandPrix: gp };
}

export class Classement extends Phaser.Scene {
  constructor() {
    super("licorne-grand-prix");
  }

  create({ grandPrix: gp }: { grandPrix: EtatDuGrandPrix }) {
    this.cameras.main.fadeIn(250);
    fondDeMenu(this);
    const finies = gp.etape + 1;
    titre(this, 46, "Grand Prix : après " + finies + (finies === 1 ? " course" : " courses") + " sur " + GRAND_PRIX.length, 34);

    const ordre = classementDuGrandPrix(gp);
    const maxi = Math.max(1, gp.points[ordre[0]]);
    ordre.forEach((numero, i) => {
      const y = 92 + i * 80;
      const look = lookDe(numero);
      const joueuse = numero === preferences.choix[0];
      const boite = this.add.container(0, y);
      boite.add(this.add.graphics().fillStyle(0xffffff, joueuse ? 1 : 0.55).fillRoundedRect(150, 0, 660, 68, 20));
      boite.add(ecrire(this, 195, 34, rangTexte(i + 1), 28, COULEURS_RANG[i] ?? COULEURS.texteDoux, { contour: true }));
      boite.add(licorneQuiGalope(this, 270, 34, look, 0.8, false));
      boite.add(ecrire(this, 321, 22, look.nom + (joueuse ? "  (toi)" : ""), 21, COULEURS.texte, { origine: [0, 0.5] }));
      boite.add(this.add.rectangle(325, 44, 380, 12, enNombre("#c8aaf0"), 0.35).setOrigin(0).setRounded(6));
      // La barre des points se remplit : un tween sur sa largeur
      const barre = this.add.image(325, 44, "licorne-barre").setOrigin(0).setDisplaySize(1, 12);
      boite.add(barre);
      this.tweens.add({
        targets: barre, displayWidth: 380 * gp.points[numero] / maxi, duration: 700, delay: 250 + i * 120, ease: "Cubic.Out",
      });
      boite.add(ecrire(this, 790, 34, gp.points[numero] + " pts", 22, COULEURS.rose, { origine: [1, 0.5] }));
      boite.setAlpha(0).x = -40;
      this.tweens.add({ targets: boite, alpha: 1, x: 0, duration: 350, delay: i * 100, ease: "Cubic.Out" });
    });

    let parti = false;
    const une = (action: () => void) => () => {
      if (!parti) {
        parti = true;
        sons.menu();
        fonduPuis(this, action);
      }
    };
    const abandonner = une(() => this.scene.start("licorne-menu"));
    bouton(this, LARGEUR / 2 - 120, 494, 240, 36, "Abandonner" + touche(" (Échap)"), abandonner, true);
    surTouche(this, "ESC", abandonner);

    // Un petit temps avant de pouvoir continuer : on a le temps de lire
    this.time.delayedCall(600, () => {
      const derniere = finies >= GRAND_PRIX.length;
      const suite = une(() => {
        if (derniere) {
          this.scene.start("licorne-podium", { grandPrix: gp });
        } else {
          gp.etape++;
          this.scene.start("licorne-course", donneesDeLEtape(gp));
        }
      });
      const texte = derniere
        ? "La remise des prix !"
        : "Course suivante : " + CIRCUITS.find((c) => c.id === GRAND_PRIX[finies].id)!.nom;
      const b = bouton(this, LARGEUR / 2 - 230, 430, 460, 50, texte + touche(" (Entrée)"), suite).setScale(0.6);
      this.tweens.add({ targets: b, scale: 1, duration: 300, ease: "Back.Out" });
      surTouche(this, "ENTER", suite);
      this.input.gamepad?.on("down", (_m: Phaser.Input.Gamepad.Gamepad, bt: Phaser.Input.Gamepad.Button) => {
        if (bt.index === 0) {
          suite();
        } else if (bt.index === 1) {
          abandonner();
        }
      });
    });
  }
}

export class Podium extends Phaser.Scene {
  constructor() {
    super("licorne-podium");
  }

  create({ grandPrix: gp }: { grandPrix: EtatDuGrandPrix }) {
    this.cameras.main.fadeIn(250);
    const pluie = fondDeMenu(this);
    pluie.frequency = 55;                  // la fête : beaucoup plus de confettis
    pluie.explode(120);
    sons.victoire();

    const ordre = classementDuGrandPrix(gp);
    const rangJoueuse = ordre.indexOf(preferences.choix[0]) + 1;
    titre(this, 44, "Remise des prix", 46);
    ecrire(this, LARGEUR / 2, 90, rangJoueuse === 1 ? "Bravo, tu gagnes le Grand Prix !" : "Tu termines " + rangTexte(rangJoueuse) + " du Grand Prix",
      26, COULEURS.texte, { contour: true });

    const marches = [
      { rang: 2, x: 300, h: 128, couleur: 0xd6dcef },
      { rang: 1, x: 480, h: 183, couleur: 0xffe58a },
      { rang: 3, x: 660, h: 90, couleur: 0xf3c9a5 },
    ];
    const sol = 486;
    for (const m of marches) {
      const numero = ordre[m.rang - 1];
      if (numero === undefined) {
        continue;
      }
      const look = lookDe(numero);
      const haut = sol - m.h;
      // La marche monte du sol, puis la licorne et son nom y tombent
      const marche = this.add.graphics().fillStyle(m.couleur).fillRoundedRect(m.x - 85, 0, 170, m.h, { tl: 16, tr: 16, bl: 0, br: 0 });
      marche.y = sol;
      marche.scaleY = 0;
      this.tweens.add({ targets: marche, y: haut, scaleY: 1, duration: 500, delay: (3 - m.rang) * 250, ease: "Back.Out" });
      const textes = [
        ecrire(this, m.x, haut + 36, String(m.rang), 44, "#ffffff", { contour: "#c8a77a" }),
        ecrire(this, m.x, haut + 74, gp.points[numero] + " pts", 18, COULEURS.texteDoux),
      ];
      const licorne = licorneQuiGalope(this, m.x, haut - 70, look, 1.45);
      const nom = ecrire(this, m.x, haut - 152, look.nom, 20, COULEURS.texte, { contour: true });
      const delai = 300 + (3 - m.rang) * 250;
      for (const objet of [...textes, licorne, nom]) {
        objet.setAlpha(0);
        this.tweens.add({ targets: objet, alpha: 1, duration: 300, delay: delai });
      }
      // Elles sautent de joie, la gagnante plus haut que les autres
      const saut = m.rang === 1 ? 16 : 8;
      this.tweens.add({
        targets: [licorne, nom], y: `-=${saut}`, duration: m.rang === 1 ? 225 : 315, yoyo: true, repeat: -1,
        ease: "Sine.Out", delay: delai,
      });
    }

    this.time.delayedCall(1000, () => {
      let parti = false;
      const menu = () => {
        if (!parti) {
          parti = true;
          sons.menu();
          fonduPuis(this, () => this.scene.start("licorne-menu"));
        }
      };
      bouton(this, LARGEUR / 2 - 80, 496, 160, 38, "Menu" + touche(" (Entrée)"), menu, true);
      surTouche(this, "ENTER", menu);
      surTouche(this, "ESC", menu);
      this.input.gamepad?.on("down", menu);
    });
  }
}
