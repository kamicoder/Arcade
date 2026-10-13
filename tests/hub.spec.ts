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
