// Le jeu de course, tel que le Hub le voit : ses scènes, celle qui démarre, et le thème de départ.
// L'ordre compte : une scène plus bas dans la liste s'affiche par-dessus celles d'avant
// (le tableau de bord sur la course, l'arrivée et la pause sur les deux).
//
// Un seul jeu, plusieurs thèmes. Le catalogue a aujourd'hui une carte par thème :
//   courseAuTheme("voitures"), courseAuTheme("licornes").
// Pour n'avoir qu'une seule carte, qui choisit son thème dans le menu (touche T) :
//   courseAuTheme()   (elle reprend le thème de la dernière fois)

import type { ModuleDeJeu } from "../catalogue";
import { Chargement, Musique, type DonneesDeDepart } from "./scenes/Chargement";
import { Menu } from "./scenes/Menu";
import { Circuits } from "./scenes/Circuits";
import { Atelier } from "./scenes/Atelier";
import { Editeur } from "./scenes/Editeur";
import { Classement, Podium } from "./scenes/GrandPrix";
import { Piste } from "./scenes/Piste";
import { Tableau } from "./scenes/Tableau";
import { Arrivee } from "./scenes/Arrivee";
import { Pause } from "./scenes/Pause";

const scenes = {
  "course-chargement": Chargement,
  "course-musique": Musique,
  "course-menu": Menu,
  "course-circuits": Circuits,
  "course-atelier": Atelier,
  "course-editeur": Editeur,
  "course-grand-prix": Classement,
  "course-podium": Podium,
  "course-piste": Piste,
  "course-tableau": Tableau,
  "course-arrivee": Arrivee,
  "course-pause": Pause,
};

export function courseAuTheme(theme?: string): ModuleDeJeu {
  const donnees: DonneesDeDepart = theme ? { theme } : { choixDuTheme: true };
  return { scenes, premiere: "course-chargement", donnees };
}
