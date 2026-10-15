// Un champ de texte du navigateur posé par-dessus le jeu, pour taper son nom après un record.
//
// Phaser ne sait pas faire de champ de saisie : il faudrait un clavier dessiné à la main, et au doigt,
// rien ne vaut le clavier du téléphone (avec ses accents). Un <input> du navigateur fait tout ça.
// On le place au-dessus du canvas, au bon endroit et à la bonne taille, et on le replace quand
// l'écran change de taille. Il disparaît avec la scène.

import Phaser from "phaser";
import { POLICE } from "../../socle/style";

export interface ChampDeNom {
  valeur(): string;
  detruire(): void;
}

// x, y : le centre du champ, en pixels du jeu (960 × 540, ou plus large au doigt : socle/largeur.ts)
export function creerChampDeNom(scene: Phaser.Scene, x: number, y: number, depart: string,
  valider: () => void): ChampDeNom {
  const champ = document.createElement("input");
  champ.type = "text";
  champ.maxLength = 12;
  champ.value = depart;
  champ.placeholder = "Ton nom";
  champ.autocomplete = "off";
  champ.enterKeyHint = "done";
  champ.setAttribute("aria-label", "Ton nom");
  Object.assign(champ.style, {
    position: "fixed", zIndex: "5", boxSizing: "border-box", textAlign: "center",
    fontFamily: POLICE, fontWeight: "bold", color: "#ffffff", background: "#14121c",
    border: "3px solid #ffc83d", borderRadius: "10px", outline: "none",
  });
  document.body.appendChild(champ);

  const largeur = 260;
  const hauteur = 46;
  const placer = () => {
    const cadre = scene.game.canvas.getBoundingClientRect();
    const k = cadre.width / scene.scale.width;   // des pixels du jeu aux pixels de la page
    Object.assign(champ.style, {
      left: cadre.left + (x - largeur / 2) * k + "px",
      top: cadre.top + (y - hauteur / 2) * k + "px",
      width: largeur * k + "px",
      height: hauteur * k + "px",
      fontSize: 24 * k + "px",
    });
  };
  placer();
  // Le canvas bouge quand la fenêtre change (on tourne le téléphone, son clavier s'ouvre...)
  scene.scale.on(Phaser.Scale.Events.RESIZE, placer);
  window.addEventListener("resize", placer);

  // Les touches tapées dans le champ restent au champ : elles ne remontent pas jusqu'à Phaser,
  // qui écoute la fenêtre (sinon, taper un R relancerait la partie)
  const touche = (evenement: KeyboardEvent) => {
    evenement.stopPropagation();
    if (evenement.key === "Enter") {
      valider();
    }
  };
  champ.addEventListener("keydown", touche);
  champ.addEventListener("keyup", (evenement) => evenement.stopPropagation());

  // Au clavier, on peut taper tout de suite. Au doigt, le téléphone n'ouvre son clavier que si
  // c'est le doigt qui touche le champ : on le laisse faire.
  champ.focus();
  champ.select();

  const detruire = () => {
    scene.scale.off(Phaser.Scale.Events.RESIZE, placer);
    window.removeEventListener("resize", placer);
    champ.remove();
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, detruire);
  return { valeur: () => champ.value, detruire };
}
