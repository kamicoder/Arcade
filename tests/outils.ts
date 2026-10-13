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

// Un point du jeu (960 × 540) en pixels de la page : le canvas est agrandi et centré
export async function versLaPage(page: Page, x: number, y: number) {
  const cadre = (await page.locator("canvas").boundingBox())!;
  return { x: cadre.x + x * cadre.width / 960, y: cadre.y + y * cadre.height / 540 };
}

export async function toucher(page: Page, x: number, y: number) {
  const p = await versLaPage(page, x, y);
  await page.touchscreen.tap(p.x, p.y);
}
