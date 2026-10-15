// Le jeu de tir, tel que le Hub le voit : ses scènes, et celle qui démarre.
// L'ordre compte : une scène plus bas dans la liste s'affiche par-dessus celles d'avant
// (le fond étoilé sous la partie, le tableau de bord par-dessus, la fin par-dessus le tableau de bord).

import type { ModuleDeJeu } from "../catalogue";
import { Chargement } from "./scenes/Chargement";
import { Menu } from "./scenes/Menu";
import { Fond } from "./scenes/Fond";
import { Partie } from "./scenes/Partie";
import { Tableau } from "./scenes/Tableau";
import { Fin } from "./scenes/Fin";

const jeu: ModuleDeJeu = {
  premiere: "tir-chargement",
  scenes: {
    "tir-chargement": Chargement,
    "tir-menu": Menu,
    "tir-fond": Fond,
    "tir-partie": Partie,
    "tir-tableau": Tableau,
    "tir-fin": Fin,
  },
};

export default jeu;
