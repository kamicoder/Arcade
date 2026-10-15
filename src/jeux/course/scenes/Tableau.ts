// Le tableau de bord : une scène lancée par-dessus la course (this.scene.launch).
// Sa caméra ne bouge pas : les compteurs, la carte, les messages et les commandes au doigt restent
// à leur place, pendant que les caméras de la course suivent les véhicules.

import Phaser from "phaser";
import { TOURS, type Piste } from "./Piste";
import type { Coureur } from "../Coureur";
import { chrono, cheminDeRoute, type Circuit } from "../circuits";
import { themeEnCours } from "../sauvegarde";
import { changerReglageSon, jouer } from "../son";
import { ecrire, enNombre, Annonces, rangTexte } from "../interface";
import { LARGEUR, HAUTEUR } from "../../../socle/style";
import { BoutonsAuDoigt } from "../../../socle/doigts";
import { estTactile } from "../../../socle/tactile";
import { surTouche } from "../../../socle/clavier";

type Action = "gauche" | "droite" | "reculer" | "turbo";

// Les commandes au doigt : pas de bouton pour avancer, le véhicule avance tout seul
const COMMANDES: { action: Action; x: number; y: number; rayon: number; icone: string }[] = [
  { action: "gauche", x: 92, y: 448, rayon: 64, icone: "◀" },
  { action: "droite", x: 238, y: 448, rayon: 64, icone: "▶" },
  { action: "reculer", x: 738, y: 475, rayon: 46, icone: "▼" },
  { action: "turbo", x: 870, y: 432, rayon: 68, icone: "" },
];

// Les compteurs d'un joueur, dans sa moitié d'écran
interface Compteurs {
  coureur: Coureur;
  vue: { x: number; w: number };
  ligne: Phaser.GameObjects.Text;
  temps: Phaser.GameObjects.Text;
  droite: Phaser.GameObjects.Text;         // le record, ou la place
  sur: Phaser.GameObjects.Text;            // « /4 » après la place
  reserve: Phaser.GameObjects.Image[];
  turbo: Phaser.GameObjects.Image;
  geante: Phaser.GameObjects.Rectangle;
  largeurBarre: number;
  banniere?: Phaser.GameObjects.Container;
}

export class Tableau extends Phaser.Scene {
  private course!: Piste;
  private compteurs: Compteurs[] = [];
  private annonces!: Annonces;
  private compte!: Phaser.GameObjects.Text;
  private points: { coureur: Coureur | null; rond: Phaser.GameObjects.Arc }[] = [];
  private carte!: { x: number; y: number; echelleX: number; echelleY: number };
  private boutonsTactiles: { action: Action; rond: Phaser.GameObjects.Arc }[] = [];
  private nombreTurbos?: Phaser.GameObjects.Text;
  private iconeTactile?: Phaser.GameObjects.Image;
  private pause?: Phaser.GameObjects.Container;

  constructor() {
    super("course-tableau");
  }

  create() {
    const habillage = themeEnCours().habillage;
    this.course = this.scene.get("course-piste") as Piste;
    this.compteurs = [];
    this.points = [];
    this.boutonsTactiles = [];
    this.nombreTurbos = undefined;
    this.iconeTactile = undefined;
    this.pause = undefined;

    const deux = this.course.joueurs.length === 2;
    const vues = deux ? [{ x: 0, w: LARGEUR / 2 - 2 }, { x: LARGEUR / 2 + 2, w: LARGEUR / 2 - 2 }] : [{ x: 0, w: LARGEUR }];
    if (deux) {
      this.add.rectangle(LARGEUR / 2, 0, 4, HAUTEUR, habillage.couleurs.separation).setOrigin(0.5, 0);
    }
    this.course.joueurs.forEach((coureur, j) => this.creerCompteurs(coureur, vues[j]));
    this.creerCarte(deux);

    this.compte = ecrire(this, LARGEUR / 2, HAUTEUR / 2, "", 130, "#ffffff", { contour: true }).setVisible(false);
    const colonnes = vues.map((v) => ({ x: v.x + v.w / 2, taille: deux ? 38 : 52 }));
    this.annonces = new Annonces(this, [...colonnes, { x: LARGEUR / 2, taille: 52 }]);

    if (estTactile() && !deux) {
      this.creerCommandes();
    }

    surTouche(this, "M", () => {
      this.annonces.annoncer(changerReglageSon(), habillage.couleurs.texteDoux);
      jouer(this, "menu");
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

  private creerCompteurs(coureur: Coureur, vue: { x: number; w: number }) {
    const theme = themeEnCours();
    const { couleurs: c, icones } = theme.habillage;
    const w = Math.min(390, vue.w - 20);
    const x = vue.x + 10;
    const y = 10;
    const fond = this.add.graphics();
    fond.fillStyle(c.fondPanneau, c.alphaPanneau).fillRoundedRect(x, y, w, 92, 18);
    fond.fillStyle(enNombre(theme.couleur(coureur.apparence))).fillRoundedRect(x, y, 10, 92, { tl: 18, bl: 18, tr: 0, br: 0 });

    const texte = (tx: number, ty: number, taille: number, couleur: string, origine: [number, number] = [0, 0.5]) =>
      ecrire(this, tx, ty, "", taille, couleur, { origine });
    const reserve: Phaser.GameObjects.Image[] = [];
    const max = theme.conduite.reserveMax;
    for (let k = 0; k < max; k++) {
      reserve.push(this.add.image(x + w - 22 - (max - 1 - k) * 25, y + 26, icones.reserveVide));
    }
    this.compteurs.push({
      coureur, vue,
      ligne: texte(x + 20, y + 26, 19, c.texte),
      temps: texte(x + 20, y + 56, 17, c.texte),
      droite: this.course.enChrono
        ? texte(x + w - 10, y + 56, 17, c.record, [1, 0.5])
        : texte(x + w - 40, y + 56, 26, c.texteDoux, [1, 0.5]),
      sur: texte(x + w - 42, y + 60, 15, c.texteClair),
      reserve,
      turbo: this.add.image(x + 20, y + 74, icones.barre).setOrigin(0),
      geante: this.add.rectangle(x + 20, y + 82, w - 34, 5, 0xff4fa8).setOrigin(0).setRounded(2.5),
      largeurBarre: w - 34,
    });
  }

  // La petite carte : la route, et un point par véhicule (blanc pour le fantôme)
  private creerCarte(deux: boolean) {
    const c = this.course.circuit;
    const habillage = themeEnCours().habillage;
    const largeur = 150;
    const hauteur = largeur * c.modele.hauteur / c.modele.largeur;
    let x = LARGEUR - largeur - 12;
    let y = 12;
    if (deux) {
      x = LARGEUR / 2 - largeur / 2;
      y = HAUTEUR - hauteur - 12;
    }
    this.add.graphics().fillStyle(habillage.couleurs.fondPanneau, habillage.couleurs.alphaPanneau * 0.95)
      .fillRoundedRect(x, y, largeur, hauteur, 16);
    this.add.image(x + 10, y + 10, this.textureCarte(c, largeur - 20, hauteur - 20)).setOrigin(0);
    this.carte = { x: x + 10, y: y + 10, echelleX: (largeur - 20) / c.modele.largeur, echelleY: (hauteur - 20) / c.modele.hauteur };
    if (this.course.enChrono) {
      this.points.push({ coureur: null, rond: this.add.circle(0, 0, 60 * this.carte.echelleX + 0.5, 0xffffff, 0.95).setVisible(false) });
    }
    // Les rivaux d'abord : les joueurs passent par-dessus
    for (const coureur of this.course.coureurs.slice().reverse()) {
      const rayon = (coureur.humain ? 85 : 55) * this.carte.echelleX + 1;
      const rond = this.add.circle(0, 0, rayon, enNombre(themeEnCours().couleur(coureur.apparence)))
        .setStrokeStyle(coureur.humain ? 1.5 : 0.8, 0xffffff, coureur.humain ? 1 : 0.6);
      this.points.push({ coureur, rond });
    }
  }

  // La route de la petite carte, dans la couleur du thème
  private textureCarte(c: Circuit, w: number, h: number): string {
    const cle = "course-carte";
    if (this.textures.exists(cle)) {
      this.textures.remove(cle);
    }
    const texture = this.textures.createCanvas(cle, Math.ceil(w), Math.ceil(h))!;
    const p = texture.getContext();
    p.scale(w / c.modele.largeur, h / c.modele.hauteur);
    p.lineJoin = "round";
    p.lineWidth = c.largeurRoute;
    p.strokeStyle = themeEnCours().habillage.couleurs.carteRoute;
    p.stroke(cheminDeRoute(c.points));
    texture.refresh();
    return cle;
  }

  private creerCommandes() {
    const { couleurs: c, icones } = themeEnCours().habillage;
    // Les ronds à tenir au doigt (socle/doigts.ts). Le turbo part dès que le doigt se pose dessus.
    const doigts = new BoutonsAuDoigt<Action>(this, {
      quandChange: (tenues) => this.recompterLesDoigts(tenues),
      quandPose: (action, nouveau) => {
        if (action === "turbo" && nouveau && this.course.enCourse) {
          this.course.joueurs[0].lancerTurbo();
        }
      },
    });
    // En pause, la scène n'entend plus les doigts : un pouce levé pendant la pause resterait posé.
    // On lâche tout à la pause ; au retour, on ne tient que ce qu'on touche à nouveau.
    const toutLacher = () => doigts.toutLacher();
    this.events.on(Phaser.Scenes.Events.PAUSE, toutLacher);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.PAUSE, toutLacher));
    for (const commande of COMMANDES) {
      const { x, y, rayon } = commande;
      const rond = this.add.circle(x, y, rayon, 0xffffff, c.alphaCommande).setStrokeStyle(3, 0xffffff, 0.9);
      doigts.ajouter(rond, commande.action, 1.4);
      this.boutonsTactiles.push({ action: commande.action, rond });

      if (commande.action === "turbo") {
        this.iconeTactile = this.add.image(x, y, icones.grandeReserve);
        this.nombreTurbos = ecrire(this, x + rayon * 0.62, y - rayon * 0.62, "", 22, c.record, { contour: true });
      } else {
        ecrire(this, x, y + 2, commande.icone, Math.round(rayon * 0.75), c.commande, { gras: false }).setAlpha(0.85);
      }
    }

    // Le bouton pause, en haut au milieu
    const rond = this.add.circle(0, 0, 24, 0xffffff, 0.7);
    const barres = this.add.graphics().fillStyle(enNombre(c.commande === "#ffffff" ? "#1c1a25" : c.commande))
      .fillRect(-8, -10, 5, 20).fillRect(3, -10, 5, 20);
    this.pause = this.add.container(LARGEUR / 2, 32, [rond, barres]).setSize(60, 60).setInteractive()
      .on("pointerup", () => this.course.mettreEnPause());
  }

  private recompterLesDoigts(tenues: Set<Action>) {
    this.course.tactile.gauche = tenues.has("gauche");
    this.course.tactile.droite = tenues.has("droite");
    this.course.tactile.reculer = tenues.has("reculer");
    const alpha = themeEnCours().habillage.couleurs.alphaCommande;
    for (const { action, rond } of this.boutonsTactiles) {
      rond.setFillStyle(0xffffff, tenues.has(action) ? Math.min(0.8, alpha * 2.2) : alpha);   // un bouton tenu s'éclaire
    }
  }

  // 3, 2, 1 : un gros chiffre de couleur, qui dégonfle pendant la seconde
  private compter(reste: number) {
    if (reste <= 0) {
      this.compte.setVisible(false);
      return;
    }
    const couleurs = themeEnCours().habillage.couleurs.compte;
    this.compte.setText(String(reste)).setColor(couleurs[(reste * 2) % couleurs.length]).setVisible(true).setScale(1.4);
    this.tweens.add({ targets: this.compte, scale: 1, duration: 1000 });
  }

  private annoncer(texte: string, couleur: string, vue: number) {
    this.annonces.annoncer(texte, couleur, vue >= 0 ? vue : undefined);
  }

  // Un joueur a passé la ligne : un cartouche « Arrivée ! » dans sa moitié d'écran
  private banniere(c: Compteurs): Phaser.GameObjects.Container {
    const habillage = themeEnCours().habillage;
    const couleurs = habillage.couleurs;
    const l = c.coureur;
    const fond = this.add.graphics().fillStyle(couleurs.fondPanneau, Math.max(0.85, couleurs.alphaPanneau))
      .fillRoundedRect(-170, -70, 340, 130, 24);
    const titre = habillage.titre(ecrire(this, 0, -30, "Arrivée !", 44, couleurs.accent, { contour: true }));
    const detail = this.course.enChrono ? chrono(l.tempsFinal) : rangTexte(l.rang) + "  ·  " + chrono(l.tempsFinal);
    const couleur = !this.course.enChrono && l.rang === 1 ? couleurs.accent : couleurs.texte;
    const texte = ecrire(this, 0, 22, detail, 30, couleur);
    const boite = this.add.container(c.vue.x + c.vue.w / 2, HAUTEUR / 2, [fond, titre, texte]).setScale(0.5).setAlpha(0);
    this.tweens.add({ targets: boite, scale: 1, alpha: 1, duration: 350, ease: "Back.Out" });
    return boite;
  }

  update() {
    const course = this.course;
    const theme = themeEnCours();
    const { icones } = theme.habillage;
    const couleurs = theme.habillage.couleurs;
    for (const c of this.compteurs) {
      const l = c.coureur;
      c.ligne.setText(l.nom + "  ·  Tour " + Math.min(l.tour, TOURS) + "/" + TOURS);
      c.reserve.forEach((icone, k) => icone.setTexture(k < l.reserve ? icones.reserve : icones.reserveVide));
      if (course.enChrono) {
        c.temps.setText("⏱ " + chrono(l.fini ? l.tempsFinal : l.tempsTour));
        c.droite.setText(course.meilleurTour !== null ? "Record " + chrono(course.meilleurTour) : "");
      } else {
        c.temps.setText("⏱ " + chrono(l.fini ? l.tempsFinal : l.tempsTotal));
        const rang = l.fini ? l.rang : l.place;
        c.droite.setText(rangTexte(rang)).setColor(rang === 1 ? couleurs.accent : couleurs.texteDoux);
        c.sur.setText("/" + course.coureurs.length);
      }
      // Les barres : le turbo, et le temps de géant qui reste
      c.turbo.setVisible(l.turbo > 0).setDisplaySize(c.largeurBarre * Math.min(1, l.turbo / theme.conduite.turbo.duree), 5);
      const geant = theme.objets.find((o) => o.effet.genre === "geant");
      const dureeGeante = geant?.effet.genre === "geant" ? geant.effet.duree : 1;
      c.geante.setVisible(l.geante > 0).setSize(c.largeurBarre * l.geante / dureeGeante, 5);
      if (l.fini && !c.banniere) {
        c.banniere = this.banniere(c);
      }
    }

    for (const { coureur, rond } of this.points) {
      if (coureur) {
        rond.setPosition(this.carte.x + coureur.x * this.carte.echelleX, this.carte.y + coureur.y * this.carte.echelleY);
      } else {
        const ombre = course.fantome[course.fantomeIndex];
        // Le fantôme a fini son tour quand il disparaît de la piste : son point aussi
        rond.setVisible(course.enCourse && ombre !== undefined && course.ombre?.objet.visible === true);
        if (ombre) {
          rond.setPosition(this.carte.x + ombre.x * this.carte.echelleX, this.carte.y + ombre.y * this.carte.echelleY);
        }
      }
    }

    if (this.nombreTurbos && this.iconeTactile) {
      const reserve = course.joueurs[0].reserve;
      this.nombreTurbos.setText(String(reserve));
      this.iconeTactile.setAlpha(reserve > 0 ? 1 : 0.4);
    }
    this.pause?.setVisible(course.enCourse);
  }
}
