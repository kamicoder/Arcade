import { test, expect, type Page } from "@playwright/test";
import {
  ouvrir, appuyer, attendreScene, scenesActives, versLaPage, toucher, toucherLaCarte, ouvrirLaCarte, manette, manetteAToutes,
  attendreLaPause, quitterParLaPause, tailleDuJeu,
} from "./outils";
import { faisable } from "./faisable";
import { Generateur } from "../src/jeux/platformer/generateur";
import { SAUT_MEMORISE, ZOOM } from "../src/jeux/platformer/reglages";
import type { Niveau as DonneesDuNiveau, Element } from "../src/jeux/platformer/elements";

// Les niveaux de l'Aventure, dans l'ordre
const NIVEAUX = [
  "Premiers pas", "Plateforme mobile", "Grand saut", "Ascenseur", "Glace et ressorts", "Tapis roulants",
  "Plongée", "Pont fragile", "Téléporteurs", "Le boss",
];

// Du Hub jusqu'au menu du platformer
async function menuPlatformer(page: Page) {
  const ouverte = await ouvrir(page);
  await ouvrirLaCarte(page, "platformer");
  await attendreScene(page, "platformer-menu");
  return ouverte;
}

// Choisir un mode du menu (0 Aventure, 1 Mon aventure, 2 Infini, 3 deux joueurs, 4 éditeur) au clavier.
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

  // Espace fait sauter (tenu : le saut entier), la flèche fait courir.
  // On saute au départ : un peu plus loin, la première plateforme est juste au-dessus de la tête.
  await page.waitForTimeout(400);
  const depart = await niveau(page);
  await page.keyboard.down("Space");
  await page.waitForTimeout(150);
  expect((await niveau(page)).y).toBeLessThan(depart.y - 30);
  await page.keyboard.up("Space");
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

// La pause (socle/pause.ts, vue en détail dans le tir) : ici, qu'elle s'ouvre, et qu'elle se tait sur la fin
test("Échap met le niveau en pause ; sur la fin, Start rejoue sans que le niveau derrière ne réagisse", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  await choisirLeMode(page, 0, "platformer-niveau");
  await appuyer(page, "Escape");
  await attendreLaPause(page);
  expect(await page.evaluate(() => {
    const jeu = (window as any).jeu;
    return [jeu.scene.isPaused("platformer-niveau"), jeu.scene.isPaused("platformer-tableau")];
  })).toEqual([true, true]);
  await appuyer(page, "Escape");
  await page.waitForFunction(() => (window as any).jeu.scene.isActive("platformer-niveau"));

  // La dernière vie perdue : la fin. Start (la manette) la lit, et le niveau aussi, dans la même image
  await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("platformer-niveau");
    n.donnees.vies = 1;
    n.mourir();
  });
  await attendreScene(page, "platformer-fin");
  await page.waitForTimeout(700);          // la fin attend un peu avant d'écouter
  await manetteAToutes(page, ["platformer-fin", "platformer-niveau"], 9);
  await attendreLeNiveau(page, "n.donnees.vies === 3 && n.enJeu");
  await page.waitForTimeout(400);          // le temps d'un fondu vers le menu, s'il était parti
  expect(await scenesActives(page)).toEqual(["platformer-niveau", "platformer-tableau"]);
  sansErreur();
});

test("à deux, à la manette : Start met en pause, et « Le menu » ramène au menu", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  await choisirLeMode(page, 3, "platformer-duo");
  await manette(page, "platformer-duo", 9);
  await attendreLaPause(page);
  expect(await page.evaluate(() => (window as any).jeu.scene.isPaused("platformer-duo"))).toBe(true);
  await manette(page, "socle-pause", 13);  // la croix, vers le bas : « Le menu »
  await manette(page, "socle-pause", 0);
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
  await choisirLeMode(page, 2, "platformer-niveau");
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

// Une touche telle qu'un clavier AZERTY l'envoie : sa place (code), sa lettre (key) et son keyCode.
// Le protocole de Chromium les donne séparément ; Playwright, lui, les déduit l'un de l'autre.
async function toucheAzerty(page: Page, type: "keyDown" | "keyUp", code: string, lettre: string, keyCode: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchKeyEvent", {
    type, code, key: lettre, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode,
  });
}

test("à deux : Q D Z d'un AZERTY à leur place, les flèches pour le joueur 2, chacun son monde, 15 points pour gagner", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  // Le menu écrit les touches du joueur 1 comme elles sont sur ce clavier (Q D Z sur un AZERTY)
  const attendu = await page.evaluate(async () => {
    const carte: Map<string, string> | undefined = await (navigator as any).keyboard?.getLayoutMap?.().catch(() => undefined);
    const azerty: Record<string, string> = { KeyA: "Q", KeyD: "D", KeyW: "Z" };
    return ["KeyA", "KeyD", "KeyW"].map((code) => carte?.get(code)?.toUpperCase() ?? azerty[code]).join(" ");
  });
  const aide = await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-menu").boutons[3].aide.text as string);
  expect(aide).toBe(attendu + " contre les flèches : le premier à 15 points");

  await choisirLeMode(page, 3, "platformer-duo");
  expect(await scenesActives(page)).toEqual(["platformer-duo", "platformer-tableau"]);
  const coureurs = () => page.evaluate(() => (window as any).jeu.scene.getScene("platformer-duo").coureurs
    .map((c: any) => ({ x: c.heros.body.x, y: c.heros.body.y, vy: c.heros.body.velocity.y })));
  await page.waitForTimeout(400);
  const depart = await coureurs();
  expect(depart[1].y - depart[0].y).toBe(1000);   // le monde du joueur 2 est sous celui du joueur 1

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

  // Les flèches : le joueur 2
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(150);
  await page.keyboard.up("ArrowLeft");
  expect((await coureurs())[1].x).toBeLessThan(depart[1].x);

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

test("à deux : tombé loin du départ, on repart sur les plateformes du début, qui restent", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  await choisirLeMode(page, 3, "platformer-duo");
  // Le joueur 1, tenu en l'air loin devant (sans gravité) : sa caméra le rejoint
  await page.evaluate(() => {
    const duo = (window as any).jeu.scene.getScene("platformer-duo");
    duo.chutes = 0;
    const repartir = duo.repartir;
    duo.repartir = function (c: any) {
      if (c === duo.coureurs[0] && !c.aRefaire) {
        duo.chutes++;
      }
      repartir.call(this, c);
    };
    const corps = duo.coureurs[0].heros.body;
    corps.setAllowGravity(false);
    corps.reset(2500, 100);
  });
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("platformer-duo").coureurs[0].camera.worldView.left > 2000);
  // Il tombe sous le monde : retour au début
  await page.evaluate(() => {
    const corps = (window as any).jeu.scene.getScene("platformer-duo").coureurs[0].heros.body;
    corps.setAllowGravity(true);
    corps.reset(2500, 600);
  });
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("platformer-duo").chutes >= 1);
  // Il se pose sur le départ et y reste : une seule chute
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("platformer-duo").coureurs[0].heros.body.blocked.down);
  await page.waitForTimeout(500);
  const etat = await page.evaluate(() => {
    const duo = (window as any).jeu.scene.getScene("platformer-duo");
    const corps = duo.coureurs[0].heros.body;
    return { chutes: duo.chutes, x: corps.x, auSol: corps.blocked.down };
  });
  expect(etat).toEqual({ chutes: 1, x: expect.any(Number), auSol: true });
  expect(etat.x).toBeLessThan(100);
  sansErreur();
});

// ================================================================ L'éditeur et Mon aventure

// L'état de l'éditeur, lu dans la scène Phaser ; « fenetre » : le titre de la fenêtre du dessus
function editeur(page: Page) {
  return page.evaluate(() => {
    const e = (window as any).jeu.scene.getScene("platformer-editeur");
    const dessus = e.fenetres[e.fenetres.length - 1];
    return {
      nom: e.nom as string, noms: [...e.noms] as string[], elements: e.elements.map((x: any) => ({ ...x })) as any[],
      fenetre: (dessus?.list[2]?.text ?? null) as string | null,
      boutonsDeLaFenetre: (dessus?.list ?? []).filter((o: any) => o.etiquette).map((o: any) => o.etiquette.text) as string[],
    };
  });
}

// Le milieu d'un bouton de l'éditeur (la barre du haut, la palette...), en pixels du jeu
function boutonDeLEditeur(page: Page, cle: string) {
  return page.evaluate((cle) => {
    const b = (window as any).jeu.scene.getScene("platformer-editeur").boutons[cle];
    return { x: b.x + b.fond.width / 2, y: b.y + b.fond.height / 2 };
  }, cle);
}

// Le milieu du bouton de la fenêtre du dessus qui porte ce texte (« rang » : le combientième, s'il y en a plusieurs)
function boutonDeLaFenetre(page: Page, texte: string, rang = 0) {
  return page.evaluate(([texte, rang]) => {
    const e = (window as any).jeu.scene.getScene("platformer-editeur");
    const b = e.fenetres[e.fenetres.length - 1].list.filter((o: any) => o.etiquette?.text === texte)[rang];
    return { x: b.x + b.fond.width / 2, y: b.y + b.fond.height / 2 };
  }, [texte, rang] as const);
}

async function cliquer(page: Page, point: { x: number; y: number }) {
  const p = await versLaPage(page, point.x, point.y);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(80);
}

const cliquerSurLaFenetre = async (page: Page, texte: string, rang = 0) => cliquer(page, await boutonDeLaFenetre(page, texte, rang));
const cliquerSurLEditeur = async (page: Page, cle: string) => cliquer(page, await boutonDeLEditeur(page, cle));

// Les noms des niveaux de la partie en cours
const nomsJoues = (page: Page) => page.evaluate(() =>
  (window as any).jeu.scene.getScene("platformer-niveau").donnees.niveaux.map((n: any) => n.nom) as string[]);

const MON_AVENTURE = "platformer/mon-aventure";

test("l'éditeur : Mon aventure vide propose une page blanche ; on y pose des choses, on teste, et on joue Mon aventure", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  await choisirLeMode(page, 4, "platformer-editeur");

  // Mon aventure est vide : aucun niveau ouvert, la fenêtre du premier niveau attend
  let etat = await editeur(page);
  expect(etat).toMatchObject({ nom: "", noms: [], fenetre: "Mon aventure est vide : ton premier niveau !" });
  expect(etat.boutonsDeLaFenetre).toContain("Page blanche (Entrée)");
  expect(etat.boutonsDeLaFenetre).toContain("3. Grand saut");

  // Une page blanche : Entrée, son nom, Entrée
  await appuyer(page, "Enter");
  await page.keyboard.type("Volcan");
  await appuyer(page, "Enter");
  etat = await editeur(page);
  expect(etat).toMatchObject({ nom: "Volcan", noms: ["Volcan"], fenetre: null });
  expect(etat.elements.map((e) => e.sorte).sort()).toEqual(["depart", "drapeau", "plateforme"]);

  // Une plateforme de glace, tracée à la souris
  await cliquerSurLEditeur(page, "genre-glace");
  const a = await versLaPage(page, 450, 300);
  const b = await versLaPage(page, 620, 320);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  // Une pièce, d'un clic
  await cliquerSurLEditeur(page, "sorte-piece");
  await cliquer(page, { x: 700, y: 200 });
  etat = await editeur(page);
  const plateforme = etat.elements.find((e) => e.genre === "glace");
  expect(plateforme.w).toBeGreaterThan(100);
  expect(etat.elements.filter((e) => e.sorte === "piece").length).toBe(1);

  // Annuler retire la pièce, Rétablir la remet
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(80);
  expect((await editeur(page)).elements.filter((e) => e.sorte === "piece").length).toBe(0);
  await page.keyboard.press("Control+y");
  await page.waitForTimeout(80);
  expect((await editeur(page)).elements.filter((e) => e.sorte === "piece").length).toBe(1);

  // Tester (Tab) enregistre le niveau dans Mon aventure, et le joue
  await appuyer(page, "Tab");
  await attendreScene(page, "platformer-niveau");
  expect(await niveau(page)).toMatchObject({ mode: "test", nom: "Volcan" });
  const sauve = await page.evaluate((cle) => JSON.parse(localStorage.getItem(cle)!), MON_AVENTURE + "/niveau/Volcan");
  expect(sauve.elements.length).toBe(5);
  await allerAuDrapeau(page);
  await attendreScene(page, "platformer-fin");
  await page.waitForTimeout(700);
  await appuyer(page, "Escape");           // Échap : retour à l'éditeur, sur le même niveau
  await attendreScene(page, "platformer-editeur");
  expect((await editeur(page)).nom).toBe("Volcan");

  // Le menu : l'Aventure n'a pas changé ; Mon aventure, c'est Volcan, et elle se joue comme l'Aventure
  await cliquerSurLEditeur(page, "menu");
  await attendreScene(page, "platformer-menu");
  const nomDuBouton = await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-menu").boutons[1].nom.text as string);
  expect(nomDuBouton).toBe("Mon aventure (1 niveau)");
  await choisirLeMode(page, 1, "platformer-niveau");
  expect(await niveau(page)).toMatchObject({ mode: "aventure", numero: 0, nom: "Volcan", vies: 3 });
  expect(await nomsJoues(page)).toEqual(["Volcan"]);
  await allerAuDrapeau(page);
  await attendreScene(page, "platformer-fin");
  await page.waitForTimeout(700);
  await appuyer(page, "Escape");
  await attendreScene(page, "platformer-menu");
  await choisirLeMode(page, 0, "platformer-niveau");
  expect(await nomsJoues(page)).toEqual(NIVEAUX);
  sansErreur();
});

test("l'éditeur : copier des niveaux de l'Aventure, les retoucher, les ranger, les renommer, en supprimer ; l'Aventure ne bouge pas", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  await choisirLeMode(page, 4, "platformer-editeur");

  // Mon aventure vide : on part du troisième niveau de l'Aventure, d'un clic
  await cliquerSurLaFenetre(page, "3. Grand saut");
  let etat = await editeur(page);
  expect(etat).toMatchObject({ nom: "Grand saut (copie)", noms: ["Grand saut (copie)"], fenetre: null });

  // N : la fenêtre du nouveau niveau. Deux fois le premier niveau : la deuxième copie a un autre nom
  for (const copie of ["Premiers pas (copie)", "Premiers pas (copie 2)"]) {
    await appuyer(page, "n");
    expect((await editeur(page)).fenetre).toBe("Un nouveau niveau");
    await cliquerSurLaFenetre(page, "1. Premiers pas");
    expect((await editeur(page)).nom).toBe(copie);
  }
  etat = await editeur(page);
  expect(etat.noms).toEqual(["Grand saut (copie)", "Premiers pas (copie)", "Premiers pas (copie 2)"]);
  const piecesAuDepart = etat.elements.filter((e) => e.sorte === "piece").length;

  // La copie se retouche : une pièce de plus, enregistrée (Ctrl+S)
  await cliquerSurLEditeur(page, "sorte-piece");
  await cliquer(page, { x: 700, y: 120 });
  await page.keyboard.press("Control+s");
  await page.waitForTimeout(80);
  const sauve = await page.evaluate((cle) => JSON.parse(localStorage.getItem(cle)!), MON_AVENTURE + "/niveau/Premiers pas (copie 2)");
  expect(sauve.elements.filter((e: any) => e.sorte === "piece").length).toBe(piecesAuDepart + 1);

  // La fenêtre des niveaux : rien que Mon aventure, et plus de « Remettre les niveaux de départ »
  await cliquerSurLEditeur(page, "niveaux");
  etat = await editeur(page);
  expect(etat.fenetre).toBe("Les niveaux de Mon aventure, dans l'ordre");
  expect(etat.boutonsDeLaFenetre.filter((texte) => /^\d+\. /.test(texte)))
    .toEqual(["1. Grand saut (copie)", "2. Premiers pas (copie)", "3. Premiers pas (copie 2)"]);
  expect(etat.boutonsDeLaFenetre.join()).not.toContain("Remettre");

  // Ranger : le premier descend
  await cliquerSurLaFenetre(page, "↓", 0);
  expect((await editeur(page)).noms).toEqual(["Premiers pas (copie)", "Grand saut (copie)", "Premiers pas (copie 2)"]);

  // Renommer le premier : effacer son nom, en taper un autre
  await cliquerSurLaFenetre(page, "Renommer", 0);
  for (let i = 0; i < "Premiers pas (copie)".length; i++) {
    await page.keyboard.press("Backspace");
  }
  await page.keyboard.type("Le commencement");
  await appuyer(page, "Enter");
  expect((await editeur(page)).noms).toEqual(["Le commencement", "Grand saut (copie)", "Premiers pas (copie 2)"]);

  // Supprimer le deuxième : une question, puis il disparaît
  await cliquerSurLaFenetre(page, "Supprimer", 1);
  expect((await editeur(page)).fenetre).toBe("Supprimer « Grand saut (copie) » ?");
  await cliquerSurLaFenetre(page, "Supprimer");
  expect((await editeur(page)).noms).toEqual(["Le commencement", "Premiers pas (copie 2)"]);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((cle) => cle.startsWith("platformer/mon-aventure/niveau/")).sort()))
    .toEqual(["platformer/mon-aventure/niveau/Le commencement", "platformer/mon-aventure/niveau/Premiers pas (copie 2)"]);
  await cliquerSurLaFenetre(page, "Fermer");

  // L'Aventure se joue comme elle est livrée : son premier niveau n'a pas la pièce de plus
  await cliquerSurLEditeur(page, "menu");
  await attendreScene(page, "platformer-menu");
  await choisirLeMode(page, 0, "platformer-niveau");
  expect(await nomsJoues(page)).toEqual(NIVEAUX);
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-niveau").donnees.niveaux[0].elements
    .filter((e: any) => e.sorte === "piece").length)).toBe(piecesAuDepart);

  // Mon aventure, dans son ordre ; le drapeau du premier mène au second
  await quitterParLaPause(page);
  await attendreScene(page, "platformer-menu");
  await choisirLeMode(page, 1, "platformer-niveau");
  expect(await nomsJoues(page)).toEqual(["Le commencement", "Premiers pas (copie 2)"]);
  await page.waitForTimeout(300);
  await allerAuDrapeau(page);
  await attendreLeNiveau(page, "n.donnees.numero === 1");
  expect(await niveau(page)).toMatchObject({ mode: "aventure", nom: "Premiers pas (copie 2)", vies: 3 });
  sansErreur();
});

test("Mon aventure vide : le menu le dit et mène à l'éditeur ; supprimer le dernier niveau la vide de nouveau", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  const bouton = () => page.evaluate(() => {
    const b = (window as any).jeu.scene.getScene("platformer-menu").boutons[1];
    return { nom: b.nom.text as string, aide: b.aide.text as string };
  });
  expect(await bouton()).toEqual({ nom: "Mon aventure", aide: "Vide pour l'instant : crée ton premier niveau !" });

  // Le bouton mène à l'éditeur, sur la fenêtre du premier niveau ; Échap ramène au menu
  await choisirLeMode(page, 1, "platformer-editeur");
  expect((await editeur(page)).fenetre).toBe("Mon aventure est vide : ton premier niveau !");
  await appuyer(page, "Escape");
  await attendreScene(page, "platformer-menu");

  // Un niveau copié, puis supprimé : Mon aventure est vide, la fenêtre du premier niveau revient
  await choisirLeMode(page, 1, "platformer-editeur");
  await cliquerSurLaFenetre(page, "10. Le boss");
  expect((await editeur(page)).nom).toBe("Le boss (copie)");
  await cliquerSurLEditeur(page, "niveaux");
  await cliquerSurLaFenetre(page, "Supprimer");
  await cliquerSurLaFenetre(page, "Supprimer");
  expect(await editeur(page)).toMatchObject({ nom: "", noms: [], fenetre: "Mon aventure est vide : ton premier niveau !" });
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-editeur").fenetres.length)).toBe(1);
  await cliquerSurLaFenetre(page, "Revenir au menu");
  await attendreScene(page, "platformer-menu");
  expect(await bouton()).toEqual({ nom: "Mon aventure", aide: "Vide pour l'instant : crée ton premier niveau !" });
  sansErreur();
});

// Les sauvegardes de l'ancien éditeur, qui retouchait l'Aventure : on n'en reprend rien
test("le premier passage oublie les anciennes sauvegardes de l'éditeur ; l'Aventure reste celle du jeu", async ({ page }) => {
  const { sansErreur } = await ouvrir(page);
  await page.evaluate(() => {
    localStorage.setItem("platformer/ordre", JSON.stringify(["Grand saut", "Volcan"]));
    localStorage.setItem("platformer/niveau/Grand saut", JSON.stringify({ nom: "Grand saut", largeur: 800, elements: [] }));
    localStorage.setItem("platformer/niveau/Volcan", JSON.stringify({ nom: "Volcan", largeur: 800, elements: [] }));
    localStorage.setItem("platformer/record-infini", "42");
    localStorage.setItem("platformer/genres", JSON.stringify({ glace: { couleur: [1, 2, 3], solide: true, effet: "mortel" } }));
  });
  await ouvrirLaCarte(page, "platformer");
  await attendreScene(page, "platformer-menu");
  expect(await page.evaluate(() => Object.keys(localStorage).filter((cle) => cle.startsWith("platformer/")).sort()))
    .toEqual(["platformer/record-infini"]);
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-menu").boutons[1].nom.text)).toBe("Mon aventure");
  await choisirLeMode(page, 0, "platformer-niveau");
  expect(await nomsJoues(page)).toEqual(NIVEAUX);
  sansErreur();
});

// Mon aventure a son record, qui ne vaut que pour ses niveaux tels qu'ils étaient : un niveau retouché l'efface
test("le record de Mon aventure : gardé à la fin, montré au menu, effacé quand un niveau change", async ({ page }) => {
  const { sansErreur } = await ouvrir(page);
  await page.evaluate(() => {
    const bon = {
      nom: "Bon", largeur: 1200, elements: [
        { sorte: "plateforme", x: 0, y: 440, w: 1200, h: 40, genre: "normale", force: 2, sens: 1 },
        { sorte: "depart", x: 60, y: 400 }, { sorte: "piece", x: 66, y: 400 }, { sorte: "drapeau", x: 1140, y: 400 },
      ],
    };
    localStorage.setItem("platformer/mon-aventure/ordre", JSON.stringify(["Bon"]));
    localStorage.setItem("platformer/mon-aventure/niveau/Bon", JSON.stringify(bon));
  });
  await ouvrirLaCarte(page, "platformer");
  await attendreScene(page, "platformer-menu");
  await choisirLeMode(page, 1, "platformer-niveau");
  // La pièce est sous ses pieds, au départ : un point, puis le drapeau
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("platformer-niveau").donnees.score === 1);
  await allerAuDrapeau(page);
  await attendreScene(page, "platformer-fin");
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-fin").sys.settings.data.nouveauRecord)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("platformer/mon-aventure/meilleur-score"))).toBe("1");

  // Au menu, le bouton de Mon aventure le dit
  await page.waitForTimeout(800);
  await appuyer(page, "Escape");
  await attendreScene(page, "platformer-menu");
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-menu").boutons[1].aide.text)).toContain("record : 1");

  // Ouvrir l'éditeur sans rien changer ne l'efface pas ; enregistrer le niveau (Ctrl+S), si
  await choisirLeMode(page, 4, "platformer-editeur");
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => localStorage.getItem("platformer/mon-aventure/meilleur-score"))).toBe("1");
  await page.keyboard.press("Control+s");
  await page.waitForFunction(() => localStorage.getItem("platformer/mon-aventure/meilleur-score") === null);
  sansErreur();
});

// Mon aventure passe par le même validerNiveau que l'Aventure : une sauvegarde illisible, ou lisible mais
// fausse (sans départ), est sautée
test("un niveau abîmé dans Mon aventure est sauté, sans planter", async ({ page }) => {
  const { sansErreur } = await ouvrir(page);
  await page.evaluate(() => {
    const bon = {
      nom: "Bon", largeur: 1200, elements: [
        { sorte: "plateforme", x: 0, y: 440, w: 1200, h: 40, genre: "normale", force: 2, sens: 1 },
        { sorte: "depart", x: 60, y: 400 }, { sorte: "drapeau", x: 1140, y: 400 },
      ],
    };
    localStorage.setItem("platformer/mon-aventure/ordre", JSON.stringify(["Illisible", "Faux", "Bon"]));
    localStorage.setItem("platformer/mon-aventure/niveau/Illisible", "{ pas du json");
    localStorage.setItem("platformer/mon-aventure/niveau/Faux", JSON.stringify({ largeur: "abc", elements: [] }));
    localStorage.setItem("platformer/mon-aventure/niveau/Bon", JSON.stringify(bon));
  });
  await ouvrirLaCarte(page, "platformer");
  await attendreScene(page, "platformer-menu");
  // Le menu dit ce qui attend : un boss au bout de l'Aventure, pas au bout de Mon aventure
  const aides = await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-menu").boutons
    .slice(0, 2).map((b: any) => b.aide.text));
  expect(aides).toEqual(["3 vies, un boss au bout", "3 vies"]);
  await choisirLeMode(page, 1, "platformer-niveau");
  expect(await nomsJoues(page)).toEqual(["Bon"]);
  sansErreur();
});

// L'Aventure se joue avec les genres de départ : un genre changé dans l'éditeur ne touche que Mon aventure
test("un genre changé dans l'éditeur ne change pas l'Aventure", async ({ page }) => {
  const { sansErreur } = await ouvrir(page);
  await page.evaluate(() => {
    localStorage.setItem("platformer/mon-aventure/genres", JSON.stringify({ glace: { couleur: [1, 2, 3], solide: true, effet: "mortel" } }));
  });
  await ouvrirLaCarte(page, "platformer");
  await attendreScene(page, "platformer-menu");
  await choisirLeMode(page, 0, "platformer-niveau");
  const effet = () => page.evaluate(() => (window as any).jeu.scene.getScene("platformer-niveau").genres.effet("glace") as string);
  expect(await effet()).toBe("glisse");
  // Le même niveau joué hors de l'Aventure (comme le bouton Tester) : le genre changé compte
  await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("platformer-niveau");
    n.scene.restart({ ...n.donnees, mode: "test", niveaux: [n.donnees.niveaux[0]] });
  });
  await attendreLeNiveau(page, "n.donnees.mode === 'test'");
  expect(await effet()).toBe("mortel");
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

  await poserLeHeros(page, 115, 255);      // sur le premier téléporteur : il arrive sur le second...
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("platformer-niveau").heros.body.x > 1690);
  await page.waitForTimeout(500);          // ... et y reste (il repartait aussitôt d'où il venait)
  expect((await niveau(page)).x).toBeGreaterThan(1690);

  await poserLeHeros(page, 835, 395);      // dans la lave
  await page.waitForFunction(() => !(window as any).jeu.scene.getScene("platformer-niveau").enJeu);
  sansErreur();
});

test.describe("au doigt", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test("on choisit au doigt, ▶ fait courir, ▲ fait sauter", async ({ page }) => {
    const { sansErreur } = await ouvrir(page);
    await toucherLaCarte(page, "platformer");
    await attendreScene(page, "platformer-menu");
    expect(await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-menu").boutons[3].possible)).toBe(false);
    const { largeur } = await tailleDuJeu(page);
    await toucher(page, largeur / 2, 150); // « Aventure »
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
    const saut = await versLaPage(page, largeur - 98, 440);   // ▲, sous le pouce droit
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

  // Le tableau de bord, arrêté avec le niveau, n'entend pas le doigt se lever pendant la pause
  test("le ⏸ met en pause ; un doigt levé pendant la pause ne fait plus courir au retour", async ({ page }) => {
    const { sansErreur } = await ouvrir(page);
    await toucherLaCarte(page, "platformer");
    await attendreScene(page, "platformer-menu");
    const { largeur } = await tailleDuJeu(page);
    await toucher(page, largeur / 2, 150); // « Aventure »
    await attendreScene(page, "platformer-niveau");
    await page.waitForTimeout(400);

    // Le ⏸, en haut à droite, sous la barre ; « Reprendre », le premier bouton de la pause
    await toucher(page, largeur - 44, 80);
    await attendreLaPause(page);
    await toucher(page, largeur / 2, 230);
    await page.waitForFunction(() => (window as any).jeu.scene.isActive("platformer-niveau"));
    await page.waitForTimeout(300);        // la pause ne se rouvre pas aussitôt fermée

    // Un doigt tient ▶ quand la pause s'ouvre (la fenêtre perd la main), et se lève pendant la pause
    const cdp = await page.context().newCDPSession(page);
    const droite = await versLaPage(page, 236, 452);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: droite.x, y: droite.y, id: 1 }] });
    await page.waitForTimeout(200);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await attendreLaPause(page);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    expect((await niveau(page)).tactile.droite).toBe(true);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(100);
    await toucher(page, largeur / 2, 230);
    await page.waitForFunction(() => (window as any).jeu.scene.isActive("platformer-niveau"));
    await page.waitForTimeout(100);
    const arret = await niveau(page);
    expect(arret.tactile).toMatchObject({ droite: false, gauche: false, saut: false });
    await page.waitForTimeout(300);
    expect((await niveau(page)).x).toBeCloseTo(arret.x, 0);
    sansErreur();
  });

  // socle/largeur.ts : sur un téléphone en 20/9, plus de bandes noires, on voit plus de niveau
  test("au doigt, le platformer prend toute la largeur du téléphone : le menu, le niveau, le tableau, l'éditeur", async ({ page }) => {
    const { sansErreur } = await ouvrir(page);
    expect(await tailleDuJeu(page)).toEqual({ largeur: 960, hauteur: 540 });
    await toucherLaCarte(page, "platformer");
    await attendreScene(page, "platformer-menu");
    const largeur = Math.round(540 * 844 / 390);
    expect((await tailleDuJeu(page)).largeur).toBe(largeur);
    expect((await page.locator("canvas").boundingBox())!.width).toBeCloseTo(844, 0);
    expect(await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-menu").boutons[0].fond.x)).toBe(largeur / 2);

    await toucher(page, largeur / 2, 150); // « Aventure »
    await attendreScene(page, "platformer-niveau");
    await attendreScene(page, "platformer-tableau");
    const vu = await page.evaluate(() => {
      const jeu = (window as any).jeu;
      const n = jeu.scene.getScene("platformer-niveau");
      const t = jeu.scene.getScene("platformer-tableau");
      return {
        camera: n.cameras.main.width as number,
        monde: n.cameras.main.worldView.width as number,
        tableau: t.cameras.main.width as number,
        saut: t.ronds.get("saut").x as number,
        gauche: t.ronds.get("gauche").x as number,
      };
    });
    expect(vu.camera).toBe(largeur);
    expect(vu.monde).toBeCloseTo(largeur / ZOOM, 0);   // plus que 960 / ZOOM : on voit plus loin
    expect(vu.tableau).toBe(largeur);
    expect(vu.saut).toBe(largeur - 98);    // ▲ au bord droit, sous le pouce ; ◀ au bord gauche
    expect(vu.gauche).toBe(88);

    // Une vie perdue au doigt : le téléphone vibrerait (ici, rien ne plante)
    await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-niveau").mourir());
    await attendreLeNiveau(page, "n.enJeu && n.donnees.vies === 2");

    // L'éditeur aussi : sa zone du niveau prend la largeur en plus
    await quitterParLaPause(page);
    await attendreScene(page, "platformer-menu");
    await toucher(page, largeur / 2, 380); // « Éditeur de niveaux »
    await attendreScene(page, "platformer-editeur");
    expect(await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-editeur").cameras.main.width)).toBe(largeur - 212);

    // De retour à l'Arcade, le jeu reprend ses 960 de large
    await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-editeur").scene.start("platformer-menu"));
    await attendreScene(page, "platformer-menu");
    await appuyer(page, "Escape");
    await attendreScene(page, "Hub");
    expect(await tailleDuJeu(page)).toEqual({ largeur: 960, hauteur: 540 });
    sansErreur();
  });
});


// Un niveau d'essai, joué comme le bouton Tester de l'éditeur le ferait
async function jouerUnEssai(page: Page, elements: Element[], largeur = 2000) {
  await page.evaluate(([elements, largeur]) => {
    (window as any).jeu.scene.getScene("platformer-menu").scene
      .start("platformer-niveau", { mode: "test", niveaux: [{ nom: "Essai", largeur, elements }], numero: 0, score: 0, vies: 3, pieces: 0 });
  }, [elements, largeur] as const);
  await attendreLeNiveau(page, "n.enJeu && n.heros.getData('auSol')");
}

const sol = (x: number, w: number, y = 440): Element => ({ sorte: "plateforme", x, y, w, h: 40, genre: "normale", force: 2, sens: 1 });

test("les niveaux de départ : chacun se joue, montre un genre de plus, et son arrivée est atteignable en théorie", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  await choisirLeMode(page, 0, "platformer-niveau");
  const niveaux: DonneesDuNiveau[] = await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-niveau").donnees.niveaux);
  expect(niveaux.map((n) => n.nom)).toEqual(NIVEAUX);

  // Du départ à l'arrivée en courant et en sautant, avec la physique du héros (voir faisable.ts)
  for (const niveau of niveaux) {
    expect(faisable(niveau), niveau.nom).toBe(true);
  }
  // Le calcul voit bien l'impossible : sans son ressort, le haut perchoir de « Glace et ressorts » est hors d'atteinte
  const glace = niveaux.find((n) => n.nom === "Glace et ressorts")!;
  expect(faisable({ ...glace, elements: glace.elements.filter((e) => e.genre !== "ressort") })).toBe(false);
  // ... et sans ses téléporteurs, le mur de « Téléporteurs » barre la route
  const tele = niveaux.find((n) => n.nom === "Téléporteurs")!;
  expect(faisable({ ...tele, elements: tele.elements.filter((e) => e.genre !== "teleporteur") })).toBe(false);

  // Toute l'Aventure montre ce que le jeu sait faire : chaque genre de plateforme et chaque ennemi
  const montres = new Set(niveaux.flatMap((n) => n.elements.map((e) => e.genre ?? e.type ?? e.sorte)));
  for (const chose of ["glace", "ressort", "tapis", "fragile", "eau", "teleporteur", "lave", "marcheur", "volant", "sauteur", "mobile", "boss"]) {
    expect(montres.has(chose), chose).toBe(true);
  }

  // Chaque niveau se charge, et le héros tient debout au départ
  for (let numero = 0; numero < niveaux.length; numero++) {
    await page.evaluate((numero) => {
      const n = (window as any).jeu.scene.getScene("platformer-niveau");
      n.scene.restart({ ...n.donnees, numero });
    }, numero);
    await attendreLeNiveau(page, `n.donnees.numero === ${numero} && n.enJeu && n.heros.getData('auSol')`);
    await page.waitForTimeout(300);
    expect(await niveau(page), NIVEAUX[numero]).toMatchObject({ nom: NIVEAUX[numero], enJeu: true, vies: 3 });
  }
  sansErreur();
});

// Chaque image du niveau est notée, après la physique : au sol ? un appui de saut en attente ? un saut ?
type Note = { sol: boolean; envie: number; saute: boolean; sauts: number };
function noterLesImages(page: Page) {
  return page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("platformer-niveau");
    n.notes = [];
    if (!n.noter) {
      n.noter = () => n.notes.push({ sol: n.heros.getData("auSol"), envie: n.heros.envieDeSauter, saute: n.heros.aSaute, sauts: n.heros.sauts });
      n.events.on("postupdate", n.noter);
    }
  });
}
const lesNotes = (page: Page): Promise<Note[]> => page.evaluate(() => (window as any).jeu.scene.getScene("platformer-niveau").notes);
const aSaute = (page: Page) => page.waitForFunction(() => (window as any).jeu.scene.getScene("platformer-niveau").notes.some((note: any) => note.saute));

test("le saut qui pardonne : on saute encore juste après avoir quitté le bord", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  // Un perchoir, haut au-dessus du sol : la chute laisse le temps d'appuyer
  await jouerUnEssai(page, [sol(0, 400, 100), sol(0, 2000), { sorte: "depart", x: 300, y: 60 }, { sorte: "drapeau", x: 1950, y: 400 }]);

  // Il court, quitte le bord sans sauter, et tombe ; un instant après, le saut part quand même
  await page.keyboard.down("ArrowRight");
  await page.waitForFunction(() => !(window as any).jeu.scene.getScene("platformer-niveau").heros.getData("auSol"));
  await noterLesImages(page);
  await page.waitForTimeout(80);
  await page.keyboard.press("Space");
  await aSaute(page);
  await page.keyboard.up("ArrowRight");
  const notes = await lesNotes(page);
  const saut = notes.find((note) => note.saute)!;
  expect(saut.sol).toBe(false);            // en l'air, après le bord
  expect(saut.sauts).toBe(1);              // et c'était le saut du sol : il lui reste le double saut
  sansErreur();
});

test("le saut qui pardonne : un appui juste avant de toucher le sol fait sauter en y arrivant", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  await jouerUnEssai(page, [sol(0, 2000), { sorte: "depart", x: 300, y: 400 }, { sorte: "drapeau", x: 1950, y: 400 }]);
  expect(SAUT_MEMORISE).toBeGreaterThanOrEqual(100);   // le test appuie un peu moins de 100 ms avant le sol

  for (let essai = 1; ; essai++) {
    // Il tombe de haut, ses deux sauts déjà pris
    await page.evaluate(() => {
      const n = (window as any).jeu.scene.getScene("platformer-niveau");
      n.heros.body.reset(n.heros.x, 100);
      n.heros.sauts = 0;
    });
    await noterLesImages(page);
    // L'appui, à 120 pixels du sol : moins de 100 ms avant de s'y poser
    await page.waitForFunction(() => {
      const corps = (window as any).jeu.scene.getScene("platformer-niveau").heros.body;
      return corps.velocity.y > 0 && corps.bottom > 320;
    });
    await page.keyboard.press("Space");
    await aSaute(page);
    const notes = await lesNotes(page);
    const appui = notes.findIndex((note) => note.envie > 0);
    // Sur un poste chargé, l'appui peut n'arriver qu'une fois au sol : ce n'est pas ce qu'on veut voir, on recommence
    if (appui < 0 && essai < 4) {
      await page.waitForTimeout(600);      // le temps qu'il retombe
      continue;
    }
    const saut = notes.findIndex((note) => note.saute);
    expect(appui).toBeGreaterThanOrEqual(0);
    expect(appui).toBeLessThan(saut);      // l'appui, entendu en l'air, sans saut possible...
    expect(notes[appui]).toMatchObject({ sol: false, sauts: 0 });
    expect(notes[saut].sol).toBe(true);    // ... fait sauter en touchant le sol, sans nouvel appui
    // La touche était lâchée bien avant : c'est quand même un saut entier, pas le petit bond d'une frappe
    // (le saut court ne raccourcit qu'un saut dont la touche est encore là)
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("platformer-niveau").heros.body.velocity.y >= 0);
    const sommet = await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-niveau").heros.body.bottom as number);
    expect(440 - sommet).toBeGreaterThan(100);
    break;
  }
  sansErreur();
});
test("l'Infini : pendant qu'il clignote, après une deuxième chance, aucun ennemi ne le touche", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  await choisirLeMode(page, 2, "platformer-niveau");
  await page.evaluate(() => {
    (window as any).jeu.scene.getScene("platformer-niveau").donnees.vies = 3;
  });
  await poserLeHeros(page, 300, 600);      // tombé dans le vide : une deuxième chance
  await attendreLeNiveau(page, "n.enJeu && n.donnees.vies === 2");

  // Un ennemi apparaît sur lui, et va et vient sur place
  await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("platformer-niveau");
    const c = n.heros.body;
    n.monde.ajouter([{ sorte: "ennemi", type: "marcheur", x: c.x, y: c.y + 5, xmin: c.x - 10, xmax: c.x + 40 }]);
  });
  await page.waitForTimeout(400);
  expect(await niveau(page)).toMatchObject({ enJeu: true, vies: 2 });
  // Le clignotement fini, l'ennemi le touche
  await page.waitForFunction(() => !(window as any).jeu.scene.getScene("platformer-niveau").enJeu);
  await attendreLeNiveau(page, "n.enJeu && n.donnees.vies === 1");
  sansErreur();
});

test("l'Infini : pièces et ennemis seulement sur les plateformes qui ne bougent pas", () => {
  const elements = new Generateur("infini").suite(60_000);
  const plateformes = elements.filter((e) => e.sorte === "plateforme" || e.sorte === "mobile");
  expect(plateformes.some((p) => p.sorte === "mobile")).toBe(true);
  expect(plateformes.some((p) => p.genre === "fragile")).toBe(true);
  const sousLui = (e: Element) => plateformes.find((p) => p.x <= e.x && e.x < p.x + p.w!);
  const poses = elements.filter((e) => e.sorte === "piece" || e.sorte === "ennemi");
  expect(poses.length).toBeGreaterThan(50);
  for (const e of poses) {
    expect(sousLui(e)).toMatchObject({ sorte: "plateforme", genre: "normale" });
  }
});

// ================================================================ La pause et les décomptes

// this.time.now continue pendant la pause : un décompte qui s'en servait finissait pendant qu'on ne jouait pas
test("la pause arrête aussi l'invincibilité du boss, qui reprend avec le jeu", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  await choisirLeMode(page, 0, "platformer-niveau");
  await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("platformer-niveau");
    n.scene.restart({ ...n.donnees, numero: n.donnees.niveaux.length - 1 });
  });
  await attendreLeNiveau(page, "n.monde.boss !== null && n.enJeu");

  // Un coup sur la tête : il devient invincible un court instant (500 ms)...
  await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("platformer-niveau");
    const b = n.monde.boss;
    n.heros.body.reset(b.x, b.body.top - 40);
    n.heros.body.setVelocityY(300);
  });
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("platformer-niveau").monde.boss.invincible);
  // ... et la pause s'ouvre aussitôt (Échap), pour deux fois ce temps
  await appuyer(page, "Escape");
  await attendreLaPause(page);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-niveau").monde.boss.invincible)).toBe(true);

  // La reprise : le reste de son invincibilité s'écoule, puis il redevient vulnérable
  await appuyer(page, "Escape");
  await page.waitForFunction(() => (window as any).jeu.scene.isActive("platformer-niveau"));
  await page.waitForFunction(() => {
    const boss = (window as any).jeu.scene.getScene("platformer-niveau").monde.boss;
    return !boss || !boss.invincible;
  });
  sansErreur();
});

test("la pause arrête aussi le clignotement de la deuxième chance (l'Infini)", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  await choisirLeMode(page, 2, "platformer-niveau");
  await page.evaluate(() => {
    (window as any).jeu.scene.getScene("platformer-niveau").donnees.vies = 3;
  });
  await poserLeHeros(page, 300, 600);      // tombé dans le vide : une deuxième chance, intouchable une seconde
  await attendreLeNiveau(page, "n.enJeu && n.donnees.vies === 2 && n.intouchable");
  await appuyer(page, "Escape");
  await attendreLaPause(page);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as any).jeu.scene.getScene("platformer-niveau").intouchable)).toBe(true);
  await appuyer(page, "Escape");
  await page.waitForFunction(() => (window as any).jeu.scene.isActive("platformer-niveau"));
  await page.waitForFunction(() => !(window as any).jeu.scene.getScene("platformer-niveau").intouchable);
  sansErreur();
});

// ================================================================ Les sensations

// La plus grande hauteur atteinte par le héros, mesurée à chaque image, pendant un saut fait par « sauter »
async function hauteurDuSaut(page: Page, sauter: () => Promise<void>): Promise<number> {
  await page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("platformer-niveau");
    n.depart = n.heros.body.y;
    n.plusHaut = n.heros.body.y;
    if (!n.mesurer) {
      n.mesurer = () => (n.plusHaut = Math.min(n.plusHaut, n.heros.body.y));
      n.events.on("postupdate", n.mesurer);
    }
  });
  await sauter();
  // Il est parti, puis il est retombé
  await page.waitForFunction(() => {
    const n = (window as any).jeu.scene.getScene("platformer-niveau");
    return n.plusHaut < n.depart - 5 && n.heros.getData("auSol");
  });
  return page.evaluate(() => {
    const n = (window as any).jeu.scene.getScene("platformer-niveau");
    return n.depart - n.plusHaut;
  });
}

test("le saut court : lâcher la touche tôt saute moins haut que la tenir", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  await jouerUnEssai(page, [sol(0, 2000), { sorte: "depart", x: 300, y: 400 }, { sorte: "drapeau", x: 1950, y: 400 }]);

  // Tenue jusqu'au haut du saut : le saut entier (environ 130 pixels)
  const entier = await hauteurDuSaut(page, async () => {
    await page.keyboard.down("Space");
    await page.waitForFunction(() => (window as any).jeu.scene.getScene("platformer-niveau").heros.body.velocity.y > 0);
    await page.keyboard.up("Space");
  });
  // Une frappe brève : un petit bond
  const court = await hauteurDuSaut(page, () => page.keyboard.press("Space"));
  expect(entier).toBeGreaterThan(115);
  expect(court).toBeGreaterThan(10);
  expect(court).toBeLessThan(entier * 0.6);
  sansErreur();
});

test("gagner, c'est une fête : des confettis au drapeau, et la caméra s'approche", async ({ page }) => {
  const { sansErreur } = await menuPlatformer(page);
  await jouerUnEssai(page, [sol(0, 2000), { sorte: "depart", x: 300, y: 400 }, { sorte: "drapeau", x: 600, y: 400 }]);
  await allerAuDrapeau(page);
  await page.waitForFunction((zoom) => {
    const n = (window as any).jeu.scene.getScene("platformer-niveau");
    return n.confettis.getAliveParticleCount() > 20 && n.cameras.main.zoom > zoom * 1.05;
  }, ZOOM);
  await attendreScene(page, "platformer-fin");
  sansErreur();
});
