// Le tableau de bord : une scène lancée par-dessus la course (this.scene.launch).
// Sa caméra ne bouge pas : les compteurs, la carte, les messages et les commandes au doigt restent
// à leur place, pendant que les caméras de la course suivent les licornes.

import Phaser from "phaser";
import type { Course } from "./Course";
import type { Coureuse } from "../Coureuse";
import { chrono, rangTexte } from "../circuits";
import { TOURS, ETOILES_MAX, DUREE_TURBO, DUREE_GEANTE, ARC_EN_CIEL, COULEURS } from "../reglages";
import { textureCarte } from "../textures";
import { ecrire, enNombre, arcEnCiel, Annonces } from "../interface";
import { changerReglageSon, sons } from "../sons";
import { LARGEUR, HAUTEUR } from "../../../socle/style";
import { estTactile } from "../../../socle/tactile";
import { surTouche } from "../../../socle/clavier";

type Action = "gauche" | "droite" | "reculer" | "turbo";

// Les commandes au doigt : pas de bouton pour galoper, la licorne galope toute seule
const COMMANDES: { action: Action; x: number; y: number; rayon: number; icone: string }[] = [
  { action: "gauche", x: 92, y: 448, rayon: 64, icone: "◀" },
  { action: "droite", x: 238, y: 448, rayon: 64, icone: "▶" },
  { action: "reculer", x: 738, y: 475, rayon: 46, icone: "▼" },
  { action: "turbo", x: 870, y: 432, rayon: 68, icone: "" },
];

// Les compteurs d'une joueuse, dans sa moitié d'écran
interface Compteurs {
  licorne: Coureuse;
  vue: { x: number; w: number };
  ligne: Phaser.GameObjects.Text;
  temps: Phaser.GameObjects.Text;
  droite: Phaser.GameObjects.Text;         // le record, ou la place
  sur: Phaser.GameObjects.Text;            // « /4 » après la place
  etoiles: Phaser.GameObjects.Image[];
  turbo: Phaser.GameObjects.Image;
  geante: Phaser.GameObjects.Rectangle;
  largeurBarre: number;
  banniere?: Phaser.GameObjects.Container;
}

export class Tableau extends Phaser.Scene {
  private course!: Course;
  private compteurs: Compteurs[] = [];
  private annonces!: Annonces;
  private compte!: Phaser.GameObjects.Text;
  private points: { licorne: Coureuse | null; rond: Phaser.GameObjects.Arc }[] = [];
  private carte!: { x: number; y: number; echelleX: number; echelleY: number };
  private boutonsTactiles: { action: Action; rond: Phaser.GameObjects.Arc }[] = [];
  private nombreEtoiles?: Phaser.GameObjects.Text;
  private etoileTactile?: Phaser.GameObjects.Image;
  private pause?: Phaser.GameObjects.Container;
  private doigts = new Map<number, Action>();   // pour chaque doigt posé : la commande qu'il tient

  constructor() {
    super("licorne-tableau");
  }

  create() {
    this.course = this.scene.get("licorne-course") as Course;
    this.compteurs = [];
    this.points = [];
    this.boutonsTactiles = [];
    this.doigts.clear();
    this.nombreEtoiles = undefined;
    this.etoileTactile = undefined;
    this.pause = undefined;

    const deux = this.course.joueuses.length === 2;
    const vues = deux ? [{ x: 0, w: LARGEUR / 2 - 2 }, { x: LARGEUR / 2 + 2, w: LARGEUR / 2 - 2 }] : [{ x: 0, w: LARGEUR }];
    if (deux) {
      this.add.rectangle(LARGEUR / 2, 0, 4, HAUTEUR, 0xffffff).setOrigin(0.5, 0);
    }
    this.course.joueuses.forEach((licorne, j) => this.creerCompteurs(licorne, vues[j]));
    this.creerCarte(deux);

    this.compte = ecrire(this, LARGEUR / 2, HAUTEUR / 2, "", 130, "#ffffff", { contour: true }).setVisible(false);
    const colonnes = vues.map((v) => ({ x: v.x + v.w / 2, taille: deux ? 38 : 52 }));
    this.annonces = new Annonces(this, [...colonnes, { x: LARGEUR / 2, taille: 52 }]);

    if (estTactile() && !deux) {
      this.creerCommandes();
    }

    surTouche(this, "M", () => {
      this.annonces.annoncer(changerReglageSon(), COULEURS.texteDoux);
      sons.menu();
    });

    // On écoute les événements de la course. Ses écouteurs ne disparaissent pas tout seuls
    // quand CETTE scène s'arrête : on les retire nous-mêmes.
    const evenements = this.course.events;
    evenements.on("compte", this.compter, this);
    evenements.on("annonce", this.annoncer, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      evenements.off("compte", this.compter, this);
      evenements.off("annonce", this.annoncer, this);
    });
    this.course.tableauPret();
  }

  private creerCompteurs(licorne: Coureuse, vue: { x: number; w: number }) {
    const w = Math.min(390, vue.w - 20);
    const x = vue.x + 10;
    const y = 10;
    const fond = this.add.graphics();
    fond.fillStyle(0xffffff, 0.82).fillRoundedRect(x, y, w, 92, 18);
    fond.fillStyle(enNombre(licorne.look.criniere[0])).fillRoundedRect(x, y, 10, 92, { tl: 18, bl: 18, tr: 0, br: 0 });

    const texte = (tx: number, ty: number, taille: number, couleur: string, origine: [number, number] = [0, 0.5]) =>
      ecrire(this, tx, ty, "", taille, couleur, { origine });
    const etoiles: Phaser.GameObjects.Image[] = [];
    for (let k = 0; k < ETOILES_MAX; k++) {
      etoiles.push(this.add.image(x + w - 22 - (ETOILES_MAX - 1 - k) * 25, y + 26, "licorne-compteur-vide"));
    }
    this.compteurs.push({
      licorne, vue,
      ligne: texte(x + 20, y + 26, 19, COULEURS.texte),
      temps: texte(x + 20, y + 56, 17, COULEURS.texte),
      droite: this.course.enChrono
        ? texte(x + w - 10, y + 56, 17, COULEURS.orange, [1, 0.5])
        : texte(x + w - 40, y + 56, 26, COULEURS.texteDoux, [1, 0.5]),
      sur: texte(x + w - 42, y + 60, 15, COULEURS.texteClair),
      etoiles,
      turbo: this.add.image(x + 20, y + 74, "licorne-barre").setOrigin(0),
      geante: this.add.rectangle(x + 20, y + 82, w - 34, 5, 0xff4fa8).setOrigin(0).setRounded(2.5),
      largeurBarre: w - 34,
    });
  }

  // La petite carte : la route en lilas, et un point par licorne (blanc pour le fantôme)
  private creerCarte(deux: boolean) {
    const c = this.course.circuit;
    const largeur = 150;
    const hauteur = largeur * c.modele.hauteur / c.modele.largeur;
    let x = LARGEUR - largeur - 12;
    let y = 12;
    if (deux) {
      x = LARGEUR / 2 - largeur / 2;
      y = HAUTEUR - hauteur - 12;
    }
    this.add.graphics().fillStyle(0xffffff, 0.78).fillRoundedRect(x, y, largeur, hauteur, 16);
    this.add.image(x + 10, y + 10, textureCarte(this, c, largeur - 20, hauteur - 20)).setOrigin(0);
    this.carte = { x: x + 10, y: y + 10, echelleX: (largeur - 20) / c.modele.largeur, echelleY: (hauteur - 20) / c.modele.hauteur };
    if (this.course.enChrono) {
      this.points.push({ licorne: null, rond: this.add.circle(0, 0, 60 * this.carte.echelleX + 0.5, 0xffffff, 0.95).setVisible(false) });
    }
    // Les rivales d'abord : les joueuses passent par-dessus
    for (const l of this.course.licornes.slice().reverse()) {
      const rayon = (l.humaine ? 85 : 55) * this.carte.echelleX + 1;
      const rond = this.add.circle(0, 0, rayon, enNombre(l.look.criniere[0]))
        .setStrokeStyle(l.humaine ? 1.5 : 0.8, 0xffffff, l.humaine ? 1 : 0.6);
      this.points.push({ licorne: l, rond });
    }
  }

  private creerCommandes() {
    for (const commande of COMMANDES) {
      const { x, y, rayon } = commande;
      const rond = this.add.circle(x, y, rayon, 0xffffff, 0.38).setStrokeStyle(3, 0xffffff, 0.9);
      // La zone sensible est un cercle un peu plus grand que le bouton (un pouce, ça déborde).
      // Ses coordonnées se comptent depuis le coin haut gauche du rond.
      rond.setInteractive(new Phaser.Geom.Circle(rayon, rayon, rayon * 1.4), Phaser.Geom.Circle.Contains);
      // Un doigt se pose sur le bouton, ou y glisse en restant appuyé : il le tient.
      // Il le lâche en se levant, ou en glissant hors du bouton.
      rond.on("pointerdown", (doigt: Phaser.Input.Pointer) => this.tenir(doigt, commande.action));
      rond.on("pointerover", (doigt: Phaser.Input.Pointer) => {
        if (doigt.isDown) {
          this.tenir(doigt, commande.action);
        }
      });
      rond.on("pointerout", (doigt: Phaser.Input.Pointer) => this.lacher(doigt));
      this.boutonsTactiles.push({ action: commande.action, rond });

      if (commande.action === "turbo") {
        this.etoileTactile = this.add.image(x, y, "licorne-grande-etoile");
        this.nombreEtoiles = ecrire(this, x + rayon * 0.62, y - rayon * 0.62, "", 22, COULEURS.orange, { contour: true });
      } else {
        ecrire(this, x, y + 2, commande.icone, Math.round(rayon * 0.75), "#8a5cd6", { gras: false }).setAlpha(0.85);
      }
    }
    this.input.on("pointerup", (doigt: Phaser.Input.Pointer) => this.lacher(doigt));

    // Le bouton pause, en haut au milieu
    const rond = this.add.circle(0, 0, 24, 0xffffff, 0.7);
    const barres = this.add.graphics().fillStyle(0x8a5cd6).fillRect(-8, -10, 5, 20).fillRect(3, -10, 5, 20);
    this.pause = this.add.container(LARGEUR / 2, 32, [rond, barres]).setSize(60, 60).setInteractive()
      .on("pointerup", () => this.course.mettreEnPause());
  }

  private tenir(doigt: Phaser.Input.Pointer, action: Action) {
    const avant = this.doigts.get(doigt.id);
    this.doigts.set(doigt.id, action);
    if (action === "turbo" && avant !== "turbo" && this.course.enCourse) {
      this.course.joueuses[0].lancerTurbo();
    }
    this.recompterLesDoigts();
  }

  private lacher(doigt: Phaser.Input.Pointer) {
    this.doigts.delete(doigt.id);
    this.recompterLesDoigts();
  }

  private recompterLesDoigts() {
    const tenues = new Set(this.doigts.values());
    this.course.tactile.gauche = tenues.has("gauche");
    this.course.tactile.droite = tenues.has("droite");
    this.course.tactile.reculer = tenues.has("reculer");
    for (const { action, rond } of this.boutonsTactiles) {
      rond.setFillStyle(0xffffff, tenues.has(action) ? 0.8 : 0.38);   // un bouton tenu s'éclaire
    }
  }

  // 3, 2, 1 : un gros chiffre de couleur, qui dégonfle pendant la seconde
  private compter(reste: number) {
    if (reste <= 0) {
      this.compte.setVisible(false);
      return;
    }
    this.compte.setText(String(reste)).setColor(ARC_EN_CIEL[(reste * 2) % ARC_EN_CIEL.length]).setVisible(true).setScale(1.4);
    this.tweens.add({ targets: this.compte, scale: 1, duration: 1000 });
  }

  private annoncer(texte: string, couleur: string, vue: number) {
    this.annonces.annoncer(texte, couleur, vue >= 0 ? vue : undefined);
  }

  // Une joueuse a passé la ligne : un cartouche « Arrivée ! » dans sa moitié d'écran
  private banniere(c: Compteurs): Phaser.GameObjects.Container {
    const l = c.licorne;
    const fond = this.add.graphics().fillStyle(0xffffff, 0.85).fillRoundedRect(-170, -70, 340, 130, 24);
    const titre = arcEnCiel(ecrire(this, 0, -30, "Arrivée !", 44, "#ff5e9e", { contour: true }));
    const detail = this.course.enChrono
      ? chrono(l.tempsFinal)
      : rangTexte(l.rang) + "  ·  " + chrono(l.tempsFinal);
    const couleur = !this.course.enChrono && l.rang === 1 ? COULEURS.rose : COULEURS.texte;
    const texte = ecrire(this, 0, 22, detail, 30, couleur);
    const boite = this.add.container(c.vue.x + c.vue.w / 2, HAUTEUR / 2, [fond, titre, texte]).setScale(0.5).setAlpha(0);
    this.tweens.add({ targets: boite, scale: 1, alpha: 1, duration: 350, ease: "Back.Out" });
    return boite;
  }

  update() {
    const course = this.course;
    for (const c of this.compteurs) {
      const l = c.licorne;
      c.ligne.setText(l.nom + "  ·  Tour " + Math.min(l.tour, TOURS) + "/" + TOURS);
      c.etoiles.forEach((etoile, k) => etoile.setTexture(k < l.etoiles ? "licorne-compteur-etoile" : "licorne-compteur-vide"));
      if (course.enChrono) {
        c.temps.setText("⏱ " + chrono(l.fini ? l.tempsFinal : l.tempsTour));
        c.droite.setText(course.meilleurTour !== null ? "Record " + chrono(course.meilleurTour) : "");
      } else {
        c.temps.setText("⏱ " + chrono(l.fini ? l.tempsFinal : l.tempsTotal));
        const rang = l.fini ? l.rang : l.place;
        c.droite.setText(rangTexte(rang)).setColor(rang === 1 ? COULEURS.rose : COULEURS.texteDoux);
        c.sur.setText("/" + course.licornes.length);
      }
      // Les barres : le turbo, et le temps de géante qui reste
      c.turbo.setVisible(l.turbo > 0).setDisplaySize(c.largeurBarre * Math.min(1, l.turbo / DUREE_TURBO), 5);
      c.geante.setVisible(l.geante > 0).setSize(c.largeurBarre * l.geante / DUREE_GEANTE, 5);
      if (l.fini && !c.banniere) {
        c.banniere = this.banniere(c);
      }
    }

    for (const { licorne, rond } of this.points) {
      if (licorne) {
        rond.setPosition(this.carte.x + licorne.x * this.carte.echelleX, this.carte.y + licorne.y * this.carte.echelleY);
      } else {
        const ombre = course.fantome[course.fantomeIndex];
        rond.setVisible(course.enCourse && ombre !== undefined);
        if (ombre) {
          rond.setPosition(this.carte.x + ombre.x * this.carte.echelleX, this.carte.y + ombre.y * this.carte.echelleY);
        }
      }
    }

    if (this.nombreEtoiles && this.etoileTactile) {
      const etoiles = course.joueuses[0].etoiles;
      this.nombreEtoiles.setText(String(etoiles));
      this.etoileTactile.setAlpha(etoiles > 0 ? 1 : 0.4);
    }
    this.pause?.setVisible(course.enCourse);
  }
}
