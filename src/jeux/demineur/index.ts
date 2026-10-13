// Le démineur, tel que le Hub le voit : ses scènes, et celle qui démarre.
// L'ordre compte : une scène plus bas dans la liste s'affiche par-dessus celles d'avant
// (la barre par-dessus la grille, la fin de partie par-dessus tout).

import type { ModuleDeJeu } from "../catalogue";
import { Chargement } from "./scenes/Chargement";
import { Menu } from "./scenes/Menu";
import { Partie } from "./scenes/Partie";
import { Barre } from "./scenes/Barre";
import { Fin } from "./scenes/Fin";

const jeu: ModuleDeJeu = {
  premiere: "demineur-chargement",
  scenes: {
    "demineur-chargement": Chargement,
    "demineur-menu": Menu,
    "demineur-partie": Partie,
    "demineur-barre": Barre,
    "demineur-fin": Fin,
  },
};

export default jeu;
