// La course de voitures, telle que le Hub la voit : ses scènes, et celle qui démarre.
// L'ordre compte : une scène plus bas dans la liste s'affiche par-dessus celles d'avant.

import type { ModuleDeJeu } from "../catalogue";
import { Chargement } from "./scenes/Chargement";
import { Menu } from "./scenes/Menu";
import { Course } from "./scenes/Course";
import { Tableau } from "./scenes/Tableau";
import { Arrivee } from "./scenes/Arrivee";

const jeu: ModuleDeJeu = {
  premiere: "voiture-chargement",
  scenes: {
    "voiture-chargement": Chargement,
    "voiture-menu": Menu,
    "voiture-course": Course,
    "voiture-tableau": Tableau,
    "voiture-arrivee": Arrivee,
  },
};

export default jeu;
