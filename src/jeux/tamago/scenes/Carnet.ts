// Le carnet, sur l'écran de la console : son état (les cœurs, la discipline, le poids, son penchant),
// le journal de sa vie, le carnet d'amis et l'album des Tamagos d'avant. ◀ ▶ pour tourner les pages.
// L'écran du Tamago est en pause pendant ce temps. Une page trop longue pour l'écran garde ses premières
// lignes (le journal et l'album commencent par les plus récentes) et dit combien il en reste.

import Phaser from "phaser";
import type { Ecran } from "./Ecran";
import { formeDe, ageEnTexte, type Etat } from "../vie";
import { LIGNEES, NOMS_DES_LIGNEES, penchants } from "../formes";
import { album, amis, type Souvenir } from "../souvenirs";
import { habillage as h, places } from "../habillage";
import { COEURS } from "../reglages";
import { surTouche } from "../../../socle/clavier";
import { surManette, MANETTE, VALIDER } from "../../../socle/manette";
import { boutonFermer } from "../../../socle/boutonArcade";
import { toucheDuSon } from "../../../socle/son";

const PAGES = ["ÉTAT", "JOURNAL", "AMIS", "ALBUM"];

export class Carnet extends Phaser.Scene {
  page = 0;
  private titre!: Phaser.GameObjects.Text;
  private contenu!: Phaser.GameObjects.Text;
  private hauteurMax = 0;                  // la place pour le contenu, jusqu'au bas de l'écran
  private ferme = false;

  constructor() {
    super("tamago-carnet");
  }

  create() {
    this.ferme = false;
    const { ecran, centre, echelle } = places(this.scale.width);
    const taille = (n: number) => Math.round(n * echelle) + "px";
    this.hauteurMax = ecran.hauteur - 40 - 12;
    this.add.rectangle(ecran.x + 3, ecran.y + 3, ecran.largeur - 6, ecran.hauteur - 6, h.ecran.fond).setOrigin(0);
    this.titre = this.add.text(centre.x, ecran.y + 20, "", {
      fontFamily: h.pixel, fontSize: taille(11), color: h.accent,
    }).setOrigin(0.5);
    this.contenu = this.add.text(ecran.x + 22, ecran.y + 40, "", {
      fontFamily: h.police, fontSize: taille(14), color: h.ecran.texte, lineSpacing: 3,
      wordWrap: { width: ecran.largeur - 44 },
    });
    const fleche = (x: number, texte: string, sens: number) =>
      this.add.text(x, ecran.y + 20, texte, { fontFamily: h.police, fontSize: "20px", color: h.accent })
        .setOrigin(0.5).setPadding(10).setInteractive({ useHandCursor: true })
        .on("pointerup", () => this.tourner(sens));
    fleche(ecran.x + 30, "◀", -1);
    fleche(ecran.x + ecran.largeur - 64, "▶", 1);
    boutonFermer(this, ecran.x + ecran.largeur - 24, ecran.y + 20, () => this.fermer(), { police: h.police, couleur: h.ecran.texte, taille: 20 });

    surTouche(this, "LEFT", () => this.tourner(-1));
    surTouche(this, "RIGHT", () => this.tourner(1));
    surTouche(this, "ESC", () => this.fermer());
    surTouche(this, "ENTER", () => this.fermer());
    surTouche(this, "EIGHT", () => this.fermer());
    surManette(this, MANETTE.GAUCHE, () => this.tourner(-1));
    surManette(this, MANETTE.DROITE, () => this.tourner(1));
    surManette(this, [...VALIDER, MANETTE.B], () => this.fermer());
    // M coupe le son ici aussi : l'écran, en pause dessous, n'entend plus le clavier
    toucheDuSon(this, "tamago", () => (this.scene.get("tamago-ecran") as Ecran).montrerLeSon());
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
    this.remplir([this.etat, this.journal, this.amis, this.album][this.page](e));
  }

  // Autant de lignes que l'écran en tient. Une ligne trop longue passe à la ligne : on mesure.
  private remplir(lignes: string[]) {
    for (let n = lignes.length; n > 0; n--) {
      const reste = lignes.length - n;
      this.contenu.setText([...lignes.slice(0, n), ...(reste > 0 ? [`... et ${reste} de plus`] : [])].join("\n"));
      if (this.contenu.height <= this.hauteurMax) {
        return;
      }
    }
  }

  private etat(e: Etat): string[] {
    if (e.stade === "oeuf") {
      return ["Un œuf. Il attend qu'on le réchauffe."];
    }
    const forme = formeDe(e);
    const coeurs = (n: number) => h.coeur.plein.repeat(n) + h.coeur.vide.repeat(COEURS - n);
    // Son penchant : la lignée qu'il prendrait s'il grandissait maintenant. À égalité, le hasard choisira
    // (sauf si celle d'avant en est : elle reste) : le carnet dit alors qu'il hésite.
    const possibles = penchants(e.points, e.lignee).map((l) => NOMS_DES_LIGNEES[l]);
    const aucun = LIGNEES.every((l) => e.points[l] === 0);
    const penchant = aucun ? "pas encore" : possibles.length === 1 ? possibles[0]
      : "hésite entre " + possibles.slice(0, -1).join(", ") + " et " + possibles[possibles.length - 1];
    return [
      `${forme.emoji}  ${forme.nom}, ${forme.caractere}`,
      `Âge : ${ageEnTexte(e.age)}    Poids : ${e.poids} g`,
      `Ventre : ${coeurs(e.ventre)}    Moral : ${coeurs(e.moral)}`,
      `Discipline : ${e.discipline * 25} %`,
      `Oublis : ${e.oublis}${e.oublis === 0 ? " (parfait !)" : ""}`,
      e.malade > 0 ? "Malade : il lui faut un médicament" : "En forme",
      e.stade === "adulte" ? "" : `Penchant : ${penchant}`,
    ].filter(Boolean);
  }

  private journal(e: Etat): string[] {
    if (e.journal.length === 0) {
      return ["Rien encore. Tout reste à vivre !"];
    }
    return e.journal.map((ligne) => `${ageEnTexte(ligne.age)} · ${ligne.texte}`);
  }

  private amis(): string[] {
    const carnet = Object.entries(amis()).sort((a, b) => b[1].visites - a[1].visites);
    if (carnet.length === 0) {
      return ["Personne n'est encore venu. Ça viendra !"];
    }
    return carnet.map(([nom, ami]) => `${ami.emoji}  ${nom} : ${ami.visites} visite${ami.visites > 1 ? "s" : ""}`);
  }

  private album(): string[] {
    const souvenirs = album();
    if (souvenirs.length === 0) {
      return ["L'album est vide : ton premier Tamago est là !"];
    }
    const fins = { vieillesse: "🛸 sa planète", faim: "🏃 chez le voisin", maladie: "🚑 chez sa grand-mère" };
    // Un souvenir d'avant l'âge en mois n'a gardé que ses années
    const age = (s: Souvenir) => (s.age !== undefined ? ageEnTexte(s.age) : `${s.ans} ans`);
    return souvenirs.map((s) => `${s.emoji}  ${s.nom}, ${age(s)} · ${fins[s.fin]} · ${s.date}`);
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
