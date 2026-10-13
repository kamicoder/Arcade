import { test, expect, type Page } from "@playwright/test";
import { ouvrir, appuyer, attendreScene, scenesActives, versLaPage, toucher } from "./outils";

// Du Hub jusqu'au titre de la baston : la quatrième carte, sous la première
async function titreBaston(page: Page) {
  const ouverte = await ouvrir(page);
  await appuyer(page, "ArrowDown");
  await appuyer(page, "Enter");
  await attendreScene(page, "baston-titre");
  return ouverte;
}

// L'état du combat, lu dans la scène Phaser
function combat(page: Page) {
  return page.evaluate(() => {
    const c = (window as any).jeu.scene.getScene("baston-combat");
    const robot = (r: any) => ({
      vie: r.vie as number,
      jauge: r.jauge as number,
      etat: r.etat as string,
      x: r.centreX as number,
      tirs: r.listeDesTirs.length as number,
      modele: r.modele.nom as string,
    });
    return {
      solo: c.solo as boolean,
      phase: c.phase as string,
      manches: { ...c.manches } as { gauche: number; droite: number },
      gauche: robot(c.gauche),
      droite: robot(c.droite),
      tactile: { ...c.tactile } as Record<string, boolean>,
    };
  });
}

function attendrePhase(page: Page, phase: string) {
  return page.waitForFunction((phase) => (window as any).jeu.scene.getScene("baston-combat")?.phase === phase,
    phase, { timeout: 15_000 });
}

// Pour des coups bien réglés : l'orange ne fait plus rien (le pilote de l'ordinateur, ou du joueur 2,
// est remplacé par un qui ne demande rien), et on place les robots où on veut, au sol
async function placer(page: Page, xGauche: number, xDroite: number) {
  await page.evaluate(([xg, xd]) => {
    const c = (window as any).jeu.scene.getScene("baston-combat");
    c.pilotes.droite = () => ({ gauche: false, droite: false, saut: false, frapper: false, tirer: false, special: false });
    c.gauche.body.reset(xg, 430);
    c.droite.body.reset(xd, 430);
  }, [xGauche, xDroite]);
}

// Le robot gauche a fini son coup, et l'orange peut de nouveau être touché
async function souffler(page: Page) {
  await page.waitForFunction(() => {
    const c = (window as any).jeu.scene.getScene("baston-combat");
    return ["repos", "marche"].includes(c.gauche.etat);
  });
  await page.evaluate(() => {
    (window as any).jeu.scene.getScene("baston-combat").droite.invincible = 0;
  });
}

// Seul contre l'ordinateur : O au titre, F (ou Entrée) pour valider son robot
async function combatSolo(page: Page) {
  const ouverte = await titreBaston(page);
  await appuyer(page, "o");
  await attendreScene(page, "baston-choix");
  await appuyer(page, "f");
  await attendreScene(page, "baston-combat");
  await attendrePhase(page, "combat");
  return ouverte;
}

test("contre l'ordinateur : les coups de poing touchent, et un K.O. finit la manche", async ({ page }) => {
  const { sansErreur } = await titreBaston(page);
  await appuyer(page, "o");
  await attendreScene(page, "baston-choix");
  await appuyer(page, "f");
  await attendreScene(page, "baston-combat");
  expect(await scenesActives(page)).toEqual(["baston-combat", "baston-tableau"]);
  expect(await combat(page)).toMatchObject({ solo: true, phase: "debut", gauche: { modele: "Le classique", vie: 100 } });

  // L'annonce de la manche, puis le combat
  await attendrePhase(page, "combat");
  await placer(page, 400, 450);
  await appuyer(page, "f");
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("baston-combat").droite.vie < 100);
  let etat = await combat(page);
  expect(etat.droite.vie).toBe(92);        // le classique frappe à 8
  expect(etat.droite.etat).toBe("touche");
  expect(etat.gauche.jauge).toBe(15);      // toucher remplit la jauge...
  expect(etat.droite.jauge).toBe(10);      // ... encaisser aussi

  // Garder la touche ne refrappe pas : un nouvel appui, si
  await souffler(page);
  await placer(page, 400, 450);            // le coup l'a fait reculer : on le remet à portée
  await page.evaluate(() => {
    (window as any).jeu.scene.getScene("baston-combat").droite.vie = 5;
  });
  await appuyer(page, "f");
  await attendrePhase(page, "ko");
  etat = await combat(page);
  expect(etat.droite).toMatchObject({ vie: 0, etat: "ko" });
  expect(etat.manches).toEqual({ gauche: 1, droite: 0 });

  // Après le K.O. (et son ralenti), la manche 2 commence avec deux robots neufs
  await attendrePhase(page, "debut");
  etat = await combat(page);
  expect(etat.manches).toEqual({ gauche: 1, droite: 0 });
  expect(etat.gauche.vie).toBe(100);
  expect(etat.droite.vie).toBe(100);
  sansErreur();
});

test("le tir, puis le coup spécial quand la jauge est pleine", async ({ page }) => {
  const { sansErreur } = await combatSolo(page);
  await placer(page, 200, 600);

  await appuyer(page, "g");
  let etat = await combat(page);
  expect(etat.gauche.etat).toBe("tir");
  expect(etat.gauche.tirs).toBe(1);
  // Il file jusqu'à l'orange, le touche, et disparaît
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("baston-combat").droite.vie < 100);
  etat = await combat(page);
  expect(etat.droite.vie).toBe(94);
  expect(etat.gauche.jauge).toBe(10);
  expect(etat.gauche.tirs).toBe(0);

  // La jauge pleine : tirer lance le coup spécial (celui du classique : un tir énorme, 25 de dégâts)
  await souffler(page);
  await page.evaluate(() => {
    (window as any).jeu.scene.getScene("baston-combat").gauche.jauge = 100;
  });
  await appuyer(page, "g");
  etat = await combat(page);
  expect(etat.gauche.etat).toBe("special");
  expect(etat.gauche.jauge).toBe(0);
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("baston-combat").droite.vie < 94);
  expect((await combat(page)).droite.vie).toBe(94 - 25);
  sansErreur();
});

test("la fin du match : le vainqueur, le bilan gardé, et la revanche", async ({ page }) => {
  const { sansErreur } = await combatSolo(page);
  await placer(page, 400, 450);
  await page.evaluate(() => {
    const c = (window as any).jeu.scene.getScene("baston-combat");
    c.manches.gauche = 1;                  // il a déjà gagné une manche
    c.droite.vie = 1;
  });
  await appuyer(page, "f");
  await attendreScene(page, "baston-fin");
  expect((await combat(page)).phase).toBe("fini");
  const bilan = await page.evaluate(() => JSON.parse(localStorage.getItem("baston/contre-ordinateur")!));
  expect(bilan).toEqual({ victoires: 1, defaites: 0 });

  // La fin attend un peu avant d'écouter ; Entrée : la revanche, avec les mêmes robots
  await page.waitForTimeout(900);
  await appuyer(page, "Enter");
  await page.waitForFunction(() => !(window as any).jeu.scene.isActive("baston-fin"));
  await attendrePhase(page, "debut");
  expect((await combat(page)).manches).toEqual({ gauche: 0, droite: 0 });
  expect(await scenesActives(page)).toEqual(["baston-combat", "baston-tableau"]);

  // Échap : le titre, puis l'Arcade
  await appuyer(page, "Escape");
  await attendreScene(page, "baston-titre");
  await appuyer(page, "Escape");
  await attendreScene(page, "Hub");
  sansErreur();
});

test("à deux sur le même clavier : chacun ses touches et son robot", async ({ page }) => {
  const { sansErreur } = await titreBaston(page);
  await appuyer(page, "d");
  await attendreScene(page, "baston-choix");
  await appuyer(page, "d");                // le bleu passe au lourd
  await appuyer(page, "ArrowLeft");        // l'orange recule jusqu'au rapide
  await appuyer(page, "f");
  await appuyer(page, "k");
  await attendreScene(page, "baston-combat");
  let etat = await combat(page);
  expect(etat).toMatchObject({ solo: false, gauche: { modele: "Le lourd" }, droite: { modele: "Le rapide" } });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("baston/choix")!))).toEqual({ gauche: 1, droite: 2 });

  await attendrePhase(page, "combat");
  const avant = await combat(page);
  // L'orange avance avec ←, le bleu recule avec Q (la touche A d'un QWERTY : Playwright tape en QWERTY)
  await page.keyboard.down("ArrowLeft");
  await page.keyboard.down("a");
  await page.waitForTimeout(400);
  await page.keyboard.up("ArrowLeft");
  await page.keyboard.up("a");
  etat = await combat(page);
  expect(etat.droite.x).toBeLessThan(avant.droite.x - 50);
  expect(etat.gauche.x).toBeLessThan(avant.gauche.x - 30);

  // K : l'orange frappe ; ↑ : il saute
  await appuyer(page, "k");
  expect((await combat(page)).droite.etat).toBe("attaque");
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("baston-combat").droite.etat === "repos");
  await appuyer(page, "ArrowUp");
  expect((await combat(page)).droite.etat).toBe("saut");
  sansErreur();
});

test.describe("au doigt", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test("seul contre l'ordinateur, avec les commandes tactiles", async ({ page }) => {
    const { sansErreur } = await ouvrir(page);
    await toucher(page, 345, 400);         // la carte de la baston
    await attendreScene(page, "baston-titre");
    await toucher(page, 480, 190);         // « Contre l'ordinateur » (le seul mode, au doigt)
    await attendreScene(page, "baston-choix");
    await toucher(page, 240, 430);         // « Touche ici pour valider »
    await attendreScene(page, "baston-combat");
    await attendrePhase(page, "combat");
    await placer(page, 300, 700);

    // Un doigt posé sur ▶ et qui y reste : on passe par le protocole de Chromium pour le tenir
    const cdp = await page.context().newCDPSession(page);
    const droite = await versLaPage(page, 222, 466);
    const avant = (await combat(page)).gauche.x;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: droite.x, y: droite.y, id: 1 }] });
    await page.waitForTimeout(400);
    let etat = await combat(page);
    expect(etat.tactile).toMatchObject({ droite: true, gauche: false });
    expect(etat.gauche.x).toBeGreaterThan(avant + 50);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(100);
    expect((await combat(page)).tactile.droite).toBe(false);

    // Une tape brève sur 👊 : le coup part quand même
    await toucher(page, 866, 462);
    expect((await combat(page)).gauche.etat).toBe("attaque");
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("baston-combat").gauche.etat === "repos");

    // ⚡ : un tir
    await toucher(page, 770, 368);
    etat = await combat(page);
    expect(etat.gauche.etat).toBe("tir");
    expect(etat.gauche.tirs).toBe(1);
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("baston-combat").gauche.etat === "repos");

    // ★ : le coup spécial, quand la jauge est pleine
    await page.evaluate(() => {
      (window as any).jeu.scene.getScene("baston-combat").gauche.jauge = 100;
    });
    await toucher(page, 888, 322);
    etat = await combat(page);
    expect(etat.gauche.etat).toBe("special");
    expect(etat.gauche.jauge).toBe(0);
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("baston-combat").gauche.etat === "repos");

    // ▲ : un saut
    await toucher(page, 735, 488);
    expect((await combat(page)).gauche.etat).toBe("saut");
    sansErreur();
  });
});
