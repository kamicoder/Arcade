// Le Tamago, tel que le Hub le voit : ses scènes, et celle qui démarre.
// L'ordre compte : le jeu et le carnet s'affichent par-dessus l'écran.

import type { ModuleDeJeu } from "../catalogue";
import { Chargement } from "./scenes/Chargement";
import { Ecran } from "./scenes/Ecran";
import { Jeu } from "./scenes/Jeu";
import { Carnet } from "./scenes/Carnet";

const jeu: ModuleDeJeu = {
  premiere: "tamago-chargement",
  scenes: {
    "tamago-chargement": Chargement,
    "tamago-ecran": Ecran,
    "tamago-jeu": Jeu,
    "tamago-carnet": Carnet,
  },
};

export default jeu;
