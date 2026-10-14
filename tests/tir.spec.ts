import { test, expect, type Page } from "@playwright/test";
import { ouvrir, appuyer, attendreScene, scenesActives, versLaPage, toucher, ouvrirLaCarte, manette } from "./outils";

// Du Hub jusqu'au menu du jeu de tir
async function menuDuTir(page: Page) {
  const ouverte = await ouvrir(page);
  await ouvrirLaCarte(page, "tir");
  await attendreScene(page, "tir-menu");
  return ouverte;
}

// L'état de la partie, lu dans la scène Phaser
function partie(page: Page) {
  return page.evaluate(() => {
    const p = (window as any).jeu.scene.getScene("tir-partie");
    return {
      enJeu: p.enJeu as boolean,
      score: p.score as number,
      vies: p.vies as number,
      arme: p.arme as number,
      bouclier: p.bouclier as boolean,
      vague: p.vague.numero as number,
      x: p.vaisseau.body.center.x as number,
      y: p.vaisseau.body.center.y as number,
      balles: p.balles.countActive() as number,
      ennemis: p.ennemis.getLength() as number,
      boss: p.boss ? { pret: p.boss.pret as boolean, vie: p.boss.vie as number } : null,
    };
  });
}

// La partie recommence à la vague voulue (le boss arrive à la 5e)
async function commencerALaVague(page: Page, numero: number) {
  await page.evaluate((numero) => {
    // Comme « Rejouer » : le tableau de bord s'arrête, la partie le relancera
    const jeu = (window as any).jeu;
    jeu.scene.stop("tir-tableau");
    jeu.scene.getScene("tir-partie").scene.restart({ vague: numero });
  }, numero);
  await page.waitForFunction((numero) => {
    const p = (window as any).jeu.scene.getScene("tir-partie");
    return p.sys.isActive() && p.vague?.numero === numero;
  }, numero);
}

test("le Hub lance le tir spatial : le vaisseau se pilote, tire tout seul et abat des ennemis", async ({ page }) => {
  const { sansErreur } = await menuDuTir(page);
  await appuyer(page, "Enter");
  await attendreScene(page, "tir-partie");
  expect(await scenesActives(page)).toEqual(["tir-partie", "tir-tableau"]);
  expect(await partie(page)).toMatchObject({ enJeu: true, score: 0, vies: 3, arme: 1, vague: 1 });

  // Il tire sans qu'on appuie sur rien
  await page.waitForTimeout(400);
  expect((await partie(page)).balles).toBeGreaterThan(0);

  // La flèche gauche le déplace ; Q (KeyA, à sa place sur le clavier) aussi
  const depart = await partie(page);
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(300);
  await page.keyboard.up("ArrowLeft");
  const apres = await partie(page);
  expect(apres.x).toBeLessThan(depart.x - 50);
  await page.keyboard.down("KeyW");          // la place du Z sur un AZERTY : vers le haut
  await page.waitForTimeout(300);
  await page.keyboard.up("KeyW");
  expect((await partie(page)).y).toBeLessThan(apres.y - 50);

  // Les éclaireurs de la première vague arrivent : on glisse sous le premier, et il finit abattu
  await page.waitForFunction(() => {
    const p = (window as any).jeu.scene.getScene("tir-partie");
    const ennemi = p.ennemis.getChildren().find((e: any) => e.y > 0 && e.y < 250);
    if (ennemi) {
      p.vaisseau.body.reset(ennemi.x, 460);
    }
    return p.score > 0;
  }, undefined, { timeout: 20_000 });
  sansErreur();
});

// Par les vrais chocs de la physique, pas en appelant toucherLeVaisseau : Phaser passe les deux objets
// d'un overlap dans l'ordre qui lui chante, et un ennemi qui percutait détruisait le vaisseau à sa place
test("un ennemi qui percute le vaisseau, puis une balle ennemie : une vie de moins chaque fois, et ça continue", async ({ page }) => {
  const { sansErreur } = await menuDuTir(page);
  await appuyer(page, "Enter");
  await attendreScene(page, "tir-partie");

  // Le vaisseau se jette sur le premier éclaireur qui passe à sa portée
  await page.waitForFunction(() => {
    const p = (window as any).jeu.scene.getScene("tir-partie");
    const ennemi = p.ennemis.getChildren().find((e: any) => e.y > 230 && e.y < 500);
    if (ennemi && p.vaisseau.body) {
      p.vaisseau.body.reset(ennemi.x, ennemi.y);
    }
    return p.vies < 3;
  }, undefined, { timeout: 20_000 });
  const images = await page.evaluate(() => (window as any).jeu.loop.frame);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).jeu.loop.frame)).toBeGreaterThan(images + 5);
  expect(await partie(page)).toMatchObject({ vies: 2, enJeu: true });

  // Une balle ennemie posée sur le vaisseau, une fois son clignotement fini
  await page.evaluate(() => {
    const p = (window as any).jeu.scene.getScene("tir-partie");
    p.invincibleJusqua = 0;
    p.tirer(p.vaisseau.x, p.vaisseau.y, 90, 1);
  });
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("tir-partie").vies === 1);
  expect((await partie(page)).enJeu).toBe(true);
  sansErreur();
});

test("à la souris, le vaisseau suit le curseur sans cliquer ; une touche reprend la main", async ({ page }) => {
  const { sansErreur } = await menuDuTir(page);
  await appuyer(page, "Enter");
  await attendreScene(page, "tir-partie");
  await page.waitForTimeout(300);

  const vers = await versLaPage(page, 250, 350);
  await page.mouse.move(vers.x, vers.y, { steps: 5 });
  await page.waitForFunction(() => {
    const c = (window as any).jeu.scene.getScene("tir-partie").vaisseau.body.center;
    return Math.abs(c.x - 250) < 4 && Math.abs(c.y - 350) < 4;
  });
  // Le curseur est caché pendant la partie : le vaisseau le remplace
  expect(await page.evaluate(() => (window as any).jeu.canvas.style.cursor)).toBe("none");

  // Plus haut que sa limite, il s'arrête à la limite
  const haut = await versLaPage(page, 600, 60);
  await page.mouse.move(haut.x, haut.y, { steps: 5 });
  await page.waitForFunction(() => {
    const c = (window as any).jeu.scene.getScene("tir-partie").vaisseau.body.center;
    return Math.abs(c.x - 600) < 4 && c.y > 190 && c.y < 240;
  });

  // La flèche droite reprend la main : le vaisseau ne revient pas vers le curseur une fois lâchée
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(300);
  await page.keyboard.up("ArrowRight");
  const apres = await partie(page);
  expect(apres.x).toBeGreaterThan(650);
  await page.waitForTimeout(300);
  expect((await partie(page)).x).toBeCloseTo(apres.x, 0);
  sansErreur();
});

test("trois coups : la partie est perdue, le record reste, et Entrée rejoue", async ({ page }) => {
  const { sansErreur } = await menuDuTir(page);
  await appuyer(page, "Enter");
  await attendreScene(page, "tir-partie");

  await page.evaluate(() => {
    const p = (window as any).jeu.scene.getScene("tir-partie");
    p.score = 4321;
  });
  for (let coup = 1; coup <= 3; coup++) {
    // Après un coup, le vaisseau clignote et ne craint rien : on n'attend pas la fin du clignotement
    await page.evaluate(() => {
      const p = (window as any).jeu.scene.getScene("tir-partie");
      p.invincibleJusqua = 0;
      p.toucherLeVaisseau();
    });
    expect((await partie(page)).vies).toBe(3 - coup);
  }
  expect((await partie(page)).enJeu).toBe(false);
  await attendreScene(page, "tir-fin");
  expect(await page.evaluate(() => (window as any).jeu.canvas.style.cursor)).toBe("default");
  expect(await page.evaluate(() => localStorage.getItem("tir/record"))).toBe("4321");

  await page.waitForTimeout(700);           // la fin n'écoute qu'après un petit moment
  await appuyer(page, "Enter");
  await page.waitForFunction(() => {
    const jeu = (window as any).jeu;
    return !jeu.scene.isActive("tir-fin") && jeu.scene.getScene("tir-partie").enJeu;
  });
  expect(await partie(page)).toMatchObject({ score: 0, vies: 3, vague: 1 });
  expect(await scenesActives(page)).toEqual(["tir-partie", "tir-tableau"]);

  // Échap revient au menu, qui montre le record
  await appuyer(page, "Escape");
  await attendreScene(page, "tir-menu");
  sansErreur();
});

test("les bonus : plus de tirs, un bouclier qui prend un coup, une vie de plus", async ({ page }) => {
  const { sansErreur } = await menuDuTir(page);
  await appuyer(page, "Enter");
  await attendreScene(page, "tir-partie");

  // Un bonus lâché sur le vaisseau est ramassé aussitôt
  const ramasser = (genre: string) => page.evaluate((genre) => {
    const p = (window as any).jeu.scene.getScene("tir-partie");
    p.lacherUnBonus(p.vaisseau.x, p.vaisseau.y, genre);
  }, genre);

  await ramasser("arme");
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("tir-partie").arme === 2);
  await ramasser("bouclier");
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("tir-partie").bouclier);
  await page.evaluate(() => (window as any).jeu.scene.getScene("tir-partie").toucherLeVaisseau());
  expect(await partie(page)).toMatchObject({ vies: 3, bouclier: false, arme: 2 });
  await ramasser("vie");
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("tir-partie").vies === 4);
  sansErreur();
});

test("le boss arrive à la vague 5 ; battu, la vague 6 commence", async ({ page }) => {
  const { sansErreur } = await menuDuTir(page);
  await appuyer(page, "Enter");
  await attendreScene(page, "tir-partie");
  await commencerALaVague(page, 5);

  // Pendant son arrivée, il ne craint rien ; ensuite, sa vie s'affiche au tableau de bord
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("tir-partie").boss?.pret, undefined, { timeout: 10_000 });
  // Le tableau de bord le voit à sa prochaine image
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("tir-tableau").cadreDuBoss.visible);

  // On le laisse à un souffle de la fin, et le vaisseau, sous lui, l'achève
  await page.evaluate(() => {
    const p = (window as any).jeu.scene.getScene("tir-partie");
    p.boss.vie = 2;
    p.invincibleJusqua = Infinity;          // ses tirs ne doivent pas finir la partie avant lui
  });
  await page.waitForFunction(() => {
    const p = (window as any).jeu.scene.getScene("tir-partie");
    if (p.boss) {
      p.vaisseau.body.reset(p.boss.x, 460);
    }
    return p.vague.numero === 6;
  }, undefined, { timeout: 15_000 });
  expect((await partie(page)).score).toBeGreaterThanOrEqual(3000);
  sansErreur();
});

// Le son coupé (socle/son.ts) : le même pour tous les jeux qui n'ont que « allumé » ou « coupé »
test("le son : M le coupe et le bouton le remet, c'est gardé, et le retour au Hub le rend à l'Arcade", async ({ page }) => {
  const { sansErreur } = await menuDuTir(page);
  // Ce que le jeu demande, d'après l'événement « mute » de Phaser : relire sound.mute peut mentir quand
  // rien ne joue (docs/PIEGES-PHASER.md)
  await page.evaluate(() => {
    (window as any).__muet = false;
    (window as any).jeu.sound.on("mute", (_sons: unknown, muet: boolean) => { (window as any).__muet = muet; });
  });
  const muet = () => page.evaluate(() => (window as any).__muet as boolean);
  const bouton = () => page.evaluate(() => (window as any).jeu.scene.getScene("tir-menu").children.list
    .find((o: any) => typeof o.text === "string" && o.text.includes("(M)")).text as string);
  expect(await muet()).toBe(false);
  await appuyer(page, "m");
  expect(await muet()).toBe(true);
  expect(await bouton()).toContain("Muet");
  expect(await page.evaluate(() => localStorage.getItem("tir/son"))).toBe("false");

  // En partie, toujours coupé ; M fonctionne là aussi
  await appuyer(page, "Enter");
  await attendreScene(page, "tir-partie");
  expect(await muet()).toBe(true);
  await appuyer(page, "m");
  expect(await muet()).toBe(false);
  await appuyer(page, "m");

  // Au Hub, le son revient pour toute l'Arcade, mais le tir s'en souvient
  await appuyer(page, "Escape");
  await attendreScene(page, "tir-menu");
  await appuyer(page, "Escape");
  await attendreScene(page, "Hub");
  expect(await muet()).toBe(false);
  await ouvrirLaCarte(page, "tir");
  await attendreScene(page, "tir-menu");
  expect(await muet()).toBe(true);
  sansErreur();
});

// La manette (socle/manette.ts) : A ou Start valide, B revient, dans les menus et les fins de partie
test("à la manette : A lance la partie, Start rejoue après la fin, B revient au menu", async ({ page }) => {
  const { sansErreur } = await menuDuTir(page);
  await manette(page, "tir-menu", 0);
  await attendreScene(page, "tir-partie");
  await page.evaluate(() => {
    const p = (window as any).jeu.scene.getScene("tir-partie");
    p.vies = 1;
    p.toucherLeVaisseau();
  });
  await attendreScene(page, "tir-fin");
  await page.waitForTimeout(700);          // la fin n'écoute qu'après un petit moment
  await manette(page, "tir-fin", 9);
  await page.waitForFunction(() => !(window as any).jeu.scene.isActive("tir-fin")
    && (window as any).jeu.scene.getScene("tir-partie").enJeu);
  await page.evaluate(() => {
    const p = (window as any).jeu.scene.getScene("tir-partie");
    p.vies = 1;
    p.toucherLeVaisseau();
  });
  await attendreScene(page, "tir-fin");
  await page.waitForTimeout(700);
  await manette(page, "tir-fin", 1);
  await attendreScene(page, "tir-menu");
  sansErreur();
});

test.describe("au doigt", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test("on touche « Jouer », puis le vaisseau suit le doigt qui glisse", async ({ page }) => {
    const { sansErreur } = await menuDuTir(page);
    await toucher(page, 480, 400);
    await attendreScene(page, "tir-partie");
    await page.waitForTimeout(500);

    const depart = await partie(page);
    const cdp = await page.context().newCDPSession(page);
    const de = await versLaPage(page, 700, 300);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: de.x, y: de.y, id: 1 }] });
    // Le doigt glisse de 200 pixels vers la gauche et 80 vers le haut : le vaisseau fait de même
    for (let pas = 1; pas <= 10; pas++) {
      const a = await versLaPage(page, 700 - 20 * pas, 300 - 8 * pas);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a.x, y: a.y, id: 1 }] });
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(300);
    const apres = await partie(page);
    expect(Math.abs(apres.x - (depart.x - 200))).toBeLessThan(12);
    expect(Math.abs(apres.y - (depart.y - 80))).toBeLessThan(12);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    sansErreur();
  });
});
