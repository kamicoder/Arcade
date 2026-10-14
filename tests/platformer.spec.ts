import { test, expect, type Page } from "@playwright/test";
import { ouvrir, appuyer, attendreScene, scenesActives, versLaPage, toucher, toucherLaCarte } from "./outils";

// Du Hub jusqu'au menu du platformer (la 5e carte : une rangée plus bas, une carte à droite)
async function menuPlatformer(page: Page) {
  const ouverte = await ouvrir(page);
  await appuyer(page, "ArrowDown");
  await appuyer(page, "ArrowRight");
  await appuyer(page, "Enter");
  await attendreScene(page, "platformer-menu");
  return ouverte;
}

// Choisir un mode du menu (0 Aventure, 1 Infini, 2 deux joueurs, 3 éditeur) au clavier.
// Le menu se souvient du dernier choix : on part de là où il en est.
async function choisirLeMode(page: Page, numero: number, scene: string) {
  const choisi = await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-menu").choisi as number);
  for (let i = choisi; i !== numero; i += numero > choisi ? 1 : -1) {
    await appuyer(page, numero > choisi ? "ArrowDown" : "ArrowUp");
  }
  await appuyer(page, "Enter");
  await attendreScene(page, scene);
}

// L'état du niveau, lu dans la scène Phaser
function niveau(page: Page) {
  return page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("platformer-niveau");
    return {
      mode: n.donnees.mode as string,
      numero: n.donnees.numero as number,
      nom: n.niveau?.nom as string | undefined,
      score: n.donnees.score as number,
      vies: n.donnees.vies as number,
      enJeu: n.enJeu as boolean,
      x: n.heros.body.x as number,
      y: n.heros.body.y as number,
      vy: n.heros.body.velocity.y as number,
      ennemis: n.monde.ennemis.getLength() as number,
      tactile: { ...n.commandes.tactile } as Record<string, boolean>,
    };
  });
}

// Pose le héros quelque part (le haut gauche de son corps), immobile
function poserLeHeros(page: Page, x: number, y: number) {
  return page.evaluate(([x, y]) => {
    const n = (window as any).jeu.scene.getScene("platformer-niveau");
    n.heros.body.reset(x + 15, y + 20);
  }, [x, y]);
}

// Le joueur arrive au drapeau
function allerAuDrapeau(page: Page) {
  return page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("platformer-niveau");
    const d = n.monde.drapeau;
    n.heros.body.reset(d.x - 10, d.y);
  });
}

// Attend que la scène du niveau soit repartie (un niveau suivant, une vie perdue)
function attendreLeNiveau(page: Page, condition: string) {
  return page.waitForFunction((condition) => {
    const n = (window as any).jeu.scene.getScene("platformer-niveau");
    return n.sys.isActive() && n.heros?.active && new Function("n", "return " + condition)(n);
  }, condition);
}

test("l'Aventure : on court, on finit le premier niveau au drapeau, et le deuxième commence", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  await choisirLeMode(page, 0, "platformer-niveau");
  expect(await scenesActives(page)).toEqual(["platformer-niveau", "platformer-tableau"]);
  expect(await niveau(page)).toMatchObject({ mode: "aventure", numero: 0, nom: "Premiers pas", vies: 3 });

  // Espace fait sauter (une frappe brève suffit), la flèche fait courir.
  // On saute au départ : un peu plus loin, la première plateforme est juste au-dessus de la tête.
  await page.waitForTimeout(400);
  const depart = await niveau(page);
  await page.keyboard.press("Space");
  await page.waitForTimeout(150);
  expect((await niveau(page)).y).toBeLessThan(depart.y - 30);
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(400);
  await page.keyboard.up("ArrowRight");
  expect((await niveau(page)).x).toBeGreaterThan(depart.x + 60);

  await allerAuDrapeau(page);
  await attendreLeNiveau(page, "n.donnees.numero === 1");
  expect(await niveau(page)).toMatchObject({ numero: 1, nom: "Plateforme mobile", vies: 3 });
  sansErreur();
});

test("mourir : tomber coûte une vie, et la dernière, c'est la fin", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  await choisirLeMode(page, 0, "platformer-niveau");
  await page.waitForTimeout(300);

  await poserLeHeros(page, 300, 520);      // sous le sol : dans le vide
  await attendreLeNiveau(page, "n.donnees.vies === 2 && n.enJeu");
  expect(await niveau(page)).toMatchObject({ numero: 0, vies: 2 });

  // Un ennemi touché de côté fait perdre une vie aussi
  await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("platformer-niveau");
    n.donnees.vies = 1;
    const e = n.monde.ennemis.getChildren()[0];
    n.heros.body.reset(e.x, e.y);
  });
  await attendreScene(page, "platformer-fin");
  expect((await niveau(page)).vies).toBe(0);

  await page.waitForTimeout(700);          // la fin attend un peu avant d'écouter
  await appuyer(page, "Escape");
  await attendreScene(page, "platformer-menu");
  expect(await scenesActives(page)).toEqual(["platformer-menu"]);
  sansErreur();
});

test("mourir rend les pièces du niveau, et reprend le score et les vies qu'elles avaient rapportés", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  await choisirLeMode(page, 0, "platformer-niveau");
  // Le niveau commence avec 5 points et 8 pièces déjà prises : 2 pièces de plus font gagner une vie
  await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("platformer-niveau");
    n.scene.restart({ ...n.donnees, score: 5, pieces: 8 });
  });
  await attendreLeNiveau(page, "n.enJeu && n.donnees.score === 5");
  // Les pièces encore à prendre dans le monde
  const aPrendre = () => page.evaluate(() => (window as any).jeu.scene.getScene("platformer-niveau")
    .monde.pieces.getChildren().filter((p: any) => p.body.enable).length as number);
  // Le héros va sur la première pièce encore là (celles des deux premières plateformes, loin de l'ennemi)
  const prendreUnePiece = async () => {
    const score = (await niveau(page)).score;
    await page.evaluate(() => {
      const n = (window as any).jeu.scene.getScene("platformer-niveau");
      const piece = n.monde.pieces.getChildren().find((p: any) => p.body.enable);
      n.heros.body.reset(piece.x, piece.y);
    });
    await page.waitForFunction((score) => (window as any).jeu.scene.getScene("platformer-niveau").donnees.score === score + 1, score);
  };
  expect(await aPrendre()).toBe(5);

  await prendreUnePiece();
  await prendreUnePiece();
  expect(await niveau(page)).toMatchObject({ score: 7, vies: 4 });   // la 10e pièce : une vie de plus
  expect(await aPrendre()).toBe(3);

  // Tombé : le niveau recommence tel qu'il avait commencé, avec une vie de moins (3 - 1 = 2 : la vie
  // gagnée avec ces pièces s'en va avec elles)
  await poserLeHeros(page, 300, 520);
  await attendreLeNiveau(page, "n.enJeu && n.donnees.vies === 2");
  expect(await niveau(page)).toMatchObject({ score: 5, vies: 2 });
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-niveau").donnees.pieces)).toBe(8);
  expect(await aPrendre()).toBe(5);

  // Les reprendre rapporte les mêmes points et la même vie, une seule fois
  await prendreUnePiece();
  await prendreUnePiece();
  expect(await niveau(page)).toMatchObject({ score: 7, vies: 3 });
  sansErreur();
});

test("sauter sur un ennemi l'écrase et rapporte un point", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  await choisirLeMode(page, 0, "platformer-niveau");
  await page.waitForTimeout(300);
  const avant = await niveau(page);
  expect(avant.ennemis).toBe(1);

  // Le héros tombe sur la tête du marcheur (les pièces ont disparu : elles rapporteraient un point aussi)
  await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("platformer-niveau");
    n.monde.pieces.clear(true, true);
    const e = n.monde.ennemis.getChildren()[0];
    n.heros.body.reset(e.x, e.y - 70);
    n.heros.body.setVelocityY(300);
  });
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("platformer-niveau").donnees.score === 1);
  await page.waitForTimeout(400);
  expect(await niveau(page)).toMatchObject({ ennemis: 0, vies: 3, enJeu: true, score: 1 });
  sansErreur();
});

test("le boss : trois coups sur la tête, ça secoue, et l'Aventure est gagnée", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  await choisirLeMode(page, 0, "platformer-niveau");
  // Directement au dernier niveau, celui du boss
  await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("platformer-niveau");
    n.scene.restart({ ...n.donnees, numero: n.donnees.niveaux.length - 1 });
  });
  await attendreLeNiveau(page, "n.monde.boss !== null");
  expect((await niveau(page)).nom).toBe("Le boss");

  for (let coup = 3; coup > 0; coup--) {
    await page.waitForFunction(() => {
      const n = (window as any).jeu.scene.getScene("platformer-niveau");
      return n.monde.boss && !n.monde.boss.invincible;
    });
    const hp = await page.evaluate(() => {
      const n = (window as any).jeu.scene.getScene("platformer-niveau");
      const b = n.monde.boss;
      n.heros.body.reset(b.x, b.body.top - 40);
      n.heros.body.setVelocityY(300);
      return b.hp;
    });
    expect(hp).toBe(coup);
    await page.waitForFunction((hp) => {
      const n = (window as any).jeu.scene.getScene("platformer-niveau");
      return !n.monde.boss || n.monde.boss.hp < hp;
    }, hp);
    // Le héros s'écarte, pour ne pas retomber sur le côté du boss
    await poserLeHeros(page, 60, 380);
    // Un coup sur la tête secoue la caméra
    if (coup > 1) {
      expect(await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-niveau").cameras.main.shakeEffect.isRunning)).toBe(true);
    }
  }
  await attendreScene(page, "platformer-fin");
  expect((await niveau(page)).vies).toBe(3);
  await page.waitForTimeout(700);
  await appuyer(page, "Enter");            // rejouer : l'Aventure recommence au premier niveau
  await attendreLeNiveau(page, "n.donnees.numero === 0 && n.donnees.score === 0");
  sansErreur();
});

test("l'Infini : le monde se fabrique devant, s'oublie derrière, et le record est gardé", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  await choisirLeMode(page, 1, "platformer-niveau");
  expect((await niveau(page)).mode).toBe("infini");

  // Le héros saute loin devant : des plateformes l'y attendent, celles du début sont oubliées
  // (posé bien au-dessus de l'écran : il a le temps de tomber pendant que la caméra le rattrape ;
  // des vies en plus, au cas où il tomberait sur un ennemi tiré au hasard)
  await page.evaluate(() => {
    (window as any).jeu.scene.getScene("platformer-niveau").donnees.vies = 9;
  });
  for (const x of [1000, 2000, 3000]) {
    await poserLeHeros(page, x, -200);
    await page.waitForTimeout(400);
  }
  const monde = await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("platformer-niveau");
    const xs = n.monde.solides.getChildren().concat(n.monde.mobiles.getChildren()).map((p: any) => p.x);
    return { plusLoin: Math.max(...xs), plusPres: Math.min(...xs), distance: n.distance };
  });
  expect(monde.plusLoin).toBeGreaterThan(3400);
  expect(monde.plusPres).toBeGreaterThan(1500);
  expect(monde.distance).toBeGreaterThanOrEqual(300);

  // La dernière vie : tomber, c'est perdu, et la distance devient le record
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("platformer-niveau").enJeu);
  await page.evaluate(() => {
    (window as any).jeu.scene.getScene("platformer-niveau").donnees.vies = 1;
  });
  await poserLeHeros(page, 3000, 600);
  await attendreScene(page, "platformer-fin");
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem("platformer/record-infini")!));
  expect(record).toBeGreaterThanOrEqual(300);
  sansErreur();
});

test("à deux : chacun ses touches, chacun son monde, le premier à 15 points gagne", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  await choisirLeMode(page, 2, "platformer-duo");
  expect(await scenesActives(page)).toEqual(["platformer-duo", "platformer-tableau"]);
  const coureurs = () => page.evaluate(() => (window as any).jeu.scene.getScene("platformer-duo").coureurs
    .map((c: any) => ({ x: c.heros.body.x, y: c.heros.body.y, score: c.score })));
  await page.waitForTimeout(300);
  const depart = await coureurs();
  expect(depart[1].y - depart[0].y).toBe(1000);   // le monde du joueur 2 est sous celui du joueur 1

  await page.keyboard.down("d");           // D : le joueur 1 seulement
  await page.waitForTimeout(300);
  await page.keyboard.up("d");
  let apres = await coureurs();
  expect(apres[0].x).toBeGreaterThan(depart[0].x + 40);
  expect(apres[1].x).toBe(depart[1].x);
  await page.keyboard.down("ArrowLeft");   // les flèches : le joueur 2
  await page.waitForTimeout(150);
  await page.keyboard.up("ArrowLeft");
  apres = await coureurs();
  expect(apres[1].x).toBeLessThan(depart[1].x);

  // Le joueur 2 a 14 points, et une pièce apparaît sur lui (le monde est tiré au hasard) : il gagne
  await page.evaluate(() => {
    const duo = (window as any).jeu.scene.getScene("platformer-duo");
    const j2 = duo.coureurs[1];
    j2.score = 14;
    const corps = j2.heros.body;
    j2.monde.ajouter([{ sorte: "piece", x: corps.x + 7, y: corps.y - j2.monde.dy + 12 }]);
  });
  await attendreScene(page, "platformer-fin");
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-duo").coureurs[1].score)).toBe(15);
  await page.waitForTimeout(700);
  await appuyer(page, "Escape");
  await attendreScene(page, "platformer-menu");
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

test("à deux, le joueur 1 sur Q D Z d'un clavier AZERTY : la place de la touche compte, pas sa lettre", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  // Le menu écrit les touches du joueur 1 comme elles sont sur ce clavier (Q D Z sur un AZERTY)
  const attendu = await page.evaluate(async () => {
    const carte: Map<string, string> | undefined = await (navigator as any).keyboard?.getLayoutMap?.().catch(() => undefined);
    const azerty: Record<string, string> = { KeyA: "Q", KeyD: "D", KeyW: "Z" };
    return ["KeyA", "KeyD", "KeyW"].map((code) => carte?.get(code)?.toUpperCase() ?? azerty[code]).join(" ");
  });
  const aide = await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-menu").boutons[2].aide.text as string);
  expect(aide).toBe(attendu + " contre les flèches : le premier à 15 points");

  await choisirLeMode(page, 2, "platformer-duo");
  const coureurs = () => page.evaluate(() => (window as any).jeu.scene.getScene("platformer-duo").coureurs
    .map((c: any) => ({ x: c.heros.body.x, vy: c.heros.body.velocity.y })));
  await page.waitForTimeout(400);
  const depart = await coureurs();

  // D (KeyD) : le joueur 1 court à droite
  await toucheAzerty(page, "keyDown", "KeyD", "d", 68);
  await page.waitForTimeout(400);
  await toucheAzerty(page, "keyUp", "KeyD", "d", 68);
  const loin = await coureurs();
  expect(loin[0].x).toBeGreaterThan(depart[0].x + 60);
  expect(loin[1].x).toBe(depart[1].x);

  // La lettre « a » à la place du Q d'un QWERTY (le A d'un AZERTY) : pas une touche du joueur 1
  await toucheAzerty(page, "keyDown", "KeyQ", "a", 65);
  await page.waitForTimeout(250);
  expect((await coureurs())[0].x).toBe(loin[0].x);
  await toucheAzerty(page, "keyUp", "KeyQ", "a", 65);
  // Le Q d'un AZERTY (KeyA, la lettre « q ») : il revient à gauche
  await toucheAzerty(page, "keyDown", "KeyA", "q", 81);
  await page.waitForTimeout(250);
  await toucheAzerty(page, "keyUp", "KeyA", "q", 81);
  expect((await coureurs())[0].x).toBeLessThan(loin[0].x - 30);

  // La lettre « w » en bas à gauche (KeyZ) ne fait pas sauter ; le Z d'un AZERTY (KeyW, « z »), si
  await page.waitForTimeout(300);
  await toucheAzerty(page, "keyDown", "KeyZ", "w", 87);
  await page.waitForTimeout(150);
  expect((await coureurs())[0].vy).toBeGreaterThan(-50);
  await toucheAzerty(page, "keyUp", "KeyZ", "w", 87);
  await toucheAzerty(page, "keyDown", "KeyW", "z", 90);
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("platformer-duo").coureurs[0].heros.body.velocity.y < -200);
  await toucheAzerty(page, "keyUp", "KeyW", "z", 90);
  expect((await coureurs())[1].vy).toBeGreaterThan(-50);   // le joueur 2 n'a pas sauté
  sansErreur();
});

test("l'éditeur : créer un niveau, y poser des choses à la souris, le tester, et le retrouver dans l'Aventure", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  await choisirLeMode(page, 3, "platformer-editeur");
  const editeur = () => page.evaluate(() => {
    const e = (window as any).jeu.scene.getScene("platformer-editeur");
    return { nom: e.nom as string, elements: e.elements.map((x: any) => ({ ...x })) as any[], outil: e.outil as string };
  });
  // Le milieu d'un bouton de l'éditeur, en pixels du jeu
  const bouton = (cle: string) => page.evaluate((cle) => {
    const b = (window as any).jeu.scene.getScene("platformer-editeur").boutons[cle];
    return { x: b.x + b.fond.width / 2, y: b.y + b.fond.height / 2 };
  }, cle);
  const cliquer = async (x: number, y: number) => {
    const p = await versLaPage(page, x, y);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(80);
  };

  // Un nouveau niveau : N, son nom, Entrée
  await appuyer(page, "n");
  await page.keyboard.type("Volcan");
  await appuyer(page, "Enter");
  let etat = await editeur();
  expect(etat.nom).toBe("Volcan");
  expect(etat.elements.map((e) => e.sorte).sort()).toEqual(["depart", "drapeau", "plateforme"]);

  // Une plateforme de glace, tracée à la souris
  const glace = await bouton("genre-glace");
  await cliquer(glace.x, glace.y);
  const a = await versLaPage(page, 450, 300);
  const b = await versLaPage(page, 620, 320);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  // Une pièce, d'un clic
  const piece = await bouton("sorte-piece");
  await cliquer(piece.x, piece.y);
  await cliquer(700, 200);
  etat = await editeur();
  const plateforme = etat.elements.find((e) => e.genre === "glace");
  expect(plateforme.w).toBeGreaterThan(100);
  expect(etat.elements.filter((e) => e.sorte === "piece").length).toBe(1);

  // Annuler retire la pièce, Rétablir la remet
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(80);
  expect((await editeur()).elements.filter((e) => e.sorte === "piece").length).toBe(0);
  await page.keyboard.press("Control+y");
  await page.waitForTimeout(80);
  expect((await editeur()).elements.filter((e) => e.sorte === "piece").length).toBe(1);

  // Tester (Tab) enregistre le niveau et le joue
  await appuyer(page, "Tab");
  await attendreScene(page, "platformer-niveau");
  expect(await niveau(page)).toMatchObject({ mode: "test", nom: "Volcan" });
  const sauve = await page.evaluate(() => JSON.parse(localStorage.getItem("platformer/niveau/Volcan")!));
  expect(sauve.elements.length).toBe(5);
  await allerAuDrapeau(page);
  await attendreScene(page, "platformer-fin");
  await page.waitForTimeout(700);
  await appuyer(page, "Escape");           // Échap : retour à l'éditeur, sur le même niveau
  await attendreScene(page, "platformer-editeur");
  expect((await editeur()).nom).toBe("Volcan");

  // Le menu : l'Aventure a un niveau de plus, et le dernier est le nôtre
  const menu = await bouton("menu");
  await cliquer(menu.x, menu.y);
  await attendreScene(page, "platformer-menu");
  await choisirLeMode(page, 0, "platformer-niveau");
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-niveau").donnees.niveaux.map((n: any) => n.nom)))
    .toEqual(["Premiers pas", "Plateforme mobile", "Grand saut", "Ascenseur", "Le boss", "Volcan"]);
  sansErreur();
});

test("les genres de plateforme : le ressort fait rebondir, le tapis emporte, le téléporteur emmène, la lave brûle", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  // Un niveau d'essai, joué comme le bouton Tester de l'éditeur le ferait
  await page.evaluate(() => {
    const P = (x: number, y: number, w: number, genre: string) => ({ sorte: "plateforme", x, y, w, h: 40, genre, force: 2, sens: 1 });
    const niveau = {
      nom: "Essai", largeur: 2000, elements: [
        P(0, 440, 400, "normale"), P(400, 440, 60, "ressort"), P(460, 440, 300, "tapis"), P(800, 440, 100, "lave"),
        P(100, 300, 60, "teleporteur"), P(1700, 300, 60, "teleporteur"), P(1600, 440, 400, "normale"),
        { sorte: "depart", x: 30, y: 400 }, { sorte: "drapeau", x: 1950, y: 400 },
      ],
    };
    (window as any).jeu.scene.getScene("platformer-menu").scene
      .start("platformer-niveau", { mode: "test", niveaux: [niveau], numero: 0, score: 0, vies: 3, pieces: 0 });
  });
  await attendreLeNiveau(page, "n.enJeu");

  await poserLeHeros(page, 415, 390);      // juste au-dessus du ressort
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("platformer-niveau").heros.body.velocity.y < -1000);

  await poserLeHeros(page, 500, 400);      // posé sur le tapis, sans toucher à rien
  await page.waitForTimeout(150);
  const x = (await niveau(page)).x;
  await page.waitForTimeout(400);
  expect((await niveau(page)).x).toBeGreaterThan(x + 30);

  await poserLeHeros(page, 115, 255);      // sur le premier téléporteur : il arrive sur le second
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("platformer-niveau").heros.body.x > 1690);

  await poserLeHeros(page, 835, 395);      // dans la lave
  await page.waitForFunction(() => !(window as any).jeu.scene.getScene("platformer-niveau").enJeu);
  sansErreur();
});

// Une sauvegarde illisible est ignorée (on rejoue le niveau de départ) ; une sauvegarde lisible mais
// fausse rend le niveau injouable : il est sauté
test("un niveau abîmé dans la sauvegarde est sauté, sans planter", async ({ page }) => {
  const { sansErreur } = await ouvrir(page);
  await page.evaluate(() => localStorage.setItem("platformer/niveau/Premiers pas", "{ pas du json"));
  await page.evaluate(() => localStorage.setItem("platformer/niveau/Grand saut", JSON.stringify({ largeur: "abc", elements: [] })));
  await appuyer(page, "ArrowDown");
  await appuyer(page, "ArrowRight");
  await appuyer(page, "Enter");
  await attendreScene(page, "platformer-menu");
  await choisirLeMode(page, 0, "platformer-niveau");
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-niveau").donnees.niveaux.map((n: any) => n.nom)))
    .toEqual(["Premiers pas", "Plateforme mobile", "Ascenseur", "Le boss"]);
  sansErreur();
});

test.describe("au doigt", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test("on choisit au doigt, ▶ fait courir, ▲ fait sauter", async ({ page }) => {
    const { sansErreur } = await ouvrir(page);
    await toucherLaCarte(page, "platformer");
    await attendreScene(page, "platformer-menu");
    expect(await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-menu").boutons[2].possible)).toBe(false);
    await toucher(page, 480, 150);         // « Aventure »
    await attendreScene(page, "platformer-niveau");
    await page.waitForTimeout(400);
    const depart = await niveau(page);

    // Un doigt posé sur ▶ et qui y reste : on passe par le protocole de Chromium pour le tenir
    const cdp = await page.context().newCDPSession(page);
    const droite = await versLaPage(page, 236, 452);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: droite.x, y: droite.y, id: 1 }] });
    await page.waitForTimeout(400);
    expect((await niveau(page)).tactile).toMatchObject({ droite: true, gauche: false, saut: false });
    expect((await niveau(page)).x).toBeGreaterThan(depart.x + 60);

    // Un deuxième doigt sur ▲ : il saute, sans lâcher ▶
    const saut = await versLaPage(page, 862, 440);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart", touchPoints: [{ x: droite.x, y: droite.y, id: 1 }, { x: saut.x, y: saut.y, id: 2 }],
    });
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("platformer-niveau").heros.body.velocity.y < -200);
    expect((await niveau(page)).tactile).toMatchObject({ droite: true, saut: true });

    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(200);
    expect((await niveau(page)).tactile).toMatchObject({ droite: false, saut: false });
    sansErreur();
  });
});
