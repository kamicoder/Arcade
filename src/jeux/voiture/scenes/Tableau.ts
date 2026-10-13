// Le tableau de bord : une scène lancée par-dessus la course (this.scene.launch).
// Sa caméra ne bouge pas : les compteurs et les commandes au doigt restent à leur place à l'écran,
// pendant que la caméra de la course suit la voiture.

import Phaser from "phaser";
import type { Course } from "./Course";
import { chrono, rang } from "../circuits";
import { TOURS, NITRO_MAX } from "../reglages";
import { LARGEUR, HAUTEUR, POLICE } from "../../../socle/style";
import { estTactile } from "../../../socle/tactile";

type Action = "gauche" | "droite" | "reculer" | "nitro";

// Les commandes au doigt : pas de bouton pour accélérer, la voiture accélère toute seule
const COMMANDES: { action: Action; x: number; y: number; rayon: number; icone: string }[] = [
  { action: "gauche", x: 92, y: 448, rayon: 64, icone: "◀" },
  { action: "droite", x: 238, y: 448, rayon: 64, icone: "▶" },
  { action: "reculer", x: 738, y: 475, rayon: 46, icone: "▼" },
  { action: "nitro", x: 870, y: 432, rayon: 68, icone: "" },
];

export class Tableau extends Phaser.Scene {
  private course!: Course;
  private compteurs!: Phaser.GameObjects.Text;
  private recordTexte!: Phaser.GameObjects.Text;
  private bidons: Phaser.GameObjects.Image[] = [];
  private grosTexte!: Phaser.GameObjects.Text;
  private nitroTexte?: Phaser.GameObjects.Text;
  private bidonTactile?: Phaser.GameObjects.Image;
  private doigts = new Map<number, Action>();   // pour chaque doigt posé : la commande qu'il tient

  constructor() {
    super("voiture-tableau");
  }

  create() {
    // Une scène peut en retrouver une autre par son nom
    this.course = this.scene.get("voiture-course") as Course;
    this.bidons = [];
    this.nitroTexte = undefined;
    this.bidonTactile = undefined;
    this.doigts.clear();

    this.add.rectangle(0, 0, LARGEUR, 40, 0x000000, 0.5).setOrigin(0);
    const style = { fontFamily: POLICE, fontSize: "18px", fontStyle: "bold" };
    this.compteurs = this.add.text(16, 20, "", { ...style, color: "#ff7a1a" }).setOrigin(0, 0.5);
    for (let k = 0; k < NITRO_MAX; k++) {
      this.bidons.push(this.add.image(300 + k * 22, 20, "voiture-bidon").setScale(0.6));
    }
    this.recordTexte = this.add.text(380, 20, "", { ...style, color: "#ffd479" }).setOrigin(0, 0.5);
    this.montrerLeRecord(this.course.record?.temps);

    this.grosTexte = this.add.text(LARGEUR / 2, HAUTEUR / 2, "", {
      fontFamily: POLICE, fontSize: "120px", fontStyle: "bold", color: "#ffffff",
      stroke: "#1c1a25", strokeThickness: 10,
    }).setOrigin(0.5);

    // Le bouton pour revenir au menu, en haut à droite
    this.add.text(LARGEUR - 26, 20, "✕", { fontFamily: POLICE, fontSize: "26px", color: "#ffffff" })
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on("pointerup", () => this.course.quitter());

    if (estTactile()) {
      this.creerCommandes();
    }

    // On écoute les événements de la course. Ses écouteurs ne disparaissent pas tout seuls
    // quand CETTE scène s'arrête : on les retire nous-mêmes.
    this.course.events.on("compte", this.compter, this);
    this.course.events.on("record", this.montrerLeRecord, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.course.events.off("compte", this.compter, this);
      this.course.events.off("record", this.montrerLeRecord, this);
    });
  }

  private compter(reste: number) {
    this.grosTexte.setText(reste > 0 ? String(reste) : "Partez !").setAlpha(1).setScale(1.6);
    this.tweens.add({ targets: this.grosTexte, scale: 1, duration: 300, ease: "Back.Out" });
    if (reste === 0) {
      this.tweens.add({ targets: this.grosTexte, alpha: 0, delay: 500, duration: 400 });
    }
  }

  private montrerLeRecord(temps?: number) {
    this.recordTexte.setText(this.course.mode === "chrono" && temps !== undefined ? "Record : " + chrono(temps) : "");
  }

  private creerCommandes() {
    for (const commande of COMMANDES) {
      const { x, y, rayon } = commande;
      const rond = this.add.circle(x, y, rayon, 0xffffff, 0.18).setStrokeStyle(3, 0xffffff, 0.7);
      // La zone sensible est un cercle un peu plus grand que le bouton (un pouce, ça déborde).
      // Ses coordonnées se comptent depuis le coin haut gauche du rond.
      rond.setInteractive(new Phaser.Geom.Circle(rayon, rayon, rayon * 1.4), Phaser.Geom.Circle.Contains);
      rond.setData("action", commande.action);

      // Un doigt se pose sur le bouton, ou y glisse en restant appuyé : il le tient.
      // Il le lâche en se levant, ou en glissant hors du bouton.
      rond.on("pointerdown", (doigt: Phaser.Input.Pointer) => this.tenir(doigt, commande.action));
      rond.on("pointerover", (doigt: Phaser.Input.Pointer) => {
        if (doigt.isDown) {
          this.tenir(doigt, commande.action);
        }
      });
      rond.on("pointerout", (doigt: Phaser.Input.Pointer) => this.lacher(doigt));

      if (commande.action === "nitro") {
        this.bidonTactile = this.add.image(x, y, "voiture-bidon").setScale(1.5);
        this.nitroTexte = this.add.text(x + 46, y - 40, "", {
          fontFamily: POLICE, fontSize: "26px", fontStyle: "bold", color: "#ffd479",
        }).setOrigin(0.5);
      } else {
        this.add.text(x, y, commande.icone, {
          fontFamily: POLICE, fontSize: Math.round(rayon * 0.75) + "px", color: "#ffffff",
        }).setOrigin(0.5).setAlpha(0.9);
      }
    }
    this.input.on("pointerup", (doigt: Phaser.Input.Pointer) => this.lacher(doigt));
  }

  private tenir(doigt: Phaser.Input.Pointer, action: Action) {
    this.doigts.set(doigt.id, action);
    this.recompterLesDoigts();
  }

  private lacher(doigt: Phaser.Input.Pointer) {
    this.doigts.delete(doigt.id);
    this.recompterLesDoigts();
  }

  private recompterLesDoigts() {
    const tenues = new Set(this.doigts.values());
    for (const commande of COMMANDES) {
      this.course.tactile[commande.action] = tenues.has(commande.action);
    }
    // Un bouton tenu s'éclaire
    for (const objet of this.children.list) {
      if (objet instanceof Phaser.GameObjects.Arc) {
        objet.setFillStyle(0xffffff, tenues.has(objet.getData("action")) ? 0.45 : 0.18);
      }
    }
  }

  update() {
    const joueur = this.course.joueur;
    let texte = "Tour " + Math.min(joueur.tour, TOURS) + "/" + TOURS + "   " + chrono(joueur.tempsTour);
    if (this.course.voitures.length > 1) {
      texte += "   " + rang(this.course.classement.indexOf(joueur) + 1) + "/" + this.course.voitures.length;
    }
    this.compteurs.setText(texte);
    this.bidons.forEach((bidon, k) => bidon.setAlpha(k < joueur.nitro ? 1 : 0.25));
    this.nitroTexte?.setText(String(joueur.nitro));
    this.bidonTactile?.setAlpha(joueur.nitro > 0 ? 1 : 0.35);
  }
}
