// Une licorne en course, sans rien d'affiché : sa conduite, le pilote de l'ordinateur, la barrière de nuages,
// le repêchage et les bonus. Du TypeScript pur : la scène de course la fait avancer à chaque image, et la
// dessine (voir LicorneVue.ts).
//
// Pourquoi pas la physique Arcade, comme la voiture ? Une licorne pivote sur place, grandit quand elle mange
// un bonbon (son rond de choc aussi), rebondit sur des nuages qui suivent la route et envoie valser les autres
// quand elle est géante : des règles de jeu, pas de la physique. On garde celles de l'ancien jeu, au pixel près.

import {
  ACCELERATION, FREIN, VITESSE_MAX, VITESSE_TURBO, MARCHE_ARRIERE, VIRAGE, FROTTEMENT, FROTTEMENT_NUAGE,
  ADHERENCE, ADHERENCE_NUAGE, DUREE_TURBO, DUREE_FLECHE, DUREE_GEANTE, DUREE_ETOURDIE, ETOILES_MAX,
  LIMITE, TAILLE_LICORNE, REPECHAGE, type Niveau,
} from "./reglages";
import { angleEntre, plusProche, surLaRoute, type Circuit, type Point } from "./circuits";
import type { Look } from "./donnees";

export interface Entrees {
  avancer: boolean;
  reculer: boolean;
  gauche: boolean;
  droite: boolean;
}

// Un instant d'un tour, pour le fantôme du contre-la-montre
export interface Instant {
  t: number;
  x: number;
  y: number;
  angle: number;
}

// Un objet qu'on ramasse : il disparaît (visible devient faux), puis revient
export interface Ramassable extends Point {
  visible: boolean;
}

// Ce que la licorne demande au monde autour d'elle. La scène de course répond aux « échos »
// par des sons, des étincelles et des messages.
export interface Monde {
  circuit: Circuit;
  aides: Niveau;
  enChrono: boolean;                       // on n'enregistre le fantôme qu'au contre-la-montre
  joueuses: Coureuse[];                    // pour l'effet élastique
  etoiles: Ramassable[];
  bonbons: Ramassable[];
  fleches: Point[];
  orages: Point[];                         // ils bougent : la scène les déplace
  sabot(c: Coureuse, aigu: boolean): void;
  pouf(c: Coureuse, x: number, y: number): void;
  repechee(c: Coureuse, avantX: number, avantY: number): void;
  etourdie(c: Coureuse): void;
  etoile(c: Coureuse, etoile: Ramassable): void;
  bonbon(c: Coureuse, bonbon: Ramassable): void;
  fleche(c: Coureuse): void;
  orage(c: Coureuse): void;
  turbo(c: Coureuse): void;
}

export interface Engagee {
  numero: number;                          // dans LICORNES
  look: Look;
  humaine: boolean;
  joueur: number;                          // 1 ou 2 pour les joueuses, 0 pour l'ordinateur
  niveau: number;                          // 1 : la vitesse pleine ; moins, elle lève le pied
}

export class Coureuse {
  readonly numero: number;
  readonly look: Look;
  readonly nom: string;
  readonly humaine: boolean;
  readonly joueur: number;
  niveau: number;
  entrees: Entrees = { avancer: false, reculer: false, gauche: false, droite: false };

  x = 0;
  y = 0;
  angle = 0;
  vx = 0;
  vy = 0;
  vitesse = 0;                             // vers l'avant (négative en reculant)
  tour = 1;
  tempsTour = 0;
  tempsTotal = 0;
  tempsFinal = 0;
  enregistrement: Instant[] = [];
  etoiles = 0;
  turbo = 0;                               // les secondes de turbo qui restent
  geante = 0;
  etourdie = 0;
  tourbillon = 0;                          // la tête qui tourne : un angle en plus
  phase = Math.random() * 6;               // le galop : les jambes, la queue, la crinière
  fini = false;
  pilote = false;                          // vrai : l'ordinateur la conduit (après l'arrivée)
  rang = 0;                                // sa place à l'arrivée
  place = 0;                               // sa place en course
  progres = 0;                             // le chemin parcouru depuis la ligne, le long de la route
  indice = 0;                              // son point sur la trace
  elan = 1;                                // l'effet élastique : moins de 1, elle attend ; plus, elle se dépêche

  private attenteFleche = 0;
  private attenteOrage = 0;
  private attentePouf = 0;
  private dernierPas = 0;
  private couloir = 0;
  private couloirVoulu = 0;
  private attenteCouloir = 0;
  private patience = 0;
  private meilleurProgres = 0;             // pour voir si elle avance encore
  private bloquee = 0;
  private readonly monde: Monde;

  // decalage : sur le côté de la ligne ; rangee : 0 devant, 1 derrière...
  constructor(monde: Monde, engagee: Engagee, decalage: number, rangee: number) {
    this.monde = monde;
    this.numero = engagee.numero;
    this.look = engagee.look;
    this.nom = engagee.look.nom;
    this.humaine = engagee.humaine;
    this.joueur = engagee.joueur;
    this.niveau = engagee.niveau;

    const c = monde.circuit;
    this.angle = c.angleDepart;
    const recul = 80 + rangee * 85;
    const porte = c.portes[0];
    this.x = porte.x - Math.cos(this.angle) * recul - Math.sin(this.angle) * decalage;
    this.y = porte.y - Math.sin(this.angle) * recul + Math.cos(this.angle) * decalage;
    this.indice = plusProche(c, this.x, this.y, -1);
    const s = c.trace[this.indice].s;
    this.progres = s > c.longueur / 2 ? s - c.longueur : s;
    this.meilleurProgres = this.progres;
  }

  // Les joueuses reçoivent les coups de pouce du niveau choisi
  get aidee(): boolean {
    return this.humaine && !this.pilote;
  }

  echelle(): number {
    let grandeur = 1;
    if (this.geante > 0) {
      // elle grandit vite, et rapetisse à la fin
      grandeur = 1 + 0.6 * Math.min(1, (DUREE_GEANTE - this.geante) * 4, this.geante * 2);
    }
    return TAILLE_LICORNE * grandeur;
  }

  // L'effet élastique : une rivale loin devant les joueuses ralentit, une rivale loin derrière se dépêche
  private elastique(): number {
    const force = this.monde.aides.elastique;
    const enCourse = this.monde.joueuses.filter((j) => !j.fini);
    if (!force || enCourse.length === 0) {
      return 1;
    }
    const tete = Math.max(...enCourse.map((j) => j.progres));
    const ecart = Math.max(-1, Math.min(1, (this.progres - tete) / 900));
    return ecart > 0 ? 1 - force * 0.6 * ecart : 1 - force * 0.15 * ecart;
  }

  // Le cerveau de l'ordinateur : il vise un point de la route un peu devant lui
  private penser(duree: number) {
    const t = this.monde.circuit.trace;
    const total = t.length;
    const vite = Math.max(0, this.vitesse);
    const avance = 10 + Math.round(vite / 35);

    // Il change de couloir de temps en temps, pour ne pas suivre les autres à la queue leu leu
    this.attenteCouloir -= duree;
    if (this.attenteCouloir <= 0) {
      this.couloirVoulu = (Math.random() - 0.5) * 70;
      this.attenteCouloir = 2 + Math.random() * 3;
    }
    this.couloir += (this.couloirVoulu - this.couloir) * Math.min(1, duree);

    const cible = t[(this.indice + avance) % total];
    const cx = cible.x + cible.nx * this.couloir;
    const cy = cible.y + cible.ny * this.couloir;
    const ecart = angleEntre(Math.atan2(cy - this.y, cx - this.x) - this.angle);

    // Un virage arrive : la route tourne entre ici et un peu plus loin
    const ici = t[this.indice];
    const loin = t[(this.indice + avance + 25) % total];
    const virage = Math.abs(angleEntre(Math.atan2(loin.ty, loin.tx) - Math.atan2(ici.ty, ici.tx)));
    this.elan = this.pilote ? 1 : this.elastique();
    const vitesseVoulue = VITESSE_MAX * this.niveau * this.elan * (1 - Math.min(0.45, virage * 0.28));

    const e = this.entrees;
    e.gauche = ecart < -0.05;
    e.droite = ecart > 0.05;
    e.avancer = vite < vitesseVoulue && Math.abs(ecart) < 1.2;
    e.reculer = vite > vitesseVoulue + 60 || (Math.abs(ecart) > 1.4 && vite > 150);
    if (vite < 80) {
      e.avancer = true;                    // à l'arrêt, il faut avancer pour pouvoir tourner
      e.reculer = false;
    }

    // Le turbo, dans une ligne droite
    if (!this.pilote && this.etoiles > 0 && this.turbo <= 0 && virage < 0.25 && Math.abs(ecart) < 0.12) {
      this.patience += duree;
      if (this.patience > 0.6) {
        this.lancerTurbo();
        this.patience = 0;
      }
    }
  }

  // L'aide au pilotage : on vise un point de la route un peu devant, et on tourne doucement vers lui
  private redresser(duree: number, roule: number) {
    const t = this.monde.circuit.trace;
    const cible = t[(this.indice + 12 + Math.round(Math.max(0, this.vitesse) / 40)) % t.length];
    const ecart = angleEntre(Math.atan2(cible.y - this.y, cible.x - this.x) - this.angle);
    const pas = this.monde.aides.direction * roule * duree;
    this.angle += Math.max(-pas, Math.min(pas, ecart));
  }

  conduire(duree: number) {
    if (!this.aidee) {
      this.penser(duree);
    }
    const aides = this.monde.aides;
    const enTurbo = this.turbo > 0;
    this.turbo = Math.max(0, this.turbo - duree);
    this.geante = Math.max(0, this.geante - duree);
    this.etourdie = Math.max(0, this.etourdie - duree);
    this.attenteFleche = Math.max(0, this.attenteFleche - duree);
    this.attenteOrage = Math.max(0, this.attenteOrage - duree);
    this.attentePouf = Math.max(0, this.attentePouf - duree);

    let frottement = FROTTEMENT;
    let adherence = ADHERENCE;
    // En turbo, la licorne vole au-dessus des nuages : ils ne la freinent plus
    if (!enTurbo && !surLaRoute(this.monde.circuit, this.x, this.y, this.indice)) {
      frottement = this.aidee ? aides.frottementNuage : FROTTEMENT_NUAGE;
      adherence = ADHERENCE_NUAGE;
    }

    // Devant : la direction du nez. Côté : la direction du flanc droit.
    // La vitesse, en deux parts : celle qui va devant, et celle qui glisse sur le côté.
    const devantX = Math.cos(this.angle);
    const devantY = Math.sin(this.angle);
    let avant = this.vx * devantX + this.vy * devantY;
    let cote = -this.vx * devantY + this.vy * devantX;

    let vitesseMax = VITESSE_MAX * this.niveau * (this.aidee ? 1 : this.elan);
    if (this.geante > 0) {
      vitesseMax *= 1.06;
    }
    if (enTurbo) {
      vitesseMax = VITESSE_TURBO;
      avant += ACCELERATION * 2.5 * duree;
    }
    let virage = VIRAGE;
    if (this.etourdie > 0) {
      vitesseMax = Math.min(vitesseMax, 200);
      adherence = 1.5;
      virage = VIRAGE * 0.5;
    }
    const e = this.entrees;
    if (e.avancer) {
      avant += ACCELERATION * duree;
    }
    if (e.reculer) {
      avant -= (avant > 0 ? FREIN : ACCELERATION) * duree;
    }
    avant -= avant * frottement * duree;
    if (avant > vitesseMax) {
      avant = Math.max(vitesseMax, avant - 900 * duree);   // après le turbo, on ralentit en douceur
    }
    avant = Math.max(-MARCHE_ARRIERE, avant);
    cote -= cote * Math.min(1, adherence * duree);

    // Une licorne n'est pas une voiture : même arrêtée, elle peut pivoter sur place
    const roule = Math.max(0.6, Math.min(1, Math.abs(avant) / 150));
    const sens = avant < -20 ? -1 : 1;
    if (e.gauche) {
      this.angle -= virage * roule * sens * duree;
    }
    if (e.droite) {
      this.angle += virage * roule * sens * duree;
    }
    if (this.aidee && aides.direction > 0 && !e.gauche && !e.droite && avant > 100) {
      this.redresser(duree, roule);
    }

    const c = this.monde.circuit;
    this.vx = avant * devantX - cote * devantY;
    this.vy = avant * devantY + cote * devantX;
    this.x = Math.max(0, Math.min(this.x + this.vx * duree, c.modele.largeur));
    this.y = Math.max(0, Math.min(this.y + this.vy * duree, c.modele.hauteur));
    this.vitesse = avant;

    this.suivreLaTrace(duree);
    this.repecherSiBloquee(duree);

    this.tourbillon = this.etourdie > 0 ? this.tourbillon + duree * 12 : 0;

    // Le galop : les jambes bougent avec la vitesse, et chaque foulée fait « clop »
    this.phase += Math.abs(avant) * duree * 0.045;
    const pas = Math.floor(this.phase / Math.PI);
    if (pas !== this.dernierPas) {
      this.dernierPas = pas;
      if (this.humaine && !this.fini && Math.abs(avant) > 60) {
        this.monde.sabot(this, pas % 2 === 0);
      }
    }

    if (!this.fini) {
      this.tempsTour += duree;
      this.tempsTotal += duree;
      if (this.humaine && this.monde.enChrono) {
        this.enregistrement.push({
          t: this.tempsTour, x: Math.round(this.x), y: Math.round(this.y), angle: Math.round(this.angle * 100) / 100,
        });
      }
    }
  }

  // La barrière de nuages, puis la distance parcourue le long de la route
  private suivreLaTrace(duree: number) {
    const c = this.monde.circuit;
    const i = plusProche(c, this.x, this.y, this.indice);
    const p = c.trace[i];
    const dx = this.x - p.x;
    const dy = this.y - p.y;
    const d = Math.hypot(dx, dy);
    const bord = LIMITE - 14;              // le corps s'arrête contre les boules de nuage
    if (d > bord) {
      const ux = dx / d;                   // de la route vers la barrière, long de 1
      const uy = dy / d;
      this.x = p.x + ux * bord;
      this.y = p.y + uy * bord;
      const dehors = this.vx * ux + this.vy * uy;
      if (dehors > 0) {
        this.vx -= ux * dehors * 1.5;      // un petit rebond sur les nuages
        this.vy -= uy * dehors * 1.5;
        if (dehors > 120 && this.attentePouf <= 0) {
          this.attentePouf = 0.3;
          this.monde.pouf(this, this.x + ux * 15, this.y + uy * 15);
        }
      }
      // Le nez dans les nuages : ils la tournent doucement dans le sens de la route
      if (Math.cos(this.angle) * ux + Math.sin(this.angle) * uy > 0.2) {
        const ecart = angleEntre(Math.atan2(p.ty, p.tx) - this.angle);
        const pas = 2.5 * duree;
        this.angle += Math.max(-pas, Math.min(pas, ecart));
      }
    }
    let ds = p.s - c.trace[this.indice].s;
    if (ds > c.longueur / 2) {
      ds -= c.longueur;                    // elle a reculé en passant la ligne
    }
    if (ds < -c.longueur / 2) {
      ds += c.longueur;                    // elle a passé la ligne
    }
    this.progres += ds;
    this.indice = i;
  }

  // Le repêchage : une licorne qui n'avance plus est remise au milieu de la route, dans le bon sens
  private repecherSiBloquee(duree: number) {
    if (this.fini || this.etourdie > 0) {
      return;
    }
    if (this.progres > this.meilleurProgres + 40) {
      this.meilleurProgres = this.progres;
      this.bloquee = 0;
      return;
    }
    this.bloquee += duree;
    if (this.bloquee < REPECHAGE) {
      return;
    }
    const p = this.monde.circuit.trace[this.indice];
    const avantX = this.x;
    const avantY = this.y;
    this.x = p.x;
    this.y = p.y;
    this.angle = Math.atan2(p.ty, p.tx);
    this.vx = 0;
    this.vy = 0;
    this.vitesse = 0;
    this.bloquee = 0;
    this.meilleurProgres = this.progres;
    this.monde.repechee(this, avantX, avantY);
  }

  toucherLesObjets() {
    const m = this.monde;
    const portee = this.geante > 0 ? 62 : 42;
    const pres = (objet: Point, distance: number) => Math.hypot(this.x - objet.x, this.y - objet.y) <= distance;
    for (const etoile of m.etoiles) {
      if (etoile.visible && pres(etoile, portee)) {
        if (this.etoiles < ETOILES_MAX) {
          this.etoiles++;
        }
        m.etoile(this, etoile);            // la scène la cache, et la fera revenir
      }
    }
    for (const bonbon of m.bonbons) {
      if (bonbon.visible && pres(bonbon, portee)) {
        this.geante = DUREE_GEANTE;
        this.etourdie = 0;
        m.bonbon(this, bonbon);
      }
    }
    for (const fleche of m.fleches) {
      if (this.attenteFleche <= 0 && pres(fleche, 55)) {
        this.attenteFleche = 1;
        this.turbo = Math.max(this.turbo, DUREE_FLECHE);
        m.fleche(this);
      }
    }
    for (const orage of m.orages) {
      if (this.attenteOrage <= 0 && pres(orage, portee - 4)) {
        this.attenteOrage = 1.5;
        if (this.geante > 0 || this.turbo > 0) {
          continue;                        // trop grande, ou trop rapide pour l'orage
        }
        this.etourdir(DUREE_ETOURDIE * (this.aidee ? m.aides.etourdie : 1));
        m.orage(this);
      }
    }
  }

  etourdir(duree: number) {
    this.etourdie = Math.max(this.etourdie, duree);
    this.monde.etourdie(this);
  }

  lancerTurbo() {
    if (this.etoiles <= 0 || this.turbo > 0 || this.fini) {
      return;
    }
    this.etoiles--;
    this.turbo = DUREE_TURBO;
    this.monde.turbo(this);
  }

  // Vrai si elle vient de finir un tour : son chemin dépasse un tour de circuit de plus
  aFiniUnTour(): boolean {
    return !this.fini && this.progres >= this.tour * this.monde.circuit.longueur;
  }

  // La ligne franchie au dernier tour. Une joueuse est ramenée tranquillement par l'ordinateur.
  franchirLArrivee(rang: number) {
    this.fini = true;
    this.tempsFinal = this.tempsTotal;
    this.rang = rang;
    if (this.humaine) {
      this.pilote = true;
      this.niveau = 0.7;
    }
  }
}

// ===== Entre les licornes =====

// Les licornes qui se touchent se poussent ; une géante envoie valser les autres
export function bousculer(licornes: Coureuse[]) {
  for (let i = 0; i < licornes.length; i++) {
    for (let j = i + 1; j < licornes.length; j++) {
      const a = licornes[i];
      const b = licornes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const mini = 20 * (a.echelle() + b.echelle());
      if (d === 0 || d >= mini) {
        continue;
      }
      const nx = dx / d;
      const ny = dy / d;
      const pousse = (mini - d) / 2;
      a.x -= nx * pousse;
      a.y -= ny * pousse;
      b.x += nx * pousse;
      b.y += ny * pousse;
      let force = 0.8;
      if (a.geante > 0 && b.geante <= 0 && b.turbo <= 0) {
        b.etourdir(0.9);
        force = 1.6;
      }
      if (b.geante > 0 && a.geante <= 0 && a.turbo <= 0) {
        a.etourdir(0.9);
        force = 1.6;
      }
      const choc = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (choc > 0) {
        a.vx -= nx * choc * force;
        a.vy -= ny * choc * force;
        b.vx += nx * choc * force;
        b.vy += ny * choc * force;
      }
    }
  }
}

// Les places en course : celles qui ont fini, dans l'ordre d'arrivée, puis les autres selon le chemin parcouru
export function ordreDeCourse(licornes: Coureuse[]): Coureuse[] {
  const arrivees = licornes.filter((l) => l.fini).sort((a, b) => a.rang - b.rang);
  const restantes = licornes.filter((l) => !l.fini).sort((a, b) => b.progres - a.progres);
  return [...arrivees, ...restantes];
}

export interface Resultat {
  licorne: Coureuse;
  rang: number;
  temps: number;
  estime: boolean;                         // pas finie : son temps est deviné d'après le chemin déjà fait
  points: number;
}

export function resultatsDeCourse(licornes: Coureuse[], longueurTotale: number, points: number[]): Resultat[] {
  return ordreDeCourse(licornes).map((l, i) => ({
    licorne: l,
    rang: i + 1,
    temps: l.fini ? l.tempsFinal : l.tempsTotal * longueurTotale / Math.max(1, l.progres),
    estime: !l.fini,
    points: points[i] ?? 0,
  }));
}
