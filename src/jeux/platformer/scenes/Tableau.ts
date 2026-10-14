// Le tableau de bord : une scène lancée par-dessus le niveau (ou le duo). Sa caméra ne bouge pas :
// le score, les vies et les commandes au doigt restent à leur place pendant que le monde défile.
// Il lit l'état du jeu à chaque image (update), plutôt que d'écouter chaque changement.

import Phaser from "phaser";
import type { Niveau } from "./Niveau";
import type { Duo } from "./Duo";
import type { Entrees } from "../Heros";
import { OBJECTIF_DUO } from "../reglages";
import { LARGEUR, HAUTEUR, POLICE } from "../../../socle/style";
import { estTactile } from "../../../socle/tactile";
import { BoutonsAuDoigt } from "../../../socle/doigts";
import { boutonFermer } from "../../../socle/boutonArcade";
import { annoncer } from "../../../socle/annonce";

type Action = keyof Entrees;

// Les commandes au doigt, en paysage : courir avec le pouce gauche, sauter avec le pouce droit
const COMMANDES: { action: Action; x: number; y: number; rayon: number; icone: string }[] = [
  { action: "gauche", x: 88, y: 452, rayon: 62, icone: "◀" },
  { action: "droite", x: 236, y: 452, rayon: 62, icone: "▶" },
  { action: "saut", x: 862, y: 440, rayon: 74, icone: "▲" },
];

export class Tableau extends Phaser.Scene {
  private niveau: Niveau | null = null;
  private duo: Duo | null = null;
  private texte!: Phaser.GameObjects.Text;
  private texte2?: Phaser.GameObjects.Text;
  private coeurs: Phaser.GameObjects.Image[] = [];
  private viesEnPlus!: Phaser.GameObjects.Text;
  private ronds = new Map<Action, Phaser.GameObjects.Arc>();

  constructor() {
    super("platformer-tableau");
  }

  create() {
    this.niveau = this.scene.isActive("platformer-niveau") ? this.scene.get("platformer-niveau") as Niveau : null;
    this.duo = this.niveau ? null : this.scene.get("platformer-duo") as Duo;
    this.coeurs = [];
    this.ronds.clear();

    this.add.rectangle(0, 0, LARGEUR, 40, 0x000000, 0.45).setOrigin(0);
    const style = { fontFamily: POLICE, fontSize: "19px", fontStyle: "bold", color: "#ffffff" };
    this.texte = this.add.text(16, 20, "", style).setOrigin(0, 0.5);
    this.viesEnPlus = this.add.text(LARGEUR - 66, 20, "", style).setOrigin(1, 0.5);

    // Revenir au menu (ou à l'éditeur), en haut à droite
    boutonFermer(this, LARGEUR - 26, 20, () => (this.niveau ?? this.duo)!.quitter());

    if (this.duo) {
      this.add.rectangle(LARGEUR / 2, HAUTEUR / 2, 4, HAUTEUR, 0x14141e);   // le trait entre les deux moitiés
      this.texte2 = this.add.text(LARGEUR / 2 + 16, 20, "", { ...style, color: "#ffb070" }).setOrigin(0, 0.5);
      this.texte.setColor("#8cc8ff");
    } else {
      this.annoncer();
      if (estTactile()) {
        this.creerCommandes();
      }
    }
  }

  // Au début d'un niveau : son nom, en grand, qui s'en va tout seul
  private annoncer() {
    const n = this.niveau!;
    let titre = "";
    if (n.donnees.mode === "aventure") {
      titre = `Niveau ${n.donnees.numero + 1} : ${n.niveau!.nom}`;
    } else if (n.donnees.mode === "test") {
      titre = estTactile() ? "Test : ✕ pour revenir à l'éditeur" : "Test : Échap pour revenir à l'éditeur";
    } else {
      titre = "Infini : va le plus loin possible !";
    }
    annoncer(this, titre, { y: 140, taille: 40, reste: 1300 });
  }

  // Les ronds à tenir au doigt (socle/doigts.ts : quel doigt tient quel bouton)
  private creerCommandes() {
    const doigts = new BoutonsAuDoigt<Action>(this, { quandChange: (tenues) => this.recompterLesDoigts(tenues) });
    for (const commande of COMMANDES) {
      const { x, y, rayon } = commande;
      const rond = this.add.circle(x, y, rayon, 0xffffff, 0.16).setStrokeStyle(3, 0xffffff, 0.6);
      this.add.text(x, y, commande.icone, { fontFamily: POLICE, fontSize: Math.round(rayon * 0.7) + "px", color: "#ffffff" })
        .setOrigin(0.5).setAlpha(0.85);
      doigts.ajouter(rond, commande.action, 1.35);
      this.ronds.set(commande.action, rond);
    }
  }

  private recompterLesDoigts(tenues: Set<Action>) {
    const tactile = this.niveau!.commandes.tactile;
    for (const [action, rond] of this.ronds) {
      tactile[action] = tenues.has(action);
      rond.setFillStyle(0xffffff, tenues.has(action) ? 0.42 : 0.16);   // un bouton tenu s'éclaire
    }
  }

  update() {
    if (this.duo) {
      const [j1, j2] = this.duo.coureurs;
      this.texte.setText(`J1 (bleu)   ${j1.score} / ${OBJECTIF_DUO}`);
      this.texte2!.setText(`J2 (orange)   ${j2.score} / ${OBJECTIF_DUO}`);
      return;
    }
    const n = this.niveau!;
    const d = n.donnees;
    if (d.mode === "infini") {
      this.texte.setText(`Distance : ${n.distance} m    Record : ${Math.max(n.record, n.distance)} m    Pièces : ${d.pieces}`);
    } else if (d.mode === "test") {
      this.texte.setText(`Test de « ${n.niveau!.nom} »    Score : ${d.score}`);
    } else {
      this.texte.setText(`Niveau ${d.numero + 1}/${d.niveaux.length}    Score : ${d.score}`);
    }
    this.montrerLesVies(d.mode === "test" ? 0 : Math.max(d.vies, 0));
  }

  // Un cœur par vie, de droite à gauche ; au-delà de 6, « + n »
  private montrerLesVies(vies: number) {
    while (this.coeurs.length < Math.min(vies, 6)) {
      const coeur = this.add.image(LARGEUR - 72 - this.coeurs.length * 28, 20, "platformer-coeur");
      // Une vie gagnée : le cœur arrive en grossissant
      coeur.setScale(0);
      this.tweens.add({ targets: coeur, scale: 1, duration: 300, ease: "Back.Out" });
      this.coeurs.push(coeur);
    }
    while (this.coeurs.length > Math.min(vies, 6)) {
      this.coeurs.pop()!.destroy();
    }
    this.viesEnPlus.setText(vies > 6 ? "+" + (vies - 6) : "").setX(LARGEUR - 72 - 6 * 28 + 10);
  }
}
