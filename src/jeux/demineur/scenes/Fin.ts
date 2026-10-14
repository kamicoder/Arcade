// La fin de partie, par-dessus la grille : gagné ou perdu, le temps, le nom à taper après un record,
// le podium du niveau, et deux boutons (rejouer, changer de niveau).

import Phaser from "phaser";
import type { Partie } from "./Partie";
import { HAUT_BARRE } from "./Partie";
import { NIVEAUX, lireLesRecords, ajouterUnRecord, dernierNom, enSecondes, type Niveau } from "../niveaux";
import { creerChampDeNom, type ChampDeNom } from "../saisie";
import { LARGEUR, HAUTEUR, POLICE } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { surManette, MANETTE, VALIDER } from "../../../socle/manette";
import { estTactile } from "../../../socle/tactile";

export interface DonneesDeFin {
  gagne: boolean;
  temps: number;
  niveau: number;
  record: boolean;
}

const CARTE = { x: LARGEUR / 2, y: (HAUTEUR + HAUT_BARRE) / 2, largeur: 460, hauteur: 360 };

export class Fin extends Phaser.Scene {
  private partie!: Partie;
  private donnees!: DonneesDeFin;
  private niveau!: Niveau;
  private carte!: Phaser.GameObjects.Container;
  private champ: ChampDeNom | null = null;
  private podium: Phaser.GameObjects.Text[] = [];
  private objetsDeSaisie: Phaser.GameObjects.GameObject[] = [];
  private pret = false;                    // on n'écoute qu'un instant après l'arrivée de la carte

  constructor() {
    super("demineur-fin");
  }

  init(donnees: DonneesDeFin) {
    this.donnees = donnees;
    this.niveau = NIVEAUX[donnees.niveau];
    this.champ = null;
    this.podium = [];
    this.objetsDeSaisie = [];
    this.pret = false;
  }

  create() {
    this.partie = this.scene.get("demineur-partie") as Partie;
    const { gagne, temps } = this.donnees;

    // Un voile sur la grille (pas sur la barre : le smiley relance toujours la partie)
    const voile = this.add.rectangle(0, HAUT_BARRE, LARGEUR, HAUTEUR - HAUT_BARRE, 0x000000, gagne ? 0.5 : 0.35)
      .setOrigin(0).setAlpha(0).setInteractive();   // interactif : les clics ne traversent pas jusqu'à la grille
    this.tweens.add({ targets: voile, alpha: 1, duration: 300 });
    // Un clic à côté de la carte l'écarte, pour revoir la grille (où étaient les mines ?) ; un autre la ramène
    voile.on("pointerup", () => this.ecarterLaCarte(voile));

    const { largeur, hauteur } = CARTE;
    const fond = this.add.rectangle(0, 0, largeur, hauteur, 0x221f2e, 0.96).setRounded(22)
      .setStrokeStyle(4, gagne ? 0x5fd068 : 0xff5a50);
    const titre = this.texte(0, -hauteur / 2 + 44, gagne ? "Gagné !" : "Boum !", 44, gagne ? "#5fd068" : "#ff5a50");
    const sousTitre = this.texte(0, -hauteur / 2 + 92,
      gagne ? `${this.niveau.nom} en ${enSecondes(temps)}` : "La prochaine sera la bonne !", 22, "#ffffff");
    this.carte = this.add.container(CARTE.x, CARTE.y, [fond, titre, sousTitre]).setDepth(2);

    // La carte tombe en place en rebondissant
    this.carte.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: this.carte, scale: 1, alpha: 1, duration: 420, ease: "Back.Out" });

    if (this.donnees.record) {
      this.demanderLeNom();
    } else {
      this.montrerLePodium(-1);
    }
    this.creerBoutons();

    if (gagne) {
      this.confettis();
    }

    surTouche(this, "ENTER", () => this.champ ? this.validerLeNom() : this.rejouer());
    surTouche(this, "SPACE", () => this.rejouer());
    surTouche(this, "R", () => this.rejouer());
    surTouche(this, "ESC", () => this.versLesNiveaux());
    surManette(this, VALIDER, () => (this.champ ? this.validerLeNom() : this.rejouer()));
    surManette(this, MANETTE.B, () => this.versLesNiveaux());
    this.time.delayedCall(500, () => {
      this.pret = true;
    });
  }

  private ecarterLaCarte(voile: Phaser.GameObjects.Rectangle) {
    if (!this.pret || this.champ) {
      return;                              // pendant la saisie du nom, la carte reste
    }
    const ecartee = this.carte.y !== CARTE.y;
    this.tweens.killTweensOf([this.carte, voile]);
    this.tweens.add({
      targets: this.carte,
      y: ecartee ? CARTE.y : HAUTEUR + CARTE.hauteur / 2 - 70,   // il en reste un bout en bas, pour la rappeler
      duration: 350,
      ease: "Back.Out",
    });
    this.tweens.add({ targets: voile, alpha: ecartee ? 1 : 0.15, duration: 300 });
  }

  private texte(x: number, y: number, contenu: string, taille: number, couleur: string) {
    return this.add.text(x, y, contenu, {
      fontFamily: POLICE, fontSize: taille + "px", fontStyle: "bold", color: couleur,
    }).setOrigin(0.5);
  }

  private demanderLeNom() {
    const etiquette = this.texte(0, -36, "🏆 Nouveau record ! Ton nom :", 20, "#ffd479");
    const ok = this.texte(150, 18, "OK", 20, "#14121c").setPadding(12, 8).setBackgroundColor("#ffc83d")
      .setInteractive({ useHandCursor: true });
    ok.on("pointerup", () => this.validerLeNom());
    this.carte.add([etiquette, ok]);
    this.objetsDeSaisie = [etiquette, ok];
    // Le champ du navigateur suit la carte : il apparaît quand elle a fini de tomber
    this.time.delayedCall(300, () => {
      if (!this.champ && this.sys.isActive()) {
        this.champ = creerChampDeNom(this, CARTE.x - 34, CARTE.y + 18, dernierNom(), () => this.validerLeNom());
      }
    });
  }

  private validerLeNom() {
    if (!this.champ) {
      return;
    }
    const nom = this.champ.valeur();
    this.champ.detruire();
    this.champ = null;
    const place = ajouterUnRecord(this.niveau, nom, this.donnees.temps);
    this.objetsDeSaisie.forEach((objet) => objet.destroy());
    this.objetsDeSaisie = [];
    this.montrerLePodium(place);
  }

  // Les trois meilleurs du niveau ; « place » : la ligne du record qu'on vient de battre, qui brille
  private montrerLePodium(place: number) {
    this.podium.forEach((ligne) => ligne.destroy());
    const records = lireLesRecords(this.niveau);
    const lignes = records.length
      ? records.map((r, k) => `${["🥇", "🥈", "🥉"][k]}  ${r.nom}   ${enSecondes(r.temps)}`)
      : ["Pas encore de record"];
    this.podium = lignes.map((ligne, k) => {
      const texte = this.texte(0, -40 + k * 34, ligne, 20, k === place ? "#ffc83d" : records.length ? "#e9e4f0" : "#6f6a86");
      this.carte.add(texte);
      texte.setAlpha(0);
      this.tweens.add({ targets: texte, alpha: 1, x: { from: -30, to: 0 }, delay: 150 + k * 110, duration: 300, ease: "Cubic.Out" });
      if (k === place) {
        this.tweens.add({ targets: texte, scale: 1.12, duration: 400, yoyo: true, repeat: -1, delay: 500 });
      }
      return texte;
    });
  }

  private creerBoutons() {
    const bouton = (x: number, contenu: string, couleur: number, action: () => void) => {
      const fond = this.add.rectangle(0, 0, 190, 54, couleur).setRounded(14).setInteractive({ useHandCursor: true });
      const texte = this.texte(0, 0, contenu, 20, "#14121c");
      const boite = this.add.container(x, CARTE.hauteur / 2 - 50, [fond, texte]);
      fond.on("pointerover", () => boite.setScale(1.06));
      fond.on("pointerout", () => boite.setScale(1));
      fond.on("pointerup", action);
      this.carte.add(boite);
    };
    const tactile = estTactile();
    bouton(-104, tactile ? "Rejouer" : "Rejouer (R)", 0x4fb3ff, () => this.rejouer());
    bouton(104, tactile ? "Niveaux" : "Niveaux (Échap)", 0xa59fc0, () => this.versLesNiveaux());
    this.carte.add(this.texte(0, CARTE.hauteur / 2 - 13, (tactile ? "Touche" : "Clique") + " à côté pour revoir la grille", 13, "#6f6a86"));
  }

  private rejouer() {
    if (!this.pret) {
      return;
    }
    if (this.champ) {
      this.validerLeNom();                 // on ne perd pas son record en rejouant
    }
    this.partie.nouvellePartie();          // arrête aussi cette scène
  }

  private versLesNiveaux() {
    if (!this.pret) {
      return;
    }
    if (this.champ) {
      this.validerLeNom();                 // on ne perd pas son record en partant
    }
    this.partie.quitter();
  }

  // Des confettis qui pleuvent du haut de l'écran, quelques instants
  private confettis() {
    const pluie = this.add.particles(0, 0, "demineur-confetti", {
      x: { min: 0, max: LARGEUR },
      y: -10,
      lifespan: 3200,
      speedY: { min: 120, max: 320 },
      speedX: { min: -90, max: 90 },
      gravityY: 60,
      rotate: { start: 0, end: 540 },
      scale: { min: 0.5, max: 1 },
      tint: [0xff5a50, 0xffc83d, 0x5fd068, 0x4fb3ff, 0xff8fd0],
      quantity: 3,
      frequency: 25,
    });
    pluie.setDepth(1);                     // au-dessus du voile, derrière la carte
    this.time.delayedCall(1400, () => pluie.stop());
  }
}
