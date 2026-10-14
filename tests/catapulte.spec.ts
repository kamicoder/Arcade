import { test, expect, type Page } from "@playwright/test";
import { ouvrir, appuyer, attendreScene, versLaPage, ouvrirLaCarte } from "./outils";

// Du Hub jusqu'au menu de la catapulte (un navigateur neuf : seul le premier niveau est ouvert)
async function menuCatapulte(page: Page) {
  const ouverte = await ouvrir(page);
  await ouvrirLaCarte(page, "catapulte");
  await attendreScene(page, "catapulte-menu");
  return ouverte;
}

// Un niveau, directement (les tests des niveaux suivants n'ont pas à gagner ceux d'avant)
async function jouerLeNiveau(page: Page, numero: number) {
  await page.evaluate((numero) => {
    const jeu = (window as any).jeu;
    jeu.scene.stop("catapulte-menu");
    jeu.scene.start("catapulte-niveau", { numero });
  }, numero);
  await attendreLEtat(page, "pret");
}

function attendreLEtat(page: Page, ...etats: string[]) {
  return page.waitForFunction((etats) => {
    const n = (window as any).jeu.scene.getScene("catapulte-niveau");
    return n?.sys.isActive() && etats.includes(n.etat);
  }, etats, { timeout: 20_000 });
}

function niveau(page: Page) {
  return page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("catapulte-niveau");
    const vol = n.enVol[0]?.image;
    return {
      etat: n.etat as string,
      score: n.score as number,
      file: n.file.length as number,
      slimes: n.slimes.length as number,
      blocs: n.blocs.length as number,
      abimes: n.blocs.filter((b: any) => b.vie < b.vieMax).length as number,
      enVol: n.enVol.length as number,
      vitesse: vol ? { x: vol.body.velocity.x as number, y: vol.body.velocity.y as number } : null,
    };
  });
}

// Un point du monde (1280 × 720, réduit à 0,75 et centré) en pixels de la page
function duMonde(page: Page, x: number, y: number) {
  return versLaPage(page, (x - 640) * 0.75 + 480, (y - 360) * 0.75 + 270);
}

test("le Hub ouvre la catapulte : seul le premier niveau est ouvert, et Entrée le lance", async ({ page }) => {
  const { sansErreur } = await menuCatapulte(page);
  // Le deuxième niveau est fermé : Entrée n'y fait rien
  await appuyer(page, "ArrowRight");
  await appuyer(page, "Enter");
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => (window as any).jeu.scene.isActive("catapulte-menu"))).toBe(true);
  await appuyer(page, "ArrowLeft");
  await appuyer(page, "Enter");
  await attendreLEtat(page, "pret");
  expect(await niveau(page)).toMatchObject({ file: 2, slimes: 1, blocs: 3 });
  sansErreur();
});

// Un château mal empilé s'écroulerait tout seul : chacun doit tenir debout, sans un seul tir
test("chaque niveau tient debout tout seul, sans rien casser", async ({ page }) => {
  const { sansErreur } = await menuCatapulte(page);
  const nombre = await page.evaluate(() => (window as any).jeu.scene.getScene("catapulte-menu").cartes.length as number);
  for (let n = 0; n < nombre; n++) {
    await jouerLeNiveau(page, n);
    const depart = await niveau(page);
    await page.waitForTimeout(1500);
    const apres = await niveau(page);
    expect(apres, `niveau ${n + 1}`).toMatchObject({ blocs: depart.blocs, slimes: depart.slimes, abimes: 0 });
  }
  sansErreur();
});

test("à la souris : on attrape le boulet, on tire l'élastique, on lâche, il part, et le suivant arrive", async ({ page }) => {
  const { sansErreur } = await menuCatapulte(page);
  await jouerLeNiveau(page, 0);
  // On prend son temps, comme un joueur : un boulet resté immobile s'endort (Matter), et doit partir quand même
  await page.waitForTimeout(2000);
  const de = await duMonde(page, 190, 520);
  const vers = await duMonde(page, 100, 575);
  await page.mouse.move(de.x, de.y);
  await page.mouse.down();
  await page.mouse.move(vers.x, vers.y, { steps: 8 });
  expect((await niveau(page)).etat).toBe("vise");
  // Les pointillés montrent la trajectoire
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("catapulte-niveau").pointilles.commandBuffer.length)).toBeGreaterThan(10);
  await page.mouse.up();
  const enVol = await niveau(page);
  expect(enVol).toMatchObject({ etat: "vol", file: 2, enVol: 1 });
  // Tiré vers l'arrière et le bas : il part vers l'avant et le haut, et il avance pour de vrai
  expect(enVol.vitesse!.x).toBeGreaterThan(10);
  expect(enVol.vitesse!.y).toBeLessThan(-5);
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("catapulte-niveau").enVol[0]?.image.x > 400);
  await attendreLEtat(page, "pret");
  expect((await niveau(page)).file).toBe(1);
  sansErreur();
});

test("au clavier : ← → l'angle, ↑ ↓ la force, Espace tire", async ({ page }) => {
  const { sansErreur } = await menuCatapulte(page);
  await jouerLeNiveau(page, 0);
  await appuyer(page, "ArrowLeft");        // 35° + 5°
  await appuyer(page, "ArrowUp");          // 0,8 + 0,1
  expect(await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("catapulte-niveau");
    return [n.angle, n.force, n.etat];
  })).toEqual([40, 0.9, "vise"]);
  await appuyer(page, "Space");
  const vol = await niveau(page);
  expect(vol.etat).toBe("vol");
  // La direction du tir : 40° au-dessus de l'horizontale
  expect(Math.atan2(-vol.vitesse!.y, vol.vitesse!.x) * 180 / Math.PI).toBeCloseTo(40, -1);
  sansErreur();
});

test("un boulet qui tombe sur un slime l'écrase, et rapporte ses points", async ({ page }) => {
  const { sansErreur } = await menuCatapulte(page);
  await jouerLeNiveau(page, 0);
  // Le boulet, posé au-dessus du slime, part vers le bas : la vraie physique fait le reste
  await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("catapulte-niveau");
    const slime = n.slimes[0].image;
    n.boulet.image.setPosition(slime.x, slime.y - 90);
    n.tirer({ x: 0, y: 12 });
  });
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("catapulte-niveau").slimes.length === 0);
  expect((await niveau(page)).score).toBeGreaterThanOrEqual(500);
  sansErreur();
});

// Les blocs posés s'endorment (Matter) : un bloc détruit doit réveiller ce qu'il portait, sinon une poutre
// dont les piliers ont éclaté reste en l'air
test("un pilier détruit fait tomber la poutre qu'il portait", async ({ page }) => {
  const { sansErreur } = await menuCatapulte(page);
  await jouerLeNiveau(page, 0);
  await page.waitForTimeout(2000);         // le château s'est posé, ses blocs dorment
  const poutre = () => page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("catapulte-niveau");
    const p = n.blocs.find((b: any) => Math.abs(b.image.angle) < 45 && b.forme === "long");
    return { y: p.image.y as number, dort: p.image.body.isSleeping as boolean };
  });
  const avant = await poutre();
  expect(avant.dort).toBe(true);
  // Les deux piliers éclatent (comme frappés par des boulets)
  await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("catapulte-niveau");
    for (const pilier of n.blocs.filter((b: any) => Math.abs(b.image.angle) > 45)) {
      n.blesser(pilier, 1000);
    }
  });
  await page.waitForFunction((y) => {
    const n = (window as any).jeu.scene.getScene("catapulte-niveau");
    const p = n.blocs.find((b: any) => b.forme === "long");
    return p && p.image.y > y + 100;
  }, avant.y, { timeout: 5000 });
  sansErreur();
});

test("gagner : plus de slime, des étoiles selon les boulets restants, et le niveau suivant s'ouvre", async ({ page }) => {
  const { sansErreur } = await menuCatapulte(page);
  await jouerLeNiveau(page, 0);
  await appuyer(page, "Space");
  // Pendant le vol, le slime est écrasé (comme par un bloc qui tombe)
  await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("catapulte-niveau");
    n.blesser(n.slimes[0], 100);
  });
  await attendreScene(page, "catapulte-fin");
  // Il restait deux boulets : trois étoiles, et 2 × 1000 points de plus
  const garde = await page.evaluate(() => JSON.parse(localStorage.getItem("catapulte/niveaux")!));
  expect(garde[0].etoiles).toBe(3);
  expect(garde[0].score).toBeGreaterThanOrEqual(2500);
  await page.waitForTimeout(800);          // la fin n'écoute qu'après un petit moment
  await appuyer(page, "Enter");            // « Niveau suivant », le premier bouton
  await page.waitForFunction(() => {
    const n = (window as any).jeu.scene.getScene("catapulte-niveau");
    return n.sys.isActive() && n.numero === 1 && n.etat === "pret";
  }, undefined, { timeout: 20_000 });
  sansErreur();
});

test("perdre : plus de boulet, des slimes encore là, et Rejouer recommence le niveau", async ({ page }) => {
  const { sansErreur } = await menuCatapulte(page);
  await jouerLeNiveau(page, 0);
  await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("catapulte-niveau");
    n.file = [];                           // le dernier boulet
    n.force = 0.3;                         // un tir trop faible
  });
  await appuyer(page, "Space");
  await attendreScene(page, "catapulte-fin");
  expect((await niveau(page)).etat).toBe("fini");
  expect(await page.evaluate(() => localStorage.getItem("catapulte/niveaux"))).toBeNull();
  await page.waitForTimeout(800);
  await appuyer(page, "Enter");            // « Rejouer » (pas de niveau suivant quand on a perdu)
  await attendreLEtat(page, "pret");
  expect(await niveau(page)).toMatchObject({ file: 2, slimes: 1, score: 0 });
  sansErreur();
});

test("les boulets spéciaux montrent leur pouvoir, et le triple se divise en trois (clic ou Espace) en plein vol", async ({ page }) => {
  const { sansErreur } = await menuCatapulte(page);
  const fiche = () => page.evaluate(() => {
    const t = (window as any).jeu.scene.getScene("catapulte-tableau");
    return t.fiche.visible ? t.fiche.list[2].text as string : null;
  });
  // « Le mur de pierre » : le lourd d'abord, puis des boulets normaux (sans fiche)
  await jouerLeNiveau(page, 3);
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("catapulte-tableau").fiche?.visible);
  expect(await fiche()).toContain("Boulet lourd");

  await jouerLeNiveau(page, 4);            // « Les jumelles » : le triple d'abord
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("catapulte-tableau").fiche?.visible);
  expect(await fiche()).toContain("se divise en trois");
  await appuyer(page, "Space");
  expect((await niveau(page)).enVol).toBe(1);
  await page.waitForTimeout(300);
  await appuyer(page, "Space");
  expect((await niveau(page)).enVol).toBe(3);
  // Divisé : la fiche s'en va
  await page.waitForFunction(() => !(window as any).jeu.scene.getScene("catapulte-tableau").fiche.visible);
  sansErreur();
});

test.describe("au doigt", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test("on touche le niveau, puis on tire l'élastique du doigt", async ({ page }) => {
    const { sansErreur } = await ouvrir(page);
    await ouvrirLaCarte(page, "catapulte");
    await attendreScene(page, "catapulte-menu");
    await page.evaluate(() => {
      const carte = (window as any).jeu.scene.getScene("catapulte-menu").cartes[0].boite;
      (window as any).__carte = { x: carte.x, y: carte.y };
    });
    const carte = await page.evaluate(() => (window as any).__carte);
    const p = await versLaPage(page, carte.x, carte.y);
    await page.touchscreen.tap(p.x, p.y);
    await attendreLEtat(page, "pret");

    const cdp = await page.context().newCDPSession(page);
    const de = await duMonde(page, 190, 520);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: de.x, y: de.y, id: 1 }] });
    for (let k = 1; k <= 8; k++) {
      const a = await duMonde(page, 190 - 11 * k, 520 + 7 * k);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a.x, y: a.y, id: 1 }] });
      await page.waitForTimeout(20);
    }
    expect((await niveau(page)).etat).toBe("vise");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    expect((await niveau(page)).etat).toBe("vol");
    sansErreur();
  });
});
