// Les fenêtres de l'éditeur : celle des niveaux (les ouvrir, les ranger, les renommer) et celle d'un
// genre de plateforme (solide ou non, son effet, sa couleur).

import type Phaser from "phaser";
import { Fenetre, Question, Saisie, GRIS, ALERTE } from "./interface";
import { EFFETS, EXPLICATIONS, type Effet, type Fiche, type Genres } from "../genres";
import { estRetouche } from "../niveaux";

// Ce que les fenêtres demandent à l'éditeur
export interface PourLesFenetres {
  noms: string[];
  nom: string;
  genres: Genres;
  ouvrir(nom: string): boolean;
  renommerUnNiveau(ancien: string, nouveau: string): void;
  supprimerUnNiveau(nom: string): void;
  deplacerUnNiveau(numero: number, sens: number): void;
  remettreLesNiveauxDeDepart(): void;
  changerLeGenre(nom: string, changement: Partial<Fiche>): void;
  supprimerLeGenre(nom: string): void;
  ouvrirUneFenetre(fenetre: Fenetre): void;
}

const PAR_PAGE = 7;

export class FenetreDesNiveaux extends Fenetre {
  private page = 0;
  private lignes: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, private ed: PourLesFenetres) {
    super(scene, "Les niveaux de l'Aventure, dans l'ordre", 620, 420);
    this.bouton(20, 372, 230, 34, "Remettre les niveaux de départ", () => {
      this.ed.ouvrirUneFenetre(new Question(scene, "Les niveaux de départ",
        "Ceux qui manquent reviennent à la fin, et ceux que tu as retouchés redeviennent comme au départ.",
        () => {
          this.ed.remettreLesNiveauxDeDepart();
          this.construire();
        }, "Remettre"));
    });
    this.bouton(500, 372, 100, 34, "Fermer", () => this.fermer());
    this.construire();
  }

  // Une ligne par niveau : son nom (le toucher l'ouvre), monter, descendre, renommer, supprimer
  private construire() {
    this.lignes.forEach((objet) => objet.destroy());
    this.lignes = [];
    const noms = this.ed.noms;
    const pages = Math.max(1, Math.ceil(noms.length / PAR_PAGE));
    this.page = Math.min(this.page, pages - 1);
    const debut = this.page * PAR_PAGE;
    noms.slice(debut, debut + PAR_PAGE).forEach((nom, k) => {
      const i = debut + k;
      const y = 50 + k * 44;
      const retouche = estRetouche(nom) ? "  (retouché)" : "";
      const ouvrir = this.bouton(20, y, 290, 36, `${i + 1}. ${nom}${retouche}`, () => {
        if (this.ed.ouvrir(nom)) {
          this.fermer();
        }
      });
      if (nom === this.ed.nom) {
        ouvrir.setChoisi(true);
      }
      this.lignes.push(
        ouvrir,
        this.bouton(318, y, 36, 36, "↑", () => this.deplacer(i, -1)).setActif(i > 0),
        this.bouton(358, y, 36, 36, "↓", () => this.deplacer(i, 1)).setActif(i < noms.length - 1),
        this.bouton(402, y, 100, 36, "Renommer", () => this.renommer(nom)),
        this.bouton(508, y, 92, 36, "Supprimer", () => this.supprimer(nom)).setActif(noms.length > 1),
      );
    });
    if (pages > 1) {
      this.lignes.push(
        this.bouton(270, 372, 40, 34, "<", () => this.tourner(-1)).setActif(this.page > 0),
        this.ecrire(318, 380, `${this.page + 1} / ${pages}`, GRIS),
        this.bouton(380, 372, 40, 34, ">", () => this.tourner(1)).setActif(this.page < pages - 1),
      );
    }
  }

  private tourner(sens: number) {
    this.page += sens;
    this.construire();
  }

  private deplacer(numero: number, sens: number) {
    this.ed.deplacerUnNiveau(numero, sens);
    this.page = Math.floor((numero + sens) / PAR_PAGE);
    this.construire();
  }

  private renommer(nom: string) {
    const valider = (nouveau: string) => {
      this.ed.renommerUnNiveau(nom, nouveau);
      if (this.active) {
        this.construire();
      }
    };
    if (!Saisie.auDoigt("Le nouveau nom de « " + nom + " »", nom, valider)) {
      this.ed.ouvrirUneFenetre(new Saisie(this.scene, "Le nouveau nom de « " + nom + " »", nom, valider));
    }
  }

  private supprimer(nom: string) {
    this.ed.ouvrirUneFenetre(new Question(this.scene, "Supprimer « " + nom + " » ?",
      "Il disparaît de l'Aventure. Un niveau de départ peut revenir avec « Remettre les niveaux de départ ».",
      () => {
        this.ed.supprimerUnNiveau(nom);
        this.construire();
      }, "Supprimer"));
  }
}

export class FenetreDuGenre extends Fenetre {
  private objets: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, private ed: PourLesFenetres, private nom: string) {
    super(scene, "Le genre « " + nom + " »", 520, 330);
    this.bouton(400, 282, 100, 34, "Fermer", () => this.fermer());
    if (nom !== "normale") {
      this.bouton(20, 282, 170, 34, "Supprimer ce genre", () => {
        this.ed.ouvrirUneFenetre(new Question(scene, "Supprimer « " + nom + " » ?",
          "Ses plateformes redeviennent normales, dans tous les niveaux.", () => {
            this.ed.supprimerLeGenre(nom);
            this.fermer();
          }, "Supprimer"));
      });
    }
    this.construire();
  }

  private construire() {
    this.objets.forEach((objet) => objet.destroy());
    this.objets = [];
    const fiche = this.ed.genres.fiche(this.nom);
    const normale = this.nom === "normale";
    const couleur = this.scene.add.rectangle(this.cadre.x + 20, this.cadre.y + 52, 34, 34,
      (fiche.couleur[0] << 16) | (fiche.couleur[1] << 8) | fiche.couleur[2]).setOrigin(0).setStrokeStyle(2, 0xffffff);
    this.add(couleur);
    this.objets.push(
      couleur,
      this.bouton(62, 52, 130, 34, "Autre couleur", () => this.changer({
        couleur: [0, 0, 0].map(() => 60 + Math.floor(Math.random() * 180)) as Fiche["couleur"],
      })),
      this.bouton(204, 52, 140, 34, "Solide : " + (fiche.solide ? "oui" : "non"), () => this.changer({ solide: !fiche.solide }))
        .setActif(!normale),
      this.ecrire(20, 100, "Son effet :", GRIS),
    );
    (Object.keys(EFFETS) as Effet[]).forEach((effet, i) => {
      const bouton = this.bouton(20 + (i % 4) * 122, 124 + Math.floor(i / 4) * 42, 116, 34, EFFETS[effet], () => this.changer({ effet }))
        .setChoisi(fiche.effet === effet).setActif(!normale);
      this.objets.push(bouton);
    });
    const phrase = normale
      ? "La normale reste solide et sans effet : c'est elle que jouent l'Infini et le duo. Sa couleur peut changer."
      : EXPLICATIONS[fiche.effet] + (fiche.solide ? " On marche dessus." : " On passe à travers.");
    this.objets.push(this.ecrire(20, 218, phrase, normale ? ALERTE : "#e6e6f0", 14));
  }

  private changer(changement: Partial<Fiche>) {
    this.ed.changerLeGenre(this.nom, changement);
    this.construire();
  }
}
