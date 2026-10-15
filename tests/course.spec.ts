// Le jeu de course et ses deux thèmes : les voitures (la première carte du Hub) et les licornes (la deuxième).
// Le code est le même pour les deux thèmes : chaque scénario n'est joué qu'une fois, dans l'un ou l'autre.
// Seul le premier test passe par les deux, pour faire tourner le décor, les dessins et le pilote de chacun.
import { test, expect, type Page } from "@playwright/test";
import { ouvrir, appuyer, attendreScene, scenesActives, versLaPage, toucher, toucherLaCarte, manette } from "./outils";

type IdTheme = "voitures" | "licornes";
const CARTE: Record<IdTheme, number> = { voitures: 0, licornes: 1 };

// Les modes du menu, dans l'ordre (au doigt, sans la course à deux)
const MODES = ["grandprix", "course", "duo", "chrono", "atelier", "editeur"];

// Du Hub jusqu'au menu de la course, dans un thème
async function menu(page: Page, theme: IdTheme) {
  const ouverte = await ouvrir(page);
  for (let i = 0; i < CARTE[theme]; i++) {
    await appuyer(page, "ArrowRight");
  }
  await appuyer(page, "Enter");
  await attendreScene(page, "course-menu");
  return ouverte;
}

// Choisir un mode au clavier (depuis le premier, le Grand Prix) et valider
async function mode(page: Page, id: string) {
  for (let i = 0; i < MODES.indexOf(id); i++) {
    await appuyer(page, "ArrowDown");
  }
  await appuyer(page, "Enter");
}

// L'état de la course, lu dans la scène Phaser
function course(page: Page) {
  return page.evaluate(() => {
    const c = (window as any).jeu.scene.getScene("course-piste");
    const j = c.joueurs[0];
    return {
      theme: c.theme.id as string,
      mode: c.donnees.mode as string,
      circuit: c.circuit.modele.id as string,
      nomCircuit: c.circuit.modele.nom as string,
      coureurs: c.coureurs.length as number,
      joueurs: c.joueurs.length as number,
      cameras: c.cameras.cameras.length as number,
      enCourse: c.enCourse as boolean,
      vitesse: j.vitesse as number,
      vitesseJ2: (c.joueurs[1]?.vitesse ?? 0) as number,
      reserve: j.reserve as number,
      turbo: j.turbo as number,
      tactile: { ...c.tactile } as Record<string, boolean>,
    };
  });
}

async function attendreLeDepart(page: Page) {
  await attendreScene(page, "course-piste");
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("course-piste").enCourse, null, { timeout: 10_000 });
}

// Le joueur vient de finir son dernier tour
function finirLaCourse(page: Page, joueur = 0) {
  return page.evaluate((joueur) => {
    const c = (window as any).jeu.scene.getScene("course-piste");
    const j = c.joueurs[joueur];
    j.tour = 3;
    j.progres = 3 * c.circuit.longueur;
  }, joueur);
}

const sauvegarde = (page: Page, cle: string) => page.evaluate((cle) => {
  const texte = localStorage.getItem(cle);
  return texte === null ? null : JSON.parse(texte);
}, cle);

// Les objets d'un type sur la route (étoiles, orages, bonbons...)
function poserSur(page: Page, type: string) {
  return page.evaluate((type) => {
    const c = (window as any).jeu.scene.getScene("course-piste");
    const objet = c.objets.find((o: any) => o.type.id === type).image;
    const j = c.joueurs[0];
    j.x = objet.x;
    j.y = objet.y;
    // Son point sur la trace, cherché partout : il ne cherche d'habitude qu'autour du précédent
    let meilleur = 0;
    c.circuit.trace.forEach((p: any, i: number) => {
      const t = c.circuit.trace[meilleur];
      if ((p.x - j.x) ** 2 + (p.y - j.y) ** 2 < (t.x - j.x) ** 2 + (t.y - j.y) ** 2) {
        meilleur = i;
      }
    });
    j.indice = meilleur;
  }, type);
}

// ===== Un thème se branche simplement : le même jeu, d'un bout à l'autre =====

for (const theme of ["voitures", "licornes"] as IdTheme[]) {
  test(`${theme} : le même jeu de bout en bout, du menu à l'arrivée d'une course contre l'ordinateur`, async ({ page }) => {
    const { sansErreur } = await menu(page, theme);
    await mode(page, "course");
    await attendreScene(page, "course-circuits");
    await appuyer(page, "Enter");
    await attendreLeDepart(page);
    expect(await course(page)).toMatchObject({ theme, mode: "course", coureurs: 4, joueurs: 1 });

    // Le joueur conduit un peu, puis l'ordinateur l'emmène passer la ligne pour de vrai
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(1000);
    await page.keyboard.up("ArrowUp");
    expect((await course(page)).vitesse).toBeGreaterThan(200);
    await page.evaluate(() => {
      const c = (window as any).jeu.scene.getScene("course-piste");
      const j = c.joueurs[0];
      j.pilote = true;
      j.tour = 3;
      j.progres = 3 * c.circuit.longueur - 250;
    });
    await attendreScene(page, "course-arrivee");
    const resultats = await page.evaluate(() =>
      (window as any).jeu.scene.getScene("course-arrivee").scene.settings.data.resultats.length);
    expect(resultats).toBe(4);
    await page.waitForTimeout(1100);
    await appuyer(page, "Enter");
    await attendreScene(page, "course-menu");
    sansErreur();
  });
}

test("chaque carte du Hub ouvre la course dans son thème, et Échap y ramène, sur la même carte", async ({ page }) => {
  const { sansErreur } = await ouvrir(page);
  const carteChoisie = () => page.evaluate(() => (window as any).jeu.scene.getScene("Hub").choisie as number);
  const themeDuMenu = () => page.evaluate(() => (window as any).jeu.scene.getScene("course-menu").modes[4].nom as string);
  for (const [theme, atelier] of [["voitures", "Le garage"], ["licornes", "Atelier des licornes"]] as [IdTheme, string][]) {
    while (await carteChoisie() < CARTE[theme]) {
      await appuyer(page, "ArrowRight");
    }
    await appuyer(page, "Enter");
    await attendreScene(page, "course-menu");
    expect(await themeDuMenu()).toBe(atelier);
    // Pas de changement de thème quand chaque thème a sa carte
    expect(await page.evaluate(() => (window as any).jeu.scene.getScene("course-menu").children.list
      .some((o: any) => typeof o.text === "string" && o.text.includes("⇄")))).toBe(false);
    await appuyer(page, "Escape");
    await attendreScene(page, "Hub");
    expect(await scenesActives(page)).toEqual(["Hub"]);   // la musique des licornes s'arrête aussi
    expect(await carteChoisie()).toBe(CARTE[theme]);
  }
  sansErreur();
});

// Le bonus pour plus tard : une seule carte de course (courseAuTheme() sans thème), et le thème se choisit au menu
test("une seule carte de course : le menu change de thème (T)", async ({ page }) => {
  const { sansErreur } = await menu(page, "voitures");
  // Ce que ferait la carte unique du catalogue : courseAuTheme(), sans thème
  await page.evaluate(() => (window as any).jeu.scene.getScene("course-menu").scene.start("course-chargement", { choixDuTheme: true }));
  await attendreScene(page, "course-menu");
  await page.waitForTimeout(400);
  await appuyer(page, "t");
  await page.waitForFunction(() => {
    const m = (window as any).jeu.scene.getScene("course-menu");
    return m.scene.isActive() && m.modes[4]?.nom === "Atelier des licornes";
  });
  expect(await scenesActives(page)).toEqual(["course-musique", "course-menu"]);
  // La dernière fois, c'étaient les licornes : la carte unique les reprend
  expect(await sauvegarde(page, "course/theme")).toBe("licornes");
  sansErreur();
});

// ===== Les voitures =====

test.describe("les voitures", () => {
  test("le nez contre les pneus, la marche arrière fait repartir", async ({ page }) => {
    const { sansErreur } = await menu(page, "voitures");
    await mode(page, "chrono");
    await attendreScene(page, "course-circuits");
    await appuyer(page, "Enter");
    await attendreLeDepart(page);

    // La voiture dans l'herbe, tournée vers les pneus ; elle fonce dedans
    await page.evaluate(() => {
      const c = (window as any).jeu.scene.getScene("course-piste");
      const v = c.joueurs[0];
      const t = c.circuit.trace[200];
      v.x = t.x + t.nx * 110;
      v.y = t.y + t.ny * 110;
      v.vx = 0;
      v.vy = 0;
      v.angle = Math.atan2(t.ny, t.nx);
      v.indice = 200;
    });
    const ecart = () => page.evaluate(() => {
      const c = (window as any).jeu.scene.getScene("course-piste");
      const v = c.joueurs[0];
      const t = c.circuit.trace[v.indice];
      return Math.hypot(v.x - t.x, v.y - t.y);
    });
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(1000);
    await page.keyboard.up("ArrowUp");
    expect(await ecart()).toBeGreaterThan(125);   // contre les pneus

    await page.keyboard.down("ArrowDown");
    await page.waitForTimeout(800);
    await page.keyboard.up("ArrowDown");
    expect(await ecart()).toBeLessThan(100);      // repartie vers la route
    sansErreur();
  });

  test("dans l'herbe aussi, le tour compte pile sur la ligne", async ({ page }) => {
    const { sansErreur } = await menu(page, "voitures");
    await mode(page, "chrono");
    await attendreScene(page, "course-circuits");
    await appuyer(page, "Enter");
    await attendreLeDepart(page);

    // L'ordinateur conduit le joueur dans l'herbe, à 105 pixels du milieu de la route, et on le pose
    // 400 pixels avant la ligne, à la fin de son premier tour
    await page.evaluate(() => {
      const c = (window as any).jeu.scene.getScene("course-piste");
      const j = c.joueurs[0];
      const trace = c.circuit.trace;
      const i = trace.length - 40;
      j.pilote = true;
      j.couloir = 105;
      j.couloirVoulu = 105;
      j.attenteCouloir = 1e9;
      j.x = trace[i].x + trace[i].nx * 105;
      j.y = trace[i].y + trace[i].ny * 105;
      j.angle = Math.atan2(trace[i].ty, trace[i].tx);
      j.indice = i;
      j.progres = trace[i].s;
    });
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("course-piste").joueurs[0].tour === 2, null, { timeout: 15_000 });

    // Où est-elle, au moment où le tour compte ? Sa distance à la ligne, dans le sens de la course
    const apresLaLigne = await page.evaluate(() => {
      const c = (window as any).jeu.scene.getScene("course-piste");
      const ligne = c.circuit.portes[0];
      const a = c.circuit.angleDepart;
      const j = c.joueurs[0];
      return (j.x - ligne.x) * Math.cos(a) + (j.y - ligne.y) * Math.sin(a);
    });
    expect(apresLaLigne).toBeGreaterThan(-15);    // les points de la trace sont à 10 pixels l'un de l'autre
    expect(apresLaLigne).toBeLessThan(15);
    sansErreur();
  });

  test("le Grand Prix : des rivaux de plus en plus forts, les points qui s'additionnent, le podium", async ({ page }) => {
    const { sansErreur } = await menu(page, "voitures");
    await mode(page, "grandprix");

    // Deux courses pour de vrai ; la troisième est sautée (le même chemin que la deuxième)
    const circuits = ["Le Vallon", "La Grande Boucle"];
    const niveaux = [0.7, 0.75];
    for (let n = 0; n < 2; n++) {
      await attendreScene(page, "course-piste");
      expect(await course(page)).toMatchObject({ mode: "grandprix", nomCircuit: circuits[n], coureurs: 4 });
      const niveauDesRivaux = await page.evaluate(() =>
        (window as any).jeu.scene.getScene("course-piste").coureurs.slice(1).map((v: any) => v.niveau));
      expect(niveauDesRivaux).toEqual([niveaux[n], niveaux[n], niveaux[n]]);
      await attendreLeDepart(page);
      if (n === 0) {
        // Les rivaux courent tout seuls
        await page.waitForTimeout(1000);
        const vitesses = await page.evaluate(() =>
          (window as any).jeu.scene.getScene("course-piste").coureurs.slice(1).map((v: any) => v.vitesse));
        for (const vitesse of vitesses) {
          expect(vitesse).toBeGreaterThan(100);
        }
      } else {
        // La deuxième course devient la dernière du Grand Prix
        await page.evaluate(() => {
          (window as any).jeu.scene.getScene("course-piste").donnees.grandPrix.etape = 2;
        });
      }

      // Le joueur gagne : 10 points à chaque course, et les rivaux se partagent 7, 5 et 3
      await finirLaCourse(page);
      await attendreScene(page, "course-arrivee");
      await page.waitForTimeout(1100);
      await appuyer(page, "Enter");
      await attendreScene(page, "course-grand-prix");
      expect(await scenesActives(page)).toEqual(["course-grand-prix"]);
      const gp = await page.evaluate(() =>
        (window as any).jeu.scene.getScene("course-grand-prix").scene.settings.data.grandPrix);
      expect(gp.points[0]).toBe(10 * (n + 1));   // la voiture n° 1, celle du joueur
      const rivaux = Object.entries(gp.points).filter(([numero]) => numero !== "0").map(([, points]) => points as number);
      expect(rivaux.reduce((a, b) => a + b)).toBe((7 + 5 + 3) * (n + 1));
      await page.waitForTimeout(700);
      await appuyer(page, "Enter");
    }

    // Après la dernière course : le podium, puis le menu
    await attendreScene(page, "course-podium");
    await page.waitForTimeout(1100);
    await appuyer(page, "Enter");
    await attendreScene(page, "course-menu");
    sansErreur();
  });

  // Une touche telle qu'un clavier AZERTY l'envoie : sa place (code), sa lettre (key) et son keyCode.
  // Le protocole de Chromium les donne séparément ; Playwright, lui, les déduit l'un de l'autre.
  async function toucheAzerty(page: Page, type: "keyDown" | "keyUp", code: string, lettre: string, keyCode: number) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchKeyEvent", {
      type, code, key: lettre, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode,
    });
  }

  const cameras = (page: Page) => page.evaluate(() =>
    (window as any).jeu.scene.getScene("course-piste").cameras.cameras.map((c: any) => [c.x, c.width]));

  test("à deux : l'écran coupé en deux, le joueur 2 sur Z Q S D d'un clavier AZERTY, les rivaux en option", async ({ page }) => {
    const { sansErreur } = await menu(page, "voitures");
    await mode(page, "duo");
    await attendreScene(page, "course-circuits");
    await appuyer(page, "r");              // deux rivaux...
    expect(await sauvegarde(page, "course/voitures/rivaux")).toBe(2);
    await appuyer(page, "r");              // ... ou aucun : juste nous deux
    expect(await sauvegarde(page, "course/voitures/rivaux")).toBe(0);
    await appuyer(page, "Enter");
    await attendreScene(page, "course-piste");
    expect(await course(page)).toMatchObject({ mode: "duo", coureurs: 2, joueurs: 2 });
    expect(await cameras(page)).toEqual([[0, 478], [482, 478]]);
    await attendreLeDepart(page);

    // La touche Z d'un AZERTY : la lettre « z » (keyCode 90), à la place du W d'un QWERTY
    await toucheAzerty(page, "keyDown", "KeyW", "z", 90);
    await page.waitForTimeout(800);
    let etat = await course(page);
    expect(etat.vitesseJ2).toBeGreaterThan(150);
    expect(etat.vitesse).toBe(0);
    await toucheAzerty(page, "keyUp", "KeyW", "z", 90);

    // La même lettre « z », mais à la place du Z d'un QWERTY (en bas à gauche) : pas la touche du joueur 2
    await page.waitForTimeout(1000);       // le joueur 2 ralentit
    const avant = (await course(page)).vitesseJ2;
    await toucheAzerty(page, "keyDown", "KeyZ", "z", 90);
    await page.waitForTimeout(500);
    expect((await course(page)).vitesseJ2).toBeLessThan(avant);
    await toucheAzerty(page, "keyUp", "KeyZ", "z", 90);

    // Le joueur 1 : les flèches
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(800);
    etat = await course(page);
    expect(etat.vitesse).toBeGreaterThan(150);
    await page.keyboard.up("ArrowUp");

    // Le joueur 2 arrive le premier : la course continue jusqu'au joueur 1
    await finirLaCourse(page, 1);
    await page.waitForTimeout(2800);
    expect(await page.evaluate(() => (window as any).jeu.scene.isActive("course-arrivee"))).toBe(false);
    await finirLaCourse(page, 0);
    await attendreScene(page, "course-arrivee");
    const rangs = await page.evaluate(() => (window as any).jeu.scene.getScene("course-piste").joueurs.map((j: any) => j.rang));
    expect(rangs).toEqual([2, 1]);
    await page.waitForTimeout(1100);
    await appuyer(page, "r");              // rejouer, toujours à deux
    await attendreLeDepart(page);
    expect(await course(page)).toMatchObject({ mode: "duo", joueurs: 2 });
    await appuyer(page, "Escape");
    await attendreScene(page, "course-menu");

    // Seul de nouveau : une seule caméra, sur tout l'écran
    await appuyer(page, "ArrowDown");      // de « Course à deux » à « Contre la montre »
    await appuyer(page, "Enter");
    await attendreScene(page, "course-circuits");
    await appuyer(page, "Enter");
    await attendreScene(page, "course-piste");
    expect(await course(page)).toMatchObject({ mode: "chrono", coureurs: 1 });
    expect(await cameras(page)).toEqual([[0, 960]]);
    sansErreur();
  });

  test("une pause pendant le 3, 2, 1 : le moteur revient à la reprise", async ({ page }) => {
    const { sansErreur } = await menu(page, "voitures");
    await mode(page, "chrono");
    await attendreScene(page, "course-circuits");
    await appuyer(page, "Enter");
    await attendreScene(page, "course-tableau");
    const moteur = () => page.evaluate(() =>
      (window as any).jeu.sound.getAll("voiture-moteur").some((s: any) => s.isPlaying) as boolean);
    await page.waitForFunction(() => (window as any).jeu.sound.getAll("voiture-moteur").some((s: any) => s.isPlaying));
    await appuyer(page, "p");
    await attendreScene(page, "course-pause");
    expect(await page.evaluate(() => (window as any).jeu.scene.getScene("course-piste").enCourse)).toBe(false);
    expect(await moteur()).toBe(false);
    await appuyer(page, "p");
    await page.waitForFunction(() => (window as any).jeu.sound.getAll("voiture-moteur").some((s: any) => s.isPlaying));
    await attendreLeDepart(page);
    expect(await moteur()).toBe(true);
    sansErreur();
  });

  // Les boutons d'une manette « standard » : voir socle/manette.ts
  const CROIX_DROITE = 15, X = 2, START = 9;

  test("deux manettes : chacune règle la voiture de son joueur au menu, et lance son turbo ; Start met en pause", async ({ page }) => {
    const { sansErreur } = await menu(page, "voitures");
    const noms = () => page.evaluate(() => {
      const m = (window as any).jeu.scene.getScene("course-menu");
      return [m.cartes[0].nom.text, m.cartes[1].nom.text] as string[];
    });
    const avant = await noms();
    await manette(page, "course-menu", CROIX_DROITE, 1);   // la deuxième manette
    const apres = await noms();
    expect(apres[0]).toBe(avant[0]);
    expect(apres[1]).not.toBe(avant[1]);
    await manette(page, "course-menu", CROIX_DROITE, 0);   // la première
    const encore = await noms();
    expect(encore[0]).not.toBe(apres[0]);
    expect(encore[1]).toBe(apres[1]);

    await mode(page, "duo");
    await attendreScene(page, "course-circuits");
    await appuyer(page, "Enter");
    await attendreLeDepart(page);
    await page.evaluate(() => {
      for (const j of (window as any).jeu.scene.getScene("course-piste").joueurs) {
        j.reserve = 1;
      }
    });
    const turbos = () => page.evaluate(() =>
      (window as any).jeu.scene.getScene("course-piste").joueurs.map((j: any) => j.turbo > 0) as boolean[]);
    await manette(page, "course-piste", X, 1);             // X : le turbo, ici celui du joueur 2
    expect(await turbos()).toEqual([false, true]);
    await manette(page, "course-piste", X, 0);
    expect(await turbos()).toEqual([true, true]);
    await manette(page, "course-piste", START, 0);
    await attendreScene(page, "course-pause");
    sansErreur();
  });

  test("le garage : une voiture personnalisée, décalco comprise, en course et après un rechargement", async ({ page }) => {
    const { sansErreur } = await menu(page, "voitures");
    await mode(page, "atelier");
    await attendreScene(page, "course-atelier");
    // Les lignes : la voiture, son nom (choisi d'entrée), la carrosserie, la décalco, sa couleur, la pièce en plus.
    // Le nom : on efface celui de départ, on tape « Zou »
    for (let i = 0; i < 20; i++) {
      await appuyer(page, "Backspace");
    }
    for (const lettre of "Zou") {
      await appuyer(page, lettre);
    }
    for (const _rubrique of ["carrosserie", "decalco", "couleurDecalco", "piece"]) {
      await appuyer(page, "ArrowDown");
      await appuyer(page, "ArrowRight");
    }
    const perso = await sauvegarde(page, "course/voitures/perso/0");
    expect(perso).toEqual({ nom: "Zou", carrosserie: "#e8453c", decalco: "flammes", couleurDecalco: "#1c1a25", piece: "aileron" });
    await appuyer(page, "Escape");
    await attendreScene(page, "course-menu");
    expect(await page.evaluate(() => (window as any).jeu.scene.getScene("course-menu").cartes[0].nom.text)).toBe("Zou");
    const auMenu = await page.evaluate(() => (window as any).jeu.scene.getScene("course-menu").cartes[0].vehicule.texture.key);

    // En course : la même voiture (la même image, dessinée d'après la même apparence)
    await appuyer(page, "ArrowUp");
    await appuyer(page, "ArrowUp");
    await appuyer(page, "ArrowUp");
    await appuyer(page, "ArrowUp");        // de « Le garage » à « Grand Prix »
    await appuyer(page, "Enter");
    await attendreScene(page, "course-piste");
    const enCourse = await page.evaluate(() => {
      const c = (window as any).jeu.scene.getScene("course-piste");
      return { cle: c.vues[0].objet.texture.key, decalco: c.joueurs[0].apparence.decalco, carrosserie: c.joueurs[0].apparence.carrosserie };
    });
    expect(enCourse).toEqual({ cle: auMenu, decalco: "flammes", carrosserie: "#e8453c" });

    // La page rechargée : la voiture est toujours là
    await page.reload();
    await attendreScene(page, "Hub");
    await appuyer(page, "Enter");
    await attendreScene(page, "course-menu");
    expect(await page.evaluate(() => (window as any).jeu.scene.getScene("course-menu").cartes[0].vehicule.texture.key)).toBe(auMenu);
    sansErreur();
  });

  // ===== L'éditeur =====

  function pointsDeLEditeur(page: Page) {
    return page.evaluate(() => (window as any).jeu.scene.getScene("course-editeur").points as { x: number; y: number }[]);
  }

  // Un point du monde (2600 × 1800) sur la carte de l'éditeur, en pixels du jeu
  const surLaCarte = (x: number, y: number) => ({ x: 142 + x * 0.26, y: 64 + y * 0.26 });

  async function cliquer(page: Page, x: number, y: number, bouton: "left" | "right" = "left") {
    const p = await versLaPage(page, surLaCarte(x, y).x, surLaCarte(x, y).y);
    await page.mouse.click(p.x, p.y, { button: bouton });
    await page.waitForTimeout(80);
  }

  const QUATRE_POINTS = [[500, 400], [2100, 400], [2100, 1400], [500, 1400]];
  const pistes = (page: Page) => page.evaluate(() =>
    (window as any).jeu.textures.getTextureKeys().filter((cle: string) => cle.startsWith("course-piste-voitures-dessine-")).length);

  test("dessiner ton circuit à la souris : poser, glisser, enlever, puis courir dessus", async ({ page }) => {
    const { sansErreur } = await menu(page, "voitures");
    await mode(page, "editeur");
    await attendreScene(page, "course-editeur");

    // Avec moins de 4 points, Entrée ne fait rien, et Échap revient sans rien garder
    await cliquer(page, 500, 400);
    await cliquer(page, 2100, 400);
    await appuyer(page, "Enter");
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as any).jeu.scene.isActive("course-editeur"))).toBe(true);
    await appuyer(page, "Escape");
    await attendreScene(page, "course-menu");
    expect(await sauvegarde(page, "course/voitures/circuit-dessine")).toBeNull();
    await appuyer(page, "Enter");          // le menu est resté sur « Dessiner un circuit »
    await attendreScene(page, "course-editeur");
    expect(await pointsDeLEditeur(page)).toHaveLength(0);

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

    // Entrée : enregistré, et choisi pour la prochaine course
    await appuyer(page, "Enter");
    await attendreScene(page, "course-menu");
    expect(await sauvegarde(page, "course/voitures/circuit-dessine")).toEqual(points);
    expect(await sauvegarde(page, "course/voitures/circuit")).toBe("dessine");

    // On court dessus (contre la montre : deux modes plus haut)
    await appuyer(page, "ArrowUp");
    await appuyer(page, "ArrowUp");
    await appuyer(page, "Enter");
    await attendreScene(page, "course-circuits");
    expect(await page.evaluate(() => (window as any).jeu.scene.getScene("course-circuits").nom.text)).toBe("Mon circuit");
    await appuyer(page, "Enter");
    await attendreScene(page, "course-piste");
    expect(await course(page)).toMatchObject({ mode: "chrono", nomCircuit: "Mon circuit" });
    expect(await pistes(page)).toBe(1);

    // Un record sur ce circuit, puis on le redessine : le record est effacé, la piste sera refaite
    await page.evaluate(() => localStorage.setItem("course/voitures/record/dessine", JSON.stringify({ temps: 12, fantome: [] })));
    await appuyer(page, "Escape");
    await attendreScene(page, "course-menu");
    await appuyer(page, "ArrowDown");
    await appuyer(page, "ArrowDown");
    await appuyer(page, "Enter");
    await attendreScene(page, "course-editeur");
    expect(await pointsDeLEditeur(page)).toEqual(points);
    await cliquer(page, 1300, 1600);
    await appuyer(page, "Enter");
    await attendreScene(page, "course-menu");
    expect(await sauvegarde(page, "course/voitures/record/dessine")).toBeNull();
    expect(await pistes(page)).toBe(0);
    expect((await sauvegarde(page, "course/voitures/circuit-dessine")).length).toBe(5);
    sansErreur();
  });

  test.describe("au doigt", () => {
    test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

    test("pas de course à deux au doigt ; toucher pose un point, toucher un point l'enlève, ✓ enregistre", async ({ page }) => {
      const { sansErreur } = await ouvrir(page);
      await toucherLaCarte(page, "voiture");
      await attendreScene(page, "course-menu");
      const modes = await page.evaluate(() => (window as any).jeu.scene.getScene("course-menu").modes.map((m: any) => m.id));
      expect(modes).toEqual(["grandprix", "course", "chrono", "atelier", "editeur"]);
      await toucher(page, 610, 339);       // « Dessiner un circuit », le cinquième bouton
      await attendreScene(page, "course-editeur");

      const poser = async (x: number, y: number) => {
        await toucher(page, surLaCarte(x, y).x, surLaCarte(x, y).y);
        await page.waitForTimeout(80);
      };
      for (const [x, y] of QUATRE_POINTS) {
        await poser(x, y);
      }
      expect(await pointsDeLEditeur(page)).toHaveLength(4);
      await poser(2100, 400);              // toucher le point 2 sans le glisser : il s'en va
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

      await toucher(page, 887, 20);        // ✓ Garder
      await attendreScene(page, "course-menu");
      expect((await sauvegarde(page, "course/voitures/circuit-dessine")).length).toBe(4);
      sansErreur();
    });
  });
});

// ===== Les licornes =====

test.describe("les licornes", () => {
  test("contre la montre : le record est gardé, et le fantôme apparaît", async ({ page }) => {
    const { sansErreur } = await menu(page, "licornes");
    await mode(page, "chrono");
    await attendreScene(page, "course-circuits");
    await appuyer(page, "Enter");
    await attendreLeDepart(page);
    expect(await course(page)).toMatchObject({ mode: "chrono", circuit: "coeur", coureurs: 1 });
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(2000);
    await page.keyboard.up("ArrowUp");
    await finirLaCourse(page);
    await attendreScene(page, "course-arrivee");

    const record = await sauvegarde(page, "course/licornes/record/coeur");
    expect(record.temps).toBeGreaterThan(1);
    expect(record.fantome.length).toBeGreaterThan(50);

    // Une nouvelle course sur le même circuit, par le menu (qui se souvient du mode) : le fantôme galope devant
    await page.waitForTimeout(1100);
    await appuyer(page, "Enter");
    await attendreScene(page, "course-menu");
    await appuyer(page, "Enter");
    await attendreScene(page, "course-circuits");
    await appuyer(page, "Enter");
    await attendreLeDepart(page);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as any).jeu.scene.getScene("course-piste").ombre.objet.visible)).toBe(true);
    sansErreur();
  });

  // Un record déjà là, et son fantôme, avant d'ouvrir la course
  const poserUnRecord = (page: Page, temps: number, fantome: { t: number; x: number; y: number; angle: number }[] = []) =>
    page.evaluate(([temps, fantome]) =>
      localStorage.setItem("course/licornes/record/coeur", JSON.stringify({ temps, fantome })), [temps, fantome] as const);

  test("contre la montre : les confettis saluent un nouveau record ou le premier temps, pas une course plus lente", async ({ page }) => {
    const { sansErreur } = await menu(page, "licornes");
    const confettis = () => page.evaluate(() => (window as any).jeu.scene.getScene("course-arrivee").children.list
      .filter((o: any) => typeof o.getAliveParticleCount === "function")
      .reduce((n: number, o: any) => n + o.getAliveParticleCount(), 0) as number);

    // Un record imbattable : pas de fête
    await poserUnRecord(page, 0.01);
    await mode(page, "chrono");
    await attendreScene(page, "course-circuits");
    await appuyer(page, "Enter");
    await attendreLeDepart(page);
    await finirLaCourse(page);
    await attendreScene(page, "course-arrivee");
    await page.waitForTimeout(400);
    expect(await confettis()).toBe(0);

    // Un record facile à battre : la fête
    await poserUnRecord(page, 999);
    await page.waitForTimeout(1100);
    await appuyer(page, "r");
    await attendreLeDepart(page);
    await finirLaCourse(page);
    await attendreScene(page, "course-arrivee");
    expect(await page.evaluate(() => (window as any).jeu.scene.getScene("course-piste").nouveauRecord)).toBe(true);
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("course-arrivee").children.list
      .some((o: any) => typeof o.getAliveParticleCount === "function" && o.getAliveParticleCount() > 0));

    // Pas encore de record sur ce circuit : le premier temps est fêté aussi
    await page.evaluate(() => localStorage.removeItem("course/licornes/record/coeur"));
    await page.waitForTimeout(1100);
    await appuyer(page, "r");
    await attendreLeDepart(page);
    await finirLaCourse(page);
    await attendreScene(page, "course-arrivee");
    expect(await page.evaluate(() => (window as any).jeu.scene.getScene("course-piste").premierTemps)).toBe(true);
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("course-arrivee").children.list
      .some((o: any) => typeof o.getAliveParticleCount === "function" && o.getAliveParticleCount() > 0));
    sansErreur();
  });

  test("contre la montre : le point du fantôme quitte la petite carte quand son tour est fini", async ({ page }) => {
    const { sansErreur } = await menu(page, "licornes");
    // Un fantôme qui ne court qu'une seconde
    await poserUnRecord(page, 1, [{ t: 0, x: 500, y: 500, angle: 0 }, { t: 1, x: 600, y: 500, angle: 0 }]);
    await mode(page, "chrono");
    await attendreScene(page, "course-circuits");
    await appuyer(page, "Enter");
    await attendreLeDepart(page);
    const pointVisible = () => page.evaluate(() => (window as any).jeu.scene.getScene("course-tableau").points
      .find((p: any) => p.coureur === null).rond.visible as boolean);
    expect(await pointVisible()).toBe(true);
    await page.waitForFunction(() => !(window as any).jeu.scene.getScene("course-tableau").points
      .find((p: any) => p.coureur === null).rond.visible, null, { timeout: 10_000 });
    expect(await page.evaluate(() => (window as any).jeu.scene.getScene("course-piste").enCourse)).toBe(true);
    sansErreur();
  });

  test("les bonus : l'étoile et son turbo, l'orage qui étourdit, le bonbon qui rend géante", async ({ page }) => {
    const { sansErreur } = await menu(page, "licornes");
    await mode(page, "chrono");
    await attendreScene(page, "course-circuits");
    await appuyer(page, "ArrowRight");
    await appuyer(page, "ArrowRight");     // le Grand Huit : des étoiles, des orages et un bonbon
    await appuyer(page, "Enter");
    await attendreLeDepart(page);

    const joueuse = () => page.evaluate(() => {
      const j = (window as any).jeu.scene.getScene("course-piste").joueurs[0];
      return { geante: j.geante as number, etourdie: j.etourdie as number };
    });
    await poserSur(page, "orages");
    await page.waitForTimeout(150);
    expect((await joueuse()).etourdie).toBeGreaterThan(0);

    await poserSur(page, "bonbons");
    await page.waitForTimeout(150);
    const geante = await joueuse();
    expect(geante.geante).toBeGreaterThan(5);
    expect(geante.etourdie).toBe(0);       // le bonbon guérit de l'étourdissement

    await poserSur(page, "etoiles");
    await page.waitForTimeout(150);
    expect((await course(page)).reserve).toBe(1);
    expect(await page.evaluate(() =>
      (window as any).jeu.scene.getScene("course-piste").objets.find((o: any) => o.type.id === "etoiles").image.visible)).toBe(false);
    await appuyer(page, "Space");          // seule, Espace lance aussi le turbo
    expect((await course(page)).turbo).toBeGreaterThan(1);
    sansErreur();
  });

  test("le repêchage : une licorne coincée dans les nuages revient sur la route", async ({ page }) => {
    const { sansErreur } = await menu(page, "licornes");
    await appuyer(page, "Enter");
    await attendreLeDepart(page);
    const loin = await page.evaluate(() => {
      const c = (window as any).jeu.scene.getScene("course-piste");
      const j = c.joueurs[0];
      const p = c.circuit.trace[j.indice];
      j.x = p.x + p.nx * 140;              // contre la barrière de nuages
      j.y = p.y + p.ny * 140;
      return Math.hypot(j.x - p.x, j.y - p.y);
    });
    expect(loin).toBeGreaterThan(100);
    // 3 secondes sans avancer (du temps de jeu : sur une machine chargée, un peu plus)
    await page.waitForFunction(() => {
      const c = (window as any).jeu.scene.getScene("course-piste");
      const j = c.joueurs[0];
      const p = c.circuit.trace[j.indice];
      return Math.hypot(j.x - p.x, j.y - p.y) < 20;
    }, null, { timeout: 10_000 });
    sansErreur();
  });

  test("la pause : P arrête tout, P repart, Échap revient au menu", async ({ page }) => {
    const { sansErreur } = await menu(page, "licornes");
    await appuyer(page, "Enter");
    await attendreLeDepart(page);
    await appuyer(page, "p");
    await attendreScene(page, "course-pause");
    expect(await page.evaluate(() => (window as any).jeu.scene.isPaused("course-piste"))).toBe(true);
    await appuyer(page, "p");
    await page.waitForFunction(() => !(window as any).jeu.scene.isPaused("course-piste"));
    await appuyer(page, "p");
    await attendreScene(page, "course-pause");
    await appuyer(page, "Escape");
    await attendreScene(page, "course-menu");
    expect(await scenesActives(page)).toEqual(["course-musique", "course-menu"]);
    sansErreur();
  });

  test("les sauvegardes du jeu sont relues après un rechargement de la page", async ({ page }) => {
    const { sansErreur } = await menu(page, "licornes");
    await appuyer(page, "n");              // le niveau : de Facile à Normal
    await appuyer(page, "ArrowRight");     // la joueuse 1 prend Guimauve
    await page.keyboard.press("KeyD");     // la joueuse 2 passe de Myrtille à Caramel
    await page.waitForTimeout(80);
    const avant = await page.evaluate(() => {
      const m = (window as any).jeu.scene.getScene("course-menu");
      return { j1: m.cartes[0].nom.text, j2: m.cartes[1].nom.text };
    });
    expect(avant.j1).toBe("Guimauve");
    expect(await sauvegarde(page, "course/licornes/niveau")).toBe("normal");

    await page.reload();
    await attendreScene(page, "Hub");
    await appuyer(page, "ArrowRight");
    await appuyer(page, "Enter");
    await attendreScene(page, "course-menu");
    const apres = await page.evaluate(() => {
      const m = (window as any).jeu.scene.getScene("course-menu");
      return { j1: m.cartes[0].nom.text, j2: m.cartes[1].nom.text };
    });
    expect(apres).toEqual(avant);

    // Le niveau Normal : pas d'aide au pilotage
    await mode(page, "chrono");
    await attendreScene(page, "course-circuits");
    await appuyer(page, "Enter");
    await attendreScene(page, "course-piste");
    const etat = await page.evaluate(() => {
      const c = (window as any).jeu.scene.getScene("course-piste");
      return { nom: c.joueurs[0].nom, niveau: c.aides.id, direction: c.aides.direction };
    });
    expect(etat).toEqual({ nom: "Guimauve", niveau: "normal", direction: 0 });
    sansErreur();
  });

  test.describe("au doigt", () => {
    test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

    test("pas de course à deux, la licorne galope seule, ◀ ▶ tournent, et le bouton pause", async ({ page }) => {
      const { sansErreur } = await ouvrir(page);
      await toucherLaCarte(page, "licorne");
      await attendreScene(page, "course-menu");
      const modes = await page.evaluate(() =>
        (window as any).jeu.scene.getScene("course-menu").modes.map((m: any) => m.id));
      expect(modes).toEqual(["grandprix", "course", "chrono", "atelier", "editeur"]);

      await toucher(page, 610, 227);       // « Contre la montre »
      await attendreScene(page, "course-circuits");
      await toucher(page, 480, 514);       // « Partir ! »
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

      // Le pouce reste sur ▶ pendant qu'un autre doigt touche la pause, et se lève pendant la pause
      const pause = await versLaPage(page, 480, 32);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: droite.x, y: droite.y, id: 1 }] });
      await page.waitForTimeout(200);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart", touchPoints: [{ x: droite.x, y: droite.y, id: 1 }, { x: pause.x, y: pause.y, id: 2 }],
      });
      await page.waitForTimeout(100);
      // Le deuxième doigt se lève, seul : la pause
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [{ x: pause.x, y: pause.y, id: 2 }] });
      await attendreScene(page, "course-pause");
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(200);
      await toucher(page, 375, 305);       // « Reprendre »
      await page.waitForFunction(() => !(window as any).jeu.scene.isPaused("course-piste"));
      await page.waitForTimeout(300);
      expect((await course(page)).tactile.droite).toBe(false);   // la licorne ne tourne pas toute seule
      sansErreur();
    });
  });
});
