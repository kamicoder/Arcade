// Le menu de la course : le circuit à gauche (◀ ▶ pour en changer), les modes de jeu à droite.

import Phaser from "phaser";
import { LARGEUR_ROUTE, preparerCircuit, chrono } from "../circuits";
import { lireLeRecord, type DonneesDeCourse, type Mode } from "./Course";
import { textureDeVoiture } from "../textures";
import { NIVEAU_COURSE, ORANGE } from "../reglages";
import { nouveauGrandPrix, circuitDeLaCourse, niveauDeLaCourse } from "../grandPrix";
import { tousLesCircuits, POINTS_MAX } from "../monCircuit";
import { LARGEUR, POLICE } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { estTactile } from "../../../socle/tactile";
import { retourAuHub, fonduPuis } from "../../../socle/retour";

type Choix = Mode | "editeur";

const MODES: { id: Choix; nom: string; aide: string; aideAuDoigt?: string }[] = [
  { id: "chrono", nom: "Contre la montre", aide: "Seul, contre le chrono et ton fantôme" },
  { id: "course", nom: "Contre l'ordinateur", aide: "Trois rivaux, trois tours" },
  { id: "duo", nom: "À deux", aide: "Sur le même clavier" },
  { id: "grandprix", nom: "Le Grand Prix", aide: "Tous les circuits, l'un après l'autre" },
  {
    id: "editeur", nom: "Dessiner ton circuit", aide: "À la souris, " + POINTS_MAX + " points au plus",
    aideAuDoigt: "Du bout du doigt, " + POINTS_MAX + " points au plus",
  },
];

// Les modes qu'on peut choisir : au doigt, pas de course à deux (il faudrait un clavier)
function modesDuMenu() {
  return estTactile() ? MODES.filter((mode) => mode.id !== "duo") : MODES;
}

const CARTE = { x: 40, y: 90, largeur: 420, hauteur: 380 };
// Au doigt, les boutons sont moins nombreux : on les fait plus grands
const BOUTON = { x: 500, y: 90, largeur: 420, hauteur: 66, ecart: 79 };
const BOUTON_AU_DOIGT = { ...BOUTON, hauteur: 84, ecart: 98 };

// Ce qu'on peut passer au menu : le circuit à montrer (celui qu'on vient de dessiner)
export interface DonneesDuMenu {
  circuit?: string;
}

interface Bouton {
  fond: Phaser.GameObjects.Rectangle;
  nom: Phaser.GameObjects.Text;
  aide: Phaser.GameObjects.Text;
}

export class Menu extends Phaser.Scene {
  // Gardés d'une visite à l'autre : on retrouve le menu comme on l'a laissé
  private numeroCircuit = 0;
  private choix = 0;

  private apercu!: Phaser.GameObjects.Graphics;
  private nomCircuit!: Phaser.GameObjects.Text;
  private recordCircuit!: Phaser.GameObjects.Text;
  private boutons: Bouton[] = [];
  private parti = false;

  private modes = MODES;

  constructor() {
    super("voiture-menu");
  }

  init(donnees: DonneesDuMenu) {
    if (donnees.circuit) {
      this.numeroCircuit = Math.max(0, tousLesCircuits().findIndex((modele) => modele.id === donnees.circuit));
    }
  }

  create() {
    this.modes = modesDuMenu();
    this.boutons = [];
    this.parti = false;
    this.cameras.main.setBackgroundColor("#1c1a25").fadeIn(250);

    this.add.image(LARGEUR / 2 - 250, 48, textureDeVoiture(this, ORANGE)).setScale(1.4);
    this.add.text(LARGEUR / 2 + 20, 48, "Course de voitures", {
      fontFamily: POLICE, fontSize: "38px", fontStyle: "bold", color: "#ff7a1a",
    }).setOrigin(0.5);

    const retour = this.add.text(20, 20, "← Arcade", { fontFamily: POLICE, fontSize: "18px", color: "#a49cb4" })
      .setInteractive({ useHandCursor: true });
    retour.on("pointerup", () => retourAuHub(this));

    this.creerCarte();
    this.creerBoutons();

    if (estTactile()) {
      this.add.text(LARGEUR / 2, 510, "Touche un mode pour jouer !", {
        fontFamily: POLICE, fontSize: "16px", color: "#e9e4f0",
      }).setOrigin(0.5);
    } else {
      this.add.text(LARGEUR / 2, 500,
        "↑ ↓ : choisir    ◀ ▶ : changer de circuit    Entrée : c'est parti !    Échap : l'Arcade", {
          fontFamily: POLICE, fontSize: "16px", color: "#e9e4f0",
        }).setOrigin(0.5);
      this.add.text(LARGEUR / 2, 526,
        "Seul : les flèches, et Espace pour la nitro.   À deux : Z Q S D et Espace, contre les flèches et Maj droite", {
          fontFamily: POLICE, fontSize: "13px", color: "#a49cb4",
        }).setOrigin(0.5);
    }

    surTouche(this, "UP", () => this.choisir(this.choix - 1));
    surTouche(this, "DOWN", () => this.choisir(this.choix + 1));
    surTouche(this, "LEFT", () => this.changerDeCircuit(-1));
    surTouche(this, "RIGHT", () => this.changerDeCircuit(1));
    surTouche(this, "ENTER", () => this.lancer());
    surTouche(this, "ESC", () => retourAuHub(this));
    this.input.gamepad?.on("down", (_m: Phaser.Input.Gamepad.Gamepad, bouton: Phaser.Input.Gamepad.Button) => {
      switch (bouton.index) {
        case 12: this.choisir(this.choix - 1); break;
        case 13: this.choisir(this.choix + 1); break;
        case 14: this.changerDeCircuit(-1); break;
        case 15: this.changerDeCircuit(1); break;
        case 0: this.lancer(); break;
        case 1: retourAuHub(this); break;
      }
    });

    this.changerDeCircuit(0);
    this.choisir(this.choix);
  }

  private creerCarte() {
    const { x, y, largeur, hauteur } = CARTE;
    this.add.rectangle(x, y, largeur, hauteur, 0x2a2735).setOrigin(0).setRounded(16);
    this.add.text(x + largeur / 2, y + 26, "Le circuit", { fontFamily: POLICE, fontSize: "16px", color: "#a49cb4" })
      .setOrigin(0.5);
    this.apercu = this.add.graphics();
    this.recordCircuit = this.add.text(x + largeur / 2, y + 300, "", {
      fontFamily: POLICE, fontSize: "16px", fontStyle: "bold", color: "#ffd479",
    }).setOrigin(0.5);
    this.nomCircuit = this.add.text(x + largeur / 2, y + 340, "", {
      fontFamily: POLICE, fontSize: "24px", fontStyle: "bold", color: "#ffffff",
    }).setOrigin(0.5);

    const fleche = (fx: number, texte: string, sens: number) => {
      const objet = this.add.text(fx, y + 340, texte, { fontFamily: POLICE, fontSize: "30px", color: "#ff7a1a" })
        .setOrigin(0.5).setPadding(16).setInteractive({ useHandCursor: true });
      objet.on("pointerup", () => this.changerDeCircuit(sens));
    };
    fleche(x + 40, "◀", -1);
    fleche(x + largeur - 40, "▶", 1);
  }

  private creerBoutons() {
    const auDoigt = estTactile();
    const b = auDoigt ? BOUTON_AU_DOIGT : BOUTON;
    this.modes.forEach((mode, i) => {
      const y = b.y + i * b.ecart;
      const cx = b.x + b.largeur / 2;
      const fond = this.add.rectangle(b.x, y, b.largeur, b.hauteur, 0x2a2735)
        .setOrigin(0).setRounded(12).setInteractive({ useHandCursor: true });
      const nom = this.add.text(cx, y + b.hauteur / 2 - 10, mode.nom, { fontFamily: POLICE, fontSize: "22px", fontStyle: "bold" })
        .setOrigin(0.5);
      const texteAide = auDoigt && mode.aideAuDoigt ? mode.aideAuDoigt : mode.aide;
      const aide = this.add.text(cx, y + b.hauteur / 2 + 16, texteAide, { fontFamily: POLICE, fontSize: "14px" }).setOrigin(0.5);
      fond.on("pointerover", () => this.choisir(i));
      fond.on("pointerup", () => {
        this.choisir(i);
        this.lancer();
      });
      this.boutons.push({ fond, nom, aide });
    });
  }

  private choisir(i: number) {
    this.choix = Phaser.Math.Wrap(i, 0, this.modes.length);   // après le dernier, on revient au premier
    this.boutons.forEach((bouton, j) => {
      const elu = j === this.choix;
      bouton.fond.setFillStyle(elu ? ORANGE : 0x2a2735);
      bouton.nom.setColor(elu ? "#1c1a25" : "#ffffff");
      bouton.aide.setColor(elu ? "#1c1a25" : "#a49cb4");
    });
  }

  // sens : -1 pour le circuit d'avant, 1 pour le suivant, 0 pour montrer celui-ci
  private changerDeCircuit(sens: number) {
    // Les circuits sont relus à chaque fois : le tien vient peut-être d'être dessiné
    const circuits = tousLesCircuits();
    this.numeroCircuit = Phaser.Math.Wrap(this.numeroCircuit + sens, 0, circuits.length);
    const modele = circuits[this.numeroCircuit];
    const circuit = preparerCircuit(modele);

    // Le dessin du circuit en petit : un Graphics qu'on vide et qu'on redessine. On dessine
    // à la taille réelle, et c'est l'objet entier qu'on rapetisse (setScale) pour qu'il tienne.
    const echelle = Math.min(360 / modele.largeur, 220 / modele.hauteur);
    const g = this.apercu.clear();
    g.lineStyle(LARGEUR_ROUTE, 0x55535c).strokePoints(circuit.trace.map((p) => new Phaser.Math.Vector2(p.x, p.y)), true, true);
    const ligne = circuit.trace[0];
    g.fillStyle(0xffffff).fillCircle(ligne.x, ligne.y, 50);   // la ligne d'arrivée
    g.setScale(echelle).setPosition(
      CARTE.x + CARTE.largeur / 2 - modele.largeur * echelle / 2,
      CARTE.y + 165 - modele.hauteur * echelle / 2,
    );

    this.nomCircuit.setText(modele.nom);
    const record = lireLeRecord(modele);
    this.recordCircuit.setText(record ? "Record : " + chrono(record.temps) : "");

    if (sens !== 0) {
      g.setAlpha(0);
      this.tweens.add({ targets: g, alpha: 1, duration: 200 });
    }
  }

  private lancer() {
    if (this.parti) {
      return;
    }
    this.parti = true;
    const mode = this.modes[this.choix].id;
    if (mode === "editeur") {
      fonduPuis(this, () => this.scene.start("voiture-editeur"));
      return;
    }
    let donnees: DonneesDeCourse;
    if (mode === "grandprix") {
      // Le Grand Prix ne regarde pas le circuit choisi : il les fait tous, dans l'ordre
      const grandPrix = nouveauGrandPrix();
      donnees = { modele: circuitDeLaCourse(grandPrix), mode, niveau: niveauDeLaCourse(grandPrix), grandPrix };
    } else {
      donnees = {
        modele: tousLesCircuits()[this.numeroCircuit],
        mode,
        niveau: mode === "course" ? NIVEAU_COURSE : 1,
      };
    }
    fonduPuis(this, () => this.scene.start("voiture-course", donnees));
  }
}
