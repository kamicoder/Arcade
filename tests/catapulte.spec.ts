import { test, expect, type Page } from "@playwright/test";
import { ouvrir, appuyer, attendreScene, versLaPage, ouvrirLaCarte, tailleDuJeu } from "./outils";

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

// Un point du monde (1280 × 720, réduit et centré par la caméra du niveau) en pixels de la page
async function duMonde(page: Page, x: number, y: number) {
  const vue = await page.evaluate(() => {
    const camera = (window as any).jeu.scene.getScene("catapulte-niveau").cameras.main;
    return { gauche: camera.worldView.x as number, haut: camera.worldView.y as number, zoom: camera.zoom as number };
  });
  return versLaPage(page, (x - vue.gauche) * vue.zoom, (y - vue.haut) * vue.zoom);
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
  await appuyer(page, "Enter");            // « Niveau suivant », le premier bouton...
  await appuyer(page, "Escape");           // ... puis Échap pendant le fondu : le premier départ seul compte
  await page.waitForFunction(() => {
    const n = (window as any).jeu.scene.getScene("catapulte-niveau");
    return n.sys.isActive() && n.numero === 1 && n.etat === "pret";
  }, undefined, { timeout: 20_000 });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).jeu.scene.isActive("catapulte-menu"))).toBe(false);
  expect((await niveau(page)).etat).toBe("pret");
  sansErreur();
});

// Le dernier slime tombé hors d'un tir (un bloc qui glissait encore) : le niveau est gagné tout de suite, et
// le boulet de la fronde, qui n'a pas servi, compte avec les autres
test("le dernier slime mort hors d'un tir : gagné tout de suite, le boulet de la fronde compte", async ({ page }) => {
  const { sansErreur } = await menuCatapulte(page);
  await jouerLeNiveau(page, 0);
  const avant = await niveau(page);
  await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("catapulte-niveau");
    for (const slime of [...n.slimes]) {
      n.blesser(slime, 1000);
    }
  });
  await attendreScene(page, "catapulte-fin");
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("catapulte-fin").sys.settings.data.gagne)).toBe(true);
  // Tous les boulets comptent : ceux de la file, et celui de la fronde
  const garde = await page.evaluate(() => JSON.parse(localStorage.getItem("catapulte/niveaux")!));
  expect(garde[0].score).toBeGreaterThanOrEqual((avant.file + 1) * 1000);
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
  // Le tir n'a touché personne : le slime ricane
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("catapulte-niveau").slimes[0].humeur === "ricane",
    undefined, { timeout: 20_000 });
  await attendreScene(page, "catapulte-fin");
  expect((await niveau(page)).etat).toBe("fini");
  expect(await page.evaluate(() => localStorage.getItem("catapulte/niveaux"))).toBeNull();
  await page.waitForTimeout(800);
  await appuyer(page, "Enter");            // « Rejouer » (pas de niveau suivant quand on a perdu)
  await attendreLEtat(page, "pret");
  expect(await niveau(page)).toMatchObject({ file: 2, slimes: 1, score: 0 });
  sansErreur();
});

// Un bloc lâché de très haut tombe encore longtemps après le tir (plus de 9 s) : le tir n'est pas coupé tant
// que tout bouge, et une fois la fin dite, plus rien ne compte (le score affiché est celui gardé)
test("la fin d'un tir attend que tout soit calme, et rien ne compte plus après", async ({ page }) => {
  test.setTimeout(90_000);
  const { sansErreur } = await menuCatapulte(page);
  await jouerLeNiveau(page, 2);            // « Sur la glace » : un slime à découvert, à droite
  await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("catapulte-niveau");
    n.file = [];                           // le dernier boulet
    n.force = 0.3;                         // un tir trop faible, vite posé
    const slime = n.slimes.find((s: any) => s.image.x > 1100).image;
    n.poserUnBloc({ matiere: "pierre", forme: "carre", x: slime.x, y: -17000 });
  });
  await appuyer(page, "Space");
  await page.waitForFunction(() => {
    const n = (window as any).jeu.scene.getScene("catapulte-niveau");
    return n.time.now - n.tirDepuis > 9500;
  }, undefined, { timeout: 30_000 });
  expect((await niveau(page)).etat).toBe("vol");
  await page.waitForFunction(() => (window as any).jeu.scene.isActive("catapulte-fin"), undefined, { timeout: 40_000 });
  const fin = await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("catapulte-niveau");
    const donnees = (window as any).jeu.scene.getScene("catapulte-fin").sys.settings.data;
    return { gagne: donnees.gagne as boolean, score: donnees.score as number, slimes: n.slimes.length as number, actuel: n.score as number };
  });
  // La fin dit ce qui est (gagné si le bloc a écrasé le slime), et le score gardé est celui affiché
  expect(fin.gagne).toBe(fin.slimes === 0);
  if (fin.gagne) {
    const garde = await page.evaluate(() => JSON.parse(localStorage.getItem("catapulte/niveaux")!));
    expect(garde[2].score).toBe(fin.score);
  }
  await page.waitForTimeout(1500);
  expect(await niveau(page)).toMatchObject({ score: fin.actuel, slimes: fin.slimes });
  sansErreur();
});

test("ce qui tombe du monde disparaît, sans rapporter de points", async ({ page }) => {
  const { sansErreur } = await menuCatapulte(page);
  await jouerLeNiveau(page, 2);
  // Un slime projeté vers la droite (réveillé : posé, il dormait) : la physique l'emporte au-delà du bord
  await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("catapulte-niveau");
    const slime = n.slimes.find((s: any) => s.image.x > 1100).image;
    slime.setAwake().setPosition(1500, 200).setVelocity(15, 0);
  });
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("catapulte-niveau").slimes.length === 1);
  expect((await niveau(page)).score).toBe(0);
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
  // Les trois petits ne se cognent pas entre eux : nés l'un dans l'autre, ils se repoussaient
  await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("catapulte-niveau");
    (window as any).__entreBoulets = 0;
    n.matter.world.on("collisionstart", (e: any) => {
      for (const { bodyA, bodyB } of e.pairs) {
        if (bodyA.label === "boulet" && bodyB.label === "boulet") {
          (window as any).__entreBoulets++;
        }
      }
    });
  });
  await page.waitForTimeout(300);
  await appuyer(page, "Space");
  expect((await niveau(page)).enVol).toBe(3);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__entreBoulets)).toBe(0);
  // Et ils frottent comme un boulet normal
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("catapulte-niveau").enVol
    .map((p: any) => p.image.body.friction))).toEqual([0.5, 0.5, 0.5]);
  // Divisé : la fiche s'en va
  await page.waitForFunction(() => !(window as any).jeu.scene.getScene("catapulte-tableau").fiche.visible);
  sansErreur();
});

test("la trace du tir d'avant : posée pendant le vol, gardée jusqu'au tir suivant", async ({ page }) => {
  const { sansErreur } = await menuCatapulte(page);
  await jouerLeNiveau(page, 0);
  await page.evaluate(() => {
    (window as any).jeu.scene.getScene("catapulte-niveau").force = 0.4;   // un tir court, loin du slime
  });
  await appuyer(page, "Space");
  await attendreLEtat(page, "pret");       // le boulet suivant est dans la fronde
  const trace = () => page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("catapulte-niveau");
    return { points: n.trace as { x: number; y: number }[], dessin: n.traceDessinee.commandBuffer.length as number };
  });
  const avant = await trace();
  expect(avant.points.length).toBeGreaterThan(5);
  expect(avant.dessin).toBeGreaterThan(5);
  // Elle part de la fronde et suit le boulet jusque loin d'elle
  expect(avant.points[0].x).toBeLessThan(300);
  expect(avant.points.at(-1)!.x).toBeGreaterThan(400);
  // Elle reste tant qu'on vise...
  await appuyer(page, "ArrowUp");
  await page.waitForTimeout(300);
  expect((await trace()).points).toEqual(avant.points);
  // ... et le tir suivant l'efface pour poser la sienne
  await appuyer(page, "Space");
  expect((await trace()).points.length).toBeLessThan(avant.points.length);
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("catapulte-niveau").trace.length > 0);
  expect((await trace()).points[0].x).toBeLessThan(300);
  sansErreur();
});

// Les vibrations passent aussi par là (un écroulement, un slime qui éclate) : sans manette ni vibreur, rien ne casse
test("le poids des chocs : un gros écroulement secoue l'écran, le dernier slime ralentit tout un instant", async ({ page }) => {
  const { sansErreur } = await menuCatapulte(page);
  await jouerLeNiveau(page, 7);            // « La forteresse » : beaucoup de blocs, quatre slimes
  // Les slimes éclatent un à un (d'un coup, avant que rien ne bouge) : le ralenti n'arrive qu'au dernier
  const rythmes = await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("catapulte-niveau");
    const temps = n.matter.world.engine.timing;
    for (const slime of n.slimes.slice(1)) {
      n.blesser(slime, 1000);
    }
    const avantLeDernier = temps.timeScale as number;
    n.blesser(n.slimes[0], 1000);
    return { avantLeDernier, auDernier: temps.timeScale as number };
  });
  expect(rythmes.avantLeDernier).toBe(1);
  expect(rythmes.auDernier).toBeLessThan(0.5);
  // Quatre blocs cassés d'un coup : l'écran tremble
  expect(await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("catapulte-niveau");
    for (const bloc of n.blocs.slice(0, 4)) {
      n.blesser(bloc, 1000);
    }
    return n.cameras.main.shakeEffect.isRunning as boolean;
  })).toBe(true);
  // Puis tout reprend son rythme, la physique comme les éclats
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("catapulte-niveau").matter.world.engine.timing.timeScale === 1,
    undefined, { timeout: 5000 });
  expect(await page.evaluate(() => [...(window as any).jeu.scene.getScene("catapulte-niveau").gerbes.values()]
    .every((g: any) => g.timeScale === 1))).toBe(true);
  sansErreur();
});

test.describe("au doigt", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test("le jeu prend la largeur du téléphone ; on touche le niveau, puis on tire l'élastique du doigt", async ({ page }) => {
    const { sansErreur } = await ouvrir(page);
    await ouvrirLaCarte(page, "catapulte");
    await attendreScene(page, "catapulte-menu");
    // Plus de bandes noires : le jeu a la proportion de l'écran (20/9), la hauteur reste 540
    const largeur = Math.round(540 * 844 / 390);
    expect(await tailleDuJeu(page)).toEqual({ largeur, hauteur: 540 });
    expect((await page.locator("canvas").boundingBox())!.width).toBeCloseTo(844, 0);
    await page.evaluate(() => {
      const carte = (window as any).jeu.scene.getScene("catapulte-menu").cartes[0].boite;
      (window as any).__carte = { x: carte.x, y: carte.y };
    });
    const carte = await page.evaluate(() => (window as any).__carte);
    const p = await versLaPage(page, carte.x, carte.y);
    await page.touchscreen.tap(p.x, p.y);
    await attendreLEtat(page, "pret");
    // Le niveau aussi : le monde entier, à la même hauteur, au milieu ; le tableau de bord suit la largeur
    expect(await page.evaluate(() => {
      const camera = (window as any).jeu.scene.getScene("catapulte-niveau").cameras.main;
      const tableau = (window as any).jeu.scene.getScene("catapulte-tableau");
      return {
        zoom: camera.zoom, x: Math.round(camera.midPoint.x), y: Math.round(camera.midPoint.y),
        largeurDeLaCamera: camera.width, score: tableau.score.x,
      };
    })).toEqual({ zoom: 0.75, x: 640, y: 360, largeurDeLaCamera: largeur, score: largeur / 2 });

    // Une tape à gauche (pour chasser l'annonce, par exemple) ne tire pas
    const tape = await duMonde(page, 300, 300);
    await page.touchscreen.tap(tape.x, tape.y);
    await page.waitForTimeout(300);
    expect(await niveau(page)).toMatchObject({ etat: "pret", file: 2 });

    // Le doigt posé loin du boulet, on tire en arrière : le boulet suit le glissé, sans sauter sous le doigt
    const cdp = await page.context().newCDPSession(page);
    const de = await duMonde(page, 300, 300);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: de.x, y: de.y, id: 1 }] });
    await page.waitForTimeout(50);
    expect((await niveau(page)).etat).toBe("pret");
    for (let k = 1; k <= 8; k++) {
      const a = await duMonde(page, 300 - 11 * k, 300 + 7 * k);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a.x, y: a.y, id: 1 }] });
      await page.waitForTimeout(20);
    }
    expect((await niveau(page)).etat).toBe("vise");
    const boulet = await page.evaluate(() => {
      const image = (window as any).jeu.scene.getScene("catapulte-niveau").boulet.image;
      return { x: image.x as number, y: image.y as number };
    });
    expect(boulet.x).toBeCloseTo(190 - 88, -1);
    expect(boulet.y).toBeCloseTo(520 + 56, -1);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    const vol = await niveau(page);
    expect(vol.etat).toBe("vol");
    expect(vol.vitesse!.x).toBeGreaterThan(10);
    sansErreur();
  });
});
