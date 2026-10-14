// La catapulte, telle que le Hub la voit : ses scènes, et celle qui démarre.
// L'ordre compte : le tableau de bord s'affiche par-dessus le niveau, la fin par-dessus le tableau.

import type { ModuleDeJeu } from "../catalogue";
import { Chargement } from "./scenes/Chargement";
import { Menu } from "./scenes/Menu";
import { Niveau } from "./scenes/Niveau";
import { Tableau } from "./scenes/Tableau";
import { Fin } from "./scenes/Fin";

const jeu: ModuleDeJeu = {
  premiere: "catapulte-chargement",
  scenes: {
    "catapulte-chargement": Chargement,
    "catapulte-menu": Menu,
    "catapulte-niveau": Niveau,
    "catapulte-tableau": Tableau,
    "catapulte-fin": Fin,
  },
};

export default jeu;
