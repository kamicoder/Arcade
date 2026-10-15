// Le Grand Prix : les courses que le thème a choisies, l'une après l'autre, contre les mêmes rivaux, de
// plus en plus rapides. Le classement entre deux courses, puis la remise des prix sur le podium.
//
// L'état du Grand Prix n'est gardé nulle part ailleurs : il passe de scène en scène dans les données de
// scene.start() (course → arrivée → classement → course suivante...). Quitter en route, c'est l'oublier.

import Phaser from "phaser";
import type { DonneesDeCourse } from "./Piste";
import { melanger } from "../circuits";
import { themeEnCours, preferences, apparenceDe, listeDesCircuits } from "../sauvegarde";
import { jouer } from "../son";
import { titre, ecrire, bouton, touche, enNombre, portrait, rangTexte, menuElargi } from "../interface";
import { LARGEUR } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { surManette, MANETTE, VALIDER } from "../../../socle/manette";
import { uneSeuleFois } from "../../../socle/fin";
import { fonduPuis } from "../../../socle/retour";

export interface EtatDuGrandPrix {
  etape: number;                           // la course en cours, de 0 à la dernière
  rivaux: number[];
  points: Record<number, number>;          // pour chaque véhicule (son numéro dans l'équipe), ses points
}

export const POINTS_GRAND_PRIX = [10, 7, 5, 3];

// Des véhicules que personne n'a pris, au hasard
export function rivauxLibres(pris: number[], nombre: number): number[] {
  const libres = themeEnCours().equipe.map((_v, i) => i).filter((i) => !pris.includes(i));
  return melanger(libres).slice(0, nombre);
}

export function nouveauGrandPrix(): EtatDuGrandPrix {
  const joueur = preferences.joueurs[0];
  const rivaux = rivauxLibres([joueur], 3);
  const points: Record<number, number> = { [joueur]: 0 };
  for (const r of rivaux) {
    points[r] = 0;
  }
  return { etape: 0, rivaux, points };
}

// Une course du Grand Prix : les mêmes rivaux tout du long, de plus en plus rapides
export function donneesDeLEtape(gp: EtatDuGrandPrix): DonneesDeCourse {
  const etape = themeEnCours().grandPrix[gp.etape];
  return { mode: "grandprix", circuitId: etape.circuit, rivaux: gp.rivaux, niveau: etape.niveau, grandPrix: gp };
}

// Le classement du Grand Prix, du premier au dernier (à égalité, le joueur d'abord)
export function classementDuGrandPrix(gp: EtatDuGrandPrix): number[] {
  const joueur = preferences.joueurs[0];
  return Object.keys(gp.points).map(Number).sort((a, b) =>
    gp.points[b] - gp.points[a] || (a === joueur ? -1 : b === joueur ? 1 : 0));
}

export class Classement extends Phaser.Scene {
  constructor() {
    super("course-grand-prix");
  }

  create({ grandPrix: gp }: { grandPrix: EtatDuGrandPrix }) {
    const theme = themeEnCours();
    const c = theme.habillage.couleurs;
    const courses = theme.grandPrix.length;
    menuElargi(this);                      // au doigt, toute la largeur du téléphone
    this.cameras.main.fadeIn(250);
    theme.habillage.fond(this);
    const finies = gp.etape + 1;
    titre(this, 46, "Grand Prix : après " + finies + (finies === 1 ? " course" : " courses") + " sur " + courses, 34);

    const ordre = classementDuGrandPrix(gp);
    const maxi = Math.max(1, gp.points[ordre[0]]);
    ordre.forEach((numero, i) => {
      const y = 92 + i * 80;
      const apparence = apparenceDe(numero);
      const joueur = numero === preferences.joueurs[0];
      const boite = this.add.container(0, y);
      boite.add(this.add.graphics().fillStyle(c.fondPanneau, joueur ? 1 : c.alphaPanneau * 0.7).fillRoundedRect(150, 0, 660, 68, 20));
      boite.add(ecrire(this, 195, 34, rangTexte(i + 1), 28, c.rangs[i] ?? c.texteDoux, { contour: true }));
      boite.add(portrait(this, 270, 34, apparence, 0.8, false));
      boite.add(ecrire(this, 321, 22, apparence.nom + (joueur ? "  (toi)" : ""), 21, c.texte, { origine: [0, 0.5] }));
      boite.add(this.add.rectangle(325, 44, 380, 12, enNombre(c.texteClair), 0.35).setOrigin(0).setRounded(6));
      // La barre des points se remplit : un tween sur sa largeur
      const barre = this.add.image(325, 44, theme.habillage.icones.barre).setOrigin(0).setDisplaySize(1, 12);
      boite.add(barre);
      this.tweens.add({
        targets: barre, displayWidth: 380 * gp.points[numero] / maxi, duration: 700, delay: 250 + i * 120, ease: "Cubic.Out",
      });
      boite.add(ecrire(this, 790, 34, gp.points[numero] + " pts", 22, c.accent, { origine: [1, 0.5] }));
      boite.setAlpha(0).x = -40;
      this.tweens.add({ targets: boite, alpha: 1, x: 0, duration: 350, delay: i * 100, ease: "Cubic.Out" });
    });

    // Une seule fois : partir (abandonner, ou la suite), avec le son du menu et un fondu
    const uneFois = uneSeuleFois();
    const une = (action: () => void) => uneFois(() => {
      jouer(this, "menu");
      fonduPuis(this, action);
    });
    const abandonner = une(() => this.scene.start("course-menu"));
    bouton(this, LARGEUR / 2 - 120, 494, 240, 36, "Abandonner" + touche(" (Échap)"), abandonner, true);
    surTouche(this, "ESC", abandonner);

    // Un petit temps avant de pouvoir continuer : on a le temps de lire
    this.time.delayedCall(600, () => {
      const derniere = finies >= courses;
      const suite = une(() => {
        if (derniere) {
          this.scene.start("course-podium", { grandPrix: gp });
        } else {
          gp.etape++;
          this.scene.start("course-piste", donneesDeLEtape(gp));
        }
      });
      const prochain = derniere ? undefined : listeDesCircuits().find((m) => m.id === theme.grandPrix[finies].circuit);
      const texte = derniere ? "La remise des prix !" : "Course suivante : " + prochain?.nom;
      const b = bouton(this, LARGEUR / 2 - 230, 430, 460, 50, texte + touche(" (Entrée)"), suite).setScale(0.6);
      this.tweens.add({ targets: b, scale: 1, duration: 300, ease: "Back.Out" });
      surTouche(this, "ENTER", suite);
      surManette(this, VALIDER, suite);
      surManette(this, MANETTE.B, abandonner);
    });
  }
}

export class Podium extends Phaser.Scene {
  constructor() {
    super("course-podium");
  }

  create({ grandPrix: gp }: { grandPrix: EtatDuGrandPrix }) {
    const theme = themeEnCours();
    const c = theme.habillage.couleurs;
    menuElargi(this);                      // au doigt, toute la largeur du téléphone
    this.cameras.main.fadeIn(250);
    theme.habillage.fond(this);
    const fete = theme.habillage.fete(this, 55);   // la fête : beaucoup plus de confettis
    fete.explode(120);
    jouer(this, "victoire");

    const ordre = classementDuGrandPrix(gp);
    const rangJoueur = ordre.indexOf(preferences.joueurs[0]) + 1;
    titre(this, 44, "Remise des prix", 46);
    ecrire(this, LARGEUR / 2, 90, rangJoueur === 1 ? "Bravo, tu gagnes le Grand Prix !" : "Tu termines " + rangTexte(rangJoueur) + " du Grand Prix",
      26, c.texte, { contour: true });

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
      const apparence = apparenceDe(numero);
      const haut = sol - m.h;
      // La marche monte du sol, puis le véhicule et son nom y tombent
      const marche = this.add.graphics().fillStyle(m.couleur).fillRoundedRect(m.x - 85, 0, 170, m.h, { tl: 16, tr: 16, bl: 0, br: 0 });
      marche.y = sol;
      marche.scaleY = 0;
      this.tweens.add({ targets: marche, y: haut, scaleY: 1, duration: 500, delay: (3 - m.rang) * 250, ease: "Back.Out" });
      const textes = [
        ecrire(this, m.x, haut + 36, String(m.rang), 44, "#ffffff", { contour: "#c8a77a" }),
        ecrire(this, m.x, haut + 74, gp.points[numero] + " pts", 18, "#8a6aae"),
      ];
      const vehicule = portrait(this, m.x, haut - 70, apparence, 1.45);
      const nom = ecrire(this, m.x, haut - 152, apparence.nom, 20, c.texte, { contour: true });
      const delai = 300 + (3 - m.rang) * 250;
      for (const objet of [...textes, vehicule, nom]) {
        objet.setAlpha(0);
        this.tweens.add({ targets: objet, alpha: 1, duration: 300, delay: delai });
      }
      // Ils sautent de joie, le gagnant plus haut que les autres
      const saut = m.rang === 1 ? 16 : 8;
      this.tweens.add({
        targets: [vehicule, nom], y: `-=${saut}`, duration: m.rang === 1 ? 225 : 315, yoyo: true, repeat: -1,
        ease: "Sine.Out", delay: delai,
      });
    }

    this.time.delayedCall(1000, () => {
      const menu = uneSeuleFois()(() => {
        jouer(this, "menu");
        fonduPuis(this, () => this.scene.start("course-menu"));
      });
      bouton(this, LARGEUR / 2 - 80, 496, 160, 38, "Menu" + touche(" (Entrée)"), menu, true);
      surTouche(this, "ENTER", menu);
      surTouche(this, "ESC", menu);
      surManette(this, [...VALIDER, MANETTE.B], menu);
    });
  }
}
