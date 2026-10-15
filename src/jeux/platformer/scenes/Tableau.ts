// Le tableau de bord : une scène lancée par-dessus le niveau (ou le duo). Sa caméra ne bouge pas :
// le score, les vies et les commandes au doigt restent à leur place pendant que le monde défile.
// Il lit l'état du jeu à chaque image (update), plutôt que d'écouter chaque changement.
// Tout se place d'après la largeur du jeu (this.scale.width) : au doigt, elle dépasse 960 (socle/largeur.ts).

import Phaser from "phaser";
import type { Niveau } from "./Niveau";
import type { Duo } from "./Duo";
import type { Entrees } from "../Heros";
import { OBJECTIF_DUO } from "../reglages";
import { HAUTEUR, POLICE } from "../../../socle/style";
import { estTactile } from "../../../socle/tactile";
import { BoutonsAuDoigt } from "../../../socle/doigts";
import { boutonPause } from "../../../socle/pause";
import { annoncer } from "../../../socle/annonce";

type Action = keyof Entrees;

// Les commandes au doigt, en paysage : courir avec le pouce gauche, sauter avec le pouce droit. Chacune se
// compte depuis son bord (« droite » : x depuis le bord droit), pour rester sous le pouce quelle que soit la largeur.
const COMMANDES: { action: Action; x: number; y: number; rayon: number; icone: string; aDroite?: boolean }[] = [
  { action: "gauche", x: 88, y: 452, rayon: 62, icone: "◀" },
  { action: "droite", x: 236, y: 452, rayon: 62, icone: "▶" },
  { action: "saut", x: 98, y: 440, rayon: 74, icone: "▲", aDroite: true },
];

export class Tableau extends Phaser.Scene {
  private niveau: Niveau | null = null;
  private duo: Duo | null = null;
  private texte!: Phaser.GameObjects.Text;
  private texte2?: Phaser.GameObjects.Text;
  private coeurs: Phaser.GameObjects.Image[] = [];
  private viesEnPlus!: Phaser.GameObjects.Text;
  private ronds = new Map<Action, Phaser.GameObjects.Arc>();
  private doigts?: BoutonsAuDoigt<Action>;

  constructor() {
    super("platformer-tableau");
  }

  create() {
    this.niveau = this.scene.isActive("platformer-niveau") ? this.scene.get("platformer-niveau") as Niveau : null;
    this.duo = this.niveau ? null : this.scene.get("platformer-duo") as Duo;
    this.coeurs = [];
    this.ronds.clear();
    this.doigts = undefined;

    const largeur = this.scale.width;
    this.add.rectangle(0, 0, largeur, 40, 0x000000, 0.45).setOrigin(0);
    const style = { fontFamily: POLICE, fontSize: "19px", fontStyle: "bold", color: "#ffffff" };
    this.texte = this.add.text(16, 20, "", style).setOrigin(0, 0.5);
    this.viesEnPlus = this.add.text(largeur - 66, 20, "", style).setOrigin(1, 0.5);

    // La pause, en haut à droite (elle propose de revenir au menu, ou à l'éditeur). Au doigt, le bouton
    // est plus grand que la barre : il se met dessous.
    const auDoigt = estTactile();
    boutonPause(this, largeur - (auDoigt ? 44 : 26), auDoigt ? 80 : 20, () => (this.niveau ?? this.duo)!.ouvrirLaPause());

    if (this.duo) {
      this.add.rectangle(largeur / 2, HAUTEUR / 2, 4, HAUTEUR, 0x14141e);   // le trait entre les deux moitiés
      this.texte2 = this.add.text(largeur / 2 + 16, 20, "", { ...style, color: "#ffb070" }).setOrigin(0, 0.5);
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
      titre = estTactile() ? "Test : ⏸ pour revenir à l'éditeur" : "Test : Échap (la pause) pour revenir à l'éditeur";
    } else {
      titre = "Infini : va le plus loin possible !";
    }
    annoncer(this, titre, { y: 140, taille: 40, reste: 1300 });
  }

  // Les ronds à tenir au doigt (socle/doigts.ts : quel doigt tient quel bouton)
  // Après une pause : le tableau, arrêté avec le niveau, n'a pas entendu les doigts se lever
  lacherLesDoigts() {
    this.doigts?.toutLacher();
  }

  private creerCommandes() {
    const doigts = new BoutonsAuDoigt<Action>(this, { quandChange: (tenues) => this.recompterLesDoigts(tenues) });
    this.doigts = doigts;
    for (const commande of COMMANDES) {
      const { y, rayon } = commande;
      const x = commande.aDroite ? this.scale.width - commande.x : commande.x;
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
    const droite = this.scale.width - 72;
    while (this.coeurs.length < Math.min(vies, 6)) {
      const coeur = this.add.image(droite - this.coeurs.length * 28, 20, "platformer-coeur");
      // Une vie gagnée : le cœur arrive en grossissant
      coeur.setScale(0);
      this.tweens.add({ targets: coeur, scale: 1, duration: 300, ease: "Back.Out" });
      this.coeurs.push(coeur);
    }
    while (this.coeurs.length > Math.min(vies, 6)) {
      this.coeurs.pop()!.destroy();
    }
    this.viesEnPlus.setText(vies > 6 ? "+" + (vies - 6) : "").setX(droite - 6 * 28 + 10);
  }
}
