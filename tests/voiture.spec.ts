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

// ===== Le Grand Prix =====

// Le Grand Prix tel que le voit la scène de classement
function grandPrix(page: Page) {
  return page.evaluate(() => {
    const gp = (window as any).jeu.scene.getScene("voiture-grandprix").grandPrix;
    const points: Record<string, number> = {};
    for (const c of gp.concurrents) {
      points[c.nom] = c.points;
    }
    return { course: gp.course as number, points };
  });
}

test("le Grand Prix : les trois circuits, des rivaux de plus en plus forts, des points, un vainqueur", async ({ page }) => {
  const { sansErreur } = await menuVoiture(page);
  for (let i = 0; i < 3; i++) {
    await appuyer(page, "ArrowDown");
  }
  await appuyer(page, "Enter");

  const circuits = ["Le Vallon", "La Grande Boucle", "Le Huit"];
  const niveaux = [0.7, 0.75, 0.8];
  for (let n = 0; n < 3; n++) {
    await attendreScene(page, "voiture-course");
    expect(await course(page)).toMatchObject({ mode: "grandprix", circuit: circuits[n], voitures: 4 });
    const niveauDesRivaux = await page.evaluate(() =>
      (window as any).jeu.scene.getScene("voiture-course").voitures.slice(1).map((v: any) => v.niveau));
    expect(niveauDesRivaux).toEqual([niveaux[n], niveaux[n], niveaux[n]]);

    // Le joueur gagne : 10 points à chaque course, et les rivaux se partagent 7, 5 et 3
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("voiture-course").enCourse);
    await finirLaCourse(page);
    await attendreScene(page, "voiture-arrivee");
    await page.waitForTimeout(1100);
    await appuyer(page, "Enter");
    await attendreScene(page, "voiture-grandprix");
    expect(await scenesActives(page)).toEqual(["voiture-grandprix"]);
    const gp = await grandPrix(page);
    expect(gp.course).toBe(n);
    expect(gp.points["Toi"]).toBe(10 * (n + 1));
    const rivaux = Object.entries(gp.points).filter(([nom]) => nom !== "Toi").map(([, points]) => points);
    expect(rivaux.reduce((a, b) => a + b)).toBe((7 + 5 + 3) * (n + 1));
    await appuyer(page, "Enter");
  }

  // Après la dernière course : le vainqueur, puis le menu
  await attendreScene(page, "voiture-menu");
  sansErreur();
});

// ===== À deux =====

// Une touche telle qu'un clavier AZERTY l'envoie : sa place (code), sa lettre (key) et son keyCode.
// Le protocole de Chromium les donne séparément ; Playwright, lui, les déduit l'un de l'autre.
async function toucheAzerty(page: Page, type: "keyDown" | "keyUp", code: string, lettre: string, keyCode: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchKeyEvent", {
    type, code, key: lettre, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode,
  });
}

function vitesses(page: Page) {
  return page.evaluate(() =>
    (window as any).jeu.scene.getScene("voiture-course").joueurs.map((v: any) => v.vitesse) as number[]);
}

function cameras(page: Page) {
  return page.evaluate(() =>
    (window as any).jeu.scene.getScene("voiture-course").cameras.cameras.map((c: any) => [c.x, c.width]));
}

test("à deux : l'écran coupé en deux, et le joueur 2 sur Z Q S D d'un clavier AZERTY", async ({ page }) => {
  const { sansErreur } = await menuVoiture(page);
  await appuyer(page, "ArrowDown");
  await appuyer(page, "ArrowDown");
  await appuyer(page, "Enter");
  await attendreScene(page, "voiture-course");
  expect(await course(page)).toMatchObject({ mode: "duo", voitures: 2 });
  expect(await cameras(page)).toEqual([[0, 480], [480, 480]]);
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("voiture-course").enCourse);

  // La touche Z d'un AZERTY : la lettre « z » (keyCode 90), à la place du W d'un QWERTY
  await toucheAzerty(page, "keyDown", "KeyW", "z", 90);
  await page.waitForTimeout(800);
  let [j1, j2] = await vitesses(page);
  expect(j2).toBeGreaterThan(150);
  expect(j1).toBe(0);
  await toucheAzerty(page, "keyUp", "KeyW", "z", 90);

  // La même lettre « z », mais à la place du Z d'un QWERTY (en bas à gauche) : pas la touche du joueur 2
  await page.waitForTimeout(1000);         // le joueur 2 ralentit
  const avant = (await vitesses(page))[1];
  await toucheAzerty(page, "keyDown", "KeyZ", "z", 90);
  await page.waitForTimeout(500);
  expect((await vitesses(page))[1]).toBeLessThan(avant);
  await toucheAzerty(page, "keyUp", "KeyZ", "z", 90);

  // Le joueur 1 : les flèches
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(800);
  [j1] = await vitesses(page);
  expect(j1).toBeGreaterThan(150);
  await page.keyboard.up("ArrowUp");

  // Le joueur 2 arrive le premier : la course continue jusqu'au joueur 1
  await page.evaluate(() => {
    const c = (window as any).jeu.scene.getScene("voiture-course");
    c.joueurs[1].tour = 3;
    c.joueurs[1].progres = 3 * c.circuit.longueur;
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).jeu.scene.isActive("voiture-arrivee"))).toBe(false);
  await finirLaCourse(page);
  await attendreScene(page, "voiture-arrivee");
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("voiture-course").classement[0].nom)).toBe("Joueur 2");
  await page.waitForTimeout(1100);
  await appuyer(page, "Enter");
  await attendreScene(page, "voiture-menu");

  // Seul de nouveau : une seule caméra, sur tout l'écran
  await appuyer(page, "ArrowUp");
  await appuyer(page, "ArrowUp");
  await appuyer(page, "Enter");
  await attendreScene(page, "voiture-course");
  expect(await course(page)).toMatchObject({ mode: "chrono", voitures: 1 });
  expect(await cameras(page)).toEqual([[0, 960]]);
  sansErreur();
});

// ===== L'éditeur =====

function pointsDeLEditeur(page: Page) {
  return page.evaluate(() => (window as any).jeu.scene.getScene("voiture-editeur").points as { x: number; y: number }[]);
}

// Un point du monde (2600 × 1800) sur la carte de l'éditeur, en pixels du jeu
const surLaCarte = (x: number, y: number) => ({ x: 142 + x * 0.26, y: 40 + y * 0.26 });

async function cliquer(page: Page, x: number, y: number, bouton: "left" | "right" = "left") {
  const p = await versLaPage(page, surLaCarte(x, y).x, surLaCarte(x, y).y);
  await page.mouse.click(p.x, p.y, { button: bouton });
  await page.waitForTimeout(80);
}

const QUATRE_POINTS = [[500, 400], [2100, 400], [2100, 1400], [500, 1400]];

test("dessiner ton circuit à la souris : poser, glisser, enlever, puis courir dessus", async ({ page }) => {
  const { sansErreur } = await menuVoiture(page);
  await appuyer(page, "ArrowUp");          // le dernier mode : dessiner ton circuit
  await appuyer(page, "Enter");
  await attendreScene(page, "voiture-editeur");

  for (const [x, y] of QUATRE_POINTS) {
    await cliquer(page, x, y);
  }
  expect(await pointsDeLEditeur(page)).toHaveLength(4);

  // Le clic droit enlève le point 2, un clic en pose un autre ailleurs
  await cliquer(page, 2100, 400, "right");
  expect(await pointsDeLEditeur(page)).toHaveLength(3);
  await cliquer(page, 1300, 300);
  expect(await pointsDeLEditeur(page)).toHaveLength(4);

  // Glisser le point 1 : il suit la souris
  const depart = await versLaPage(page, surLaCarte(500, 400).x, surLaCarte(500, 400).y);
  const arrivee = await versLaPage(page, surLaCarte(700, 900).x, surLaCarte(700, 900).y);
  await page.mouse.move(depart.x, depart.y);
  await page.mouse.down();
  await page.mouse.move(arrivee.x, arrivee.y, { steps: 8 });
  await page.mouse.up();
  const points = await pointsDeLEditeur(page);
  expect(points).toHaveLength(4);
  expect(Math.abs(points[0].x - 700)).toBeLessThan(10);
  expect(Math.abs(points[0].y - 900)).toBeLessThan(10);

  // Entrée : enregistré sous le nom de l'ancien jeu, et montré dans le menu
  await appuyer(page, "Enter");
  await attendreScene(page, "voiture-menu");
  const garde = await page.evaluate(() => JSON.parse(localStorage.getItem("course-de-pixy/points-du-circuit")!));
  expect(garde).toEqual(points);
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("voiture-menu").nomCircuit.text)).toBe("Mon circuit");

  // On court dessus (contre la montre : le mode qui suit le dernier)
  await appuyer(page, "ArrowDown");
  await appuyer(page, "Enter");
  await attendreScene(page, "voiture-course");
  expect(await course(page)).toMatchObject({ mode: "chrono", circuit: "Mon circuit" });
  expect(await page.evaluate(() => (window as any).jeu.textures.exists("voiture-piste-circuit-dessine"))).toBe(true);

  // Un record sur ce circuit, puis on le redessine : le record est effacé, la piste sera refaite
  await page.evaluate(() => localStorage.setItem("course-de-pixy/circuit-dessine", JSON.stringify({ temps: 12, fantome: [] })));
  await appuyer(page, "Escape");
  await attendreScene(page, "voiture-menu");
  await appuyer(page, "ArrowUp");
  await appuyer(page, "Enter");
  await attendreScene(page, "voiture-editeur");
  expect(await pointsDeLEditeur(page)).toEqual(points);
  await cliquer(page, 1300, 1600);
  await appuyer(page, "Enter");
  await attendreScene(page, "voiture-menu");
  expect(await page.evaluate(() => localStorage.getItem("course-de-pixy/circuit-dessine"))).toBeNull();
  expect(await page.evaluate(() => (window as any).jeu.textures.exists("voiture-piste-circuit-dessine"))).toBe(false);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("course-de-pixy/points-du-circuit")!).length)).toBe(5);
  sansErreur();
});

test("l'éditeur : avec moins de 4 points, Entrée revient sans rien enregistrer", async ({ page }) => {
  const { sansErreur } = await menuVoiture(page);
  await appuyer(page, "ArrowUp");
  await appuyer(page, "Enter");
  await attendreScene(page, "voiture-editeur");
  await cliquer(page, 500, 400);
  await cliquer(page, 2100, 400);
  await appuyer(page, "Enter");
  await attendreScene(page, "voiture-menu");
  expect(await page.evaluate(() => localStorage.getItem("course-de-pixy/points-du-circuit"))).toBeNull();
  sansErreur();
});

test.describe("l'éditeur au doigt", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test("pas de course à deux au doigt ; toucher pose un point, toucher un point l'enlève, ✔ enregistre", async ({ page }) => {
    const { sansErreur } = await ouvrir(page);
    await toucher(page, 225, 225);
    await attendreScene(page, "voiture-menu");
    const modes = await page.evaluate(() => (window as any).jeu.scene.getScene("voiture-menu").modes.map((m: any) => m.id));
    expect(modes).toEqual(["chrono", "course", "grandprix", "editeur"]);
    await toucher(page, 710, 426);         // « Dessiner ton circuit », le quatrième bouton
    await attendreScene(page, "voiture-editeur");

    const poser = async (x: number, y: number) => {
      await toucher(page, surLaCarte(x, y).x, surLaCarte(x, y).y);
      await page.waitForTimeout(80);
    };
    for (const [x, y] of QUATRE_POINTS) {
      await poser(x, y);
    }
    expect(await pointsDeLEditeur(page)).toHaveLength(4);
    await poser(2100, 400);                // toucher le point 2 sans le glisser : il s'en va
    expect(await pointsDeLEditeur(page)).toHaveLength(3);
    await poser(1300, 300);
    expect(await pointsDeLEditeur(page)).toHaveLength(4);

    // Glisser le point 1 du bout du doigt : il bouge, et il n'est pas enlevé en lâchant
    const cdp = await page.context().newCDPSession(page);
    const de = await versLaPage(page, surLaCarte(500, 400).x, surLaCarte(500, 400).y);
    const vers = await versLaPage(page, surLaCarte(800, 800).x, surLaCarte(800, 800).y);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: de.x, y: de.y, id: 1 }] });
    for (let k = 1; k <= 8; k++) {
      const x = de.x + (vers.x - de.x) * k / 8;
      const y = de.y + (vers.y - de.y) * k / 8;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y, id: 1 }] });
      await page.waitForTimeout(20);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(100);
    const points = await pointsDeLEditeur(page);
    expect(points).toHaveLength(4);
    expect(Math.abs(points[0].x - 800)).toBeLessThan(15);
    expect(Math.abs(points[0].y - 800)).toBeLessThan(15);

    await toucher(page, 885, 270);         // ✔
    await attendreScene(page, "voiture-menu");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("course-de-pixy/points-du-circuit")!).length)).toBe(4);
    sansErreur();
  });
});
