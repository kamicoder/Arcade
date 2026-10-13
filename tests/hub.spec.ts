import { test, expect } from "@playwright/test";
import { ouvrir, appuyer, attendreScene } from "./outils";

test("le Hub s'ouvre, et Entrée lance la course de voitures", async ({ page }) => {
  const { sansErreur } = await ouvrir(page);
  await appuyer(page, "Enter");
  await attendreScene(page, "voiture-menu");
  sansErreur();
});

test("un jeu pas encore là ne se lance pas", async ({ page }) => {
  const { sansErreur } = await ouvrir(page);
  await appuyer(page, "ArrowRight");
  await appuyer(page, "Enter");
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).jeu.scene.isActive("Hub"))).toBe(true);
  sansErreur();
});
