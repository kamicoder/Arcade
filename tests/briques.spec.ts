import { test, expect, type Page } from "@playwright/test";
import {
  ouvrir, appuyer, attendreScene, scenesActives, ouvrirLaCarte, toucherLaCarte, toucher, versLaPage, manette, attendreLaPause,
  tailleDuJeu,
  quitterParLaPause,
} from "./outils";

// Du Hub jusqu'au menu du casse-briques
async function menuDesBriques(page: Page) {
  const ouverte = await ouvrir(page);
  await ouvrirLaCarte(page, "briques");
  await attendreScene(page, "briques-menu");
  return ouverte;
}

// L'état de la partie, lu dans la scène Phaser
function partie(page: Page) {
  return page.evaluate(() => {
    const p = (window as any).jeu.scene.getScene("briques-partie");
    const balles = p.balles.getMatching("active", true);
    return {
      etat: p.etat as string,
      score: p.score as number,
      vies: p.vies as number,
      mur: p.mur as number,
      raquette: p.raquette.body.center.x as number,
      largeur: p.raquette.body.width as number,
      balles: balles.length as number,
      balle: balles[0] ? { x: balles[0].body.center.x, y: balles[0].body.center.y, vy: balles[0].body.velocity.y } : null,
      briques: p.briquesRestantes().length as number,
      effets: [...p.effets.keys()] as string[],
    };
  });
}

// Le joueur a déjà gagné ces niveaux (0 à 9) : ce qu'ils ouvrent est ouvert
async function dejaGagnes(page: Page, jusqua: number) {
  await page.evaluate((jusqua) => {
    const tout: Record<number, unknown> = {};
    for (let i = 0; i <= jusqua; i++) {
      tout[i] = { etoiles: 1, score: 10 };
    }
    localStorage.setItem("briques/niveaux", JSON.stringify(tout));
  }, jusqua);
}

// Une seule brique à casser dans le mur (les autres s'en vont), d'un seul coup, et la balle part droit dessus, d'en dessous
async function laDerniereBrique(page: Page) {
  await page.evaluate(() => {
    const p = (window as any).jeu.scene.getScene("briques-partie");
    const toutes = p.briquesRestantes();
    // Une brique sans rien en dessous d'elle (le métal, qui reste, pourrait lui barrer la route)
    const aCasser = toutes.filter((b: any) => b.genre !== "metal");
    const garde = aCasser.find((b: any) => !toutes.some((c: any) => c.colonne === b.colonne && c.ligne > b.ligne)) ?? aCasser[0];
    aCasser.filter((b: any) => b !== garde).forEach((b: any) => b.disableBody(true, true));
    garde.brique.coups = 1;                // une brique dure renverrait la balle sans casser (le mur sans fin est tiré au hasard)
    p.lancer();
    const balle = p.balles.getFirstAlive();
    balle.body.reset(garde.x, garde.y + 120);
    balle.body.setVelocity(0, -400);
  });
}

// La balle tombe loin de la raquette
async function laisserTomber(page: Page) {
  await page.evaluate(() => {
    const p = (window as any).jeu.scene.getScene("briques-partie");
    p.lancer();
    const balle = p.balles.getFirstAlive();
    const x = p.raquette.x > 480 ? 80 : 880;
    balle.body.reset(x, 440);
    balle.body.setVelocity(0, 400);
  });
}

test("le Hub lance le casse-briques : la raquette se pilote, Espace lance, la balle casse les briques", async ({ page }) => {
  const { sansErreur } = await menuDesBriques(page);
  await appuyer(page, "Enter");
  await attendreScene(page, "briques-partie");
  expect(await scenesActives(page)).toEqual(["briques-partie", "briques-tableau"]);
  const depart = await partie(page);
  expect(depart).toMatchObject({ etat: "tenue", score: 0, vies: 3, balles: 1, briques: 60 });

  // La flèche gauche déplace la raquette, et la balle posée dessus la suit ; D (à sa place) revient
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(300);
  await page.keyboard.up("ArrowLeft");
  const aGauche = await partie(page);
  expect(aGauche.raquette).toBeLessThan(depart.raquette - 100);
  await page.waitForFunction(() => {
    const p = (window as any).jeu.scene.getScene("briques-partie");
    return Math.abs(p.balles.getFirstAlive().body.center.x - p.raquette.body.center.x) < 2;
  });
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(150);
  await page.keyboard.up("KeyD");
  expect((await partie(page)).raquette).toBeGreaterThan(aGauche.raquette + 40);

  // Espace lance la balle vers le haut, et elle finit par casser des briques
  await appuyer(page, "Space");
  const lancee = await partie(page);
  expect(lancee.etat).toBe("jeu");
  expect(lancee.balle!.vy).toBeLessThan(0);
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("briques-partie").score > 0, undefined, { timeout: 10_000 });
  expect((await partie(page)).briques).toBeLessThan(60);
  sansErreur();
});

test("la raquette renvoie la balle d'autant plus penchée qu'elle tape loin du milieu", async ({ page }) => {
  const { sansErreur } = await menuDesBriques(page);
  await appuyer(page, "Enter");
  await attendreScene(page, "briques-partie");
  // La balle tombe sur le bord droit de la raquette, puis au milieu
  const renvoi = async (decalage: number) => {
    await page.evaluate((decalage) => {
      const p = (window as any).jeu.scene.getScene("briques-partie");
      p.lancer();
      const balle = p.balles.getFirstAlive();
      balle.body.reset(p.raquette.body.center.x + decalage, 400);
      balle.body.setVelocity(0, 300);
    }, decalage);
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("briques-partie").balles.getFirstAlive().body.velocity.y < 0);
    return page.evaluate(() => {
      const v = (window as any).jeu.scene.getScene("briques-partie").balles.getFirstAlive().body.velocity;
      return { x: v.x as number, y: v.y as number };
    });
  };
  const auBord = await renvoi(45);
  expect(auBord.x).toBeGreaterThan(Math.abs(auBord.y));            // très penchée vers la droite
  const auMilieu = await renvoi(0);
  expect(Math.abs(auMilieu.x)).toBeLessThan(Math.abs(auMilieu.y) * 0.3);   // presque droite
  sansErreur();
});

test("perdre : une balle tombée coûte une vie, la troisième finit la partie, et Rejouer recommence", async ({ page }) => {
  const { sansErreur } = await menuDesBriques(page);
  await appuyer(page, "Enter");
  await attendreScene(page, "briques-partie");

  await laisserTomber(page);
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("briques-partie").vies === 2);
  expect(await partie(page)).toMatchObject({ etat: "tenue", balles: 1 });

  await laisserTomber(page);
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("briques-partie").vies === 1);
  await laisserTomber(page);
  await attendreScene(page, "briques-fin");
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("briques-fin").sys.settings.data.gagne)).toBe(false);
  // Perdu, rien n'est gardé
  expect(await page.evaluate(() => localStorage.getItem("briques/niveaux"))).toBeNull();

  // « Rejouer » est le premier bouton
  await page.waitForTimeout(800);
  await appuyer(page, "Enter");
  await page.waitForFunction(() => {
    const jeu = (window as any).jeu;
    return !jeu.scene.isActive("briques-fin") && jeu.scene.getScene("briques-partie").vies === 3;
  });
  expect(await partie(page)).toMatchObject({ etat: "tenue", score: 0, briques: 60 });
  sansErreur();
});

test("gagner : la dernière brique cassée, trois étoiles, le score gardé, et le niveau suivant s'ouvre", async ({ page }) => {
  const { sansErreur } = await menuDesBriques(page);
  await appuyer(page, "Enter");
  await attendreScene(page, "briques-partie");
  await page.waitForTimeout(400);

  await laDerniereBrique(page);
  await attendreScene(page, "briques-fin");
  const fin = await page.evaluate(() => (window as any).jeu.scene.getScene("briques-fin").sys.settings.data);
  expect(fin).toMatchObject({ gagne: true, etoiles: 3, record: true });
  // Les 3 vies restantes comptent dans le score
  expect(fin.score).toBeGreaterThanOrEqual(600);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("briques/niveaux")!)))
    .toEqual({ 0: { etoiles: 3, score: fin.score } });

  // « Niveau suivant » est le premier bouton
  await page.waitForTimeout(800);
  await appuyer(page, "Enter");
  await page.waitForFunction(() => {
    const p = (window as any).jeu.scene.getScene("briques-partie");
    return p.sys.isActive() && p.donnees.numero === 1;
  });
  // Au menu, le niveau 2 est ouvert, le 3 pas encore
  await quitterParLaPause(page);
  await attendreScene(page, "briques-menu");
  const ouvertes = await page.evaluate(() => (window as any).jeu.scene.getScene("briques-menu").cartes.map((c: any) => c.ouverte));
  expect(ouvertes.slice(0, 3)).toEqual([true, true, false]);
  sansErreur();
});

test("les bonus : raquette large, trois balles, une vie, et la balle de feu qui traverse les briques", async ({ page }) => {
  const { sansErreur } = await menuDesBriques(page);
  await appuyer(page, "Enter");
  await attendreScene(page, "briques-partie");
  // Un bonus tombe juste au-dessus de la raquette : elle l'attrape
  const attraper = async (genre: string) => {
    await page.evaluate((genre) => {
      const p = (window as any).jeu.scene.getScene("briques-partie");
      p.lacherUnBonus(p.raquette.body.center.x, 440, genre);
    }, genre);
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("briques-partie").bonus.countActive() === 0);
  };

  // La balle attend sur la raquette : rien ne peut se perdre pendant les premiers bonus
  await attraper("large");
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("briques-partie").raquette.body.width > 150);
  expect((await partie(page)).effets).toContain("large");

  await attraper("vie");
  expect((await partie(page)).vies).toBe(4);

  // La balle remonte sous le mur, puis devient trois
  await appuyer(page, "Space");
  await page.evaluate(() => {
    const balle = (window as any).jeu.scene.getScene("briques-partie").balles.getFirstAlive();
    balle.body.reset(480, 380);
    balle.body.setVelocity(0, -300);
  });
  await attraper("multi");
  expect((await partie(page)).balles).toBe(3);

  // La balle de feu : une seule balle, lancée droit dans une colonne de cinq briques. Elle les casse toutes
  // d'un trait ; une balle qui rebondit n'en casserait qu'une avant de redescendre.
  await attraper("feu");
  await page.evaluate(() => {
    const p = (window as any).jeu.scene.getScene("briques-partie");
    const [garde, ...autres] = p.balles.getMatching("active", true);
    autres.forEach((b: any) => b.destroy());
    garde.body.reset(128, 300);
    garde.body.setVelocity(0, -400);
  });
  await page.waitForFunction(() => {
    const p = (window as any).jeu.scene.getScene("briques-partie");
    return p.briquesRestantes().filter((b: any) => b.colonne === 0).length === 0;
  }, undefined, { timeout: 2000 });
  sansErreur();
});

test("la brique explosive casse ses voisines", async ({ page }) => {
  const { sansErreur } = await ouvrir(page);
  await dejaGagnes(page, 3);
  await ouvrirLaCarte(page, "briques");
  await attendreScene(page, "briques-menu");
  // Le niveau 5, « Boum ! » : le premier à gagner, le menu le choisit d'office
  await appuyer(page, "Enter");
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("briques-partie").donnees?.numero === 4);
  await page.waitForTimeout(400);
  const avant = (await partie(page)).briques;
  // Droit sur l'explosive de la 2e rangée, 5e colonne, par un trou ouvert dans les rangées du dessous
  await page.evaluate(() => {
    const p = (window as any).jeu.scene.getScene("briques-partie");
    const boum = p.briquesRestantes().find((b: any) => b.genre === "explosive" && b.ligne === 1);
    p.briquesRestantes().filter((b: any) => b.colonne === boum.colonne && b.ligne > 1).forEach((b: any) => b.disableBody(true, true));
    p.lancer();
    const balle = p.balles.getFirstAlive();
    balle.body.reset(boum.x, 300);
    balle.body.setVelocity(0, -400);
  });
  // L'explosive et ses sept voisines (celle du dessous était déjà partie, avec le reste de la colonne)
  await page.waitForFunction((avant) => (window as any).jeu.scene.getScene("briques-partie").briquesRestantes().length <= avant - 4 - 6, avant);
  sansErreur();
});

test("le mode sans fin s'ouvre avec le dernier niveau ; un mur cassé, le suivant arrive", async ({ page }) => {
  const { sansErreur } = await menuDesBriques(page);
  // Fermé : la carte « Sans fin » ne lance rien
  await appuyer(page, "ArrowDown");
  await appuyer(page, "ArrowDown");
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("briques-menu").choisi)).toBe(10);
  await appuyer(page, "Enter");
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => (window as any).jeu.scene.isActive("briques-menu"))).toBe(true);

  // Les dix niveaux gagnés : il s'ouvre, et le menu le choisit d'office
  await dejaGagnes(page, 9);
  await page.evaluate(() => {
    const menu = (window as any).jeu.scene.getScene("briques-menu");
    menu.choisi = -1;
    menu.scene.restart();
  });
  await page.waitForTimeout(300);
  await appuyer(page, "Enter");
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("briques-partie").donnees?.mode === "sansFin");
  await page.waitForTimeout(400);
  expect(await partie(page)).toMatchObject({ mur: 1, etat: "tenue" });

  await laDerniereBrique(page);
  await page.waitForFunction(() => {
    const p = (window as any).jeu.scene.getScene("briques-partie");
    return p.mur === 2 && p.etat === "tenue";
  });
  const mur2 = await partie(page);
  expect(mur2.briques).toBeGreaterThan(10);
  expect(mur2.vies).toBe(3);

  // Perdu : le record du mode sans fin est gardé, avec le mur atteint
  for (let vies = 3; vies > 0; vies--) {
    await laisserTomber(page);
    await page.waitForFunction((vies) => (window as any).jeu.scene.getScene("briques-partie").vies === vies - 1, vies);
  }
  await attendreScene(page, "briques-fin");
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem("briques/sans-fin")!));
  expect(record.mur).toBe(2);
  expect(record.score).toBeGreaterThan(0);
  sansErreur();
});

test("à la manette : A lance la partie puis la balle, Start met en pause, et de là aux niveaux ; B à l'Arcade", async ({ page }) => {
  const { sansErreur } = await menuDesBriques(page);
  await manette(page, "briques-menu", 0);
  await attendreScene(page, "briques-partie");
  await page.waitForTimeout(300);
  await manette(page, "briques-partie", 0);
  expect((await partie(page)).etat).toBe("jeu");
  // La pause arrête la balle ; « Les niveaux » est son dernier bouton
  await manette(page, "briques-partie", 9);
  await attendreLaPause(page);
  const figee = (await partie(page)).balle!;
  await page.waitForTimeout(300);
  expect((await partie(page)).balle).toEqual(figee);
  await manette(page, "socle-pause", 12);
  await manette(page, "socle-pause", 0);
  await attendreScene(page, "briques-menu");
  await manette(page, "briques-menu", 1);
  await attendreScene(page, "Hub");
  sansErreur();
});

test.describe("au doigt", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test("on touche un niveau, la raquette suit le doigt qui glisse, une tape lance la balle", async ({ page }) => {
    const { sansErreur } = await ouvrir(page);
    await toucherLaCarte(page, "briques");
    await attendreScene(page, "briques-menu");
    await page.waitForTimeout(300);
    const carte = await page.evaluate(() => {
      const boite = (window as any).jeu.scene.getScene("briques-menu").cartes[0].boite;
      return { x: boite.x as number, y: boite.y as number };
    });
    await toucher(page, carte.x, carte.y);
    await attendreScene(page, "briques-partie");
    await page.waitForTimeout(500);

    // Le téléphone en 20/9 : le jeu s'élargit, le mur reste au milieu, la raquette part du milieu
    const { largeur } = await tailleDuJeu(page);
    expect(largeur).toBeGreaterThan(1100);
    const placees = await page.evaluate(() => {
      const p = (window as any).jeu.scene.getScene("briques-partie");
      const xs = p.briquesRestantes().map((b: any) => b.x);
      return { gauche: Math.min(...xs), droite: Math.max(...xs), raquette: p.raquette.x as number };
    });
    expect(placees.gauche + placees.droite).toBeCloseTo(largeur, 0);
    expect(placees.raquette).toBeCloseTo(largeur / 2, 0);
    // Au doigt, la raquette est au-dessus de la bande du pouce : le doigt qui glisse en bas ne la cache pas
    const { hauteur } = await tailleDuJeu(page);
    expect(await page.evaluate(() => (window as any).jeu.scene.getScene("briques-partie").raquette.y)).toBeLessThan(hauteur - 100);

    // Le doigt glisse de 200 pixels vers la gauche : la raquette fait de même, et la balle ne part pas
    const depart = await partie(page);
    const cdp = await page.context().newCDPSession(page);
    const de = await versLaPage(page, 700, 500);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: de.x, y: de.y, id: 1 }] });
    for (let pas = 1; pas <= 10; pas++) {
      const a = await versLaPage(page, 700 - 20 * pas, 500);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a.x, y: a.y, id: 1 }] });
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(300);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    const apres = await partie(page);
    expect(Math.abs(apres.raquette - (depart.raquette - 200))).toBeLessThan(12);
    expect(apres.etat).toBe("tenue");

    // Une tape, sans glisser : la balle part
    await toucher(page, 480, 300);
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("briques-partie").etat === "jeu");
    sansErreur();
  });
});
