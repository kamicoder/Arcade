// Le platformer, tel que le Hub le voit : ses scènes, et celle qui démarre.
// L'ordre compte : une scène plus bas dans la liste s'affiche par-dessus celles d'avant
// (le tableau de bord par-dessus le niveau, la fin par-dessus le tableau de bord).

import type { ModuleDeJeu } from "../catalogue";
import { Chargement } from "./scenes/Chargement";
import { Menu } from "./scenes/Menu";
import { Niveau } from "./scenes/Niveau";
import { Duo } from "./scenes/Duo";
import { Editeur } from "./scenes/Editeur";
import { Tableau } from "./scenes/Tableau";
import { Fin } from "./scenes/Fin";

const jeu: ModuleDeJeu = {
  premiere: "platformer-chargement",
  scenes: {
    "platformer-chargement": Chargement,
    "platformer-menu": Menu,
    "platformer-niveau": Niveau,
    "platformer-duo": Duo,
    "platformer-editeur": Editeur,
    "platformer-tableau": Tableau,
    "platformer-fin": Fin,
  },
};

export default jeu;
