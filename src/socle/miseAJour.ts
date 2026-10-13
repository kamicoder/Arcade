// La mise à jour automatique. vite-plugin-pwa fabrique le service worker (le jeu marche sans réseau)
// et nous prévient quand une nouvelle version est en ligne. On ne l'installe qu'au menu de l'Arcade :
// jamais au milieu d'une partie.

import { registerSW } from "virtual:pwa-register";

let nouvelleVersion = false;
let installer: (() => Promise<void>) | null = null;
const abonnes = new Set<() => void>();

export function demarrerMiseAJour() {
  installer = registerSW({
    onNeedRefresh() {
      nouvelleVersion = true;
      abonnes.forEach((prevenir) => prevenir());
    },
    onRegisteredSW(_adresse, inscription) {
      if (!inscription) {
        return;
      }
      // Le navigateur ne regarde pas souvent tout seul : on lui demande toutes les deux minutes,
      // et chaque fois qu'on revient dans l'appli
      setInterval(() => inscription.update(), 2 * 60 * 1000);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          inscription.update();
        }
      });
    },
  });
}

// Appelle « prevenir » dès qu'une nouvelle version est prête (tout de suite si c'est déjà le cas).
// Renvoie de quoi arrêter d'écouter.
export function quandNouvelleVersion(prevenir: () => void): () => void {
  abonnes.add(prevenir);
  if (nouvelleVersion) {
    prevenir();
  }
  return () => abonnes.delete(prevenir);
}

// Active la nouvelle version : la page se recharge
export function installerNouvelleVersion() {
  installer?.();
}
