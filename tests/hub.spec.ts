import { test, expect } from "@playwright/test";
import { ouvrir, brancherUneManette, pousserLeStick, ouvrirLaCarte, attendreScene, appuyer } from "./outils";

// Phaser 4.2.1 : un segment de longueur nulle dans un contour donnait des sommets NaN, que certains
// téléphones dessinent comme des traits partis du coin haut gauche (voir socle/correctifs.ts)
test("les contours ne donnent jamais de sommets NaN (traits fantômes sur téléphone)", async ({ page }) => {
  const { sansErreur } = await ouvrir(page);
  const nan = await page.evaluate(async () => {
    const jeu = (window as any).jeu;
    const noeud = jeu.renderer.renderNodes.getNode("DrawLine");
    let sommetsNaN = 0;
    const tracer = noeud.run.bind(noeud);
    noeud.run = (...args: any[]) => {
      const sommets = args[8] as number[];
      const avant = sommets.length;
      tracer(...args);
      for (let i = avant; i < sommets.length; i++) {
        if (Number.isNaN(sommets[i])) sommetsNaN++;
      }
    };
    // Un segment de longueur nulle, tracé directement
    const sommets: number[] = [];
    noeud.run({}, null, 10, 10, 10, 10, 2, 2, sommets);
    // Puis quelques images du Hub, plein de rectangles arrondis à contour
    await new Promise((fini) => setTimeout(fini, 500));
    return sommetsNaN;
  });
  expect(nan).toBe(0);
  sansErreur();
});

// Phaser 4.2.1 rognait le haut des emojis sur Android (le 🍄 du Platformer) : un texte avec des emojis
// mesure maintenant sa hauteur avec eux (voir socle/correctifs.ts)
test("les emojis des cartes sont mesurés avec leur texte, pour ne pas être coupés", async ({ page }) => {
  const { sansErreur } = await ouvrir(page);
  const mesures = await page.evaluate(() => {
    const hub = (window as any).jeu.scene.getScene("Hub");
    return hub.cartes.map((carte: any) => {
      const emoji = carte.boite.list.find((objet: any) => objet.text === carte.fiche.emoji);
      return { emoji: carte.fiche.emoji, reference: emoji.style.testString, hauteur: emoji.height };
    });
  });
  for (const { emoji, reference, hauteur } of mesures) {
    expect(reference).toContain([...emoji][0]);
    expect(hauteur).toBeGreaterThan(0);
  }
  // Un texte sans emoji garde la référence de Phaser, sans rien de plus
  const references = await page.evaluate(() => {
    const carte = (window as any).jeu.scene.getScene("Hub").cartes[0];
    const titre = carte.boite.list.find((objet: any) => objet.text === "Course de voitures");
    const emoji = carte.boite.list.find((objet: any) => objet.text === carte.fiche.emoji);
    return { titre: titre.style.testString as string, emoji: emoji.style.testString as string };
  });
  expect(references.emoji.startsWith(references.titre)).toBe(true);
  expect(references.emoji.length).toBeGreaterThan(references.titre.length);
  sansErreur();
});

// Le stick gauche fait comme la croix dans les menus (socle/manette.ts) : un coup, un pas
test("le stick de la manette choisit un jeu : un coup de stick, une carte", async ({ page }) => {
  await brancherUneManette(page);
  const { sansErreur } = await ouvrir(page);
  const choisie = () => page.evaluate(() => (window as any).jeu.scene.getScene("Hub").choisie as number);
  const depart = await choisie();
  await pousserLeStick(page, 1, 0.1);
  const apres = await choisie();
  expect(apres).not.toBe(depart);
  // Tenu, ou à moitié relâché : il ne repart pas
  await pousserLeStick(page, 1, 0);
  await pousserLeStick(page, 0.45, 0);
  expect(await choisie()).toBe(apres);
  // Lâché, puis à gauche : retour à la carte du départ
  await pousserLeStick(page, 0, 0);
  await pousserLeStick(page, -1, 0);
  expect(await choisie()).toBe(depart);
  sansErreur();
});

// Sur un vieil ordinateur, l'Arcade dessine en canvas 2D (socle/rendu.ts), où Phaser ignore les teintes :
// elle les refait avec des copies colorées des images
test("en canvas 2D, les images et les particules gardent leurs teintes", async ({ page }) => {
  const { sansErreur } = await ouvrir(page, "canvas");
  expect(await page.evaluate(() => (window as any).jeu.renderer.type)).toBe(1);   // Phaser.CANVAS
  await page.evaluate(() => {
    const hub = (window as any).jeu.scene.getScene("Hub");
    const blanc = hub.textures.createCanvas("essai-blanc", 20, 20);
    blanc.context.fillStyle = "#ffffff";
    blanc.context.fillRect(0, 0, 20, 20);
    blanc.refresh();
    hub.add.image(100, 100, "essai-blanc").setDepth(1000).setTint(0xff0000);                  // multipliée
    hub.add.image(200, 100, "essai-blanc").setDepth(1000).setTint(0x0000ff).setTintMode(1);   // FILL
    hub.add.particles(300, 100, "essai-blanc", { speed: 0, lifespan: 60_000, tint: 0x00ff00, emitting: false })
      .setDepth(1000).explode(1);
  });
  const couleur = (x: number, y: number) => page.evaluate(([x, y]) => {
    const [r, g, b] = (window as any).jeu.canvas.getContext("2d").getImageData(x, y, 1, 1).data;
    return [r, g, b];
  }, [x, y]);
  // Le Hub pose un léger voile sur tout : on regarde la couleur qui domine
  const dominante = async (x: number, y: number) => {
    const [r, g, b] = await couleur(x, y);
    return r > 150 && g < 60 && b < 60 ? "rouge" : g > 150 && r < 60 && b < 60 ? "vert" : b > 150 && r < 60 && g < 60 ? "bleu" : [r, g, b];
  };
  await page.waitForFunction(() => {
    const [r] = (window as any).jeu.canvas.getContext("2d").getImageData(100, 100, 1, 1).data;
    return r > 150;
  });
  expect(await dominante(100, 100)).toBe("rouge");
  expect(await dominante(200, 100)).toBe("bleu");
  expect(await dominante(300, 100)).toBe("vert");
  sansErreur();
});

test("en canvas 2D, un jeu se lance", async ({ page }) => {
  const { sansErreur } = await ouvrir(page, "canvas");
  await ouvrirLaCarte(page, "briques");
  await attendreScene(page, "briques-menu");
  await appuyer(page, "Enter");
  await attendreScene(page, "briques-partie");
  sansErreur();
});
