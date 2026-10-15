// Le menu du platformer : l'Aventure, l'Infini, les 2 joueurs et l'éditeur de niveaux.
// Au clavier (↑ ↓ Entrée), à la manette (croix + A), à la souris ou au doigt (socle/listeDeBoutons.ts).

import Phaser from "phaser";
import { chargerTous, liste } from "../niveaux";
import { lancerLaMusique, quitterLePlatformer } from "../son";
import { lireLeRecord, type DonneesDeNiveau } from "./Niveau";
import { lettresDuJoueur1 } from "../commandes";
import { texturePour, ECHELLE_TUILE } from "../textures";
import { Genres } from "../genres";
import { FOND, VERT, VIES, SAUVEGARDE, OBJECTIF_DUO } from "../reglages";
import { LARGEUR, HAUTEUR, POLICE } from "../../../socle/style";
import { surTouche } from "../../../socle/clavier";
import { surManette, MANETTE } from "../../../socle/manette";
import { ListeDeBoutons } from "../../../socle/listeDeBoutons";
import { estTactile } from "../../../socle/tactile";
import { retourAuHub, fonduPuis } from "../../../socle/retour";
import { boutonArcade } from "../../../socle/boutonArcade";
import { boutonDuSon } from "../../../socle/son";

type Mode = "aventure" | "infini" | "duo" | "editeur";

export class Menu extends Phaser.Scene {
  choisi = 0;                              // gardé d'une visite à l'autre
  private liste!: ListeDeBoutons;
  private parti = false;
  private alerte!: Phaser.GameObjects.Text;

  constructor() {
    super("platformer-menu");
  }

  create() {
    this.parti = false;
    this.cameras.main.setBackgroundColor(FOND).fadeIn(250);
    lancerLaMusique(this);

    this.creerDecor();
    this.add.text(LARGEUR / 2, 70, "Super Platformer", {
      fontFamily: POLICE, fontSize: "50px", fontStyle: "bold", color: VERT, stroke: "#14121c", strokeThickness: 8,
    }).setOrigin(0.5);

    boutonArcade(this, () => this.quitter());

    const record = lireLeRecord();
    const auDoigt = estTactile();
    this.liste = new ListeDeBoutons(this, [
      { nom: `Aventure (${liste().length} niveaux)`, aide: aideDeLAventure(), action: () => this.lancer("aventure") },
      { nom: "Infini", aide: record > 0 ? `Record : ${record} m` : "Jusqu'où iras-tu ?", action: () => this.lancer("infini") },
      {
        nom: "2 joueurs", aide: auDoigt ? "Au clavier ou à deux manettes" : `${lettresDuJoueur1()} contre les flèches : le premier à ${OBJECTIF_DUO} points`,
        action: () => this.lancer("duo"), possible: !auDoigt,
      },
      { nom: "Éditeur de niveaux", aide: "Dessine tes niveaux, joue-les tout de suite", action: () => this.lancer("editeur") },
    ], { x: LARGEUR / 2, y: 150, largeur: 440, hauteur: 58, ecart: 68 }, {
      couleur: 0x5fd068, depart: this.choisi, quandChoisi: (i) => (this.choisi = i),
    });

    this.alerte = this.add.text(LARGEUR / 2, 432, "", { fontFamily: POLICE, fontSize: "18px", color: "#f07878" }).setOrigin(0.5);
    const aide = auDoigt ? "Touche un mode pour jouer !" : "↑ ↓ : choisir    Entrée : jouer    M : le son    Échap : l'Arcade";
    this.add.text(LARGEUR / 2, 515, aide, { fontFamily: POLICE, fontSize: "16px", color: "#e9e4f0" }).setOrigin(0.5);

    boutonDuSon(this, SAUVEGARDE);

    surTouche(this, "ESC", () => this.quitter());
    surManette(this, MANETTE.B, () => this.quitter());
  }

  // Les boutons de la liste (les tests y lisent ce qui est possible, et les aides)
  get boutons() {
    return this.liste.boutons;
  }

  // Un sol de tuiles, des pièces qui flottent, et le héros qui se promène : le jeu donne envie
  private creerDecor() {
    const genres = new Genres();
    this.add.tileSprite(0, HAUTEUR - 70, LARGEUR, 70, texturePour(this, "normale", genres.fiche("normale")))
      .setOrigin(0).setTileScale(ECHELLE_TUILE * 1.5);
    const heros = this.add.sprite(120, HAUTEUR - 70, "platformer-heros").setOrigin(0.5, 1).setScale(1.5).play("platformer-heros-marche");
    // Un tween qui l'emmène d'un bord à l'autre et le ramène ; il se retourne à chaque bout
    this.tweens.add({
      targets: heros, x: LARGEUR - 120, duration: 6000, yoyo: true, repeat: -1, ease: "Sine.InOut",
      onYoyo: () => heros.setFlipX(true), onRepeat: () => heros.setFlipX(false),
    });
    for (let k = 0; k < 5; k++) {
      const piece = this.add.image(140 + k * 170, HAUTEUR - 130, "platformer-piece").setScale(0.75);
      this.tweens.add({ targets: piece, y: piece.y - 10, duration: 700, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: k * 140 });
    }
  }

  // Renvoie false quand on reste au menu (aucun niveau jouable) : on peut choisir de nouveau
  private lancer(mode: Mode): boolean {
    if (this.parti) {
      return false;
    }
    let scene = "platformer-niveau";
    let donnees: DonneesDeNiveau | undefined;
    if (mode === "aventure") {
      const niveaux = chargerTous();         // relus à chaque partie : l'éditeur a pu les changer
      if (niveaux.length === 0) {
        this.alerte.setText("Aucun niveau jouable : ouvre l'éditeur");
        return false;
      }
      donnees = { mode: "aventure", niveaux, numero: 0, score: 0, vies: VIES, pieces: 0 };
    } else if (mode === "infini") {
      donnees = { mode: "infini", niveaux: [], numero: 0, score: 0, vies: 1, pieces: 0 };
    } else if (mode === "duo") {
      scene = "platformer-duo";
    } else {
      scene = "platformer-editeur";
    }
    this.parti = true;
    fonduPuis(this, () => this.scene.start(scene, donnees));
    return true;
  }

  private quitter() {
    if (this.parti) {
      return;
    }
    this.parti = true;
    quitterLePlatformer(this);
    retourAuHub(this);
  }
}

// L'aide de l'Aventure : ses vies, et le boss seulement s'il attend au dernier niveau (l'éditeur a pu
// changer les niveaux, leur ordre, ou retirer le boss)
function aideDeLAventure(): string {
  const dernier = chargerTous().at(-1);
  return dernier?.elements.some((e) => e.sorte === "boss") ? `${VIES} vies, un boss au bout` : `${VIES} vies`;
}
