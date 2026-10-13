import { test, expect } from "@playwright/test";
import { ouvrir, appuyer, attendreScene } from "./outils";

test("le Hub s'ouvre, et Entrée lance la course de voitures", async ({ page }) => {
  const { sansErreur } = await ouvrir(page);
  await appuyer(page, "Enter");
  await attendreScene(page, "course-menu");
  sansErreur();
});

test("un jeu pas encore là ne se lance pas", async ({ page }) => {
  const { sansErreur } = await ouvrir(page);
  const bientot = await page.evaluate(() =>
    (window as any).jeu.scene.getScene("Hub").cartes.findIndex((carte: any) => !carte.fiche.charger));
  test.skip(bientot < 0, "tous les jeux sont là");
  for (let i = 0; i < bientot; i++) {
    await appuyer(page, "ArrowRight");
  }
  await appuyer(page, "Enter");
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).jeu.scene.isActive("Hub"))).toBe(true);
  sansErreur();
});

// Phaser 4.2.1 : un segment de longueur nulle dans un contour donnait des sommets NaN, que certains
// téléphones dessinent comme des traits partis du coin haut gauche (voir socle/correctifs.ts)
test("les contours ne donnent jamais de sommets NaN (traits fantômes sur téléphone)", async ({ page }) => {
  const { sansErreur } = await ouvrir(page);
  const nan = await page.evaluate(async () => {
    const jeu = (window as any).jeu;
    const noeud = jeu.renderer.renderNodes.getNode("DrawLine");
    let sommetsNaN = 0;
    const tracer = noeud.run.bind(noeud);
    noeud.run = (...args: any[]) => {
      const sommets = args[8] as number[];
      const avant = sommets.length;
      tracer(...args);
      for (let i = avant; i < sommets.length; i++) {
        if (Number.isNaN(sommets[i])) sommetsNaN++;
      }
    };
    // Un segment de longueur nulle, tracé directement
    const sommets: number[] = [];
    noeud.run({}, null, 10, 10, 10, 10, 2, 2, sommets);
    // Puis quelques images du Hub, plein de rectangles arrondis à contour
    await new Promise((fini) => setTimeout(fini, 500));
    return sommetsNaN;
  });
  expect(nan).toBe(0);
  sansErreur();
});
