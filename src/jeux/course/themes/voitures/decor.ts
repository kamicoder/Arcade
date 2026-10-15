// Une course de voitures, telle qu'on la voit : les bidons, les flèches et les flaques d'huile sur la route,
// les marques de pneus et la fumée des dérapages, les flammes de la nitro, les étincelles des chocs,
// et le moteur qui monte dans les aigus. Les voitures (où elles vont, à quelle vitesse) sont des
// Coureurs : du calcul pur, dans le jeu.

import Phaser from "phaser";
import type { Coureur, Instant } from "../../Coureur";
import type { CourseVue, DecorDeCourse, Evenement, Moteur, VueDuCoureur } from "../../theme";
import { textureDeVoiture, type LookDeVoiture } from "./dessins";
import { ecrire } from "../../interface";
import { jouerFichier, sonCoupe } from "../../son";
import { sons } from "./sons";

const RESOLUTION = 2;                      // la voiture est dessinée en double : nette dans les menus aussi

// L'ordre d'affichage dans la course : plus le nombre est grand, plus c'est dessus
const PROFONDEUR = { traces: 1, objets: 2, fumee: 3, fantome: 4, flammes: 5, voitures: 6, gerbes: 7 };

const look = (c: Coureur) => c.apparence as unknown as LookDeVoiture;

// Ce qu'on voit d'une voiture : son image, et les flammes de la nitro qui sortent par l'arrière
class VoitureVue implements VueDuCoureur {
  readonly objet: Phaser.GameObjects.Image;
  private readonly flammes: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly etiquette?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, private readonly coureur: Coureur, avecEtiquette: boolean,
    private readonly deraper: (x: number, y: number) => void) {
    this.objet = scene.add.image(coureur.x, coureur.y, textureDeVoiture(scene, look(coureur), RESOLUTION))
      .setScale(1 / RESOLUTION).setDepth(PROFONDEUR.voitures);
    // Les flammes : un émetteur à elle, qu'on allume et qu'on éteint.
    // L'angle de chaque flamme est calculé à sa naissance : vers l'arrière de la voiture.
    this.flammes = scene.add.particles(0, 0, "etincelle", {
      emitting: false,
      frequency: 15,
      lifespan: 250,
      speed: { min: 150, max: 260 },
      angle: { onEmit: () => Phaser.Math.RadToDeg(this.coureur.angle) + 180 + Phaser.Math.Between(-14, 14) },
      scale: { start: 1.4, end: 0 },
      tint: [0xffb02e, 0xff5a1a, 0xffe08a],
      blendMode: "ADD",
    }).setDepth(PROFONDEUR.flammes);
    if (avecEtiquette) {
      const couleur = look(coureur).carrosserie;
      this.etiquette = ecrire(scene, 0, 0, "J" + coureur.joueur, 16, couleur, { contour: "#1c1a25" }).setDepth(PROFONDEUR.gerbes);
    }
  }

  actualiser(_horloge: number, duree: number) {
    const c = this.coureur;
    this.objet.setPosition(c.x, c.y).setRotation(c.angle + c.tourbillon);
    this.etiquette?.setPosition(c.x, c.y - 32);
    const devantX = Math.cos(c.angle);
    const devantY = Math.sin(c.angle);
    this.flammes.setPosition(c.x - devantX * 22, c.y - devantY * 22);
    if (c.turbo > 0 && !this.flammes.emitting) {
      this.flammes.start();
    } else if (c.turbo <= 0 && this.flammes.emitting) {
      this.flammes.stop();
    }
    // Une glissade laisse des marques de pneus, et un peu de fumée
    if (duree > 0 && Math.abs(c.glissade) > 90) {
      this.deraper(c.x, c.y);
    }
  }
}

export function decorDesVoitures(course: CourseVue): DecorDeCourse {
  const scene = course.scene;
  const { largeur, hauteur } = course.circuit.modele;

  // Les marques de pneus : une RenderTexture, une image sur laquelle on peut dessiner pendant le jeu
  const sol = scene.add.renderTexture(0, 0, largeur, hauteur).setOrigin(0).setDepth(PROFONDEUR.traces);
  let solAMettreAJour = false;
  const fumee = scene.add.particles(0, 0, "etincelle", {
    emitting: false,
    lifespan: 600,
    speed: { min: 5, max: 30 },
    scale: { start: 1.2, end: 2.5 },
    alpha: { start: 0.35, end: 0 },
    tint: 0xdddddd,
  }).setDepth(PROFONDEUR.fumee);
  const etincelles = scene.add.particles(0, 0, "etincelle", {
    emitting: false,
    lifespan: 500,
    speed: { min: 80, max: 200 },
    scale: { start: 1, end: 0 },
  }).setDepth(PROFONDEUR.gerbes);

  const deraper = (x: number, y: number) => {
    sol.stamp("voiture-pneu", undefined, x, y, { alpha: 0.35 });
    solAMettreAJour = true;
    fumee.emitParticleAt(x, y);
  };
  const gerbe = (x: number, y: number, couleur: number) => {
    etincelles.particleTint = couleur;
    etincelles.explode(12, x, y);
  };

  // Les bruitages ne sont que pour les joueurs : on n'entend pas les rivaux se cogner à l'autre bout
  const joue = (c: Coureur, son: () => void) => {
    if (c.humain && !sonCoupe()) {
      son();
    }
  };

  const reagir = (c: Coureur, evenement: Evenement) => {
    switch (evenement.genre) {
      case "barriere":
        gerbe(evenement.x, evenement.y, 0x222222);
        joue(c, () => sons.choc(evenement.fort));
        break;
      case "choc":
        if (evenement.gerbe) {
          gerbe(evenement.x, evenement.y, 0xffe08a);
        }
        joue(c, () => sons.choc(evenement.fort));
        break;
      case "turbo":
        joue(c, sons.nitro);
        break;
      case "repeche":
        gerbe(c.x, c.y, 0xffffff);
        break;
      case "objet":
        if (evenement.type.id === "bidons") {
          gerbe(evenement.x, evenement.y, 0xffd23f);
          if (c.humain) {
            jouerFichier(scene, "voiture-bip", { rate: 2.5 });
          }
        } else if (evenement.type.id === "huiles") {
          gerbe(c.x, c.y, 0x16141a);
        }
        break;
    }
  };

  return {
    vue: (c, etiquette) => new VoitureVue(scene, c, etiquette, deraper),
    // Les objets de la route, tournés dans le sens de la course
    objet: (type, place) => scene.add.image(place.x, place.y, "voiture-" + type.id.replace(/s$/, ""))
      .setRotation(place.angle).setDepth(PROFONDEUR.objets),
    // Le fantôme : la voiture du joueur, toute blanche et transparente
    fantome: () => {
      const image = scene.add.image(0, 0, textureDeVoiture(scene, look(course.joueurs[0]), RESOLUTION))
        .setScale(1 / RESOLUTION).setTint(0xffffff).setTintMode(Phaser.TintModes.FILL).setAlpha(0.4).setDepth(PROFONDEUR.fantome);
      return { objet: image, placer: (i: Instant) => image.setPosition(i.x, i.y).setRotation(i.angle) };
    },
    reagir,
    apresImage: () => {
      if (solAMettreAJour) {
        sol.render();                      // dessine d'un coup toutes les marques de cette image
        solAMettreAJour = false;
      }
    },
  };
}

type Son = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

// Le moteur d'un joueur : un son en boucle qui monte dans les aigus avec la vitesse
export function moteurDeVoiture(scene: Phaser.Scene, auDoigt: boolean, joueurs: number): Moteur {
  const volume = auDoigt ? 0.6 : 0.25 / joueurs;
  const son = scene.sound.add(auDoigt ? "voiture-moteur-mobile" : "voiture-moteur", { loop: true, volume }) as Son;
  return {
    demarrer: () => {
      if (!son.isPlaying) {
        son.play();
      }
    },
    // vitesse : de 0 (arrêtée) à 1 (la nitro)
    regler: (vitesse) => {
      son.setRate(0.6 + vitesse * 1.6);
      son.setVolume(sonCoupe() ? 0 : volume);
    },
    arreter: () => son.stop(),
    detruire: () => son.destroy(),
  };
}
