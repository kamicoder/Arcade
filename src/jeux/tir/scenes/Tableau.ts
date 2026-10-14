// Le tableau de bord, lancé par-dessus la partie : le score, le record, la vague, les vies, l'arme, et la
// vie du boss quand il est là. Il lit l'état de la partie à chaque image (update), plutôt que d'écouter
// chaque changement : une nouvelle vague se voit à son numéro qui change, et s'annonce.

import Phaser from "phaser";
import type { Partie } from "./Partie";
import { ARME_MAX, CYAN } from "../reglages";
import { LARGEUR, POLICE } from "../../../socle/style";

export class Tableau extends Phaser.Scene {
  private partie!: Partie;
  private texte!: Phaser.GameObjects.Text;
  private arme!: Phaser.GameObjects.Text;
  private vies: Phaser.GameObjects.Image[] = [];
  private viesEnPlus!: Phaser.GameObjects.Text;
  private vagueAnnoncee = 0;
  private barreDuBoss!: Phaser.GameObjects.Rectangle;
  private cadreDuBoss!: Phaser.GameObjects.Container;

  constructor() {
    super("tir-tableau");
  }

  create() {
    this.partie = this.scene.get("tir-partie") as Partie;
    this.vies = [];
    this.vagueAnnoncee = 0;

    this.add.rectangle(0, 0, LARGEUR, 40, 0x000000, 0.45).setOrigin(0);
    const style = { fontFamily: POLICE, fontSize: "19px", fontStyle: "bold", color: "#ffffff" };
    this.texte = this.add.text(16, 20, "", style).setOrigin(0, 0.5);
    this.arme = this.add.text(LARGEUR / 2 + 80, 20, "", { ...style, color: "#ff9a3c" }).setOrigin(0, 0.5);
    this.viesEnPlus = this.add.text(LARGEUR - 72 - 5 * 26 + 6, 20, "", style).setOrigin(1, 0.5);

    // Revenir au menu, en haut à droite
    this.add.text(LARGEUR - 26, 20, "✕", { fontFamily: POLICE, fontSize: "26px", color: "#ffffff" })
      .setOrigin(0.5).setPadding(10).setInteractive({ useHandCursor: true })
      .on("pointerup", () => this.partie.quitter());

    // La vie du boss, cachée tant qu'il n'est pas là
    const largeur = 420;
    this.barreDuBoss = this.add.rectangle(-largeur / 2, 0, largeur, 12, 0xff4f4f).setOrigin(0, 0.5);
    this.cadreDuBoss = this.add.container(LARGEUR / 2, 62, [
      this.add.rectangle(0, 0, largeur + 6, 18, 0x000000, 0.6).setStrokeStyle(2, 0xffffff, 0.7),
      this.barreDuBoss,
      this.add.text(0, -18, "BOSS", { fontFamily: POLICE, fontSize: "14px", fontStyle: "bold", color: "#ff9a9a" }).setOrigin(0.5),
    ]).setVisible(false);
  }

  update() {
    const p = this.partie;
    this.texte.setText(`Vague ${p.vague.numero}    Score : ${p.score}    Record : ${Math.max(p.record, p.score)}`);
    this.arme.setText("Tirs " + "▲".repeat(p.arme) + "△".repeat(ARME_MAX - p.arme));
    this.montrerLesVies(Math.max(p.vies, 0));

    const boss = p.boss;
    this.cadreDuBoss.setVisible(!!boss?.pret);
    if (boss) {
      this.barreDuBoss.setScale(Math.max(boss.vie, 0) / boss.vieMax, 1);
    }

    if (p.vague.numero !== this.vagueAnnoncee) {
      this.vagueAnnoncee = p.vague.numero;
      this.annoncer(p.vague.boss ? "Attention : le boss !" : `Vague ${p.vague.numero}`, p.vague.boss ? "#ff7070" : CYAN);
    }
  }

  // Un titre en grand, qui arrive en grossissant et s'en va tout seul
  private annoncer(titre: string, couleur: string) {
    const bandeau = this.add.text(LARGEUR / 2, 220, titre, {
      fontFamily: POLICE, fontSize: "44px", fontStyle: "bold", color: couleur, stroke: "#14121c", strokeThickness: 8,
    }).setOrigin(0.5).setScale(0.6).setAlpha(0);
    this.tweens.chain({
      targets: bandeau,
      tweens: [
        { alpha: 1, scale: 1, duration: 350, ease: "Back.Out" },
        { alpha: 0, y: 190, duration: 400, delay: 900, onComplete: () => bandeau.destroy() },
      ],
    });
  }

  // Un petit vaisseau par vie, de droite à gauche ; au-delà de 5, « + n »
  private montrerLesVies(vies: number) {
    const montrees = Math.min(vies, 5);
    while (this.vies.length < montrees) {
      const vie = this.add.image(LARGEUR - 72 - this.vies.length * 26, 20, "tir-vie").setScale(0);
      this.tweens.add({ targets: vie, scale: 1, duration: 300, ease: "Back.Out" });
      this.vies.push(vie);
    }
    while (this.vies.length > montrees) {
      this.vies.pop()!.destroy();
    }
    this.viesEnPlus.setText(vies > 5 ? "+" + (vies - 5) : "");
  }
}
