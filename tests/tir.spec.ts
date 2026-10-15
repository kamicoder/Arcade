import { test, expect, type Page } from "@playwright/test";
import {
  ouvrir, appuyer, attendreScene, scenesActives, versLaPage, toucher, ouvrirLaCarte, manette, manetteAToutes, quitterParLaPause,
  attendreLaPause,
} from "./outils";

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

  // La pause, puis « Le menu »
  await quitterParLaPause(page);
  await attendreScene(page, "tir-menu");
  sansErreur();
});

// La pause du socle (socle/pause.ts), vue en détail ici une fois pour toutes ; les autres jeux vérifient
// seulement qu'elle s'ouvre
test("la pause : tout s'arrête, une touche lâchée pendant la pause l'est aussi à la reprise, et on en sort", async ({ page }) => {
  const { sansErreur } = await menuDuTir(page);
  await appuyer(page, "Enter");
  await attendreScene(page, "tir-partie");
  await page.waitForTimeout(300);
  const enPause = () => page.evaluate(() => {
    const jeu = (window as any).jeu;
    return {
      pause: jeu.scene.isActive("socle-pause") as boolean,
      partie: jeu.scene.isPaused("tir-partie") as boolean,
      tableau: jeu.scene.isPaused("tir-tableau") as boolean,
    };
  });

  // On tient ← et on appuie sur Échap : la partie et son tableau de bord s'arrêtent, le vaisseau ne bouge plus
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(100);
  await appuyer(page, "Escape");
  await attendreLaPause(page);
  expect(await enPause()).toEqual({ pause: true, partie: true, tableau: true });
  expect(await page.evaluate(() => (window as any).jeu.canvas.style.cursor)).toBe("default");   // la flèche revient
  const arrete = await partie(page);
  await page.waitForTimeout(300);
  expect((await partie(page)).x).toBe(arrete.x);

  // ← lâchée pendant la pause : la partie ne l'a pas entendu. Échap reprend, et le vaisseau ne file pas
  // tout seul à gauche
  await page.keyboard.up("ArrowLeft");
  await appuyer(page, "Escape");
  await page.waitForFunction(() => (window as any).jeu.scene.isActive("tir-partie"));
  await page.waitForTimeout(300);
  expect(await enPause()).toEqual({ pause: false, partie: false, tableau: false });
  // Au plus une image de mouvement (7 pixels) : à la reprise, la physique fait un pas avec la vitesse d'avant
  // la pause, avant que la partie ne relise les touches. Une ← restée « tenue », elle, l'emmènerait de 120.
  expect(Math.abs((await partie(page)).x - arrete.x)).toBeLessThanOrEqual(8);

  // P, et Start à la manette, l'ouvrent aussi ; B la referme
  await appuyer(page, "p");
  await attendreLaPause(page);
  await appuyer(page, "p");
  await page.waitForFunction(() => (window as any).jeu.scene.isActive("tir-partie"));
  await page.waitForTimeout(300);
  await manette(page, "tir-partie", 9);
  await attendreLaPause(page);
  await manette(page, "socle-pause", 1);
  await page.waitForFunction(() => (window as any).jeu.scene.isActive("tir-partie"));
  await page.waitForTimeout(300);

  // Start valide « Reprendre ». La partie lit la manette avec sa propre copie, restée figée pendant la
  // pause : réveillée, elle prend le Start encore tenu pour un nouvel appui. Elle ne rouvre pas la pause.
  await appuyer(page, "Escape");
  await attendreLaPause(page);
  await manette(page, "socle-pause", 9);
  await page.waitForFunction(() => (window as any).jeu.scene.isActive("tir-partie"));
  await manette(page, "tir-partie", 9);
  await page.waitForTimeout(200);
  expect(await enPause()).toEqual({ pause: false, partie: false, tableau: false });
  await page.waitForTimeout(200);

  // La fenêtre perd la main (un autre onglet, une autre appli) : la pause s'ouvre d'elle-même
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await attendreLaPause(page);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  expect(await enPause()).toEqual({ pause: true, partie: true, tableau: true });

  // « Le menu », en bas de la liste : retour au menu du tir
  await appuyer(page, "ArrowDown");
  await appuyer(page, "Enter");
  await attendreScene(page, "tir-menu");
  expect(await scenesActives(page)).toEqual(["tir-menu"]);
  sansErreur();
});

// La fin et la partie lisent toutes les deux la manette : Start valide « Rejouer » sur la fin, et la partie,
// derrière, ne doit rien en faire (avant, elle quittait en même temps)
test("Start sur l'écran de fin rejoue, sans que la partie derrière s'en aille ni se mette en pause", async ({ page }) => {
  const { sansErreur } = await menuDuTir(page);
  await appuyer(page, "Enter");
  await attendreScene(page, "tir-partie");
  await page.evaluate(() => {
    const p = (window as any).jeu.scene.getScene("tir-partie");
    p.vies = 1;
    p.toucherLeVaisseau();
  });
  await attendreScene(page, "tir-fin");
  await page.waitForTimeout(700);          // la fin n'écoute qu'après un petit moment
  await manetteAToutes(page, ["tir-fin", "tir-partie"], 9);
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("tir-partie").enJeu);
  await page.waitForTimeout(400);          // le temps d'un fondu vers le menu, s'il était parti
  expect(await scenesActives(page)).toEqual(["tir-partie", "tir-tableau"]);
  sansErreur();
});

test("le lourd qui percute le vaisseau perd 4 points de vie et continue sa route ; il ne retouche pas aussitôt", async ({ page }) => {
  const { sansErreur } = await menuDuTir(page);
  await appuyer(page, "Enter");
  await attendreScene(page, "tir-partie");
  await commencerALaVague(page, 4);         // deux lourds, qui plongent après une attente

  // On écoute ce que le lourd encaisse. Les balles du vaisseau, collé à lui, le touchent aussi (d'un point
  // chacune) : on le blinde, pour qu'elles ne l'abattent pas avant la fin du test.
  await page.waitForFunction(() => {
    const p = (window as any).jeu.scene.getScene("tir-partie");
    const lourd = p.ennemis.getChildren().find((e: any) => e.genre === "lourd");
    if (lourd && !lourd.espion) {
      lourd.vie = 100;
      lourd.espion = [];
      const toucher = lourd.toucher.bind(lourd);
      lourd.toucher = (degats?: number) => {
        lourd.espion.push(degats ?? 1);
        return toucher(degats);
      };
      (window as any).__lourd = lourd;
    }
    return !!lourd;
  }, undefined, { timeout: 10_000 });

  // En attendant qu'il plonge, les tirs ennemis ne comptent pas (le vaisseau ne craint rien). Quand il
  // plonge, le vaisseau se jette dessus, sans balle ennemie autour : le vrai choc de la physique.
  await page.waitForFunction(() => {
    const p = (window as any).jeu.scene.getScene("tir-partie");
    const lourd = (window as any).__lourd;
    if (lourd.y <= 230) {
      p.invincibleJusqua = Infinity;
      return false;
    }
    if (p.invincibleJusqua === Infinity) {
      p.invincibleJusqua = 0;
      p.vies = 3;
      p.ballesEnnemies.getMatching("active", true).forEach((b: any) => b.disableBody(true, true));
    }
    if (lourd.active && lourd.y < 500) {
      p.vaisseau.body.reset(lourd.x, lourd.y);
    }
    return p.vies < 3;
  }, undefined, { timeout: 20_000 });
  const lourd = () => page.evaluate(() => {
    const p = (window as any).jeu.scene.getScene("tir-partie");
    const lourd = (window as any).__lourd;
    return { vies: p.vies, chocs: lourd.espion.filter((d: number) => d === 4).length, vie: lourd.vie, active: lourd.active };
  });
  const choc = await lourd();
  expect(choc).toMatchObject({ vies: 2, chocs: 1, active: true });   // toujours là, sa route continue
  expect(choc.vie).toBeGreaterThan(0);

  // Le vaisseau reste collé à lui un moment : il clignote et ne craint rien, le lourd ne le retouche pas
  const fin = Date.now() + 800;
  while (Date.now() < fin) {
    await page.evaluate(() => {
      const p = (window as any).jeu.scene.getScene("tir-partie");
      const lourd = (window as any).__lourd;
      if (lourd.active && lourd.y < 500) {
        p.vaisseau.body.reset(lourd.x, lourd.y);
      }
    });
    await page.waitForTimeout(50);
  }
  expect(await lourd()).toMatchObject({ vies: 2, chocs: 1 });
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

  // Le bouclier colle au vaisseau qui file (il suit son corps, pas son image, en retard d'un pas)
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(150);
  const ecart = await page.evaluate(() => {
    const p = (window as any).jeu.scene.getScene("tir-partie");
    return Math.abs(p.halo.x - p.vaisseau.body.center.x);
  });
  await page.keyboard.up("ArrowLeft");
  expect(ecart).toBeLessThan(0.5);

  await page.evaluate(() => (window as any).jeu.scene.getScene("tir-partie").toucherLeVaisseau());
  expect(await partie(page)).toMatchObject({ vies: 3, bouclier: false, arme: 2 });
  await ramasser("vie");
  await page.waitForFunction(() => (window as any).jeu.scene.getScene("tir-partie").vies === 4);

  // Un bonus manqué, qui sort par le bas, s'en va pour de bon, avec son tween
  await page.evaluate(() => {
    const p = (window as any).jeu.scene.getScene("tir-partie");
    p.vaisseau.body.reset(800, 300);
    p.lacherUnBonus(100, 520, "arme");
  });
  await page.waitForFunction(() => {
    const p = (window as any).jeu.scene.getScene("tir-partie");
    return p.bonus.getLength() === 0;
  });
  expect(await page.evaluate(() => {
    const p = (window as any).jeu.scene.getScene("tir-partie");
    return p.tweens.getTweens().filter((t: any) => t.targets.some((c: any) => c.texture?.key?.startsWith("tir-bonus"))).length;
  })).toBe(0);
  sansErreur();
});

test("le boss arrive à la vague 5 ; battu, la vague 6 commence", async ({ page }) => {
  const { sansErreur } = await menuDuTir(page);
  await appuyer(page, "Enter");
  await attendreScene(page, "tir-partie");
  await commencerALaVague(page, 5);
  const chocs = () => page.evaluate(() => (window as any).jeu.scene.getScene("tir-partie").physics.world.colliders.length as number);
  const avantLeBoss = await chocs();

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
  expect(await chocs()).toBe(avantLeBoss);  // ses chocs sont partis avec lui
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
  await quitterParLaPause(page);
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
