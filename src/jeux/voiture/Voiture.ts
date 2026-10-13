// Une voiture : conduite par un joueur, ou par l'ordinateur.
//
// C'est un Sprite de la physique Arcade : une image qui a un corps (body). Le corps garde la vitesse,
// déplace l'image à chaque pas de la physique et gère les chocs (entre voitures, contre le bord du monde).
// Nous, on décide seulement de la vitesse voulue : accélérer, freiner, tourner, déraper.

import Phaser from "phaser";
import {
  ACCELERATION, FREIN, VITESSE_MAX, MARCHE_ARRIERE, VIRAGE, FROTTEMENT, FROTTEMENT_HERBE,
  ADHERENCE, ADHERENCE_HERBE, VITESSE_NITRO, DUREE_NITRO, NITRO_MAX, DUREE_FLECHE, DUREE_HUILE,
  ADHERENCE_HUILE, REMISE_SUR_LA_ROUTE, AIDE_MOBILE, PROFONDEUR,
} from "./reglages";
import { angleEntre, plusProche, surLaRoute, LIMITE, type Circuit } from "./circuits";
import { textureDeVoiture } from "./textures";

export const RAYON = 17;                  // deux voitures plus près que deux rayons se touchent

export interface Entrees {
  avancer: boolean;
  reculer: boolean;
  gauche: boolean;
  droite: boolean;
  nitro: boolean;
}

export interface Pilote {
  nom: string;
  couleur: number;
  niveau: number;                          // 1 : aussi vite que possible ; moins, il lève le pied
  joueur: boolean;                         // faux : c'est l'ordinateur qui conduit
}

// Un instant d'un tour, pour le fantôme
export interface Instant {
  t: number;
  x: number;
  y: number;
  angle: number;
}

// Ce que la voiture demande à la course autour d'elle
export interface Piste {
  circuit: Circuit;
  marquerLeSol(x: number, y: number): void;
  fumer(x: number, y: number): void;
  gerbe(x: number, y: number, couleur: number): void;
}

export class Voiture extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  readonly nom: string;
  readonly couleur: number;
  readonly joueur: boolean;
  ordinateur: boolean;
  niveau: number;
  aidee = false;                           // seul au doigt : les coups de pouce d'AIDE_MOBILE
  entrees: Entrees = { avancer: false, reculer: false, gauche: false, droite: false, nitro: false };

  vitesse = 0;                             // vers l'avant (négative en reculant)
  tour = 1;
  tempsTour = 0;
  tempsTotal = 0;
  enregistrement: Instant[] = [];
  nitro = 0;                               // ses bidons
  turbo = 0;                               // les secondes de nitro qui restent
  huile = 0;                               // les secondes de glissade qui restent
  fini = false;
  place = 0;
  progres: number;                         // le chemin parcouru depuis la ligne, le long de la route
  indice: number;                          // son point sur la trace

  private readonly piste: Piste;
  private readonly couloir: number;        // l'ordinateur garde son côté de la route
  private coincee = 0;
  private readonly flammes: Phaser.GameObjects.Particles.ParticleEmitter;

  // Sur la grille de départ, derrière la ligne : decalage la pousse sur le côté, rangee vers l'arrière
  constructor(scene: Phaser.Scene, piste: Piste, pilote: Pilote, decalage: number, rangee: number) {
    const c = piste.circuit;
    const angle = c.angleDepart;
    const recul = 70 + rangee * 80;
    super(scene,
      c.portes[0].x - Math.cos(angle) * recul - Math.sin(angle) * decalage,
      c.portes[0].y - Math.sin(angle) * recul + Math.cos(angle) * decalage,
      textureDeVoiture(scene, pilote.couleur));

    // Un objet créé avec « new » n'est nulle part : on l'ajoute à la scène (pour l'afficher)
    // et à la physique (pour lui donner un corps)
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setRotation(angle).setDepth(PROFONDEUR.voitures);
    this.body.setCircle(RAYON, 22 - RAYON, 15 - RAYON);   // un corps rond au milieu de l'image (44 × 30)
    this.setCollideWorldBounds(true);      // au bord du monde, elle s'arrête net

    this.piste = piste;
    this.nom = pilote.nom;
    this.couleur = pilote.couleur;
    this.joueur = pilote.joueur;
    this.ordinateur = !pilote.joueur;
    this.niveau = pilote.niveau;
    this.couloir = decalage / 2;
    this.indice = plusProche(c, this.x, this.y, 0);
    this.progres = -recul;

    // Les flammes de la nitro : un émetteur à elle, qu'on allume et qu'on éteint.
    // L'angle de chaque flamme est calculé à sa naissance : vers l'arrière de la voiture.
    this.flammes = scene.add.particles(0, 0, "etincelle", {
      emitting: false,
      frequency: 15,
      lifespan: 250,
      speed: { min: 150, max: 260 },
      angle: { onEmit: () => Phaser.Math.RadToDeg(this.rotation) + 180 + Phaser.Math.Between(-14, 14) },
      scale: { start: 1.4, end: 0 },
      tint: [0xffb02e, 0xff5a1a, 0xffe08a],
      blendMode: "ADD",
    }).setDepth(PROFONDEUR.flammes);
  }

  conduire(duree: number) {
    if (this.ordinateur) {
      this.penser();
    }
    const e = this.entrees;
    if (e.nitro && this.nitro > 0 && this.turbo <= 0) {
      this.nitro--;
      this.turbo = DUREE_NITRO;
    }
    const enTurbo = this.turbo > 0;
    this.turbo = Math.max(0, this.turbo - duree);
    this.huile = Math.max(0, this.huile - duree);

    const c = this.piste.circuit;
    const dansLHerbe = !surLaRoute(c, this.x, this.y);
    let frottement = FROTTEMENT;
    let adherence = ADHERENCE;
    if (dansLHerbe) {
      frottement = this.aidee ? AIDE_MOBILE.frottementHerbe : FROTTEMENT_HERBE;
      adherence = ADHERENCE_HERBE;
    }
    if (this.huile > 0) {
      adherence = ADHERENCE_HUILE;
    }

    // Devant : la direction du nez. Côté : la direction de la portière droite.
    // La vitesse du corps, en deux parts : celle qui va devant, et celle qui glisse sur le côté.
    const devantX = Math.cos(this.rotation);
    const devantY = Math.sin(this.rotation);
    const v = this.body.velocity;
    let avant = v.x * devantX + v.y * devantY;
    let cote = -v.x * devantY + v.y * devantX;

    let vitesseMax = VITESSE_MAX * this.niveau;
    if (enTurbo) {
      vitesseMax = VITESSE_NITRO;
      avant += ACCELERATION * 2 * duree;   // la nitro pousse fort
    }
    if (e.avancer) {
      avant += ACCELERATION * duree;
    }
    if (e.reculer) {
      avant -= (avant > 0 ? FREIN : ACCELERATION) * duree;
    }
    avant -= avant * frottement * duree;
    if (avant > vitesseMax) {
      avant = Math.max(vitesseMax, avant - 900 * duree);   // après la nitro, elle ralentit en douceur
    }
    avant = Math.max(-MARCHE_ARRIERE, avant);
    cote -= cote * Math.min(1, adherence * duree);         // les pneus retiennent la glissade

    // Tourner : seulement en roulant, et à l'envers en marche arrière
    const roule = Math.min(1, Math.abs(avant) / 150);
    const sens = avant < 0 ? -1 : 1;
    if (e.gauche) {
      this.rotation -= VIRAGE * roule * sens * duree;
    }
    if (e.droite) {
      this.rotation += VIRAGE * roule * sens * duree;
    }
    if (this.aidee && !e.gauche && !e.droite && avant > 100) {
      this.redresser(duree, roule);
    }

    // On recolle les deux parts : c'est la nouvelle vitesse du corps. La physique fera le reste.
    const vx = avant * devantX - cote * devantY;
    const vy = avant * devantY + cote * devantX;
    this.body.velocity.set(vx, vy);
    this.vitesse = avant;
    this.suivreLaTrace();

    // Coincée dans l'herbe ? Au bout d'un moment, on la remet sur la route
    this.coincee = dansLHerbe && Math.abs(avant) < 60 ? this.coincee + duree : 0;
    if (this.coincee > REMISE_SUR_LA_ROUTE) {
      this.remettreSurLaRoute();
    }

    // Une glissade laisse des marques de pneus, et un peu de fumée
    if (Math.abs(cote) > 90) {
      this.piste.marquerLeSol(this.x, this.y);
      this.piste.fumer(this.x, this.y);
    }
    // La nitro crache des flammes par l'arrière
    this.flammes.setPosition(this.x - devantX * 22, this.y - devantY * 22);
    if (enTurbo && !this.flammes.emitting) {
      this.flammes.start();
    } else if (!enTurbo && this.flammes.emitting) {
      this.flammes.stop();
    }

    if (!this.fini) {
      this.tempsTour += duree;
      this.tempsTotal += duree;
      this.enregistrement.push({
        t: this.tempsTour,
        x: Math.round(this.x),
        y: Math.round(this.y),
        angle: Math.round(this.rotation * 100) / 100,
      });
    }
  }

  // Le cerveau de l'ordinateur : il vise un point de la trace un peu devant lui
  private penser() {
    const trace = this.piste.circuit.trace;
    const vite = Math.max(0, this.vitesse);
    const devant = 10 + Math.round(vite / 35);   // plus il va vite, plus il regarde loin
    const cible = trace[(this.indice + devant) % trace.length];
    const cibleX = cible.x - Math.sin(cible.angle) * this.couloir;
    const cibleY = cible.y + Math.cos(cible.angle) * this.couloir;
    const ecart = angleEntre(Math.atan2(cibleY - this.y, cibleX - this.x), this.rotation);

    // Un virage arrive : plus il est serré, plus il ralentit
    const loin = trace[(this.indice + devant + 25) % trace.length];
    const virage = Math.abs(angleEntre(loin.angle, trace[this.indice].angle));
    const vitesseVoulue = VITESSE_MAX * this.niveau * (1 - Math.min(0.45, virage * 0.3));

    const e = this.entrees;
    e.gauche = ecart < -0.05;
    e.droite = ecart > 0.05;
    e.avancer = vite < vitesseVoulue || vite < 100;     // presque arrêté : il repart
    e.reculer = vite > vitesseVoulue + 60;
    e.nitro = virage < 0.2 && Math.abs(ecart) < 0.1;    // la nitro, dans une ligne droite
  }

  // L'aide au pilotage : on vise un point de la route un peu devant, et on tourne doucement vers lui
  private redresser(duree: number, roule: number) {
    const trace = this.piste.circuit.trace;
    const cible = trace[(this.indice + 12 + Math.round(Math.max(0, this.vitesse) / 40)) % trace.length];
    const ecart = angleEntre(Math.atan2(cible.y - this.y, cible.x - this.x), this.rotation);
    const pas = AIDE_MOBILE.direction * roule * duree;
    this.rotation += Phaser.Math.Clamp(ecart, -pas, pas);
  }

  // La barrière de pneus, puis le chemin parcouru le long de la route depuis la ligne.
  // La barrière empêche les raccourcis par l'herbe : le chemin, c'est simplement le point de la trace
  // le plus proche, et un tour tombe pile sur la ligne.
  private suivreLaTrace() {
    const c = this.piste.circuit;
    // Le corps, pas l'image : dans update(), Phaser a déjà avancé le corps de ce pas de physique, mais
    // n'a pas encore recopié sa place sur l'image (this.x a un pas de retard). Avec this.x, une voiture
    // qui recule loin des pneus serait vue encore contre eux, et remise contre eux à chaque image.
    const ici = this.body.center;
    const i = plusProche(c, ici.x, ici.y, this.indice);
    const p = c.trace[i];
    const dx = ici.x - p.x;
    const dy = ici.y - p.y;
    const loin = Math.hypot(dx, dy);
    const bord = LIMITE - RAYON;           // son corps s'arrête contre les pneus
    if (loin > bord) {
      const ux = dx / loin;                // la direction de la route vers la barrière, longue de 1
      const uy = dy / loin;
      const v = this.body.velocity;
      const dehors = v.x * ux + v.y * uy;  // la part de sa vitesse qui va vers la barrière
      const vx = dehors > 0 ? v.x - ux * dehors * 1.5 : v.x;   // elle la perd, avec un petit rebond
      const vy = dehors > 0 ? v.y - uy * dehors * 1.5 : v.y;
      this.body.reset(p.x + ux * bord, p.y + uy * bord);      // reset met aussi la vitesse à 0...
      this.body.velocity.set(vx, vy);                         // ... on lui rend la sienne
      if (dehors > 150) {
        this.piste.gerbe(this.x + ux * RAYON, this.y + uy * RAYON, 0x222222);
      }
    }
    let chemin = c.trace[i].d - c.trace[this.indice].d;
    if (chemin > c.longueur / 2) {
      chemin -= c.longueur;                // elle a reculé en passant la ligne
    }
    if (chemin < -c.longueur / 2) {
      chemin += c.longueur;                // elle a passé la ligne
    }
    this.progres += chemin;
    this.indice = i;
  }

  // Au milieu de la route, sur son point de la trace, tournée dans le sens de la course
  private remettreSurLaRoute() {
    const point = this.piste.circuit.trace[this.indice];
    this.body.reset(point.x, point.y);     // reset : la place change d'un coup, et la vitesse tombe à 0
    this.setRotation(point.angle);
    this.coincee = 0;
    this.piste.gerbe(point.x, point.y, 0xffffff);
  }

  ramasserUnBidon() {
    this.nitro = Math.min(NITRO_MAX, this.nitro + 1);
  }

  prendreUneFleche() {
    this.turbo = Math.max(this.turbo, DUREE_FLECHE);
  }

  // Vrai si elle vient de glisser sur la flaque
  glisser(): boolean {
    if (this.huile > 0) {
      return false;
    }
    this.huile = this.aidee ? DUREE_HUILE * AIDE_MOBILE.huile : DUREE_HUILE;
    return true;
  }

  // Vrai si elle vient de finir un tour : son chemin parcouru dépasse un tour de circuit de plus.
  // Reculer par-dessus la ligne puis la repasser ne compte pas : le chemin, lui, a reculé aussi.
  aFiniUnTour(): boolean {
    return !this.fini && this.progres >= this.tour * this.piste.circuit.longueur;
  }

  // La course est finie pour elle : elle prend sa place, et l'ordinateur la ramène au ralenti
  franchirLArrivee(place: number) {
    this.fini = true;
    this.place = place;
    this.ordinateur = true;
    this.niveau = 0.6;
  }
}
