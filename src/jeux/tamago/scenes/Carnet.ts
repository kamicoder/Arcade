// Le carnet, sur l'écran de la console : son état (les cœurs, la discipline, le poids, son penchant),
// le journal de sa vie, le carnet d'amis et l'album des Tamagos d'avant. ◀ ▶ pour tourner les pages.
// L'écran du Tamago est en pause pendant ce temps.

import Phaser from "phaser";
import type { Ecran } from "./Ecran";
import { formeDe, ageEnAnnees, type Etat } from "../vie";
import { LIGNEES, NOMS_DES_LIGNEES } from "../formes";
import { album, amis } from "../souvenirs";
import { habillage as h, ECRAN, CENTRE_ECRAN } from "../habillage";
import { COEURS, UN_AN } from "../reglages";
import { surTouche } from "../../../socle/clavier";
import { surManette, MANETTE, VALIDER } from "../../../socle/manette";
import { boutonFermer } from "../../../socle/boutonArcade";

const PAGES = ["ÉTAT", "JOURNAL", "AMIS", "ALBUM"];

export class Carnet extends Phaser.Scene {
  page = 0;
  private titre!: Phaser.GameObjects.Text;
  private contenu!: Phaser.GameObjects.Text;
  private ferme = false;

  constructor() {
    super("tamago-carnet");
  }

  create() {
    this.ferme = false;
    this.add.rectangle(ECRAN.x + 3, ECRAN.y + 3, ECRAN.largeur - 6, ECRAN.hauteur - 6, h.ecran.fond).setOrigin(0);
    this.titre = this.add.text(CENTRE_ECRAN.x, ECRAN.y + 20, "", {
      fontFamily: h.pixel, fontSize: "11px", color: h.accent,
    }).setOrigin(0.5);
    this.contenu = this.add.text(ECRAN.x + 22, ECRAN.y + 40, "", {
      fontFamily: h.police, fontSize: "14px", color: h.ecran.texte, lineSpacing: 3,
      wordWrap: { width: ECRAN.largeur - 44 },
    });
    const fleche = (x: number, texte: string, sens: number) =>
      this.add.text(x, ECRAN.y + 20, texte, { fontFamily: h.police, fontSize: "20px", color: h.accent })
        .setOrigin(0.5).setPadding(10).setInteractive({ useHandCursor: true })
        .on("pointerup", () => this.tourner(sens));
    fleche(ECRAN.x + 30, "◀", -1);
    fleche(ECRAN.x + ECRAN.largeur - 64, "▶", 1);
    boutonFermer(this, ECRAN.x + ECRAN.largeur - 24, ECRAN.y + 20, () => this.fermer(), { police: h.police, couleur: h.ecran.texte, taille: 20 });

    surTouche(this, "LEFT", () => this.tourner(-1));
    surTouche(this, "RIGHT", () => this.tourner(1));
    surTouche(this, "ESC", () => this.fermer());
    surTouche(this, "ENTER", () => this.fermer());
    surTouche(this, "EIGHT", () => this.fermer());
    surManette(this, MANETTE.GAUCHE, () => this.tourner(-1));
    surManette(this, MANETTE.DROITE, () => this.tourner(1));
    surManette(this, [...VALIDER, MANETTE.B], () => this.fermer());
    this.montrer();
  }

  private tourner(sens: number) {
    this.page = Phaser.Math.Wrap(this.page + sens, 0, PAGES.length);
    this.sound.play("tamago-bip");
    this.montrer();
  }

  private montrer() {
    const e = (this.scene.get("tamago-ecran") as Ecran).etat;
    this.titre.setText(`${PAGES[this.page]}  ${this.page + 1}/${PAGES.length}`);
    this.contenu.setText([this.etat, this.journal, this.amis, this.album][this.page](e));
  }

  private etat(e: Etat): string {
    if (e.stade === "oeuf") {
      return "Un œuf. Il attend qu'on le réchauffe.";
    }
    const forme = formeDe(e);
    const coeurs = (n: number) => h.coeur.plein.repeat(n) + h.coeur.vide.repeat(COEURS - n);
    // Son penchant : la lignée qui a le plus de points pendant ce stade (ce qu'il deviendra peut-être)
    const penchant = LIGNEES.reduce((a, b) => (e.points[b] > e.points[a] ? b : a));
    const aucun = LIGNEES.every((l) => e.points[l] === 0);
    return [
      `${forme.emoji}  ${forme.nom}, ${forme.caractere}`,
      `Âge : ${ageEnAnnees(e)} an${ageEnAnnees(e) > 1 ? "s" : ""}    Poids : ${e.poids} g`,
      `Ventre : ${coeurs(e.ventre)}    Moral : ${coeurs(e.moral)}`,
      `Discipline : ${e.discipline * 25} %`,
      `Oublis : ${e.oublis}${e.oublis === 0 ? " (parfait !)" : ""}`,
      e.malade > 0 ? "Malade : il lui faut un médicament" : "En forme",
      e.stade === "adulte" ? "" : `Penchant : ${aucun ? "pas encore" : NOMS_DES_LIGNEES[penchant]}`,
    ].filter(Boolean).join("\n");
  }

  private journal(e: Etat): string {
    if (e.journal.length === 0) {
      return "Rien encore. Tout reste à vivre !";
    }
    return e.journal.slice(0, 10)
      .map((ligne) => `${Math.floor(ligne.age / UN_AN)} an${ligne.age >= 2 * UN_AN ? "s" : ""} · ${ligne.texte}`)
      .join("\n");
  }

  private amis(): string {
    const carnet = Object.entries(amis()).sort((a, b) => b[1].visites - a[1].visites);
    if (carnet.length === 0) {
      return "Personne n'est encore venu. Ça viendra !";
    }
    return carnet.map(([nom, ami]) => `${ami.emoji}  ${nom} : ${ami.visites} visite${ami.visites > 1 ? "s" : ""}`).join("\n");
  }

  private album(): string {
    const souvenirs = album();
    if (souvenirs.length === 0) {
      return "L'album est vide : ton premier Tamago est là !";
    }
    const fins = { vieillesse: "🛸 sa planète", faim: "🏃 chez le voisin", maladie: "🚑 chez sa grand-mère" };
    return souvenirs.slice(0, 9)
      .map((s) => `${s.emoji}  ${s.nom}, ${s.ans} ans · ${fins[s.fin]} · ${s.date}`)
      .join("\n");
  }

  private fermer() {
    if (this.ferme) {
      return;
    }
    this.ferme = true;
    this.scene.stop();
    this.scene.resume("tamago-ecran");
  }
}
