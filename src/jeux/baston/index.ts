// La baston de robots, telle que le Hub la voit : ses scènes, et celle qui démarre.
// L'ordre compte : une scène plus bas dans la liste s'affiche par-dessus celles d'avant.

import type { ModuleDeJeu } from "../catalogue";
import { Chargement } from "./scenes/Chargement";
import { Titre } from "./scenes/Titre";
import { Choix } from "./scenes/Choix";
import { Combat } from "./scenes/Combat";
import { Tableau } from "./scenes/Tableau";
import { Fin } from "./scenes/Fin";

const jeu: ModuleDeJeu = {
  premiere: "baston-chargement",
  scenes: {
    "baston-chargement": Chargement,
    "baston-titre": Titre,
    "baston-choix": Choix,
    "baston-combat": Combat,
    "baston-tableau": Tableau,
    "baston-fin": Fin,
  },
};

export default jeu;
