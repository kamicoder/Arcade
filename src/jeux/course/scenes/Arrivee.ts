// L'arrivée : le classement de la course, par-dessus la course figée derrière.

import Phaser from "phaser";
import type { Piste } from "./Piste";
import type { Resultat } from "../Coureur";
import { chrono } from "../circuits";
import { themeEnCours } from "../sauvegarde";
import { ecrire, titre, bouton, touche, portrait, enNombre, rangTexte } from "../interface";
import { LARGEUR, HAUTEUR } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { surManette, MANETTE, VALIDER } from "../../../socle/manette";
import { uneSeuleFois } from "../../../socle/fin";

export class Arrivee extends Phaser.Scene {
  constructor() {
    super("course-arrivee");
  }

  create(donnees: { resultats: Resultat[] }) {
    const theme = themeEnCours();
    const { couleurs: c } = theme.habillage;
    const course = this.scene.get("course-piste") as Piste;
    const { resultats } = donnees;
    const gp = course.donnees.grandPrix;

    if (course.joueurs.length === 2) {
      // Le trait de l'écran partagé : il était au tableau de bord, qui vient de s'arrêter
      this.add.rectangle(LARGEUR / 2, 0, 4, HAUTEUR, c.separation).setOrigin(0.5, 0);
    }
    this.add.rectangle(0, 0, LARGEUR, HAUTEUR, c.voile, c.alphaVoile).setOrigin(0);
    const fete = theme.habillage.fete(this, 0);
    if (resultats.some((r) => r.coureur.humain && r.rang === 1)) {
      fete.explode(90);
      fete.frequency = 100;                // puis encore quelques-uns, tant qu'on reste là
      fete.start();
    }

    const lignes: Phaser.GameObjects.GameObject[] = [];
    if (course.enChrono) {
      const l = course.joueurs[0];
      const vehicule = portrait(this, LARGEUR / 2, 160, l.apparence, 1.8);
      // Il saute de joie : un tween qui monte et redescend, sans fin
      this.tweens.add({ targets: vehicule, y: 148, duration: 225, yoyo: true, repeat: -1, ease: "Sine.Out" });
      lignes.push(theme.habillage.titre(ecrire(this, LARGEUR / 2, 270, "Arrivée !", 64, c.accent, { contour: true })));
      lignes.push(ecrire(this, LARGEUR / 2, 330, "Course en " + chrono(l.tempsFinal), 28, c.texte, { contour: true }));
      lignes.push(ecrire(this, LARGEUR / 2, 368, "Record du tour : " + chrono(course.meilleurTour ?? 0), 22, c.record, { contour: true }));
      if (course.nouveauRecord) {
        lignes.push(ecrire(this, LARGEUR / 2, 405, "✨ Nouveau record ! ✨", 24, c.accent, { contour: true }));
      }
    } else {
      const nom = course.circuit.modele.nom;
      lignes.push(titre(this, 48, gp ? "Course " + (gp.etape + 1) + "/" + theme.grandPrix.length + " : " + nom : nom, 38));
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
      const une = uneSeuleFois();
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
      surManette(this, VALIDER, suite);
      surManette(this, MANETTE.B, menu);
    });
  }

  private ligne(r: Resultat, i: number, y: number, h: number, course: Piste, enGrandPrix: boolean) {
    const theme = themeEnCours();
    const c = theme.habillage.couleurs;
    const l = r.coureur;
    const fond = this.add.graphics().fillStyle(c.fondPanneau, l.humain ? 0.95 : c.alphaPanneau * 0.67)
      .fillRoundedRect(-310, -h / 2, 620, h, 18);
    if (l.humain) {
      fond.lineStyle(3, enNombre(theme.couleur(l.apparence))).strokeRoundedRect(-310, -h / 2, 620, h, 18);
    }
    let nom = l.nom;
    if (l.humain) {
      nom += course.joueurs.length === 2 ? "  (J" + l.joueur + ")" : "  (toi)";
    }
    const enfants: Phaser.GameObjects.GameObject[] = [
      fond,
      ecrire(this, -265, 0, rangTexte(r.rang), 28, c.rangs[i] ?? c.texteDoux, { contour: true }),
      portrait(this, -190, 0, l.apparence, Math.min(0.75, h / 70), false),
      ecrire(this, -135, 0, nom, 22, c.texte, { origine: [0, 0.5] }),
      ecrire(this, 170, 0, (r.estime ? "≈ " : "") + chrono(r.temps), 20, c.texteDoux, { origine: [1, 0.5] }),
    ];
    if (enGrandPrix) {
      enfants.push(ecrire(this, 280, 0, "+" + r.points, 22, c.accent, { origine: [1, 0.5] }));
    }
    return this.add.container(LARGEUR / 2, y + h / 2, enfants);
  }

  private versLeGrandPrix(course: Piste) {
    const grandPrix = course.donnees.grandPrix!;
    course.scene.stop();
    this.scene.start("course-grand-prix", { grandPrix });
  }
}
