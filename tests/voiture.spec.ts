import { test, expect, type Page } from "@playwright/test";
import { ouvrir, appuyer, attendreScene, scenesActives, versLaPage, toucher } from "./outils";

// Du Hub jusqu'au menu de la course de voitures
async function menuVoiture(page: Page) {
  const ouverte = await ouvrir(page);
  await appuyer(page, "Enter");
  await attendreScene(page, "voiture-menu");
  return ouverte;
}

// L'état de la course, lu dans la scène Phaser
function course(page: Page) {
  return page.evaluate(() => {
    const c = (window as any).jeu.scene.getScene("voiture-course");
    return {
      mode: c.mode as string,
      circuit: c.circuit.modele.nom as string,
      voitures: c.voitures.length as number,
      enCourse: c.enCourse as boolean,
      vitesse: c.joueur.vitesse as number,
      tactile: { ...c.tactile } as Record<string, boolean>,
    };
  });
}

// Le joueur vient de finir son dernier tour
function finirLaCourse(page: Page) {
  return page.evaluate(() => {
    const c = (window as any).jeu.scene.getScene("voiture-course");
    c.joueur.tour = 3;
    c.joueur.progres = 3 * c.circuit.longueur;
  });
}

test("contre l'ordinateur : quatre voitures, le départ, l'arrivée, le retour", async ({ page }) => {
  const { sansErreur } = await menuVoiture(page);
  await appuyer(page, "ArrowRight");       // le circuit suivant
  await appuyer(page, "ArrowDown");        // contre l'ordinateur
  await appuyer(page, "Enter");
  await attendreScene(page, "voiture-course");
  expect(await scenesActives(page)).toEqual(["voiture-course", "voiture-tableau"]);
  expect(await course(page)).toMatchObject({ mode: "course", circuit: "La Grande Boucle", voitures: 4, enCourse: false });

  // 3, 2, 1 : la course commence, et la voiture avance
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("voiture-course").enCourse);
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(1000);
  expect((await course(page)).vitesse).toBeGreaterThan(200);
  await page.keyboard.up("ArrowUp");

  await finirLaCourse(page);
  await attendreScene(page, "voiture-arrivee");
  await page.waitForTimeout(1100);         // l'arrivée attend un peu avant d'écouter
  await appuyer(page, "Enter");
  await attendreScene(page, "voiture-menu");
  expect(await scenesActives(page)).toEqual(["voiture-menu"]);

  await appuyer(page, "Escape");
  await attendreScene(page, "Hub");
  sansErreur();
});

test("contre la montre : le record est gardé, et le fantôme apparaît", async ({ page }) => {
  const { sansErreur } = await menuVoiture(page);
  await appuyer(page, "Enter");
  await attendreScene(page, "voiture-course");
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("voiture-course").enCourse);
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(2000);
  await page.keyboard.up("ArrowUp");
  await finirLaCourse(page);
  await attendreScene(page, "voiture-arrivee");

  const record = await page.evaluate(() => JSON.parse(localStorage.getItem("course-de-pixy/mon-premier-circuit")!));
  expect(record.temps).toBeGreaterThan(1);
  expect(record.fantome.length).toBeGreaterThan(50);

  // Une nouvelle course sur le même circuit : le fantôme est là
  await page.waitForTimeout(1100);
  await appuyer(page, "Enter");
  await attendreScene(page, "voiture-menu");
  await appuyer(page, "Enter");
  await attendreScene(page, "voiture-course");
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("voiture-course").enCourse);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("voiture-course").fantome.visible)).toBe(true);
  sansErreur();
});

test("dans l'herbe aussi, le tour compte pile sur la ligne", async ({ page }) => {
  const { sansErreur } = await menuVoiture(page);
  await appuyer(page, "Enter");
  await attendreScene(page, "voiture-course");
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("voiture-course").enCourse);

  // L'ordinateur conduit le joueur dans l'herbe, à 105 pixels du milieu de la route, et on le pose
  // 400 pixels avant la ligne, à la fin de son premier tour
  await page.evaluate(() => {
    const c = (window as any).jeu.scene.getScene("voiture-course");
    const j = c.joueur;
    const trace = c.circuit.trace;
    const i = trace.length - 40;
    j.ordinateur = true;
    j.couloir = 105;
    j.body.reset(trace[i].x - Math.sin(trace[i].angle) * 105, trace[i].y + Math.cos(trace[i].angle) * 105);
    j.setRotation(trace[i].angle);
    j.indice = i;
    j.progres = trace[i].d;
  });
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("voiture-course").joueur.tour === 2, null, { timeout: 15_000 });

  // Où est-elle, au moment où le tour compte ? Sa distance à la ligne, dans le sens de la course
  const apresLaLigne = await page.evaluate(() => {
    const c = (window as any).jeu.scene.getScene("voiture-course");
    const ligne = c.circuit.portes[0];
    const a = c.circuit.angleDepart;
    return (c.joueur.x - ligne.x) * Math.cos(a) + (c.joueur.y - ligne.y) * Math.sin(a);
  });
  expect(apresLaLigne).toBeGreaterThan(-15);    // les points de la trace sont à 10 pixels l'un de l'autre
  expect(apresLaLigne).toBeLessThan(15);
  sansErreur();
});

test.describe("au doigt", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test("on choisit au doigt, la voiture accélère seule, et ◀ ▶ tournent", async ({ page }) => {
    const { sansErreur } = await ouvrir(page);
    await toucher(page, 225, 225);         // la carte de la course de voitures
    await attendreScene(page, "voiture-menu");
    await toucher(page, 710, 132);         // « Contre la montre »
    await attendreScene(page, "voiture-course");
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("voiture-course").enCourse);
    await page.waitForTimeout(800);
    expect((await course(page)).vitesse).toBeGreaterThan(100);

    // Un doigt posé sur ▶ et qui y reste : on passe par le protocole de Chromium pour le tenir
    const cdp = await page.context().newCDPSession(page);
    const droite = await versLaPage(page, 238, 448);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: droite.x, y: droite.y, id: 1 }] });
    await page.waitForTimeout(200);
    expect((await course(page)).tactile).toMatchObject({ droite: true, gauche: false });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(200);
    expect((await course(page)).tactile.droite).toBe(false);
    sansErreur();
  });
});
