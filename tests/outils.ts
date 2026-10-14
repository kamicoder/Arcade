// Ce que les tests partagent : attendre une scène, lire l'état du jeu, appuyer sur une touche, toucher l'écran.
import { expect, type Page } from "@playwright/test";

// Ouvre l'Arcade et relève les erreurs de la page : un test les vérifie à la fin avec sansErreur()
export async function ouvrir(page: Page) {
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") {
      erreurs.push(m.text());
    }
  });
  await page.goto("/");
  await attendreScene(page, "Hub");
  return {
    sansErreur: () => expect(erreurs).toEqual([]),
  };
}

export async function attendreScene(page: Page, cle: string) {
  await page.waitForFunction((cle) => {
    const jeu = (window as any).jeu;
    return jeu && jeu.scene.isActive(cle);
  }, cle);
}

export function scenesActives(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as any).jeu.scene.getScenes(true).map((s: any) => s.scene.key));
}

// Une touche, puis un petit temps : Phaser traite deux fois les touches arrivées dans la même image
export async function appuyer(page: Page, touche: string) {
  await page.keyboard.press(touche);
  await page.waitForTimeout(80);
}

// La taille du jeu : 960 × 540, ou plus large quand un jeu s'élargit au doigt (socle/largeur.ts)
export function tailleDuJeu(page: Page): Promise<{ largeur: number; hauteur: number }> {
  return page.evaluate(() => {
    const scale = (window as any).jeu.scale;
    return { largeur: scale.width as number, hauteur: scale.height as number };
  });
}

// Un point du jeu en pixels de la page : le canvas est agrandi et centré
export async function versLaPage(page: Page, x: number, y: number) {
  const cadre = (await page.locator("canvas").boundingBox())!;
  const { largeur, hauteur } = await tailleDuJeu(page);
  return { x: cadre.x + x * cadre.width / largeur, y: cadre.y + y * cadre.height / hauteur };
}

export async function toucher(page: Page, x: number, y: number) {
  const p = await versLaPage(page, x, y);
  await page.touchscreen.tap(p.x, p.y);
}

// Toucher la carte d'un jeu dans le Hub, d'après sa clé (catalogue.ts) : sa place change quand un jeu arrive
export async function toucherLaCarte(page: Page, cle: string) {
  const { x, y } = await page.evaluate((cle) => {
    const carte = (window as any).jeu.scene.getScene("Hub").cartes.find((c: any) => c.fiche.cle === cle);
    return { x: carte.boite.x as number, y: carte.boite.y as number };
  }, cle);
  await toucher(page, x, y);
}

// Au clavier, jusqu'à la carte d'un jeu dans le Hub, puis Entrée. → avance d'une carte à la fois, quelle
// que soit la mise en page (le nombre de cartes par rangée change quand des jeux arrivent).
export async function ouvrirLaCarte(page: Page, cle: string) {
  const { choisie, cible } = await page.evaluate((cle) => {
    const hub = (window as any).jeu.scene.getScene("Hub");
    return { choisie: hub.choisie as number, cible: hub.cartes.findIndex((c: any) => c.fiche.cle === cle) as number };
  }, cle);
  for (let i = choisie; i < cible; i++) {
    await appuyer(page, "ArrowRight");
  }
  for (let i = choisie; i > cible; i--) {
    await appuyer(page, "ArrowLeft");
  }
  await appuyer(page, "Enter");
}

// Un bouton de manette pressé, tel que Phaser le raconte à une scène (0 = A, 1 = B, 9 = Start... : voir
// socle/manette.ts). Les tests n'ont pas de vraie manette : on émet l'événement que Phaser émettrait.
export async function manette(page: Page, scene: string, bouton: number) {
  await page.evaluate(([scene, bouton]) => {
    const plugin = (window as any).jeu.scene.getScene(scene).input.gamepad;
    plugin.emit("down", plugin.pad1 ?? {}, { index: bouton, value: 1 }, 1);
  }, [scene, bouton] as const);
  await page.waitForTimeout(80);
}
