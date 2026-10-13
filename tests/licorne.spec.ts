import { test, expect, type Page } from "@playwright/test";
import { ouvrir, appuyer, attendreScene, scenesActives, versLaPage, toucher } from "./outils";

// Du Hub jusqu'au menu des licornes (la deuxième carte)
async function menuLicornes(page: Page) {
  const ouverte = await ouvrir(page);
  await appuyer(page, "ArrowRight");
  await appuyer(page, "Enter");
  await attendreScene(page, "licorne-menu");
  return ouverte;
}

// L'état de la course, lu dans la scène Phaser
function course(page: Page) {
  return page.evaluate(() => {
    const c = (window as any).jeu.scene.getScene("licorne-course");
    const j = c.joueuses[0];
    return {
      mode: c.donnees.mode as string,
      circuit: c.circuit.modele.id as string,
      licornes: c.licornes.length as number,
      joueuses: c.joueuses.length as number,
      cameras: c.cameras.cameras.length as number,
      enCourse: c.enCourse as boolean,
      vitesse: j.vitesse as number,
      vitesseJ2: (c.joueuses[1]?.vitesse ?? 0) as number,
      etoiles: j.etoiles as number,
      turbo: j.turbo as number,
      tactile: { ...c.tactile } as Record<string, boolean>,
    };
  });
}

async function attendreLeDepart(page: Page) {
  await attendreScene(page, "licorne-course");
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("licorne-course").enCourse, null, { timeout: 10_000 });
}

// La joueuse vient de finir son dernier tour
function finirLaCourse(page: Page) {
  return page.evaluate(() => {
    const c = (window as any).jeu.scene.getScene("licorne-course");
    const j = c.joueuses[0];
    j.tour = 3;
    j.progres = 3 * c.circuit.longueur;
  });
}

// Pose la joueuse sur un objet du circuit (une étoile, un orage, un bonbon...)
function poserSur(page: Page, liste: "etoiles" | "orages" | "bonbons") {
  return page.evaluate((liste) => {
    const c = (window as any).jeu.scene.getScene("licorne-course");
    const objet = c[liste][0];
    const j = c.joueuses[0];
    j.x = objet.x;
    j.y = objet.y;
    // Son point sur la trace, cherché partout : elle ne cherche d'habitude qu'autour du précédent
    let meilleur = 0;
    c.circuit.trace.forEach((p: any, i: number) => {
      const t = c.circuit.trace[meilleur];
      if ((p.x - j.x) ** 2 + (p.y - j.y) ** 2 < (t.x - j.x) ** 2 + (t.y - j.y) ** 2) {
        meilleur = i;
      }
    });
    j.indice = meilleur;
  }, liste);
}

const sauvegarde = (page: Page, cle: string) => page.evaluate((cle) => localStorage.getItem(cle), cle);

test("le Hub ouvre les licornes, et Échap y revient", async ({ page }) => {
  const { sansErreur } = await menuLicornes(page);
  expect(await scenesActives(page)).toEqual(["licorne-musique", "licorne-menu"]);
  await appuyer(page, "Escape");
  await attendreScene(page, "Hub");
  expect(await scenesActives(page)).toEqual(["Hub"]);
  sansErreur();
});

test("Grand Prix : quatre licornes, le départ, l'arrivée, les points, la course suivante, le podium", async ({ page }) => {
  const { sansErreur } = await menuLicornes(page);
  await appuyer(page, "Enter");            // Grand Prix, le premier mode
  await attendreScene(page, "licorne-course");
  expect(await scenesActives(page)).toEqual(["licorne-musique", "licorne-course", "licorne-tableau"]);
  expect(await course(page)).toMatchObject({ mode: "gp", circuit: "coeur", licornes: 4, joueuses: 1, cameras: 1, enCourse: false });

  // 3, 2, 1 : la course commence, et la licorne galope
  await attendreLeDepart(page);
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(1200);
  expect((await course(page)).vitesse).toBeGreaterThan(200);
  await page.keyboard.up("ArrowUp");

  // Les rivales courent toutes seules
  const rivales = await page.evaluate(() =>
    (window as any).jeu.scene.getScene("licorne-course").licornes.slice(1).map((l: any) => l.vitesse));
  for (const vitesse of rivales) {
    expect(vitesse).toBeGreaterThan(100);
  }

  await finirLaCourse(page);
  await attendreScene(page, "licorne-arrivee");
  await page.waitForTimeout(1100);         // l'arrivée attend un peu avant d'écouter
  await appuyer(page, "Enter");
  await attendreScene(page, "licorne-grand-prix");
  const points = await page.evaluate(() => {
    const s = (window as any).jeu.scene.getScene("licorne-grand-prix");
    return s.scene.settings.data.grandPrix.points;
  });
  expect(Object.values(points).sort()).toEqual([10, 3, 5, 7]);

  // La course suivante : le Vallon des Nuages
  await page.waitForTimeout(700);
  await appuyer(page, "Enter");
  await attendreScene(page, "licorne-course");
  expect((await course(page)).circuit).toBe("vallon");

  // On saute à la fin du Grand Prix : le podium, puis le menu
  await page.evaluate(() => {
    const c = (window as any).jeu.scene.getScene("licorne-course");
    c.donnees.grandPrix.etape = 4;
  });
  await attendreLeDepart(page);
  await finirLaCourse(page);
  await attendreScene(page, "licorne-arrivee");
  await page.waitForTimeout(1100);
  await appuyer(page, "Enter");
  await attendreScene(page, "licorne-grand-prix");
  await page.waitForTimeout(700);
  await appuyer(page, "Enter");
  await attendreScene(page, "licorne-podium");
  await page.waitForTimeout(1100);
  await appuyer(page, "Enter");
  await attendreScene(page, "licorne-menu");
  sansErreur();
});

test("course à deux : l'écran partagé, ZQSD pour la deuxième, et les rivales en option", async ({ page }) => {
  const { sansErreur } = await menuLicornes(page);
  await appuyer(page, "ArrowDown");
  await appuyer(page, "Enter");
  await attendreScene(page, "licorne-circuits");
  await appuyer(page, "r");                // deux rivales...
  expect(await sauvegarde(page, "licornes-rivales")).toBe("2");
  await appuyer(page, "r");                // ... ou aucune : juste nous deux
  expect(await sauvegarde(page, "licornes-rivales")).toBe("0");
  await appuyer(page, "ArrowRight");       // le Vallon des Nuages
  await appuyer(page, "Enter");
  await attendreScene(page, "licorne-course");
  expect(await course(page)).toMatchObject({ mode: "duo", circuit: "vallon", licornes: 2, joueuses: 2, cameras: 2 });
  expect(await sauvegarde(page, "licornes-circuit-id")).toBe("vallon");   // en texte brut, comme l'ancien jeu

  // La deuxième joueuse galope avec Z (KeyW, la même place sur tous les claviers) ; la première ne bouge pas
  await attendreLeDepart(page);
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1000);
  const etat = await course(page);
  await page.keyboard.up("KeyW");
  expect(etat.vitesseJ2).toBeGreaterThan(200);
  expect(etat.vitesse).toBeLessThan(10);

  // Les deux joueuses doivent finir pour voir l'arrivée
  await page.evaluate(() => {
    const c = (window as any).jeu.scene.getScene("licorne-course");
    for (const j of c.joueuses) {
      j.tour = 3;
      j.progres = 3 * c.circuit.longueur;
    }
  });
  await attendreScene(page, "licorne-arrivee");
  await page.waitForTimeout(1100);
  await appuyer(page, "r");                // rejouer
  await attendreLeDepart(page);
  expect(await course(page)).toMatchObject({ mode: "duo", circuit: "vallon", joueuses: 2 });
  await appuyer(page, "Escape");
  await attendreScene(page, "licorne-menu");
  expect(await scenesActives(page)).toEqual(["licorne-musique", "licorne-menu"]);
  sansErreur();
});

test("contre la montre : le record est gardé, et le fantôme apparaît", async ({ page }) => {
  const { sansErreur } = await menuLicornes(page);
  await appuyer(page, "ArrowDown");
  await appuyer(page, "ArrowDown");
  await appuyer(page, "Enter");
  await attendreScene(page, "licorne-circuits");
  await appuyer(page, "Enter");
  await attendreLeDepart(page);
  expect(await course(page)).toMatchObject({ mode: "chrono", circuit: "coeur", licornes: 1 });
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(2000);
  await page.keyboard.up("ArrowUp");
  await finirLaCourse(page);
  await attendreScene(page, "licorne-arrivee");

  const record = JSON.parse((await sauvegarde(page, "licornes-record-coeur"))!);
  expect(record.temps).toBeGreaterThan(1);
  expect(record.fantome.length).toBeGreaterThan(50);

  // Rejouer : le fantôme galope devant
  await page.waitForTimeout(1100);
  await appuyer(page, "r");
  await attendreLeDepart(page);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("licorne-course").ombre.visible)).toBe(true);
  sansErreur();
});

test("les bonus : l'étoile et son turbo, l'orage qui étourdit, le bonbon qui rend géante", async ({ page }) => {
  const { sansErreur } = await menuLicornes(page);
  await appuyer(page, "ArrowDown");
  await appuyer(page, "ArrowDown");
  await appuyer(page, "Enter");
  await attendreScene(page, "licorne-circuits");
  await appuyer(page, "ArrowRight");
  await appuyer(page, "ArrowRight");       // le Grand Huit : des étoiles, des orages et un bonbon
  await appuyer(page, "Enter");
  await attendreLeDepart(page);

  await poserSur(page, "orages");
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("licorne-course").joueuses[0].etourdie)).toBeGreaterThan(0);

  await poserSur(page, "bonbons");
  await page.waitForTimeout(150);
  const geante = await page.evaluate(() => {
    const j = (window as any).jeu.scene.getScene("licorne-course").joueuses[0];
    return { geante: j.geante, etourdie: j.etourdie };
  });
  expect(geante.geante).toBeGreaterThan(5);
  expect(geante.etourdie).toBe(0);          // le bonbon guérit de l'étourdissement

  await poserSur(page, "etoiles");
  await page.waitForTimeout(150);
  expect((await course(page)).etoiles).toBe(1);
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("licorne-course").etoiles[0].visible)).toBe(false);
  await appuyer(page, "Space");            // seule, Espace lance aussi le turbo
  expect((await course(page)).turbo).toBeGreaterThan(1);
  sansErreur();
});

test("le repêchage : une licorne coincée dans les nuages revient sur la route", async ({ page }) => {
  const { sansErreur } = await menuLicornes(page);
  await appuyer(page, "Enter");
  await attendreLeDepart(page);
  const loin = await page.evaluate(() => {
    const c = (window as any).jeu.scene.getScene("licorne-course");
    const j = c.joueuses[0];
    const p = c.circuit.trace[j.indice];
    j.x = p.x + p.nx * 140;              // contre la barrière de nuages
    j.y = p.y + p.ny * 140;
    return Math.hypot(j.x - p.x, j.y - p.y);
  });
  expect(loin).toBeGreaterThan(100);
  // REPECHAGE : 3 secondes sans avancer (du temps de jeu : sur une machine chargée, un peu plus)
  await page.waitForFunction(() => {
    const c = (window as any).jeu.scene.getScene("licorne-course");
    const j = c.joueuses[0];
    const p = c.circuit.trace[j.indice];
    return Math.hypot(j.x - p.x, j.y - p.y) < 20;
  }, null, { timeout: 10_000 });
  sansErreur();
});

test("la pause : P arrête tout, P repart, Échap revient au menu", async ({ page }) => {
  const { sansErreur } = await menuLicornes(page);
  await appuyer(page, "Enter");
  await attendreLeDepart(page);
  await appuyer(page, "p");
  await attendreScene(page, "licorne-pause");
  expect(await page.evaluate(() => (window as any).jeu.scene.isPaused("licorne-course"))).toBe(true);
  await appuyer(page, "p");
  await page.waitForFunction(() => !(window as any).jeu.scene.isPaused("licorne-course"));
  await appuyer(page, "p");
  await attendreScene(page, "licorne-pause");
  await appuyer(page, "Escape");
  await attendreScene(page, "licorne-menu");
  expect(await scenesActives(page)).toEqual(["licorne-musique", "licorne-menu"]);
  sansErreur();
});

test("l'atelier : le nom tapé au clavier et la robe sont gardés", async ({ page }) => {
  const { sansErreur } = await menuLicornes(page);
  for (let i = 0; i < 3; i++) {
    await appuyer(page, "ArrowDown");
  }
  await appuyer(page, "Enter");
  await attendreScene(page, "licorne-atelier");
  // La ligne du nom est choisie d'entrée : on efface « Paillette », on tape « Zou »
  for (let i = 0; i < 9; i++) {
    await appuyer(page, "Backspace");
  }
  for (const lettre of "Zou") {
    await appuyer(page, lettre);
  }
  await appuyer(page, "ArrowDown");        // sa robe
  await appuyer(page, "ArrowRight");
  const perso = JSON.parse((await sauvegarde(page, "licornes-perso"))!);
  expect(perso[0].nom).toBe("Zou");
  expect(perso[0].corps).toBe("#ffd9ec");   // la couleur d'après la sienne
  await appuyer(page, "Escape");
  await attendreScene(page, "licorne-menu");
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("licorne-menu").cartes[0].nom.text)).toBe("Zou");
  sansErreur();
});

test("l'éditeur : quatre points à la souris, et le circuit rejoint la liste", async ({ page }) => {
  const { sansErreur } = await menuLicornes(page);
  for (let i = 0; i < 4; i++) {
    await appuyer(page, "ArrowDown");
  }
  await appuyer(page, "Enter");
  await attendreScene(page, "licorne-editeur");
  await appuyer(page, "Enter");            // trop tôt : il faut 4 points
  await attendreScene(page, "licorne-editeur");
  for (const [x, y] of [[250, 150], [700, 140], [760, 450], [260, 470]]) {
    const p = await versLaPage(page, x, y);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(80);
  }
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("licorne-editeur").points.length)).toBe(4);
  await appuyer(page, "Enter");
  await attendreScene(page, "licorne-menu");
  expect(JSON.parse((await sauvegarde(page, "licornes-circuit-perso"))!).length).toBe(4);
  expect(await sauvegarde(page, "licornes-circuit-id")).toBe("perso");

  // Au contre-la-montre, le circuit dessiné est déjà choisi
  await appuyer(page, "ArrowUp");          // de « Dessiner un circuit » à « Atelier »...
  await appuyer(page, "ArrowUp");          // ... puis « Contre la montre »
  await appuyer(page, "Enter");
  await attendreScene(page, "licorne-circuits");
  await appuyer(page, "Enter");
  await attendreLeDepart(page);
  expect((await course(page)).circuit).toBe("perso");
  sansErreur();
});

test("les sauvegardes de l'ancien jeu sont reprises telles quelles", async ({ page }) => {
  // L'ancien jeu rangeait le niveau et le circuit en texte brut, les licornes en nombres
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("deja")) {
      sessionStorage.setItem("deja", "1");
      localStorage.setItem("licornes-niveau", "expert");
      localStorage.setItem("licornes-j1", "3");
      localStorage.setItem("licornes-j2", "5");
      localStorage.setItem("licornes-circuit-id", "etoile");
      localStorage.setItem("licornes-perso", JSON.stringify({ 3: {
        nom: "Biscotte", corps: "#fff3b0", criniere: ["#ff4f9a", "#ffffff", "#ff9fcf"], corne: "arc", accessoire: "couronne",
      } }));
    }
  });
  const { sansErreur } = await menuLicornes(page);
  const menu = await page.evaluate(() => {
    const m = (window as any).jeu.scene.getScene("licorne-menu");
    return { j1: m.cartes[0].nom.text, j2: m.cartes[1].nom.text };
  });
  expect(menu).toEqual({ j1: "Biscotte", j2: "Nuit étoilée" });

  // Le niveau passe d'Expert à Facile, et reste en texte brut
  await appuyer(page, "n");
  expect(await sauvegarde(page, "licornes-niveau")).toBe("facile");

  await appuyer(page, "ArrowDown");
  await appuyer(page, "ArrowDown");
  await appuyer(page, "Enter");
  await attendreScene(page, "licorne-circuits");
  await appuyer(page, "Enter");
  await attendreScene(page, "licorne-course");
  const etat = await page.evaluate(() => {
    const c = (window as any).jeu.scene.getScene("licorne-course");
    return { circuit: c.circuit.modele.id, nom: c.joueuses[0].nom, direction: c.aides.direction };
  });
  expect(etat).toEqual({ circuit: "etoile", nom: "Biscotte", direction: 0.8 });   // Facile : l'aide au pilotage
  sansErreur();
});

test.describe("au doigt", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test("pas de course à deux, la licorne galope seule, ◀ ▶ tournent, et le bouton pause", async ({ page }) => {
    const { sansErreur } = await ouvrir(page);
    await toucher(page, 480, 200);         // la carte des licornes
    await attendreScene(page, "licorne-menu");
    const modes = await page.evaluate(() =>
      (window as any).jeu.scene.getScene("licorne-menu").modes.map((m: any) => m.id));
    expect(modes).toEqual(["gp", "chrono", "atelier", "editeur"]);

    await toucher(page, 610, 181);         // « Contre la montre »
    await attendreScene(page, "licorne-circuits");
    await toucher(page, 480, 514);         // « Partir ! »
    await attendreLeDepart(page);
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

    await toucher(page, 480, 32);          // la pause
    await attendreScene(page, "licorne-pause");
    sansErreur();
  });
});
