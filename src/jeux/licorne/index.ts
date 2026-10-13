// La course des licornes, telle que le Hub la voit : ses scènes, et celle qui démarre.
// L'ordre compte : une scène plus bas dans la liste s'affiche par-dessus celles d'avant
// (le tableau de bord sur la course, l'arrivée et la pause sur les deux).

import type { ModuleDeJeu } from "../catalogue";
import { Chargement, Musique } from "./scenes/Chargement";
import { Menu } from "./scenes/Menu";
import { Circuits } from "./scenes/Circuits";
import { Atelier } from "./scenes/Atelier";
import { Editeur } from "./scenes/Editeur";
import { Classement, Podium } from "./scenes/GrandPrix";
import { Course } from "./scenes/Course";
import { Tableau } from "./scenes/Tableau";
import { Arrivee } from "./scenes/Arrivee";
import { Pause } from "./scenes/Pause";

const jeu: ModuleDeJeu = {
  premiere: "licorne-chargement",
  scenes: {
    "licorne-chargement": Chargement,
    "licorne-musique": Musique,
    "licorne-menu": Menu,
    "licorne-circuits": Circuits,
    "licorne-atelier": Atelier,
    "licorne-editeur": Editeur,
    "licorne-grand-prix": Classement,
    "licorne-podium": Podium,
    "licorne-course": Course,
    "licorne-tableau": Tableau,
    "licorne-arrivee": Arrivee,
    "licorne-pause": Pause,
  },
};

export default jeu;
