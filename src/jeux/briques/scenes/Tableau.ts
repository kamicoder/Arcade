// Le tableau de bord, lancé par-dessus la partie : le niveau (ou le mur du mode sans fin), le score, les vies,
// les bonus en cours avec leur temps, le ⏸, et l'aide pour lancer la balle. Il lit l'état de la partie à chaque
// image (update) plutôt que d'écouter chaque changement : un nouveau mur se voit à son titre qui change, et
// s'annonce.

import Phaser from "phaser";
import type { Partie } from "./Partie";
import type { GenreDeBonus } from "../textures";
import { TEXTE } from "../reglages";
import { HAUTEUR, POLICE } from "../../../socle/style";
import { estTactile } from "../../../socle/tactile";
import { boutonPause } from "../../../socle/pause";
import { annoncer } from "../../../socle/annonce";

const NOMS_DES_EFFETS: [GenreDeBonus, string, string][] = [
  ["large", "↔ Large", "#7fc4ff"],
  ["feu", "🔥 Feu", "#ff9a5a"],
  ["lente", "⌛ Lente", "#c8a8ff"],
];

export class Tableau extends Phaser.Scene {
  private partie!: Partie;
  private gauche!: Phaser.GameObjects.Text;
  private score!: Phaser.GameObjects.Text;
  private effets!: Phaser.GameObjects.Text;
  private aide!: Phaser.GameObjects.Text;
  private vies: Phaser.GameObjects.Image[] = [];
  private viesEnPlus!: Phaser.GameObjects.Text;
  private titreAnnonce = "";

  constructor() {
    super("briques-tableau");
  }

  create() {
    this.partie = this.scene.get("briques-partie") as Partie;
    this.vies = [];
    this.titreAnnonce = "";

    this.add.rectangle(0, 0, this.scale.width, 40, 0x000000, 0.45).setOrigin(0);
    const style = { fontFamily: POLICE, fontSize: "18px", fontStyle: "bold", color: "#ffffff" };
    this.gauche = this.add.text(16, 20, "", style).setOrigin(0, 0.5);
    this.score = this.add.text(this.scale.width / 2 + 70, 20, "", { ...style, color: "#ffd23f" }).setOrigin(0.5);
    this.viesEnPlus = this.add.text(this.scale.width - 72 - 5 * 32 + 8, 20, "", style).setOrigin(1, 0.5);
    this.effets = this.add.text(this.scale.width / 2, 56, "", { fontFamily: POLICE, fontSize: "15px", fontStyle: "bold" }).setOrigin(0.5);
    // La pause, en haut à droite (Échap, P ou Start font pareil) ; au doigt, plus grande, sous la barre, à
    // côté du mur
    const auDoigt = estTactile();
    boutonPause(this, this.scale.width - (auDoigt ? 44 : 26), auDoigt ? 80 : 20, () => this.partie.ouvrirLaPause());

    const aide = estTactile()
      ? "Glisse le doigt pour bouger la raquette, touche l'écran pour lancer"
      : "Souris, ← → ou Q D : bouger    Clic, Espace ou ↑ : lancer    M : le son    Échap : pause";
    this.aide = this.add.text(this.scale.width / 2, HAUTEUR - 12, aide, { fontFamily: POLICE, fontSize: "14px", color: TEXTE }).setOrigin(0.5);
  }

  update() {
    const p = this.partie;
    this.gauche.setText(p.titre);
    this.score.setText(`Score : ${p.score}` + (p.combo > 1 ? `   ×${p.combo}` : ""));
    this.montrerLesVies(Math.max(p.vies, 0));
    this.aide.setVisible(p.etat === "tenue");

    // Les bonus en cours, et le temps qui leur reste
    const actifs = NOMS_DES_EFFETS.filter(([genre]) => p.effets.has(genre));
    this.effets.setText(actifs.map(([genre, nom]) => `${nom} ${p.resteDeLEffet(genre)} s`).join("     "));
    this.effets.setColor(actifs.length === 1 ? actifs[0][2] : "#ffffff");

    // Un nouveau niveau ou un nouveau mur : son nom, en grand
    if (p.titre !== this.titreAnnonce) {
      this.titreAnnonce = p.titre;
      const nom = p.donnees.mode === "niveau" ? p.titre.split(" : ")[1] : `Mur ${p.mur}`;
      annoncer(this, nom, { y: 300, couleur: "#c8a8ff" });
    }
  }

  // Une petite raquette par vie, de droite à gauche ; au-delà de 5, « + n »
  private montrerLesVies(vies: number) {
    const montrees = Math.min(vies, 5);
    while (this.vies.length < montrees) {
      const vie = this.add.image(this.scale.width - 72 - this.vies.length * 32, 20, "briques-vie").setScale(0);
      this.tweens.add({ targets: vie, scale: 1, duration: 300, ease: "Back.Out" });
      this.vies.push(vie);
    }
    while (this.vies.length > montrees) {
      this.vies.pop()!.destroy();
    }
    this.viesEnPlus.setText(vies > 5 ? "+" + (vies - 5) : "");
  }
}
