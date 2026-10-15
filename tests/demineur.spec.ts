import { test, expect, type Page } from "@playwright/test";
import {
  ouvrir, appuyer, attendreScene, versLaPage, toucher, toucherLaCarte, ouvrirLaCarte, quitterParLaPause, attendreLaPause,
  tailleDuJeu,
} from "./outils";

// Dix mines connues pour le niveau Facile (9 × 9), loin du coin en bas à gauche où l'on commence :
// (8, 0) n'a aucune mine autour, et la cascade ouvre une belle zone
const MINES = [
  { r: 0, c: 0 }, { r: 0, c: 8 }, { r: 1, c: 4 }, { r: 2, c: 7 }, { r: 3, c: 2 },
  { r: 4, c: 6 }, { r: 5, c: 8 }, { r: 6, c: 4 }, { r: 7, c: 7 }, { r: 2, c: 1 },
];

// Du Hub jusqu'au menu du démineur
async function menuDemineur(page: Page) {
  const ouverte = await ouvrir(page);
  await ouvrirLaCarte(page, "demineur");
  await attendreScene(page, "demineur-menu");
  return ouverte;
}

// Le niveau Facile, avec les mines connues (avant le premier clic)
async function partieFacile(page: Page, mines: typeof MINES | null = MINES) {
  await appuyer(page, "1");
  await attendreScene(page, "demineur-partie");
  await attendreScene(page, "demineur-barre");
  await page.evaluate((mines) => {
    (window as any).jeu.registry.set("demineur-mines-imposees", mines ?? undefined);
  }, mines);
}

// Ce qu'on sait de la partie, lu dans la scène
function partie(page: Page) {
  return page.evaluate(() => {
    const p = (window as any).jeu.scene.getScene("demineur-partie");
    return {
      issue: p.grille.issue as string,
      etats: p.grille.cases.map((ligne: any[]) => ligne.map((c) => c.etat)) as string[][],
      restantes: p.grille.restantes() as number,
      modeDrapeau: p.modeDrapeau as boolean,
      smiley: (window as any).jeu.scene.getScene("demineur-barre").smiley.texture.key as string,
    };
  });
}

// Le centre d'une case, en pixels de la page
async function caseALaPage(page: Page, r: number, c: number) {
  const ici = await page.evaluate(([r, c]) =>
    (window as any).jeu.scene.getScene("demineur-partie").ecranDeCase(r, c), [r, c]);
  return versLaPage(page, ici.x, ici.y);
}

async function cliquer(page: Page, r: number, c: number, bouton: "left" | "right" = "left") {
  const p = await caseALaPage(page, r, c);
  await page.mouse.click(p.x, p.y, { button: bouton });
  await page.waitForTimeout(30);
}

// Un doigt qui reste posé sur une case : on passe par le protocole de Chromium pour le tenir
async function appuiLong(page: Page, r: number, c: number) {
  const p = await caseALaPage(page, r, c);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y, id: 1 }] });
  await page.waitForTimeout(550);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(50);
}

async function toucherCase(page: Page, r: number, c: number) {
  const p = await caseALaPage(page, r, c);
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(50);
}

test("une partie gagnée à la souris, et son record", async ({ page }) => {
  const { sansErreur } = await menuDemineur(page);
  await partieFacile(page);

  // Le premier clic ouvre toute une zone (la cascade), et le chrono part
  await cliquer(page, 8, 0);
  let etat = await partie(page);
  expect(etat.etats[8][0]).toBe("ouverte");
  expect(etat.etats.flat().filter((e) => e === "ouverte").length).toBeGreaterThan(5);

  // On ouvre, une à une, toutes les cases sans mine encore fermées
  const estMine = (r: number, c: number) => MINES.some((m) => m.r === r && m.c === c);
  await page.waitForTimeout(1200);         // un petit temps de jeu, pour que le record ne soit pas nul
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (!estMine(r, c) && (await partie(page)).etats[r][c] !== "ouverte") {
        await cliquer(page, r, c);
      }
    }
  }
  etat = await partie(page);
  expect(etat.issue).toBe("gagne");
  expect(etat.restantes).toBe(0);          // les mines ont reçu leur drapeau
  expect(etat.smiley).toBe("demineur-smiley_gagne");

  // La fin de partie demande le nom du record
  await attendreScene(page, "demineur-fin");
  const champ = page.locator("input[aria-label='Ton nom']");
  await expect(champ).toBeVisible();
  await page.waitForTimeout(500);
  await champ.fill("Pixy");
  await champ.press("Enter");
  const records = await page.evaluate(() => JSON.parse(localStorage.getItem("demineur/facile")!));
  expect(records).toHaveLength(1);
  expect(records[0].nom).toBe("Pixy");
  expect(records[0].temps).toBeGreaterThan(1000);
  await expect(champ).toHaveCount(0);      // le champ est parti avec la saisie

  // Le record s'affiche au menu des niveaux
  await appuyer(page, "Escape");
  await attendreScene(page, "demineur-menu");
  const textes = await page.evaluate(() => (window as any).jeu.scene.getScene("demineur-menu").children.list
    .flatMap((o: any) => o.list ?? [o]).map((o: any) => o.text).filter(Boolean).join(" | "));
  expect(textes).toContain("Pixy");
  sansErreur();
});

test("une partie perdue : la mine saute, les autres se montrent, le faux drapeau est barré", async ({ page }) => {
  const { sansErreur } = await menuDemineur(page);
  await partieFacile(page);
  await cliquer(page, 8, 0);
  await cliquer(page, 8, 8, "right");      // un drapeau... sans mine dessous
  await cliquer(page, 3, 2);               // une mine
  const etat = await partie(page);
  expect(etat.issue).toBe("perdu");
  expect(etat.smiley).toBe("demineur-smiley_perdu");
  for (const m of MINES) {
    expect(etat.etats[m.r][m.c]).toBe("ouverte");   // toutes les mines se montrent
  }
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("demineur-partie").grille.drapeauxFaux()))
    .toEqual([{ r: 8, c: 8 }]);

  // La fin de partie arrive, sans record ; R relance une partie neuve
  await attendreScene(page, "demineur-fin");
  expect(await page.locator("input").count()).toBe(0);
  await page.waitForTimeout(600);
  await appuyer(page, "r");
  await page.waitForFunction(() => !(window as any).jeu.scene.isActive("demineur-fin"));
  const neuve = await partie(page);
  expect(neuve.issue).toBe("");
  expect(neuve.etats.flat().every((e) => e === "cachee")).toBe(true);
  expect(neuve.smiley).toBe("demineur-smiley");

  // Perdue encore, puis les niveaux, puis un niveau : la scène repart sans planter (Phaser avait détruit la
  // chaîne des mines à l'arrêt, et la nouvelle partie la détruisait une seconde fois)
  await page.evaluate((mines) => (window as any).jeu.registry.set("demineur-mines-imposees", mines), MINES);
  await cliquer(page, 8, 0);
  await cliquer(page, 3, 2);
  await attendreScene(page, "demineur-fin");
  await page.waitForTimeout(600);
  await appuyer(page, "Escape");
  await attendreScene(page, "demineur-menu");
  await partieFacile(page);
  expect((await partie(page)).etats.flat().every((e) => e === "cachee")).toBe(true);
  sansErreur();
});

test("rejouer pendant l'explosion : la fin de l'ancienne partie ne revient pas", async ({ page }) => {
  const { sansErreur } = await menuDemineur(page);
  await partieFacile(page);
  await cliquer(page, 8, 0);
  await cliquer(page, 3, 2);
  await appuyer(page, "r");                // tout de suite, avant la fin de partie
  await page.waitForTimeout(2500);
  expect(await page.evaluate(() => (window as any).jeu.scene.isActive("demineur-fin"))).toBe(false);
  expect((await partie(page)).issue).toBe("");
  sansErreur();
});

test("le premier clic ne tombe jamais sur une mine, ni à côté", async ({ page }) => {
  const { sansErreur } = await menuDemineur(page);
  await appuyer(page, "3");                // Difficile : 99 mines, le plus risqué
  await attendreScene(page, "demineur-partie");
  await attendreScene(page, "demineur-barre");
  const essais = [[0, 0], [15, 29], [7, 14], [0, 15], [15, 0], [8, 3]];
  for (const [r, c] of essais) {
    await cliquer(page, r, c);
    const resultat = await page.evaluate(([r, c]) => {
      const g = (window as any).jeu.scene.getScene("demineur-partie").grille;
      const autour = [[r, c], ...g.voisines(r, c).map((p: any) => [p.r, p.c])];
      return {
        issue: g.issue,
        mines: g.toutesLesMines().length,
        minesAutour: autour.filter(([rr, cc]: number[]) => g.case(rr, cc).mine).length,
        etat: g.case(r, c).etat,
      };
    }, [r, c]);
    expect(resultat).toEqual({ issue: "", mines: 99, minesAutour: 0, etat: "ouverte" });
    // Le smiley relance une partie
    const smiley = await versLaPage(page, 480, 28);
    await page.mouse.click(smiley.x, smiley.y);
    await page.waitForTimeout(50);
    expect((await partie(page)).etats.flat().every((e) => e === "cachee")).toBe(true);
  }
  sansErreur();
});

test("un accord raté se voit : les voisines s'enfoncent puis remontent, rien ne s'ouvre", async ({ page }) => {
  const { sansErreur } = await menuDemineur(page);
  await partieFacile(page);
  await cliquer(page, 8, 0);
  await page.waitForTimeout(300);
  const avant = await partie(page);
  expect(avant.etats[4][3]).toBe("ouverte");   // un « 1 » : sa mine, en (3, 2), n'a pas de drapeau
  expect(avant.etats[3][3]).toBe("cachee");
  const enfoncee = () => page.evaluate(() =>
    (window as any).jeu.scene.getScene("demineur-partie").tuiles[3][3].enfoncee as boolean);
  await cliquer(page, 4, 3);
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("demineur-partie").tuiles[3][3].enfoncee);
  await page.waitForFunction(() => !(window as any).jeu.scene.getScene("demineur-partie").tuiles[3][3].enfoncee);
  expect(await enfoncee()).toBe(false);
  const apres = await partie(page);
  expect(apres.etats).toEqual(avant.etats);
  expect(apres.issue).toBe("");
  sansErreur();
});

test("le drapeau à la souris : clic droit, sans le menu du navigateur", async ({ page }) => {
  const { sansErreur } = await menuDemineur(page);
  await partieFacile(page);
  // Le menu du clic droit du navigateur est-il empêché ?
  await page.evaluate(() => document.addEventListener("contextmenu", (e) => {
    (window as any).menuEmpeche = e.defaultPrevented;
  }));

  await cliquer(page, 4, 4, "right");
  expect((await partie(page)).etats[4][4]).toBe("drapeau");
  expect((await partie(page)).restantes).toBe(9);
  expect(await page.evaluate(() => (window as any).menuEmpeche)).toBe(true);

  // Un drapeau protège sa case : le clic gauche n'y fait rien (même pas poser les mines)
  await cliquer(page, 4, 4);
  expect((await partie(page)).etats[4][4]).toBe("drapeau");
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("demineur-partie").grille.minesPlacees)).toBe(false);

  // Le tour : drapeau, point d'interrogation, rien
  await cliquer(page, 4, 4, "right");
  expect((await partie(page)).etats[4][4]).toBe("question");
  await cliquer(page, 4, 4, "right");
  expect((await partie(page)).etats[4][4]).toBe("cachee");
  expect((await partie(page)).restantes).toBe(10);

  // L'accord : un chiffre entouré de tous ses drapeaux ouvre le reste autour
  await cliquer(page, 8, 0);
  await cliquer(page, 3, 2, "right");      // la seule mine autour du « 1 » en (4, 3)
  let etat = await partie(page);
  expect(etat.etats[4][3]).toBe("ouverte");
  const autour = [[3, 3], [3, 4], [4, 4], [5, 4]];
  expect(autour.map(([r, c]) => etat.etats[r][c])).toEqual(["cachee", "cachee", "cachee", "cachee"]);
  await cliquer(page, 4, 3);
  etat = await partie(page);
  expect(etat.issue).toBe("");
  expect(autour.map(([r, c]) => etat.etats[r][c])).toEqual(["ouverte", "ouverte", "ouverte", "ouverte"]);
  sansErreur();
});

test("au clavier : le curseur (flèches ou main gauche à sa place), Espace pour creuser, F pour le drapeau", async ({ page }) => {
  const { sansErreur } = await menuDemineur(page);
  await partieFacile(page);
  // Le curseur part du milieu (4, 4) ; le premier appui le montre seulement
  await appuyer(page, "ArrowDown");
  for (let k = 0; k < 4; k++) {
    await appuyer(page, "ArrowDown");
    await appuyer(page, "ArrowLeft");
  }
  await appuyer(page, "Space");            // (8, 0)
  expect((await partie(page)).etats[8][0]).toBe("ouverte");
  for (let k = 0; k < 5; k++) {
    await appuyer(page, "ArrowUp");
  }
  await appuyer(page, "ArrowRight");
  await appuyer(page, "ArrowRight");
  await appuyer(page, "f");                // (3, 2) : une mine
  expect((await partie(page)).etats[3][2]).toBe("drapeau");

  // La main gauche, reconnue à la place des touches : KeyA (le Q d'un AZERTY) va à gauche, KeyQ (son A) ne
  // fait rien, KeyW (son Z) monte
  const curseur = () => page.evaluate(() => ({ ...(window as any).jeu.scene.getScene("demineur-partie").posCurseur }));
  await appuyer(page, "KeyA");
  expect(await curseur()).toEqual({ r: 3, c: 1 });
  await appuyer(page, "KeyQ");
  expect(await curseur()).toEqual({ r: 3, c: 1 });
  await appuyer(page, "KeyW");
  expect(await curseur()).toEqual({ r: 2, c: 1 });

  // X plante un drapeau aussi, Entrée creuse
  await appuyer(page, "x");
  expect((await partie(page)).etats[2][1]).toBe("drapeau");
  await appuyer(page, "ArrowRight");
  await appuyer(page, "Enter");             // (2, 2) : un chiffre
  expect((await partie(page)).etats[2][2]).toBe("ouverte");

  // L'aide en bas de l'écran cite toutes ces touches
  const aide = await page.evaluate(() => (window as any).jeu.scene.getScene("demineur-barre").children.list
    .map((o: any) => o.text).filter(Boolean).join(" "));
  for (const mot of ["Molette", "Entrée", "F ou X", "Échap ou P : pause", "M : le son"]) {
    expect(aide).toContain(mot);
  }

  // La pause, puis « Les niveaux »
  await quitterParLaPause(page);
  await attendreScene(page, "demineur-menu");
  await appuyer(page, "Escape");
  await attendreScene(page, "Hub");
  sansErreur();
});

// La pause (socle/pause.ts, vue en détail dans le tir) : ici, le chrono qui s'arrête avec elle
test("la pause arrête le chrono, et propose une nouvelle grille", async ({ page }) => {
  const { sansErreur } = await menuDemineur(page);
  await partieFacile(page);
  await cliquer(page, 8, 0);                // le chrono part
  await page.waitForTimeout(500);
  await appuyer(page, "Escape");
  await attendreLaPause(page);
  const temps = () => page.evaluate(() => (window as any).jeu.scene.getScene("demineur-partie").tempsEcoule() as number);
  const avant = await temps();
  await page.waitForTimeout(1000);
  expect(await temps()).toBe(avant);

  // « Nouvelle grille », au milieu de la liste
  await appuyer(page, "ArrowDown");
  await appuyer(page, "Enter");
  await page.waitForFunction(() => (window as any).jeu.scene.isActive("demineur-partie"));
  const neuve = await partie(page);
  expect(neuve.etats.flat().every((e) => e === "cachee")).toBe(true);
  expect(await temps()).toBe(0);
  sansErreur();
});

test("un double clic sur la flèche de la barre : on ne quitte qu'une fois", async ({ page }) => {
  const { sansErreur } = await menuDemineur(page);
  await partieFacile(page);
  // Chaque départ du menu le recrée : on compte ses créations
  await page.evaluate(() => {
    (window as any).__menus = 0;
    (window as any).jeu.scene.getScene("demineur-menu").events.on("create", () => (window as any).__menus++);
  });
  const fleche = await page.evaluate(() => {
    const texte = (window as any).jeu.scene.getScene("demineur-barre").children.list.find((o: any) => o.text === "←");
    const centre = texte.getCenter();
    return { x: centre.x as number, y: centre.y as number };
  });
  const ici = await versLaPage(page, fleche.x, fleche.y);
  await page.mouse.dblclick(ici.x, ici.y);
  await attendreScene(page, "demineur-menu");
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__menus)).toBe(1);
  sansErreur();
});

test("le son : M le coupe au menu comme en partie, et c'est gardé", async ({ page }) => {
  const { sansErreur } = await menuDemineur(page);
  await page.evaluate(() => {
    (window as any).__muet = false;
    (window as any).jeu.sound.on("mute", (_sons: unknown, muet: boolean) => { (window as any).__muet = muet; });
  });
  const muet = () => page.evaluate(() => (window as any).__muet as boolean);
  await appuyer(page, "m");
  expect(await muet()).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("demineur/son"))).toBe("false");
  await partieFacile(page);
  await appuyer(page, "m");
  expect(await muet()).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem("demineur/son"))).toBe("true");
  sansErreur();
});

test.describe("au doigt", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  // Le menu au doigt, puis un niveau (0 : Facile, 1 : Moyen) touché sur sa carte, avec des mines connues.
  // Le téléphone n'a pas de vibreur : les vibrations ne doivent rien casser (sansErreur).
  async function partieAuDoigt(page: Page, niveau: number) {
    await page.evaluate(() => Object.defineProperty(navigator, "vibrate", { value: undefined, configurable: true }));
    await toucherLaCarte(page, "demineur");
    await attendreScene(page, "demineur-menu");
    await page.waitForTimeout(500);
    const { largeur } = await tailleDuJeu(page);
    await toucher(page, largeur / 2 + (niveau - 1) * 300, 300);
    await attendreScene(page, "demineur-partie");
    await attendreScene(page, "demineur-barre");
    await page.evaluate((mines) => (window as any).jeu.registry.set("demineur-mines-imposees", mines), MINES);
  }

  test("toucher pour creuser, appui long ou bouton pour le drapeau, dans un jeu à la forme du téléphone", async ({ page }) => {
    const { sansErreur } = await ouvrir(page);
    await partieAuDoigt(page, 0);

    // Le jeu prend la proportion de l'écran (20/9), sans bandes noires (socle/largeur.ts)
    const { largeur } = await tailleDuJeu(page);
    expect(largeur).toBe(Math.round(540 * 844 / 390));
    expect((await page.locator("canvas").boundingBox())!.width).toBeCloseTo(844, 0);
    expect(await page.evaluate(() => (window as any).jeu.scene.getScene("demineur-partie").cameras.main.width))
      .toBe(largeur);

    // Les cases sont assez grandes pour un doigt
    const a = await caseALaPage(page, 0, 0);
    const b = await caseALaPage(page, 0, 1);
    expect(b.x - a.x).toBeGreaterThanOrEqual(36);

    await toucherCase(page, 8, 0);
    expect((await partie(page)).etats[8][0]).toBe("ouverte");

    // Un doigt qui reste posé plante un drapeau
    await appuiLong(page, 3, 2);
    expect((await partie(page)).etats[3][2]).toBe("drapeau");

    // Le bouton du mode : maintenant, un toucher plante le drapeau, et l'appui long creuse
    await toucher(page, largeur - 66, 474);
    expect((await partie(page)).modeDrapeau).toBe(true);
    await toucherCase(page, 0, 4);
    expect((await partie(page)).etats[0][4]).toBe("drapeau");
    await toucherCase(page, 0, 4);
    expect((await partie(page)).etats[0][4]).toBe("question");
    await appuiLong(page, 8, 8);
    expect((await partie(page)).etats[8][8]).toBe("ouverte");
    expect((await partie(page)).issue).toBe("");

    // On finit la partie en creusant tout ce qui reste
    await toucher(page, largeur - 66, 474);
    expect((await partie(page)).modeDrapeau).toBe(false);
    const estMine = (r: number, c: number) => MINES.some((m) => m.r === r && m.c === c);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!estMine(r, c) && (await partie(page)).etats[r][c] !== "ouverte") {
          await toucherCase(page, r, c);
        }
      }
    }
    expect((await partie(page)).issue).toBe("gagne");

    // Le champ du nom (un élément de la page, posé sur le canvas) est bien sur la carte, au milieu du
    // jeu élargi : son centre est 34 pixels du jeu à gauche du milieu, 18 sous le centre de la carte
    await attendreScene(page, "demineur-fin");
    const champ = page.locator("input[aria-label='Ton nom']");
    await expect(champ).toBeVisible();
    const boite = (await champ.boundingBox())!;
    const voulu = await versLaPage(page, largeur / 2 - 34, (540 + 68) / 2 + 18);
    expect(Math.abs(boite.x + boite.width / 2 - voulu.x)).toBeLessThan(2);
    expect(Math.abs(boite.y + boite.height / 2 - voulu.y)).toBeLessThan(2);
    sansErreur();
  });

  test("le ⏸ de la barre est assez grand pour un pouce, et la barre le contient", async ({ page }) => {
    const { sansErreur } = await ouvrir(page);
    await partieAuDoigt(page, 0);
    const pause = await page.evaluate(() => {
      const barre = (window as any).jeu.scene.getScene("demineur-barre");
      const bouton = barre.children.list.find((o: any) => o.depth === 1000);
      return { x: bouton.x, y: bouton.y, rayon: bouton.list[0].radius, haut: barre.haut };
    });
    expect(pause.rayon * 2).toBeGreaterThanOrEqual(64);
    expect(pause.y - pause.rayon).toBeGreaterThanOrEqual(0);
    expect(pause.y + pause.rayon).toBeLessThanOrEqual(pause.haut);
    // Un pouce posé un peu à côté du dessin l'ouvre quand même
    await toucher(page, pause.x - pause.rayon - 4, pause.y);
    await attendreLaPause(page);
    sansErreur();
  });

  test("la fin montre toute la grille : la caméra recule, et les mines éclatent en chaîne", async ({ page }) => {
    const { sansErreur } = await ouvrir(page);
    await partieAuDoigt(page, 1);          // Moyen : 16 × 16, trop grand pour tenir à l'écran au doigt
    const vue = () => page.evaluate(() => {
      const p = (window as any).jeu.scene.getScene("demineur-partie");
      const v = p.cameras.main.worldView;
      const l = p.niveau.colonnes * 48;
      const h = p.niveau.rangees * 48;
      return { toutVu: v.x <= 1 && v.y <= 1 && v.right >= l - 1 && v.bottom >= h - 1 };
    });
    expect((await vue()).toutVu).toBe(false);

    await toucherCase(page, 10, 10);       // loin des mines : la cascade
    await page.waitForTimeout(300);
    await toucherCase(page, 6, 4);         // une mine
    expect((await partie(page)).issue).toBe("perdu");
    await page.waitForFunction(() => {
      const p = (window as any).jeu.scene.getScene("demineur-partie");
      const v = p.cameras.main.worldView;
      return v.x <= 1 && v.y <= 1 && v.right >= p.niveau.colonnes * 48 - 1 && v.bottom >= p.niveau.rangees * 48 - 1;
    });
    // La chaîne des autres mines : chacune a sa gerbe
    await page.waitForFunction(() =>
      (window as any).jeu.scene.getScene("demineur-partie").chaine?.complete === true);
    await attendreScene(page, "demineur-fin");
    // Rejouer remet la caméra comme au départ
    await page.waitForTimeout(600);
    await appuyer(page, "r");
    await page.waitForFunction(() => !(window as any).jeu.scene.isActive("demineur-fin"));
    expect((await vue()).toutVu).toBe(false);
    sansErreur();
  });
});
