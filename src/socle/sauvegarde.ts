// Les sauvegardes, dans le localStorage du navigateur. Il peut refuser (navigation privée, stockage
// plein...) : on ne plante jamais pour autant, on joue simplement sans sauvegarde.

export function lire<T>(cle: string): T | null {
  try {
    const texte = localStorage.getItem(cle);
    return texte === null ? null : (JSON.parse(texte) as T);
  } catch {
    return null;
  }
}

export function ecrire(cle: string, valeur: unknown) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    // pas de sauvegarde, tant pis
  }
}

export function oublier(cle: string) {
  try {
    localStorage.removeItem(cle);
  } catch {
    // rien à oublier
  }
}
