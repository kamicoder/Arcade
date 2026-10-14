// Le chargement de la course : le thème choisi, ce qu'il charge (sons, police) et ses images fabriquées.
// C'est la première scène du jeu : le Hub la démarre avec le thème de sa carte, elle passe la main au menu.
// Le menu la relance pour changer de thème (quand l'Arcade n'a qu'une carte de course : voir index.ts).

import Phaser from "phaser";
import { themeParId } from "../themes";
import { choisirLeTheme, themeEnCours } from "../sauvegarde";
import { brancherLeSon, musicien } from "../son";
import { enNombre } from "../interface";
import { lire, ecrire } from "../../../socle/sauvegarde";
import { barreDeChargement } from "../../../socle/chargement";

export interface DonneesDeDepart {
  theme?: string;                          // sans thème : celui de la dernière fois
  choixDuTheme?: boolean;                  // vrai : le menu propose de changer de thème
}

export let avecChoixDuTheme = false;

export class Chargement extends Phaser.Scene {
  constructor() {
    super("course-chargement");
  }

  init(donnees: DonneesDeDepart) {
    avecChoixDuTheme = donnees.choixDuTheme ?? false;
    const theme = themeParId(donnees.theme ?? lire<string>("course/theme") ?? "");
    ecrire("course/theme", theme.id);
    choisirLeTheme(theme);
  }

  // preload : Phaser charge tout ce qu'on lui demande ici, et n'appelle create() qu'une fois tout arrivé
  preload() {
    const theme = themeEnCours();
    barreDeChargement(this, enNombre(theme.habillage.couleurs.accent));
    theme.charger?.(this);
  }

  create() {
    const theme = themeEnCours();
    // Le grain des étincelles est celui du Hub (« etincelle ») ; le reste, c'est le thème qui le dessine
    theme.fabriquerTextures(this);
    brancherLeSon(this);
    // La musique passe d'une scène à l'autre : elle a sa propre scène, qui tourne à côté des autres
    this.scene.stop("course-musique");
    if (theme.musique) {
      this.scene.launch("course-musique");
    }
    this.scene.start("course-menu");
  }
}

// Le musicien : une scène sans rien à montrer, dont la minuterie prépare les notes à venir.
// retourAuHub l'arrête avec les autres scènes du jeu : la musique s'arrête avec elle.
export class Musique extends Phaser.Scene {
  constructor() {
    super("course-musique");
  }

  create() {
    this.time.addEvent({ delay: 30, loop: true, callback: () => musicien.preparer() });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      musicien.air = null;
    });
  }
}
