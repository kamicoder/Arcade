// Joue-t-on au doigt ? Vrai sur un téléphone ou une tablette, et dès qu'un doigt touche l'écran.

let auDoigt = window.matchMedia("(pointer: coarse)").matches;

window.addEventListener("touchstart", () => {
  auDoigt = true;
}, { passive: true });

export function estTactile(): boolean {
  return auDoigt;
}
