import { test, expect, type Page } from "@playwright/test";
import { ouvrir, appuyer, attendreScene, scenesActives, versLaPage, toucher, tailleDuJeu } from "./outils";

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

  // Des doigts qu'on pose, qu'on glisse et qu'on lève quand on veut (Playwright ne sait que taper) :
  // on passe par le protocole de Chromium. Les places sont en pixels du jeu.
  async function doigts(page: Page) {
    const cdp = await page.context().newCDPSession(page);
    const enPage = async (points: { x: number; y: number; id: number }[]) =>
      Promise.all(points.map(async ({ x, y, id }) => ({ ...(await versLaPage(page, x, y)), id })));
    return {
      poser: async (...points: { x: number; y: number; id: number }[]) =>
        cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: await enPage(points) }),
      glisser: async (...points: { x: number; y: number; id: number }[]) =>
        cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: await enPage(points) }),
      lever: () => cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }),
    };
  }

  function stickVisible(page: Page) {
    return page.evaluate(() => (window as any).jeu.scene.getScene("baston-tableau").baseDuStick.visible as boolean);
  }

  test("l'arène élargie, le joystick et les trois boutons", async ({ page }) => {
    const { sansErreur } = await ouvrir(page);
    expect(await tailleDuJeu(page)).toEqual({ largeur: 960, hauteur: 540 });
    await toucher(page, 345, 400);         // la carte de la baston
    await attendreScene(page, "baston-titre");

    // La baston prend la proportion du téléphone : plus de bandes noires sur les côtés
    const { largeur } = await tailleDuJeu(page);
    expect(largeur).toBe(Math.round(540 * 844 / 390));
    expect((await page.locator("canvas").boundingBox())!.width).toBeCloseTo(844, 0);

    await toucher(page, largeur / 2, 190); // « Contre l'ordinateur » (le seul mode, au doigt)
    await attendreScene(page, "baston-choix");
    await toucher(page, largeur / 4, 430); // « Touche ici pour valider »
    await attendreScene(page, "baston-combat");

    // L'arène, sa caméra et le tableau de bord ont toute la largeur ; les robots partent à 450
    // pixels l'un de l'autre, de part et d'autre du milieu
    const arene = await page.evaluate(() => {
      const jeu = (window as any).jeu;
      const c = jeu.scene.getScene("baston-combat");
      return {
        bords: c.physics.world.bounds.width,
        camera: c.cameras.main.width,
        tableau: jeu.scene.getScene("baston-tableau").cameras.main.width,
      };
    });
    expect(arene).toEqual({ bords: largeur, camera: largeur, tableau: largeur });
    let etat = await combat(page);
    expect(Math.abs(etat.gauche.x - (largeur / 2 - 225))).toBeLessThan(2);
    expect(Math.abs(etat.droite.x - (largeur / 2 + 225))).toBeLessThan(2);

    await attendrePhase(page, "combat");
    await placer(page, 450, 1000);
    const doigt = await doigts(page);

    // Le joystick : le pouce se pose n'importe où à gauche, et glisse vers la droite
    expect(await stickVisible(page)).toBe(false);
    let avant = (await combat(page)).gauche.x;
    await doigt.poser({ x: 250, y: 300, id: 1 });
    await doigt.glisser({ x: 340, y: 300, id: 1 });
    await page.waitForTimeout(400);
    etat = await combat(page);
    expect(await stickVisible(page)).toBe(true);
    expect(etat.tactile).toMatchObject({ droite: true, gauche: false, saut: false });
    expect(etat.gauche.x).toBeGreaterThan(avant + 50);

    // Puis vers la gauche : la base a suivi le pouce, un petit geste suffit pour repartir
    avant = (await combat(page)).gauche.x;
    await doigt.glisser({ x: 200, y: 300, id: 1 });
    await page.waitForTimeout(400);
    etat = await combat(page);
    expect(etat.tactile).toMatchObject({ droite: false, gauche: true });
    expect(etat.gauche.x).toBeLessThan(avant - 50);

    // Le pouce se lève : le joystick disparaît, le robot s'arrête
    await doigt.lever();
    await page.waitForTimeout(100);
    expect((await combat(page)).tactile).toMatchObject({ droite: false, gauche: false });
    expect(await stickVisible(page)).toBe(false);

    // Sauter : une poussée vers le haut, un saut. Le pouce reste en haut : pas de rafale.
    await doigt.poser({ x: 200, y: 330, id: 1 });
    await doigt.glisser({ x: 205, y: 260, id: 1 });
    await page.waitForTimeout(50);
    expect((await combat(page)).gauche.etat).toBe("saut");
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("baston-combat").gauche.etat === "repos");
    await page.waitForTimeout(300);
    expect((await combat(page)).gauche.etat).toBe("repos");
    // Redescendu au milieu, puis repoussé : un nouveau saut
    await doigt.glisser({ x: 200, y: 330, id: 1 });
    await doigt.glisser({ x: 200, y: 260, id: 1 });
    await page.waitForTimeout(50);
    expect((await combat(page)).gauche.etat).toBe("saut");
    await doigt.lever();
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("baston-combat").gauche.etat === "repos");

    // 👊 : une tape très brève (posée et levée d'un coup) frappe quand même
    await placer(page, 450, 1000);
    await doigt.poser({ x: largeur - 112, y: 438, id: 2 });
    await doigt.lever();
    await page.waitForTimeout(50);
    expect((await combat(page)).gauche.etat).toBe("attaque");
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("baston-combat").gauche.etat === "repos");

    // Les deux mains ensemble : marcher et frapper
    await doigt.poser({ x: 200, y: 300, id: 1 });
    await doigt.glisser({ x: 290, y: 300, id: 1 });
    await doigt.poser({ x: 290, y: 300, id: 1 }, { x: largeur - 100, y: 450, id: 2 });
    await page.waitForTimeout(50);
    etat = await combat(page);
    expect(etat.tactile).toMatchObject({ droite: true, frapper: true });
    expect(etat.gauche.etat).toBe("attaque");
    await doigt.lever();
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("baston-combat").gauche.etat === "repos");

    // ⚡ : un tir (l'état « tir » ne dure qu'un instant : on attend le tir lui-même, ou ses dégâts)
    const vieAvantLeTir = (await combat(page)).droite.vie;
    await toucher(page, largeur - 270, 480);
    await page.waitForFunction((vie) => {
      const c = (window as any).jeu.scene.getScene("baston-combat");
      return c.gauche.listeDesTirs.length === 1 || c.droite.vie < vie;
    }, vieAvantLeTir);
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("baston-combat").gauche.etat === "repos");

    // ★ : éteint tant que la jauge n'est pas pleine (il ne fait rien), puis allumé
    await page.evaluate(() => {
      (window as any).jeu.scene.getScene("baston-combat").gauche.jauge = 0;
    });
    await toucher(page, largeur - 104, 272);
    expect((await combat(page)).gauche.etat).toBe("repos");
    await page.evaluate(() => {
      (window as any).jeu.scene.getScene("baston-combat").gauche.jauge = 100;
    });
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("baston-tableau").specialPret === true);
    await toucher(page, largeur - 104, 272);
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("baston-combat").gauche.jauge === 0);
    sansErreur();
  });

  test("de retour au Hub, puis dans un autre jeu : 960 × 540", async ({ page }) => {
    const { sansErreur } = await ouvrir(page);
    await toucher(page, 345, 400);
    await attendreScene(page, "baston-titre");
    expect((await tailleDuJeu(page)).largeur).toBe(Math.round(540 * 844 / 390));
    // L'écran change de forme (un autre téléphone, le plein écran) : le titre suit
    await page.setViewportSize({ width: 760, height: 390 });
    await page.waitForFunction(() => (window as any).jeu.scale.width === Math.round(540 * 760 / 390));
    await attendreScene(page, "baston-titre");
    await toucher(page, 60, 30);           // « ← Arcade »
    await attendreScene(page, "Hub");
    expect(await tailleDuJeu(page)).toEqual({ largeur: 960, hauteur: 540 });
    expect(await page.evaluate(() => (window as any).jeu.scene.getScene("Hub").cameras.main.width)).toBe(960);

    await toucher(page, 750, 200);         // le démineur
    await attendreScene(page, "demineur-menu");
    expect(await tailleDuJeu(page)).toEqual({ largeur: 960, hauteur: 540 });
    // Le démineur garde ses bandes noires : il n'a rien demandé
    expect((await page.locator("canvas").boundingBox())!.width).toBeLessThan(800);
    sansErreur();
  });
});
