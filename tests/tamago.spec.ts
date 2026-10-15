import { test, expect, type Page } from "@playwright/test";
import { ouvrir, appuyer, attendreScene, scenesActives, toucher, ouvrirLaCarte, tailleDuJeu } from "./outils";
import {
  UN_AN, UN_MOIS, DUREE_STADE, PERTE_VENTRE, OUBLI_APRES, CROTTE_FRAICHE, ROI_CACA_APRES, VIE_MAX, CAPRICES,
} from "../src/jeux/tamago/reglages";

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

// Ce que montre l'écran (un champ de la scène : un texte, un drapeau...)
function ecran<T>(page: Page, lire: string): Promise<T> {
  return page.evaluate((lire) => new Function("e", "return " + lire)((window as any).jeu.scene.getScene("tamago-ecran")), lire);
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

// Le texte du carnet, à la page voulue (0 : état, 1 : journal, 3 : album)
async function ouvrirLeCarnet(page: Page, pageDuCarnet = 0) {
  await appuyer(page, "8");
  await attendreScene(page, "tamago-carnet");
  for (let i = 0; i < pageDuCarnet; i++) {
    await appuyer(page, "ArrowRight");
  }
  return page.evaluate(() => (window as any).jeu.scene.getScene("tamago-carnet").contenu.text as string);
}

test("une sauvegarde de l'ancien rythme (4 fois plus lent) continue là où elle en était", async ({ page }) => {
  const { sansErreur } = await ouvrir(page);
  const ANCIEN_AN = 15 * 60_000;
  const ancien = (valeurs: Record<string, unknown>) => JSON.stringify({
    version: 1, lignee: "propre", variante: "gentil", ventre: 4, moral: 4, crottes: [], caprices: [], maladieDuStade: null,
    points: { gourmand: 0, joyeux: 0, propre: 0, style: 0 }, avantPerteVentre: 3 * 60_000, avantPerteMoral: 4 * 60_000,
    avantCrotte: 5 * 60_000, avantSurprise: 3 * 60_000, derniereCaresse: null, ...valeurs,
  });
  // Un adulte de 6 anciens ans (1 h 30) : sans conversion, il repartirait sur sa planète à la première image
  await page.evaluate((s) => localStorage.setItem("tamago/etat", s), ancien({
    stade: "adulte", age: 6 * ANCIEN_AN, dansLeStade: 20 * 60_000, journal: [{ age: 2 * ANCIEN_AN, texte: "✨ Il a grandi." }],
  }));
  await ouvrirLaCarte(page, "tamago");
  await attendreScene(page, "tamago-ecran");
  await page.waitForTimeout(500);
  expect(await etat(page)).toMatchObject({ version: 2, stade: "adulte", fin: null, age: expect.closeTo(6 * UN_AN, -4) });
  expect(await ecran<string>(page, "e.age.text")).toBe("6 ANS");
  expect(await ouvrirLeCarnet(page, 1)).toContain("2 ans · ✨ Il a grandi.");
  await appuyer(page, "Escape");
  await page.waitForFunction(() => (window as any).jeu.scene.isActive("tamago-ecran"));
  await appuyer(page, "Escape");
  await attendreScene(page, "Hub");

  // Un ado de 2 ans 8 mois, à 15 de ses 40 anciennes minutes : sans conversion, il grandirait d'un coup
  await page.evaluate((s) => localStorage.setItem("tamago/etat", s), ancien({
    stade: "ado", age: 40 * 60_000, dansLeStade: 15 * 60_000, journal: [],
  }));
  await ouvrirLaCarte(page, "tamago");
  await attendreScene(page, "tamago-ecran");
  await page.waitForTimeout(500);
  expect(await etat(page)).toMatchObject({ version: 2, stade: "ado", fin: null });
  expect(await ecran<string>(page, "e.age.text")).toBe("2 ANS");
  expect(await ecran<number>(page, "e.barre.scaleX")).toBeCloseTo(15 / 40, 1);
  sansErreur();
});

test("le Hub ouvre le Tamago : un œuf, cinq tapes pour le réchauffer, et il éclot", async ({ page }) => {
  const { sansErreur } = await ouvrirLeTamago(page);
  expect(await scenesActives(page)).toEqual(["tamago-ecran"]);
  expect(await etat(page)).toMatchObject({ stade: "oeuf", tapes: 0 });
  // L'aide des touches, au clavier
  expect(await ecran<string>(page, "e.aide.text")).toContain("1 à 8");
  // N'importe quel bouton réchauffe l'œuf : ici Entrée sur le premier. La barre compte les tapes.
  for (let i = 1; i <= 5; i++) {
    await appuyer(page, "Enter");
    expect((await etat(page)).tapes).toBe(i);
  }
  expect(await ecran<string>(page, "e.bientot.visible && e.bientot.text")).toBe("éclot bientôt");
  // Il éclot quelques secondes plus tard, tout seul
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("tamago-ecran").etat.stade === "bebe", undefined, { timeout: 8000 });
  expect(await etat(page)).toMatchObject({ ventre: 2, moral: 2, poids: 5 });
  expect(await ecran<string>(page, "e.age.text")).toBe("NOUVEAU-NÉ");
  sansErreur();
});

test("revenir pendant l'éclosion : l'œuf tremble toujours", async ({ page }) => {
  const { sansErreur } = await ouvrirLeTamago(page);
  for (let i = 0; i < 5; i++) {
    await appuyer(page, "Enter");
  }
  await appuyer(page, "Escape");
  await attendreScene(page, "Hub");
  await ouvrirLaCarte(page, "tamago");
  await attendreScene(page, "tamago-ecran");
  expect((await etat(page)).eclosion).not.toBeNull();
  expect(await ecran<string>(page, "e.texteBulle.text")).toBe("Il bouge !!!");
  expect(await ecran<boolean>(page, "e.tweens.getTweensOf(e.creature).some((t) => t.data.some((d) => d.key === 'x'))")).toBe(true);
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("tamago-ecran").etat.stade === "bebe", undefined, { timeout: 8000 });
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
  await regler(page, { crottes: [0, 2 * CROTTE_FRAICHE] });
  await appuyer(page, "4");
  expect(await etat(page)).toMatchObject({ crottes: [] });
  expect((await etat(page)).points.propre).toBe(3);

  // 5 : soigner, autant de doses que la maladie en demande. Malade, il verdit.
  await regler(page, { malade: 2 });
  await avancer(page, 100);
  expect(await ecran<boolean>(page, "e.teinteDeMalade")).toBe(true);
  await appuyer(page, "5");
  expect((await etat(page)).malade).toBe(1);
  await appuyer(page, "5");
  expect((await etat(page)).malade).toBe(0);
  expect(await ecran<boolean>(page, "e.teinteDeMalade")).toBe(false);
  sansErreur();
});

test("le temps : il a faim, un cœur tombe, il appelle, le bouton Repas bat, et un appel ignoré devient un oubli", async ({ page }) => {
  const { sansErreur } = await ouvrirLeTamago(page);
  await naitre(page);
  await regler(page, { ventre: 1, moral: 4, avantPerteVentre: PERTE_VENTRE });
  // Un bébé a faim deux fois plus vite : son dernier cœur part en 22 secondes et demie
  await avancer(page, PERTE_VENTRE / 2 - 1000);
  expect((await etat(page)).ventre).toBe(1);
  await avancer(page, 1000);
  expect(await etat(page)).toMatchObject({ ventre: 0, appel: { raison: "ventre", compte: false }, oublis: 0 });
  expect(await ecran<number>(page, "e.coeursPerdus")).toBe(1);
  expect(await ecran<string>(page, "e.bat")).toBe("repas");
  expect(await ecran<boolean>(page, "e.boutons[0].anneau.visible")).toBe(true);
  await avancer(page, OUBLI_APRES);
  expect(await etat(page)).toMatchObject({ appel: { raison: "ventre", compte: true }, oublis: 1 });
  // Le nourrir répond à l'appel : le bouton ne bat plus
  await appuyer(page, "1");
  expect(await etat(page)).toMatchObject({ ventre: 1, appel: null });
  await avancer(page, 100);
  expect(await ecran<string | null>(page, "e.bat")).toBeNull();
  expect(await ecran<boolean>(page, "e.boutons[0].anneau.visible")).toBe(false);
  sansErreur();
});

test("le rythme : 1 an pour 3 min 45, l'âge en mois puis en ans, et la barre du stade", async ({ page }) => {
  const { sansErreur } = await ouvrirLeTamago(page);
  await naitre(page);
  await hasard(page, 0.5);
  // Bébé pendant 1 min 15 : 3 mois, la barre presque pleine, « grandit bientôt »
  await avancer(page, DUREE_STADE.bebe - 3000);
  expect((await etat(page)).stade).toBe("bebe");
  expect(await ecran<string>(page, "e.age.text")).toBe("3 MOIS");
  expect(await ecran<number>(page, "e.barre.scaleX")).toBeGreaterThan(0.9);
  expect(await ecran<boolean>(page, "e.bientot.visible")).toBe(true);
  await avancer(page, 4000);
  // Enfant à 4 mois : la barre repart de zéro
  expect((await etat(page)).stade).toBe("enfant");
  expect(await ecran<string>(page, "e.age.text")).toBe("4 MOIS");
  expect(await ecran<number>(page, "e.barre.scaleX")).toBeLessThan(0.05);
  expect(await ecran<boolean>(page, "e.bientot.visible")).toBe(false);

  // 11 mois, puis 1 an, puis 2 ans ; le carnet le dit aussi
  await regler(page, { age: UN_AN - UN_MOIS / 2, ventre: 4, moral: 4, caprices: [], maladieDuStade: null });
  await avancer(page, 100);
  expect(await ecran<string>(page, "e.age.text")).toBe("11 MOIS");
  await avancer(page, UN_MOIS);
  expect(await ecran<string>(page, "e.age.text")).toBe("1 AN");
  await regler(page, { age: 2 * UN_AN });
  await avancer(page, 100);
  expect(await ecran<string>(page, "e.age.text")).toBe("2 ANS");
  expect(await ouvrirLeCarnet(page)).toContain("Âge : 2 ans");
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
  await regler(page, { dansLeStade: DUREE_STADE.bebe - 1000, ventre: 4, moral: 4 });
  await avancer(page, 2000);
  expect(await etat(page)).toMatchObject({ stade: "enfant", lignee: "gourmand", variante: "gentil" });

  // Enfant, on joue beaucoup avec lui... mais avec trois oublis : un ado Joyeux, sauvage (Howlyx)
  await regler(page, { points: { gourmand: 0, joyeux: 6, propre: 0, style: 0 }, oublisDuStade: 3, discipline: 3 });
  await regler(page, { dansLeStade: DUREE_STADE.enfant - 1000, ventre: 4, moral: 4, caprices: [] });
  await avancer(page, 2000);
  expect(await etat(page)).toMatchObject({ stade: "ado", lignee: "joyeux", variante: "sauvage" });
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("tamago-ecran").nom.text)).toBe("HOWLYX");
  sansErreur();
});

test("le carnet annonce l'égalité : il hésite, sauf si sa lignée d'avant en est", async ({ page }) => {
  const { sansErreur } = await ouvrirLeTamago(page);
  await naitre(page);
  await regler(page, { points: { gourmand: 2, joyeux: 2, propre: 0, style: 1 } });
  expect(await ouvrirLeCarnet(page)).toContain("Penchant : hésite entre Gourmand et Joyeux");
  await appuyer(page, "Escape");
  await page.waitForFunction(() => (window as any).jeu.scene.isActive("tamago-ecran"));
  await regler(page, { stade: "enfant", lignee: "joyeux", variante: "gentil" });
  expect(await ouvrirLeCarnet(page)).toContain("Penchant : Joyeux");
  sansErreur();
});

test("un caprice qui n'a pas pu venir avant la fin du stade vient au stade suivant", async ({ page }) => {
  const { sansErreur } = await ouvrirLeTamago(page);
  await naitre(page);
  await hasard(page, 0.5);
  // Son caprice est bloqué : il est malade jusqu'au bout du stade
  await regler(page, { ventre: 4, moral: 4, malade: 3, caprices: [1000], dansLeStade: DUREE_STADE.bebe - 3000 });
  await avancer(page, 4000);
  expect((await etat(page)).stade).toBe("enfant");
  expect((await etat(page)).caprices).toHaveLength(CAPRICES.enfant + 1);
  // Guéri, le caprice en retard vient tôt dans l'enfance (un dixième du stade, avec ce hasard)
  await regler(page, { malade: 0, ventre: 4, moral: 4, maladieDuStade: null });
  await avancer(page, DUREE_STADE.enfant * 0.1 + 1000);
  expect((await etat(page)).appel).toMatchObject({ raison: "caprice" });
  sansErreur();
});

test("le journal et l'album ne débordent pas de l'écran", async ({ page }) => {
  const { sansErreur } = await ouvrirLeTamago(page);
  await naitre(page);
  const longue = "✨ Il a grandi : c'est maintenant DRAGOMEGA 🐲, gourmand, et il le fait savoir à tout le quartier.";
  await regler(page, { journal: Array.from({ length: 40 }, (_, i) => ({ age: i * UN_MOIS, texte: longue })) });
  await page.evaluate(() => localStorage.setItem("tamago/album", JSON.stringify(Array.from({ length: 20 }, () => ({
    nom: "DRAGOMEGA", emoji: "🐲", caractere: "gourmand", ans: 19, age: 19 * 225_000, fin: "vieillesse", date: "14/10/2026",
  })))));
  const dansLEcran = () => page.evaluate(() => {
    const contenu = (window as any).jeu.scene.getScene("tamago-carnet").contenu;
    const ecran = (window as any).jeu.scene.getScene("tamago-ecran").ecran;
    return contenu.y + contenu.height <= ecran.y + ecran.hauteur;
  });
  expect(await ouvrirLeCarnet(page, 1)).toContain("de plus");
  expect(await dansLEcran()).toBe(true);
  await appuyer(page, "ArrowRight");
  await appuyer(page, "ArrowRight");
  const album = await page.evaluate(() => (window as any).jeu.scene.getScene("tamago-carnet").contenu.text as string);
  expect(album).toContain("DRAGOMEGA, 19 ans");
  expect(album).toContain("de plus");
  expect(await dansLEcran()).toBe(true);
  sansErreur();
});

test("M coupe le son pendant le carnet et pendant le jeu", async ({ page }) => {
  const { sansErreur } = await ouvrirLeTamago(page);
  await naitre(page);
  await regler(page, { ventre: 4, moral: 4, caprices: [] });
  const son = () => page.evaluate(() => localStorage.getItem("tamago/son"));
  await ouvrirLeCarnet(page);
  await appuyer(page, "m");
  expect(await son()).toBe("false");
  expect(await ecran<string>(page, "e.boutonSon.text")).toContain("Muet");
  await appuyer(page, "Escape");
  await page.waitForFunction(() => (window as any).jeu.scene.isActive("tamago-ecran"));
  await appuyer(page, "3");
  await attendreScene(page, "tamago-jeu");
  await appuyer(page, "m");
  expect(await son()).toBe("true");
  expect(await ecran<string>(page, "e.boutonSon.text")).toContain("Son");
  sansErreur();
});

test("le ROI CACA : quatre crottes laissées le font venir, et il faut le nettoyer cinq fois", async ({ page }) => {
  const { sansErreur } = await ouvrirLeTamago(page);
  await naitre(page);
  await regler(page, { crottes: [0, 0, 0, 0], ventre: 4, moral: 4 });
  await avancer(page, ROI_CACA_APRES + 1000);
  expect(await etat(page)).toMatchObject({ crottes: [], roiCaca: 5 });
  for (let coup = 4; coup >= 1; coup--) {
    await appuyer(page, "4");
    expect((await etat(page)).roiCaca).toBe(coup);
  }
  await appuyer(page, "4");
  expect((await etat(page)).roiCaca).toBe(null);
  sansErreur();
});

test("le caprice : le bouton Gronder bat ; le gronder fait monter la discipline ; le gronder pour rien le vexe", async ({ page }) => {
  const { sansErreur } = await ouvrirLeTamago(page);
  await naitre(page);
  await regler(page, { ventre: 4, moral: 4, caprices: [0] });
  await avancer(page, 1000);
  expect((await etat(page)).appel).toMatchObject({ raison: "caprice" });
  expect(await ecran<string>(page, "e.bat")).toBe("gronder");
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

test("comblé, des cœurs s'envolent de lui", async ({ page }) => {
  const { sansErreur } = await ouvrirLeTamago(page);
  await naitre(page);
  await regler(page, { ventre: 4, moral: 4, crottes: [], caprices: [] });
  expect(await ecran<boolean>(page, "e.comble()")).toBe(true);
  // Un cœur s'envole : un texte rose au-dessus de lui
  await page.waitForFunction(() => {
    const e = (window as any).jeu.scene.getScene("tamago-ecran");
    return e.children.list.some((o: any) => o.type === "Text" && o.depth === 15);
  }, undefined, { timeout: 4000 });
  await regler(page, { ventre: 3 });
  expect(await ecran<boolean>(page, "e.comble()")).toBe(false);
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
  // Un oubli : il part à 19 ans au lieu de 20 (ici, une seconde avant)
  await regler(page, {
    stade: "adulte", lignee: "propre", variante: "gentil", age: VIE_MAX - UN_AN - 1000, ventre: 4, moral: 4,
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
  await page.waitForTimeout(4000);
  await ouvrirLaCarte(page, "tamago");
  await attendreScene(page, "tamago-ecran");
  const apres = await etat(page);
  expect(apres).toMatchObject({ stade: "bebe", ventre: 3, moral: 2 });
  // Un peu plus d'une seconde de vie en plus (il s'endort, puis le fondu), pas les 4 s passées au Hub
  expect(apres.age - avant.age).toBeLessThan(2500);
  sansErreur();
});

test("le carnet : son état, son journal, ses amis et l'album, page après page", async ({ page }) => {
  const { sansErreur } = await ouvrirLeTamago(page);
  await naitre(page);
  const contenu = () => page.evaluate(() => (window as any).jeu.scene.getScene("tamago-carnet").contenu.text as string);
  expect(await ouvrirLeCarnet(page)).toContain("Ptiou");
  await appuyer(page, "ArrowRight");
  expect(await contenu()).toContain("nouveau-né · 🐣 Il est né !");
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

  // La place d'un objet de l'écran, en pixels de jeu
  function place(page: Page, lire: string) {
    return ecran<{ x: number; y: number }>(page, `(() => { const o = ${lire}; return { x: o.x, y: o.y }; })()`);
  }

  test("le jeu prend la largeur du téléphone : la console au milieu, de gros boutons sur les côtés", async ({ page }) => {
    const { sansErreur } = await ouvrirLeTamago(page);
    const { largeur } = await tailleDuJeu(page);
    expect(largeur).toBeGreaterThan(1100);
    const { console: c, rayon, gauche, droite } = await ecran<any>(page,
      "({ console: e.console, rayon: e.boutons[0].fond.radius, gauche: e.boutons[0].fond.x, droite: e.boutons[7].fond.x })");
    expect(c.x).toBe(Math.round(largeur / 2));
    expect(rayon).toBeGreaterThanOrEqual(38);
    // L'écran de la console grandit dans la place laissée par les boutons, et ce qu'il montre aussi
    expect(await ecran<number>(page, "e.ecran.largeur")).toBeGreaterThan(400);
    expect(await ecran<number>(page, "e.k")).toBeGreaterThan(1);
    expect(gauche).toBeLessThan(c.x - c.rx);
    expect(droite).toBeGreaterThan(c.x + c.rx);
    // Pas d'aide des touches au doigt
    expect(await ecran<unknown>(page, "e.aide")).toBeNull();
    sansErreur();
  });

  test("toucher l'œuf le réchauffe, toucher un bouton le soigne, toucher le Tamago le caresse", async ({ page }) => {
    const { sansErreur } = await ouvrirLeTamago(page);
    for (let i = 0; i < 5; i++) {
      const { x, y } = await place(page, "e.creature");
      await toucher(page, x, y - 40);
      await page.waitForTimeout(80);
    }
    expect((await etat(page)).tapes).toBe(5);
    await avancer(page, 5000);
    // Le bouton Repas : le premier, à gauche. Touché un peu à côté du rond : la zone déborde, pour le pouce
    const bouton = await place(page, "e.boutons[0].fond");
    await toucher(page, bouton.x + 44, bouton.y);
    expect((await etat(page)).ventre).toBe(3);
    // Une caresse compte pour la lignée Stylée
    await page.evaluate(() => (window as any).jeu.scene.getScene("tamago-ecran").tweens.killTweensOf(
      (window as any).jeu.scene.getScene("tamago-ecran").creature));
    const { x, y } = await place(page, "e.creature");
    await toucher(page, x, y - 40);
    expect((await etat(page)).points.style).toBe(1);
    sansErreur();
  });

  test("toucher une crotte la nettoie, et on tape le ROI CACA", async ({ page }) => {
    const { sansErreur } = await ouvrirLeTamago(page);
    await naitre(page);
    // Il ne se promène pas jusque sous les crottes : leurs zones ne se chevauchent pas
    await regler(page, { crottes: [0, 0], ventre: 4, moral: 4 });
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("tamago-ecran").crottes[1]?.scale === 1);
    expect(await ecran<boolean>(page,
      "e.promenadeMax() + e.creature.width / 2 < e.crottes[1].getBounds().left - 10")).toBe(true);
    // Toucher une crotte n'enlève qu'elle : la fraîche compte double pour la lignée Propre, la vieille simple
    expect((await etat(page)).points.propre).toBe(0);
    await regler(page, { crottes: [0, 2 * CROTTE_FRAICHE] });
    const premiere = await place(page, "e.crottes[0]");
    await toucher(page, premiere.x, premiere.y - 15);
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("tamago-ecran").etat.crottes.length === 1);
    expect((await etat(page)).points.propre).toBe(2);
    expect((await etat(page)).crottes[0]).toBeGreaterThanOrEqual(2 * CROTTE_FRAICHE);
    // L'autre prend sa place
    await page.waitForFunction((x) => Math.abs((window as any).jeu.scene.getScene("tamago-ecran").crottes[0].x - x) < 1, premiere.x);
    await toucher(page, premiere.x, premiere.y - 15);
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("tamago-ecran").etat.crottes.length === 0);
    expect((await etat(page)).points.propre).toBe(3);

    await regler(page, { roiCaca: 5 });
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("tamago-ecran").roi?.scale === 1);
    expect(await ecran<boolean>(page, "e.promenadeMax() + e.creature.width / 2 < e.roi.getBounds().left")).toBe(true);
    for (let coup = 4; coup >= 0; coup--) {
      const roi = await place(page, "e.roi");
      await toucher(page, roi.x, roi.y - 40);
      await page.waitForFunction((coup) => {
        const r = (window as any).jeu.scene.getScene("tamago-ecran").etat.roiCaca;
        return coup === 0 ? r === null : r === coup;
      }, coup);
    }
    sansErreur();
  });
});
