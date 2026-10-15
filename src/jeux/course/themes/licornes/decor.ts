// Une course de licornes, telle qu'on la voit : les flèches arc-en-ciel, les bonbons qui se dandinent, les
// nuages d'orage qui clignotent et se balancent, les étoiles, la traînée arc-en-ciel derrière chaque
// licorne, les gerbes d'étoiles, et les licornes elles-mêmes (halo de turbo, galop, tête qui tourne).
// Les licornes (où elles vont, à quelle vitesse) sont des Coureurs : du calcul pur, dans le jeu.

import Phaser from "phaser";
import type { Coureur, Instant } from "../../Coureur";
import type { CourseVue, DecorDeCourse, Evenement, VueDuCoureur, TypeDObjet } from "../../theme";
import type { Emplacement } from "../../circuits";
import { textureDeLicorne, imageDuGalop } from "./textures";
import { PROFONDEUR, type Look } from "./reglages";
import { sons } from "./sons";
import { ecrire, enNombre } from "../../interface";
import { sonCoupe } from "../../son";

const RESOLUTION = 2;                      // la feuille de galop est dessinée en double : nette même géante

export const LOOK_FANTOME: Look = {
  nom: "Fantôme", corps: "#ffffff", ombre: "#ddd6ff", criniere: ["#ffffff", "#e9e1ff"], corne: "#ffffff", accessoire: "aucun",
};

const look = (c: Coureur) => c.apparence as unknown as Look;

// Ce qu'on voit d'une licorne : un Container qui la suit, avec son halo de turbo, son sprite (tourné et
// animé selon son galop), les étoiles d'étourdissement et, à deux, son étiquette J1 / J2
class LicorneVue extends Phaser.GameObjects.Container implements VueDuCoureur {
  readonly objet = this;
  private readonly halo: Phaser.GameObjects.Image;
  private readonly corps: Phaser.GameObjects.Sprite;
  private readonly tete: Phaser.GameObjects.Image[] = [];   // les étoiles qui tournent autour de sa tête
  private readonly etiquette?: Phaser.GameObjects.Container;
  private reserveDeGrains = 0;

  constructor(scene: Phaser.Scene, private readonly coureur: Coureur, avecEtiquette: boolean,
    private readonly traine: (c: Coureur, grand: boolean) => void) {
    super(scene, coureur.x, coureur.y);
    this.halo = scene.add.image(0, 0, "licorne-halo").setVisible(false);
    this.corps = scene.add.sprite(0, 0, textureDeLicorne(scene, look(coureur), RESOLUTION), 0);
    this.add([this.halo, this.corps]);
    for (let k = 0; k < 3; k++) {
      const etoile = scene.add.image(0, 0, "licorne-petite-etoile").setVisible(false);
      this.tete.push(etoile);
      this.add(etoile);
    }
    if (avecEtiquette) {
      const couleur = look(coureur).criniere[0];
      const pointe = scene.add.triangle(0, 0, -7, 0, 7, 0, 0, 9, enNombre(couleur)).setOrigin(0.5, 0);
      const texte = ecrire(scene, 0, -12, "J" + coureur.joueur, 16, couleur, { contour: true });
      this.etiquette = scene.add.container(0, 0, [pointe, texte]);
      this.add(this.etiquette);
    }
    scene.add.existing(this);
    this.actualiser(0, 0);
  }

  // À chaque image : la vue rattrape la licorne, et sème sa traînée
  actualiser(horloge: number, duree: number) {
    const c = this.coureur;
    const e = c.echelle();
    this.setPosition(c.x, c.y).setDepth(PROFONDEUR.licornes + e);   // les géantes passent par-dessus
    this.corps.setRotation(c.angle + c.tourbillon).setScale(e / RESOLUTION).setFrame(imageDuGalop(c.phase));
    this.halo.setVisible(c.turbo > 0).setScale(e);
    this.tete.forEach((etoile, k) => {
      const a = horloge * 6 + k * Math.PI * 2 / 3;
      etoile.setVisible(c.etourdie > 0).setPosition(Math.cos(a) * 22 * e, -8 + Math.sin(a) * 10 * e).setRotation(a);
    });
    this.etiquette?.setY(-42 * e);
    this.semer(duree);
  }

  // La traînée arc-en-ciel derrière elle : plus elle va vite, plus elle sème
  private semer(duree: number) {
    const c = this.coureur;
    const vite = Math.abs(c.vitesse);
    let debit = 0;
    if (c.turbo > 0) {
      debit = 110;
    } else if (vite > 150) {
      debit = vite / (c.humain ? 10 : 20);
    }
    if (c.geante > 0) {
      debit += 20;
    }
    this.reserveDeGrains += debit * duree;
    while (this.reserveDeGrains >= 1) {
      this.reserveDeGrains--;
      this.traine(c, c.turbo > 0);
    }
  }
}

export function decorDesLicornes(course: CourseVue): DecorDeCourse {
  const scene = course.scene;

  // La traînée arc-en-ciel : sa couleur tourne avec le temps. On sème les grains nous-mêmes
  // (emitParticleAt), au rythme de la vitesse de chaque licorne.
  const teinte = () => {
    const t = (scene.time.now / 1000 * 220 + Math.random() * 40) % 360;
    return Phaser.Display.Color.HSLToColor(t / 360, 0.95, 0.72).color;
  };
  const emetteur = (grand: boolean) => scene.add.particles(0, 0, "licorne-particules", {
    emitting: false,
    frame: ["rond", "rond", "etoile"],
    lifespan: grand ? 1000 : 600,
    speed: { min: 0, max: 21 },
    scale: grand ? { min: 0.67, max: 1.33 } : { min: 0.4, max: 0.8 },
    alpha: { start: 1, end: 0 },
    rotate: { min: 0, max: 360 },
    tint: { onEmit: teinte },
  }).setDepth(PROFONDEUR.traine);
  const traine = emetteur(false);
  const traineTurbo = emetteur(true);
  const semer = (c: Coureur, grand: boolean) => {
    const e = c.echelle();
    (grand ? traineTurbo : traine).emitParticleAt(
      c.x - Math.cos(c.angle) * 34 * e + (Math.random() - 0.5) * 14 * e,
      c.y - Math.sin(c.angle) * 34 * e + (Math.random() - 0.5) * 14 * e,
    );
  };

  // Les gerbes : des étoiles qui jaillissent d'un coup (explode), aux couleurs de l'événement
  let couleursGerbe = ["#ffffff"];
  let n = 0;
  const gerbes = scene.add.particles(0, 0, "licorne-particules", {
    emitting: false,
    frame: "etoile",
    lifespan: 700,
    speed: { min: 60, max: 200 },
    scale: { min: 0.53, max: 0.93 },
    alpha: { start: 1, end: 0 },
    rotate: { min: 0, max: 360 },
    tint: { onEmit: () => Phaser.Display.Color.HexStringToColor(couleursGerbe[n++ % couleursGerbe.length]).color },
  }).setDepth(PROFONDEUR.traine);
  const gerbe = (x: number, y: number, nombre: number, couleurs: string[]) => {
    couleursGerbe = couleurs;
    gerbes.explode(nombre, x, y);
  };

  const objets: Record<string, (e: Emplacement) => Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | Phaser.GameObjects.Container> = {
    // Les flèches arc-en-ciel : une animation dont les couleurs défilent
    fleches: (f) => scene.add.sprite(f.x, f.y, "licorne-fleche").setRotation(f.angle).setDepth(PROFONDEUR.fleches)
      .play("licorne-fleche"),
    // Les bonbons flottent et se dandinent ; leur spirale tourne
    bonbons: (b) => {
      const spirale = scene.add.image(0, 0, "licorne-spirale");
      const bonbon = scene.add.container(b.x, b.y, [scene.add.image(0, 0, "licorne-bonbon"), spirale]).setDepth(PROFONDEUR.bonbons);
      scene.tweens.add({ targets: spirale, angle: 360, duration: 2100, repeat: -1 });
      scene.tweens.add({ targets: bonbon, y: b.y - 4, duration: 1050, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      scene.tweens.add({
        targets: bonbon, rotation: { from: -0.5, to: 0.5 }, duration: 1570, yoyo: true, repeat: -1, ease: "Sine.InOut",
      });
      return bonbon;
    },
    // Les nuages d'orage : leur éclair clignote, et certains se balancent en travers de la route
    orages: (o) => {
      const eclair = scene.add.image(0, 0, "licorne-eclair").setOrigin(12 / 26, 17 / 40).setVisible(false);
      const orage = scene.add.container(o.x, o.y, [scene.add.image(0, 0, "licorne-orage").setOrigin(0.5, 40 / 84), eclair])
        .setDepth(PROFONDEUR.orages);
      scene.time.addEvent({
        delay: 900,
        loop: true,
        startAt: (o.phase * 137) % 900,
        callback: () => {
          eclair.setVisible(true);
          scene.time.delayedCall(280, () => eclair.setVisible(false));
        },
      });
      if (o.balancement > 0) {
        // Un aller-retour d'un bord à l'autre, en douceur (Sine) : le même balancement que sin(1,6 t)
        orage.setPosition(o.x - o.nx * o.balancement, o.y - o.ny * o.balancement);
        const balancement = scene.tweens.add({
          targets: orage,
          x: o.x + o.nx * o.balancement,
          y: o.y + o.ny * o.balancement,
          duration: Math.PI / 1.6 * 1000,
          yoyo: true,
          repeat: -1,
          ease: "Sine.InOut",
        });
        balancement.seek((o.phase * 1000) % 3900);
      }
      return orage;
    },
    // Les étoiles tournent sur elles-mêmes et flottent
    etoiles: (e) => {
      const etoile = scene.add.image(e.x, e.y, "licorne-etoile").setDepth(PROFONDEUR.etoiles);
      scene.tweens.add({ targets: etoile, angle: 360, duration: 4200, repeat: -1 });
      scene.tweens.add({
        targets: etoile, y: e.y + 4, duration: 785, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: (e.x * 7) % 785,
      });
      return etoile;
    },
  };

  // Ce qui arrive en course : des sons (pour les joueuses), des gerbes, des messages
  const reagir = (c: Coureur, evenement: Evenement) => {
    const joue = (son: () => void) => {
      if (c.humain && !sonCoupe()) {
        son();
      }
    };
    switch (evenement.genre) {
      case "pas":
        joue(() => sons.sabot(evenement.aigu));
        break;
      case "barriere":
        joue(sons.pouf);
        gerbe(evenement.x, evenement.y, 8, ["#ffffff", "#ffd3ec"]);
        break;
      case "choc":
        if (evenement.gerbe) {             // un « pouf » et une gerbe par contact, pas un par licorne
          joue(sons.pouf);
          gerbe(evenement.x, evenement.y, evenement.fort ? 10 : 5, ["#ffffff", "#ffe066"]);
        }
        break;
      case "repeche":
        gerbe(evenement.avantX, evenement.avantY, 12, ["#ffffff", "#ffd3ec"]);
        gerbe(c.x, c.y, 18, ["#ffe066", "#ffffff", "#c47dff"]);
        if (c.humain) {
          joue(sons.etoile);
          course.annoncer("Hop ! Un petit coup de magie", look(c).criniere[0], c);
        }
        break;
      case "etourdi":
        gerbe(c.x, c.y, 10, ["#fff176", "#b39ddb"]);
        break;
      case "turbo":
        joue(sons.turbo);
        break;
      case "objet":
        reagirAUnObjet(c, evenement.type, evenement.x, evenement.y, joue);
        break;
    }
  };
  const reagirAUnObjet = (_c: Coureur, type: TypeDObjet, x: number, y: number, joue: (son: () => void) => void) => {
    if (type.id === "etoiles") {
      gerbe(x, y, 14, ["#ffe066", "#ffffff"]);
      joue(sons.etoile);
    } else if (type.id === "bonbons") {
      gerbe(x, y, 18, ["#ff4fa8", "#ffffff", "#ff9fd4"]);
      joue(sons.bonbon);
    } else if (type.id === "fleches") {
      joue(sons.fleche);
    } else if (type.id === "orages") {
      joue(sons.orage);
    }
  };

  return {
    vue: (c, etiquette) => new LicorneVue(scene, c, etiquette, semer),
    objet: (type, place) => objets[type.id](place),
    fantome: () => {
      const ombre = scene.add.sprite(0, 0, textureDeLicorne(scene, LOOK_FANTOME), 0)
        .setAlpha(0.4).setScale(1.1 / RESOLUTION).setDepth(PROFONDEUR.fantome);
      return {
        objet: ombre,
        placer: (i: Instant) => ombre.setPosition(i.x, i.y).setRotation(i.angle).setFrame(imageDuGalop(i.t * 20)),
      };
    },
    reagir,
  };
}
