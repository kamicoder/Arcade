// La pause : la partie s'arrête net, un voile, « Reprendre » et « Le menu ». Le tir, le platformer et le
// démineur (la course a la sienne, avec ses réglages).
//
// Phaser sait arrêter une scène sans la défaire (scene.pause) : elle ne bouge plus, sa physique, ses
// minuteries et ses tweens attendent, et elle n'entend plus ni le clavier, ni la manette, ni le doigt. On
// lance par-dessus une scène à nous, qui, elle, écoute. Ce que Phaser ne fait pas tout seul, et qu'on fait ici :
//  - le jeu qui perd la main (un autre onglet, une autre appli, un appel) se met en pause de lui-même ;
//  - les sons continueraient : on les met en pause aussi ;
//  - une touche ou un doigt lâché pendant la pause n'a pas été entendu par la partie : à la reprise, on lâche
//    le clavier de Phaser (TouchesPhysiques se lâche toute seule), et chaque jeu lâche ses boutons au doigt
//    (apresReprise) ;
//  - chaque scène lit la manette avec sa propre copie : la partie réveillée, qui n'a pas vu passer le Start
//    qui a fermé la pause, le prendrait pour un nouvel appui et la rouvrirait. Et la pause, qui vient
//    d'arriver, prendrait le Start encore tenu qui l'a ouverte pour « Reprendre ». Chacune attend un instant.
//
// La partie appelle mettreEnPause une fois, dans son create ; elle garde la fonction rendue pour son
// bouton ⏸ (boutonPause, dans son tableau de bord : la caméra de la partie peut bouger, celle du tableau non).

import Phaser from "phaser";
import { POLICE } from "./style";
import { surTouche } from "./clavier";
import { surManette, MANETTE } from "./manette";
import { uneSeuleFois } from "./fin";
import { ListeDeBoutons, type Choix } from "./listeDeBoutons";
import { boutonDuSon } from "./son";
import { estTactile } from "./tactile";

const CLE = "socle-pause";

export interface ReglagesDePause {
  quitter: () => void;                     // le dernier bouton : la partie s'en va (avec son fondu)
  ailleurs?: string;                       // son nom : « Le menu », « L'éditeur »...
  autres?: string[];                       // les scènes arrêtées avec la partie (le tableau de bord)
  // La pause a-t-elle un sens maintenant ? Pas quand la fin est affichée (elle a ses boutons), ni quand on
  // s'en va déjà
  possible?: () => boolean;
  apresReprise?: () => void;               // lâcher ce qui était tenu au doigt, remettre ce que la pause a changé
  plus?: { nom: string; action: () => void }[];   // d'autres choix, entre Reprendre et quitter (« Nouvelle grille »)
  son?: string;                            // la clé du son du jeu (socle/son.ts) : le bouton du son, et M
  couleur?: number;                        // le fond du bouton choisi
}

// Le moment où la dernière pause s'est fermée : le bouton qui l'a fermée ne la rouvre pas
let fermeeA = -Infinity;
const ATTENTE = 250;                       // ms : le temps de lâcher le bouton qui ouvre ou ferme la pause

// Installe la pause sur la partie : Échap, P, Start ou Select l'ouvrent, et le jeu qui perd la main.
// Rend la fonction qui l'ouvre (pour le bouton ⏸).
export function mettreEnPause(scene: Phaser.Scene, reglages: ReglagesDePause): () => void {
  const jeu = scene.game;
  const ouvrir = () => {
    if (!scene.sys.isActive() || jeu.loop.time - fermeeA < ATTENTE || reglages.possible?.() === false) {
      return;
    }
    const scenes = [scene.scene.key, ...(reglages.autres ?? []).filter((cle) => scene.scene.isActive(cle))];
    for (const cle of scenes) {
      scene.scene.pause(cle);
    }
    scene.sound.pauseAll();
    // La scène de la pause rejoint le jeu la première fois, comme les scènes d'un jeu (Hub.ts). Les jeux
    // chargés ensuite ajoutent leurs scènes au-dessus d'elle : on la remonte à chaque fois.
    if (!scene.scene.manager.keys[CLE]) {
      scene.scene.add(CLE, Pause);
    }
    scene.scene.launch(CLE, { scenes, reglages });
    scene.scene.bringToTop(CLE);
  };

  surTouche(scene, "ESC", ouvrir);
  surTouche(scene, "P", ouvrir);
  surManette(scene, [MANETTE.START, MANETTE.SELECT], ouvrir);
  // Le jeu Phaser n'appartient pas à la scène : ces écouteurs-là, on les retire nous-mêmes
  jeu.events.on(Phaser.Core.Events.BLUR, ouvrir);
  jeu.events.on(Phaser.Core.Events.HIDDEN, ouvrir);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    jeu.events.off(Phaser.Core.Events.BLUR, ouvrir);
    jeu.events.off(Phaser.Core.Events.HIDDEN, ouvrir);
  });
  return ouvrir;
}

interface DonneesDePause {
  scenes: string[];
  reglages: ReglagesDePause;
}

class Pause extends Phaser.Scene {
  pret = false;                            // elle écoute (les tests l'attendent)

  constructor() {
    super(CLE);
  }

  create({ scenes, reglages }: DonneesDePause) {
    const largeur = this.scale.width;
    const hauteur = this.scale.height;
    // Le tir cache la flèche de la souris pendant la partie : elle revient pour choisir
    this.input.setDefaultCursor("default");
    this.add.rectangle(0, 0, largeur, hauteur, 0x000000, 0.6).setOrigin(0);
    this.add.text(largeur / 2, hauteur / 2 - 140, "Pause", {
      fontFamily: POLICE, fontSize: "56px", fontStyle: "bold", color: "#ffffff", stroke: "#14121c", strokeThickness: 8,
    }).setOrigin(0.5);

    // Réveiller la partie, puis faire ce qu'on a choisi. Une seule fois : Échap et un clic presque ensemble
    const une = uneSeuleFois();
    const reveiller = () => {
      fermeeA = this.game.loop.time;
      this.scene.stop();
      for (const cle of scenes) {
        this.scene.get(cle).input.keyboard?.resetKeys();
        this.scene.resume(cle);
      }
      this.sound.resumeAll();
      reglages.apresReprise?.();
    };
    const reprendre = une(reveiller);
    const puis = (action: () => void) => une(() => {
      reveiller();
      action();
    });

    if (reglages.son) {
      boutonDuSon(this, reglages.son);
    }

    // Les boutons, un instant plus tard : cette scène lit la manette avec sa propre copie, toute neuve, et
    // prendrait le Start qui a ouvert la pause, encore tenu, pour un nouvel appui (« Reprendre » aussitôt)
    this.pret = false;
    this.time.delayedCall(ATTENTE, () => {
      const choix: Choix[] = [
        { nom: "Reprendre", action: reprendre },
        ...(reglages.plus ?? []).map((autre) => ({ nom: autre.nom, action: puis(autre.action) })),
        { nom: reglages.ailleurs ?? "Le menu", action: puis(reglages.quitter) },
      ];
      const ecart = estTactile() ? 84 : 70;
      new ListeDeBoutons(this, choix, {
        x: largeur / 2, y: hauteur / 2 - 40, largeur: 300, hauteur: estTactile() ? 68 : 56, ecart,
      }, { couleur: reglages.couleur });
      if (!estTactile()) {
        this.add.text(largeur / 2, hauteur / 2 - 40 + choix.length * ecart, "Échap ou P : reprendre", {
          fontFamily: POLICE, fontSize: "16px", color: "#a49cb4",
        }).setOrigin(0.5);
      }
      surTouche(this, "ESC", reprendre);
      surTouche(this, "P", reprendre);
      surManette(this, MANETTE.B, reprendre);
      this.pret = true;
    });
  }
}

// Le bouton ⏸, rond, pour le doigt et la souris : au doigt, assez grand pour un pouce (voir boutonArcade).
// x, y : son centre.
export function boutonPause(
  scene: Phaser.Scene, x: number, y: number, action: () => void, taille = estTactile() ? 64 : 34,
): Phaser.GameObjects.Container {
  const fond = scene.add.circle(0, 0, taille / 2, 0x000000, 0.35).setStrokeStyle(2, 0xffffff, 0.5);
  // Deux barres : le signe de la pause partout pareil (un emoji change d'un téléphone à l'autre)
  const barre = (dx: number) => scene.add.rectangle(dx * taille, 0, taille * 0.12, taille * 0.4, 0xffffff);
  const bouton = scene.add.container(x, y, [fond, barre(-0.1), barre(0.1)]).setDepth(1000);
  // La zone se compte depuis le coin haut gauche du rond ; elle déborde un peu, pour le pouce
  fond.setInteractive({
    hitArea: new Phaser.Geom.Circle(taille / 2, taille / 2, taille * 0.65),
    hitAreaCallback: Phaser.Geom.Circle.Contains,
    useHandCursor: true,
  });
  fond.on("pointerdown", () => scene.tweens.add({ targets: bouton, scale: 0.9, duration: 80 }));
  fond.on("pointerout", () => bouton.setScale(1));
  fond.on("pointerup", () => {
    bouton.setScale(1);
    action();
  });
  return bouton;
}
