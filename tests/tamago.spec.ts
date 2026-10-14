import { test, expect, type Page } from "@playwright/test";
import { ouvrir, appuyer, attendreScene, scenesActives, toucher, ouvrirLaCarte } from "./outils";

const MINUTE = 60_000;

// Du Hub jusqu'au Tamago (un œuf neuf : chaque test a son propre navigateur, sans sauvegarde)
async function ouvrirLeTamago(page: Page) {
  const ouverte = await ouvrir(page);
  await ouvrirLaCarte(page, "tamago");
  await attendreScene(page, "tamago-ecran");
  return ouverte;
}

// L'état du Tamago, lu dans la scène
function etat(page: Page) {
  return page.evaluate(() => {
    const e = (window as any).jeu.scene.getScene("tamago-ecran").etat;
    return JSON.parse(JSON.stringify(e));
  });
}

// Faire passer du temps de jeu d'un coup (la vie avance comme à chaque image, en accéléré)
function avancer(page: Page, duree: number) {
  return page.evaluate((duree) => (window as any).jeu.scene.getScene("tamago-ecran").avancerDe(duree), duree);
}

// Le hasard du Tamago, fixé : les tests savent ce qui va arriver
function hasard(page: Page, valeur: number) {
  return page.evaluate((valeur) => {
    (window as any).jeu.scene.getScene("tamago-ecran").hasard = () => valeur;
  }, valeur);
}

// Changer l'état à la main, pour se placer là où le test commence
function regler(page: Page, valeurs: Record<string, unknown>) {
  return page.evaluate((valeurs) => Object.assign((window as any).jeu.scene.getScene("tamago-ecran").etat, valeurs), valeurs);
}

// L'œuf réchauffé et éclos, sans attendre
async function naitre(page: Page) {
  for (let i = 0; i < 5; i++) {
    await appuyer(page, "Enter");
  }
  await avancer(page, 5000);
  expect((await etat(page)).stade).toBe("bebe");
}

test("le Hub ouvre le Tamago : un œuf, cinq tapes pour le réchauffer, et il éclot", async ({ page }) => {
  const { sansErreur } = await ouvrirLeTamago(page);
  expect(await scenesActives(page)).toEqual(["tamago-ecran"]);
  expect(await etat(page)).toMatchObject({ stade: "oeuf", tapes: 0 });
  // N'importe quel bouton réchauffe l'œuf : ici Entrée sur le premier
  for (let i = 1; i <= 5; i++) {
    await appuyer(page, "Enter");
    expect((await etat(page)).tapes).toBe(i);
  }
  // Il éclot quelques secondes plus tard, tout seul
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("tamago-ecran").etat.stade === "bebe", undefined, { timeout: 8000 });
  expect(await etat(page)).toMatchObject({ ventre: 2, moral: 2, poids: 5 });
  sansErreur();
});

test("les soins au clavier : repas (refusé le ventre plein), friandise, nettoyer, soigner", async ({ page }) => {
  const { sansErreur } = await ouvrirLeTamago(page);
  await naitre(page);

  // 1 : le repas. Deux cœurs, puis plein : il refuse le troisième repas de trop
  await appuyer(page, "1");
  await appuyer(page, "1");
  expect(await etat(page)).toMatchObject({ ventre: 4, poids: 7 });
  await appuyer(page, "1");
  expect(await etat(page)).toMatchObject({ ventre: 4, poids: 7 });

  // 2 : la friandise, qui fait grossir de 2 g
  await appuyer(page, "2");
  expect(await etat(page)).toMatchObject({ moral: 3, poids: 9 });

  // 4 : nettoyer. Une crotte fraîche compte double pour la lignée Propre
  await regler(page, { crottes: [0, 2 * MINUTE] });
  await appuyer(page, "4");
  expect(await etat(page)).toMatchObject({ crottes: [] });
  expect((await etat(page)).points.propre).toBe(3);

  // 5 : soigner, autant de doses que la maladie en demande
  await regler(page, { malade: 2 });
  await appuyer(page, "5");
  expect((await etat(page)).malade).toBe(1);
  await appuyer(page, "5");
  expect((await etat(page)).malade).toBe(0);
  sansErreur();
});

test("le temps : il a faim, il appelle, et un appel ignoré une minute devient un oubli", async ({ page }) => {
  const { sansErreur } = await ouvrirLeTamago(page);
  await naitre(page);
  await regler(page, { ventre: 1, moral: 4, avantPerteVentre: 3 * MINUTE });
  // Un bébé a faim deux fois plus vite : son dernier cœur part en une minute et demie
  await avancer(page, 1.5 * MINUTE);
  expect(await etat(page)).toMatchObject({ ventre: 0, appel: { raison: "ventre", compte: false }, oublis: 0 });
  await avancer(page, MINUTE);
  expect(await etat(page)).toMatchObject({ appel: { raison: "ventre", compte: true }, oublis: 1 });
  // Le nourrir répond à l'appel
  await appuyer(page, "1");
  expect(await etat(page)).toMatchObject({ ventre: 1, appel: null });
  sansErreur();
});

test("grandir : ses soins décident de sa lignée, et trop d'oublis le rendent sauvage", async ({ page }) => {
  const { sansErreur } = await ouvrirLeTamago(page);
  await naitre(page);
  await hasard(page, 0.5);
  // Bébé, on le nourrit souvent : il devient un enfant Gourmand, gentil (aucun oubli)
  for (let i = 0; i < 3; i++) {
    await regler(page, { ventre: 1 });
    await appuyer(page, "1");
  }
  await regler(page, { dansLeStade: 5 * MINUTE - 1000, ventre: 4, moral: 4 });
  await avancer(page, 2000);
  expect(await etat(page)).toMatchObject({ stade: "enfant", lignee: "gourmand", variante: "gentil" });

  // Enfant, on joue beaucoup avec lui... mais avec trois oublis : un ado Joyeux, sauvage (Howlyx)
  await regler(page, { points: { gourmand: 0, joyeux: 6, propre: 0, style: 0 }, oublisDuStade: 3, discipline: 3 });
  await regler(page, { dansLeStade: 20 * MINUTE - 1000, ventre: 4, moral: 4, caprices: [] });
  await avancer(page, 2000);
  expect(await etat(page)).toMatchObject({ stade: "ado", lignee: "joyeux", variante: "sauvage" });
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("tamago-ecran").nom.text)).toBe("HOWLYX");
  sansErreur();
});

test("le ROI CACA : quatre crottes laissées le font venir, et il faut le nettoyer cinq fois", async ({ page }) => {
  const { sansErreur } = await ouvrirLeTamago(page);
  await naitre(page);
  await regler(page, { crottes: [0, 0, 0, 0], ventre: 4, moral: 4 });
  await avancer(page, 2 * MINUTE + 1000);
  expect(await etat(page)).toMatchObject({ crottes: [], roiCaca: 5 });
  for (let coup = 4; coup >= 1; coup--) {
    await appuyer(page, "4");
    expect((await etat(page)).roiCaca).toBe(coup);
  }
  await appuyer(page, "4");
  expect((await etat(page)).roiCaca).toBe(null);
  sansErreur();
});

test("le caprice : le gronder fait monter la discipline ; le gronder pour rien le vexe", async ({ page }) => {
  const { sansErreur } = await ouvrirLeTamago(page);
  await naitre(page);
  await regler(page, { ventre: 4, moral: 4, caprices: [0] });
  await avancer(page, 1000);
  expect((await etat(page)).appel).toMatchObject({ raison: "caprice" });
  // Pendant un caprice, il refuse de manger
  await appuyer(page, "1");
  expect((await etat(page)).ventre).toBe(4);
  await appuyer(page, "6");
  expect(await etat(page)).toMatchObject({ appel: null, discipline: 1 });
  // Grondé sans raison : un cœur de Moral en moins
  await appuyer(page, "6");
  expect(await etat(page)).toMatchObject({ discipline: 1, moral: 3 });
  sansErreur();
});

test("le jeu de gauche-droite : arrêté en route, rien ne change ; trois manches gagnées rendent un cœur de Moral", async ({ page }) => {
  const { sansErreur } = await ouvrirLeTamago(page);
  await naitre(page);
  await regler(page, { ventre: 4, moral: 2, poids: 8, caprices: [] });
  await hasard(page, 0.1);                 // il regardera toujours à gauche

  // Échap en pleine partie : on revient, sans rien gagner ni perdre
  await appuyer(page, "3");
  await attendreScene(page, "tamago-jeu");
  await appuyer(page, "Escape");
  await page.waitForFunction(() => (window as any).jeu.scene.isActive("tamago-ecran"));
  expect(await etat(page)).toMatchObject({ moral: 2, poids: 8 });

  await appuyer(page, "3");
  await attendreScene(page, "tamago-jeu");
  for (let manche = 1; manche <= 5; manche++) {
    await page.waitForFunction((m) => {
      const jeu = (window as any).jeu.scene.getScene("tamago-jeu");
      return jeu.manche === m && jeu.attend;
    }, manche);
    await appuyer(page, "ArrowLeft");
  }
  await page.waitForFunction(() => (window as any).jeu.scene.isActive("tamago-ecran"));
  expect(await etat(page)).toMatchObject({ moral: 3, poids: 7 });
  sansErreur();
});

test("la fin : de vieillesse, il repart sur sa planète, l'album le garde, et un nouvel œuf attend", async ({ page }) => {
  const { sansErreur } = await ouvrirLeTamago(page);
  await naitre(page);
  await regler(page, {
    stade: "adulte", lignee: "propre", variante: "gentil", age: 5 * 60 * MINUTE - 1000, ventre: 4, moral: 4,
    oublis: 1, discipline: 4, caprices: [], maladieDuStade: null,
  });
  await avancer(page, 2000);
  const album = await page.evaluate(() => JSON.parse(localStorage.getItem("tamago/album")!));
  expect(album).toHaveLength(1);
  expect(album[0]).toMatchObject({ nom: "KTHULU JR", fin: "vieillesse", ans: 19 });
  // Le nouvel œuf est sauvé tout de suite, et arrive après le départ
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("tamago/etat")!).stade)).toBe("oeuf");
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("tamago-ecran").etat.stade === "oeuf", undefined, { timeout: 8000 });

  // Une sauvegarde d'un Tamago déjà parti (abîmée, d'une version d'avant...) : un œuf neuf, pas un Tamago figé
  await page.evaluate(() => {
    const e = JSON.parse(localStorage.getItem("tamago/etat")!);
    localStorage.setItem("tamago/etat", JSON.stringify({ ...e, stade: "adulte", lignee: "propre", variante: "gentil", fin: "faim" }));
  });
  await appuyer(page, "Escape");
  await attendreScene(page, "Hub");
  await ouvrirLaCarte(page, "tamago");
  await attendreScene(page, "tamago-ecran");
  expect(await etat(page)).toMatchObject({ stade: "oeuf", fin: null });
  sansErreur();
});

test("il dort quand on s'en va : rien ne bouge au Hub, et on le retrouve comme on l'a laissé", async ({ page }) => {
  const { sansErreur } = await ouvrirLeTamago(page);
  await naitre(page);
  await regler(page, { ventre: 3, moral: 2 });
  const avant = await etat(page);
  await appuyer(page, "Escape");
  await attendreScene(page, "Hub");
  await page.waitForTimeout(2500);
  await ouvrirLaCarte(page, "tamago");
  await attendreScene(page, "tamago-ecran");
  const apres = await etat(page);
  expect(apres).toMatchObject({ stade: "bebe", ventre: 3, moral: 2 });
  // Moins d'une seconde de vie en plus (le temps de partir et de revenir), pas les 2,5 s passées au Hub
  expect(apres.age - avant.age).toBeLessThan(1500);
  sansErreur();
});

test("le carnet : son état, son journal, ses amis et l'album, page après page", async ({ page }) => {
  const { sansErreur } = await ouvrirLeTamago(page);
  await naitre(page);
  await appuyer(page, "8");
  await attendreScene(page, "tamago-carnet");
  const contenu = () => page.evaluate(() => (window as any).jeu.scene.getScene("tamago-carnet").contenu.text as string);
  expect(await contenu()).toContain("Ptiou");
  await appuyer(page, "ArrowRight");
  expect(await contenu()).toContain("Il est né !");
  await appuyer(page, "ArrowRight");
  expect(await contenu()).toContain("Personne");
  await appuyer(page, "ArrowRight");
  expect(await contenu()).toContain("album est vide");
  await appuyer(page, "Escape");
  await page.waitForFunction(() => !(window as any).jeu.scene.isActive("tamago-carnet"));
  expect(await scenesActives(page)).toEqual(["tamago-ecran"]);
  sansErreur();
});

test.describe("au doigt", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test("toucher l'œuf le réchauffe, toucher un bouton le soigne, toucher le Tamago le caresse", async ({ page }) => {
    const { sansErreur } = await ouvrirLeTamago(page);
    const creature = () => page.evaluate(() => {
      const c = (window as any).jeu.scene.getScene("tamago-ecran").creature;
      return { x: c.x as number, y: c.y as number };
    });
    for (let i = 0; i < 5; i++) {
      const { x, y } = await creature();
      await toucher(page, x, y - 40);
      await page.waitForTimeout(80);
    }
    expect((await etat(page)).tapes).toBe(5);
    await avancer(page, 5000);
    // Le bouton Repas : le premier de la rangée
    const bouton = await page.evaluate(() => {
      const f = (window as any).jeu.scene.getScene("tamago-ecran").boutons[0].fond;
      return { x: f.x as number, y: f.y as number };
    });
    await toucher(page, bouton.x, bouton.y);
    expect((await etat(page)).ventre).toBe(3);
    // Une caresse compte pour la lignée Stylée
    await page.evaluate(() => (window as any).jeu.scene.getScene("tamago-ecran").tweens.killTweensOf(
      (window as any).jeu.scene.getScene("tamago-ecran").creature));
    const { x, y } = await creature();
    await toucher(page, x, y - 40);
    expect((await etat(page)).points.style).toBe(1);
    sansErreur();
  });
});
