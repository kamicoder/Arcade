// Le monde d'un héros : ce qu'un niveau (une liste d'éléments) devient dans une scène Phaser.
//
// - les plateformes solides sont des TileSprite (l'image du genre, répétée en tuiles) avec un corps
//   STATIQUE, réunis dans un staticGroup : un seul collider pour toutes ;
// - les plateformes mobiles ont un corps qui bouge mais que rien ne pousse (immovable) ;
// - pièces, ennemis, boss et drapeau : des overlap, c'est nous qui décidons de ce qui arrive.
//
// Les genres (glace, ressort, eau...) se regardent à chaque image, en comparant des rectangles :
// ce qu'ils font dépend de « posé dessus » ou « dedans », ce qu'aucun collider ne dit tout seul.
// Le Monde sert à l'Aventure, à l'Infini, au test de l'éditeur, et deux fois au duo.

import Phaser from "phaser";
import { estUnePlateforme, seTouchent, type Element, type Rect } from "./elements";
import type { Genres, Effet } from "./genres";
import { Heros, type Terrain } from "./Heros";
import { Ennemi, Boss } from "./Ennemis";
import { texturePour, ECHELLE_TUILE } from "./textures";
import { GLISSES, REBONDS, TAPIS, ECROULEMENTS, IMAGES, ECRASER, ECRASER_BOSS, SAUT, REBOND_ECRASE } from "./reglages";

type Tuiles = Phaser.GameObjects.TileSprite & { body: Phaser.Physics.Arcade.StaticBody | Phaser.Physics.Arcade.Body };

// Une plateforme d'un genre spécial : ce qu'elle fait au héros qui la touche
interface Zone {
  objet: Tuiles;
  rect: Rect;
  genre: string;
  effet: Effet;
  force: number;
  sens: number;
  solide: boolean;
}

// Ce que le monde dit au jeu, pour qu'il compte les points et les vies (chaque mode a ses règles)
export interface Reactions {
  piece?: () => void;
  ecrase?: (ennemi: Ennemi) => void;
  touche?: () => void;                     // un ennemi, le boss, la lave : aïe
  bossTouche?: (boss: Boss) => void;
  drapeau?: () => void;
  rebond?: () => void;                     // un ressort l'a lancé
}

const CHUTE_QUI_SONNE = 700;               // une arrivée au sol plus rapide que ça (pixels par seconde) s'entend

export class Monde {
  largeur = 0;
  depart = { x: 60, y: 380 };
  readonly solides: Phaser.Physics.Arcade.StaticGroup;
  readonly mobiles: Phaser.GameObjects.Group;
  readonly pieces: Phaser.Physics.Arcade.StaticGroup;
  readonly ennemis: Phaser.GameObjects.Group;
  boss: Boss | null = null;
  drapeau: Phaser.Types.Physics.Arcade.ImageWithStaticBody | null = null;
  drapeauVu: Phaser.GameObjects.Image | null = null;   // l'image du drapeau, qui ondule (voir ajouterUnObjet)
  private zones: Zone[] = [];
  private qui: { heros: Heros; reactions: Reactions } | null = null;
  private dejaTeleporte = false;           // arrivé sur un téléporteur, on attend d'en être sorti pour repartir
  private poussiere: Phaser.GameObjects.Particles.ParticleEmitter;

  // dy : de combien ce monde est décalé vers le bas (le duo en met deux l'un sous l'autre)
  constructor(private scene: Phaser.Scene, private genres: Genres, readonly dy = 0) {
    this.solides = scene.physics.add.staticGroup();
    // Des groupes simples, pas des groupes physiques : un groupe physique remettrait à zéro la vitesse
    // et la gravité de chaque objet qu'on y ajoute
    this.mobiles = scene.add.group();
    this.pieces = scene.physics.add.staticGroup();
    this.ennemis = scene.add.group();
    this.poussiere = scene.add.particles(0, 0, "etincelle", {
      emitting: false,
      lifespan: 400,
      speedX: { min: -60, max: 60 },
      speedY: { min: -40, max: -5 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.7, end: 0 },
      tint: 0xd8d0c0,
    }).setDepth(5);
  }

  ajouter(elements: Element[]) {
    // Les plateformes d'abord : les autres éléments se dessinent par-dessus
    for (const e of elements.filter(estUnePlateforme)) {
      this.ajouterUnePlateforme(e);
    }
    for (const e of elements.filter((e) => !estUnePlateforme(e))) {
      this.ajouterUnObjet(e);
    }
  }

  private ajouterUnePlateforme(e: Element) {
    const y = e.y + this.dy;
    if (e.sorte === "mobile") {
      const objet = this.scene.add.tileSprite(e.x, y, e.w!, e.h!, "platformer-mobile").setOrigin(0) as Tuiles;
      objet.setTileScale(ECHELLE_TUILE);
      this.scene.physics.add.existing(objet);
      this.mobiles.add(objet);
      // Elle fait l'aller-retour entre sa place de départ et « dist » plus loin. Rien ne la pousse
      // (immovable), et elle ne tombe pas.
      const corps = objet.body as Phaser.Physics.Arcade.Body;
      corps.setAllowGravity(false).setImmovable(true);
      const vitesse = e.v! * IMAGES;
      objet.setData({ axe: e.axe, min: e.axe === "x" ? e.x : y, max: (e.axe === "x" ? e.x : y) + e.dist! });
      if (e.axe === "x") {
        corps.setVelocityX(vitesse);
      } else {
        corps.setVelocityY(vitesse);
      }
      return;
    }
    const genre = e.genre! in this.genres.fiches ? e.genre! : "normale";
    const fiche = this.genres.fiche(genre);
    const objet = this.scene.add.tileSprite(e.x, y, e.w!, e.h!, texturePour(this.scene, genre, fiche)).setOrigin(0) as Tuiles;
    objet.setTileScale(e.sens === -1 ? -ECHELLE_TUILE : ECHELLE_TUILE, ECHELLE_TUILE);   // un tapis vers la gauche : retourné
    if (fiche.solide) {
      this.solides.add(objet);             // un staticGroup donne un corps statique à ce qu'on y ajoute
    } else {
      objet.setDepth(4);                   // l'eau et la lave passent devant le héros
      objet.setAlpha(fiche.effet === "eau" ? 0.75 : 1);
    }
    if (genre !== "normale") {
      this.zones.push({
        objet, rect: { x: e.x, y, w: e.w!, h: e.h! }, genre, effet: fiche.effet,
        force: e.force ?? 2, sens: e.sens ?? 1, solide: fiche.solide,
      });
    }
  }

  private ajouterUnObjet(e: Element) {
    const y = e.y + this.dy;
    switch (e.sorte) {
      case "piece": {
        const piece = this.pieces.create(e.x + 8, y + 8, "platformer-piece") as Phaser.Physics.Arcade.Image;
        piece.setDisplaySize(16, 16).refreshBody();
        // Elle flotte : un tween qui la monte et la descend (le corps statique, lui, ne bouge pas : 3 pixels, ça ne se voit pas)
        this.scene.tweens.add({ targets: piece, y: piece.y - 3, duration: 600, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: (e.x * 7) % 600 });
        break;
      }
      case "ennemi":
        this.ennemis.add(new Ennemi(this.scene, e, this.dy));
        break;
      case "boss":
        this.boss = new Boss(this.scene, e, this.dy);
        break;
      case "drapeau": {
        // Le corps et l'image à part : l'image ondule (elle s'étire depuis son mât), le corps ne bouge pas
        this.drapeau = this.scene.physics.add.staticImage(e.x + 8, y + 20, "platformer-drapeau");
        this.drapeau.setDisplaySize(16, 40).refreshBody().setVisible(false);
        const mat = 2.5 / 16;              // le mât, à gauche de l'image
        const vu = this.scene.add.image(e.x + 16 * mat, y + 40, "platformer-drapeau").setOrigin(mat, 1).setDisplaySize(16, 40);
        this.scene.tweens.add({ targets: vu, scaleX: vu.scaleX * 0.8, duration: 550, yoyo: true, repeat: -1, ease: "Sine.InOut" });
        this.drapeauVu = vu;
        break;
      }
      case "depart":
        this.depart = { x: e.x, y: e.y };
        break;
    }
  }

  // Le héros de ce monde : ses collisions, et ce qu'on fait quand il touche quelque chose
  brancher(heros: Heros, reactions: Reactions) {
    this.qui = { heros, reactions };
    const physique = this.scene.physics;
    physique.add.collider(heros, this.solides);
    physique.add.collider(heros, this.mobiles);
    physique.add.overlap(heros, this.pieces, (_h, piece) => this.ramasser(piece as Phaser.Physics.Arcade.Image));
    physique.add.overlap(heros, this.ennemis, (_h, ennemi) => this.toucherUnEnnemi(ennemi as Ennemi));
    if (this.boss) {
      physique.add.overlap(heros, this.boss, () => this.toucherLeBoss());
    }
    if (this.drapeau) {
      physique.add.overlap(heros, this.drapeau, () => reactions.drapeau?.());
    }
  }

  private ramasser(piece: Phaser.Physics.Arcade.Image) {
    if (!piece.body!.enable) {
      return;                              // déjà ramassée, au pas de physique d'avant (deux pas par image)
    }
    piece.disableBody(false, false);       // plus de corps : on ne la ramasse qu'une fois
    this.scene.tweens.killTweensOf(piece);
    // Elle s'envole et s'efface, puis disparaît pour de bon
    this.scene.tweens.add({ targets: piece, y: piece.y - 30, alpha: 0, scale: piece.scale * 1.6, duration: 300, onComplete: () => piece.destroy() });
    this.qui?.reactions.piece?.();
  }

  private toucherUnEnnemi(ennemi: Ennemi) {
    const heros = this.qui!.heros;
    const corps = heros.body;
    if (ennemi.ecrase) {
      return;
    }
    // Il tombe, et ses pieds arrivent par le haut de l'ennemi : écrasé ! Sinon, c'est le héros qui est touché.
    if (corps.velocity.y > 0 && corps.bottom - ennemi.body.top < ECRASER + corps.velocity.y / IMAGES) {
      ennemi.ecraser();
      heros.lance(REBOND_ECRASE);
      this.qui!.reactions.ecrase?.(ennemi);
    } else {
      this.qui!.reactions.touche?.();
    }
  }

  private toucherLeBoss() {
    const boss = this.boss!;
    const corps = this.qui!.heros.body;
    if (boss.invincible) {
      return;                              // juste après un coup, il ne fait rien, et ne craint rien
    }
    if (corps.velocity.y > 0 && corps.bottom - boss.body.top < ECRASER_BOSS + corps.velocity.y / IMAGES) {
      boss.toucher();
      this.qui!.heros.lance(SAUT);         // sur le boss, un vrai saut : on s'en éloigne
      this.qui!.reactions.bossTouche?.(boss);
    } else {
      this.qui!.reactions.touche?.();
    }
  }

  // ===== À chaque image

  avancer(duree: number) {
    for (const zone of this.zones) {
      if (zone.effet === "tapis") {
        // Le tapis roule : ses tuiles défilent à sa vitesse (comptée en pixels de l'image, d'où l'échelle)
        zone.objet.tilePositionX -= TAPIS[zone.force] * zone.sens * duree / ECHELLE_TUILE;
      }
    }
    for (const objet of this.mobiles.getChildren() as Tuiles[]) {
      const corps = objet.body as Phaser.Physics.Arcade.Body;
      const { axe, min, max } = objet.data.values;
      const position = axe === "x" ? corps.x : corps.y;
      const vitesse = axe === "x" ? corps.velocity.x : corps.velocity.y;
      if ((position <= min && vitesse < 0) || (position >= max && vitesse > 0)) {
        if (axe === "x") {
          corps.velocity.x = -vitesse;
        } else {
          corps.velocity.y = -vitesse;
        }
      }
    }
    for (const ennemi of this.ennemis.getChildren() as Ennemi[]) {
      ennemi.avancer();
    }
    this.boss?.avancer();
  }

  // La plateforme sous les pieds du héros, ou null s'il est en l'air. Quand il en touche deux (en
  // retombant vite d'un ressort posé sur le sol), la plus haute : celle qu'il a touchée en premier.
  solSous(heros: Heros): Tuiles | null {
    const c = heros.body;
    if (!c.blocked.down && !c.touching.down) {
      return null;
    }
    let sol: Tuiles | null = null;
    for (const objet of [...this.solides.getChildren(), ...this.mobiles.getChildren()] as Tuiles[]) {
      const p = objet.body;
      if (p.enable && Math.abs(p.top - c.bottom) < 4 && p.left < c.right && c.left < p.right) {
        if (!sol || p.top < sol.body.top) {
          sol = objet;
        }
      }
    }
    return sol;
  }

  // Ce que les plateformes font au héros pendant cette image. Renvoie aussi s'il vient de mourir (la lave).
  terrain(heros: Heros): Terrain & { mortel: boolean; atterrit: boolean } {
    const sol = this.solSous(heros);
    const c = heros.body;
    const lui: Rect = { x: c.x, y: c.y, w: c.width, h: c.height };
    const terrain = { auSol: sol !== null, glisse: 0, eau: null as Rect | null, poussee: 0, rebond: false, mortel: false, atterrit: false };
    const etaitEnLAir = !heros.getData("auSol");
    terrain.atterrit = etaitEnLAir && sol !== null;
    heros.setData("auSol", sol !== null);
    // Sa vitesse à l'image d'avant : posé, il ne tombe plus, c'est avant qu'il tombait vite
    const chute = heros.getData("chute") ?? 0;
    heros.setData("chute", c.velocity.y);

    if (sol && this.mobiles.contains(sol)) {
      terrain.poussee = (sol.body as Phaser.Physics.Arcade.Body).velocity.x;   // une plateforme mobile le porte
    }
    let surUnTeleporteur = false;
    for (const zone of this.zones) {
      const dessus = zone.objet === sol;
      // Le téléporteur compte aussi pour les pieds posés pile sur lui : à l'arrivée, le héros remis en
      // place (body.reset) n'est ni « posé » ni dedans. Il se croyait sorti, et repartait d'où il venait.
      const r = zone.effet === "teleporte" ? { ...zone.rect, y: zone.rect.y - 2, h: zone.rect.h + 2 } : zone.rect;
      const touche = dessus || seTouchent(lui, r);
      if (!touche) {
        continue;
      }
      if (zone.effet === "eau") {
        terrain.eau = zone.rect;
      } else if (dessus && zone.effet === "glisse") {
        terrain.glisse = GLISSES[zone.force];
      } else if (dessus && zone.effet === "rebond") {
        c.setVelocityY(REBONDS[zone.force]);   // boing !
        terrain.rebond = true;
        this.scene.sound.play("platformer-saut", { rate: 0.8 });
        this.qui?.reactions.rebond?.();
        this.scene.tweens.add({ targets: zone.objet, scaleY: 0.7, duration: 70, yoyo: true });
      } else if (dessus && zone.effet === "tapis") {
        terrain.poussee += TAPIS[zone.force] * zone.sens;
      } else if (dessus && zone.effet === "ecroule") {
        this.faireEcrouler(zone);
      } else if (zone.effet === "teleporte") {
        surUnTeleporteur = true;
        if (!this.dejaTeleporte && this.teleporter(heros, zone)) {
          this.dejaTeleporte = true;
          break;                           // il a changé de place : les autres zones attendront l'image suivante
        }
      } else if (zone.effet === "mortel") {
        terrain.mortel = true;
      }
    }
    if (!surUnTeleporteur) {
      this.dejaTeleporte = false;
    }
    if (terrain.atterrit && c.velocity.y >= 0) {
      this.poussiere.explode(8, c.center.x, c.bottom);   // un nuage de poussière sous ses pieds
      if (chute > CHUTE_QUI_SONNE && !terrain.rebond) {
        // Un « poc » sourd : le son du boss, plus aigu et tout bas (on n'entend pas chaque petit pas)
        this.scene.sound.play("platformer-boss", { rate: 1.5, volume: 0.25 });
      }
    }
    return terrain;
  }

  // Posé sur une plateforme fragile : elle tremble, puis s'écroule (elle revient au prochain essai)
  private faireEcrouler(zone: Zone) {
    if (zone.objet.getData("ecroule")) {
      return;
    }
    zone.objet.setData("ecroule", true);
    const x = zone.objet.x;
    this.scene.tweens.add({ targets: zone.objet, x: x + 2, duration: 40, yoyo: true, repeat: -1 });
    // Elle craque (le « aïe », bien plus aigu et bref), puis tombe dans un bruit sourd
    this.scene.sound.play("platformer-aie", { rate: 2.6, volume: 0.35 });
    this.scene.time.delayedCall(ECROULEMENTS[zone.force], () => {
      this.scene.sound.play("platformer-boss", { rate: 0.8, volume: 0.3 });
      this.scene.tweens.killTweensOf(zone.objet);
      zone.objet.x = x;
      zone.objet.body.enable = false;
      this.zones = this.zones.filter((autre) => autre !== zone);
      this.scene.tweens.add({ targets: zone.objet, y: zone.objet.y + 40, alpha: 0, duration: 300, onComplete: () => zone.objet.destroy() });
    });
  }

  // Le téléporteur suivant du même genre (après le dernier : le premier)
  private teleporter(heros: Heros, depart: Zone): boolean {
    const memes = this.zones.filter((zone) => zone.genre === depart.genre);
    const arrivee = memes[(memes.indexOf(depart) + 1) % memes.length];
    if (arrivee === depart) {
      return false;                        // un seul téléporteur de ce genre : il ne fait rien
    }
    const r = arrivee.rect;
    heros.poserA(r.x + r.w / 2, depart.solide ? r.y : r.y + r.h);   // posé dessus, ou dedans
    this.poussiere.explode(16, r.x + r.w / 2, r.y);
    this.scene.sound.play("platformer-vie");
    return true;
  }

  // Une deuxième chance (Infini) : le héros revient sur la plateforme la plus proche
  plusProcheDe(x: number): Rect | null {
    let proche: Rect | null = null;
    for (const objet of [...this.solides.getChildren(), ...this.mobiles.getChildren()] as Tuiles[]) {
      const p = objet.body;
      if (p.enable && (!proche || Math.abs(p.center.x - x) < Math.abs(proche.x + proche.w / 2 - x))) {
        proche = { x: p.x, y: p.y, w: p.width, h: p.height };
      }
    }
    return proche;
  }

  // Infini et duo : on efface ce qui est loin derrière (pour ne pas garder des milliers d'objets)
  oublierAvant(limite: number) {
    for (const groupe of [this.solides, this.mobiles, this.pieces, this.ennemis]) {
      for (const objet of groupe.getChildren().slice() as Phaser.GameObjects.Image[]) {
        if (objet.getBounds().right < limite) {
          objet.destroy();
        }
      }
    }
    this.zones = this.zones.filter((zone) => {
      if (zone.rect.x + zone.rect.w >= limite) {
        return true;
      }
      zone.objet.destroy();
      return false;
    });
  }

  // Tout le monde disparaît (le duo repart de zéro)
  detruire() {
    this.solides.clear(true, true);
    this.mobiles.clear(true, true);
    this.pieces.clear(true, true);
    this.ennemis.clear(true, true);
    for (const zone of this.zones) {
      zone.objet.destroy();
    }
    this.zones = [];
    this.boss?.destroy();
    this.boss = null;
    this.drapeau?.destroy();
    this.drapeau = null;
    this.drapeauVu?.destroy();
    this.drapeauVu = null;
  }
}
