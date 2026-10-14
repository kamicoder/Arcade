// Le jeu de tir, tel que le Hub le voit : ses scènes, et celle qui démarre.
// L'ordre compte : une scène plus bas dans la liste s'affiche par-dessus celles d'avant
// (le tableau de bord par-dessus la partie, la fin par-dessus le tableau de bord).

import type { ModuleDeJeu } from "../catalogue";
import { Chargement } from "./scenes/Chargement";
import { Menu } from "./scenes/Menu";
import { Partie } from "./scenes/Partie";
import { Tableau } from "./scenes/Tableau";
import { Fin } from "./scenes/Fin";

const jeu: ModuleDeJeu = {
  premiere: "tir-chargement",
  scenes: {
    "tir-chargement": Chargement,
    "tir-menu": Menu,
    "tir-partie": Partie,
    "tir-tableau": Tableau,
    "tir-fin": Fin,
  },
};

export default jeu;
