// Le casse-briques, tel que le Hub le voit : ses scènes, et celle qui démarre.
// L'ordre compte : le tableau de bord s'affiche par-dessus la partie, la fin par-dessus le tableau.

import type { ModuleDeJeu } from "../catalogue";
import { Chargement } from "./scenes/Chargement";
import { Menu } from "./scenes/Menu";
import { Partie } from "./scenes/Partie";
import { Tableau } from "./scenes/Tableau";
import { Fin } from "./scenes/Fin";

const jeu: ModuleDeJeu = {
  premiere: "briques-chargement",
  scenes: {
    "briques-chargement": Chargement,
    "briques-menu": Menu,
    "briques-partie": Partie,
    "briques-tableau": Tableau,
    "briques-fin": Fin,
  },
};

export default jeu;
