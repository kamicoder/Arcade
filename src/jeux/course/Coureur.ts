// Un véhicule en course, sans rien d'affiché : sa conduite, le pilote de l'ordinateur, la barrière, le
// repêchage, les objets et la bousculade. Du TypeScript pur : la scène de course le fait avancer à chaque
// image, et le thème le dessine (voir DecorDeCourse dans theme.ts).
//
// Pourquoi pas la physique Arcade ? Un véhicule pivote, grandit quand il mange un bonbon (son rond de choc
// aussi), rebondit sur une barrière qui suit la route et envoie valser les autres quand il est géant :
// des règles de jeu, pas de la physique. Et tout calculer ici évite le piège du sprite qui a un pas de
// physique de retard sur son corps (une voiture restait coincée contre les pneus) : la place lue est
// toujours la vraie.

import { angleEntre, plusProche, surLaRoute, type Circuit, type Point } from "./circuits";
import type { Apparence, Conduite, Evenement, Niveau, TypeDObjet } from "./theme";

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

// Un objet de la route, tel que la scène l'affiche : il disparaît (visible devient faux), puis revient
export interface ObjetEnCourse {
  type: TypeDObjet;
  image: Point & { visible: boolean };
}

// Ce que le véhicule demande au monde autour de lui
export interface Monde {
  conduite: Conduite;
  circuit: Circuit;
  aides: Niveau;
  enChrono: boolean;                       // on n'enregistre le fantôme qu'au contre-la-montre
  joueurs: Coureur[];                      // pour l'effet élastique
  objets: ObjetEnCourse[];
  ramasser(objet: ObjetEnCourse): void;    // la scène le cache, et le fera revenir
  reagir(c: Coureur, evenement: Evenement): void;
}

export interface Engage {
  numero: number;                          // dans l'équipe du thème
  apparence: Apparence;
  humain: boolean;
  joueur: number;                          // 1 ou 2 pour les joueurs, 0 pour l'ordinateur
  niveau: number;                          // 1 : la vitesse pleine ; moins, il lève le pied
}

const NIVEAU_APRES_L_ARRIVEE = 0.7;        // le joueur arrivé est ramené tranquillement par l'ordinateur

export class Coureur {
  readonly numero: number;
  readonly apparence: Apparence;
  readonly nom: string;
  readonly humain: boolean;
  readonly joueur: number;
  niveau: number;
  entrees: Entrees = { avancer: false, reculer: false, gauche: false, droite: false };

  x = 0;
  y = 0;
  angle = 0;
  vx = 0;
  vy = 0;
  vitesse = 0;                             // vers l'avant (négative en reculant)
  glissade = 0;                            // la vitesse qui part sur le côté (les pneus crissent)
  tour = 1;
  tempsTour = 0;
  tempsTotal = 0;
  tempsFinal = 0;
  enregistrement: Instant[] = [];
  reserve = 0;                             // les turbos gardés (bidons, étoiles)
  turbo = 0;                               // les secondes de turbo qui restent
  geante = 0;
  etourdie = 0;
  glisse = 0;
  tourbillon = 0;                          // la tête qui tourne : un angle en plus
  phase = Math.random() * 6;               // la foulée : les jambes, la queue, la crinière
  fini = false;
  pilote = false;                          // vrai : l'ordinateur le conduit (un joueur, après l'arrivée)
  rang = 0;                                // sa place à l'arrivée
  place = 0;                               // sa place en course
  progres = 0;                             // le chemin parcouru depuis la ligne, le long de la route
  indice = 0;                              // son point sur la trace
  elan = 1;                                // l'effet élastique : moins de 1, il attend ; plus, il se dépêche

  private adherenceGlisse = 1;
  private readonly attentes = new Map<TypeDObjet, number>();
  private attentePouf = 0;
  private dernierPas = 0;
  private couloir = 0;
  private couloirVoulu = 0;
  private attenteCouloir = 0;
  private patience = 0;
  private meilleurProgres = 0;             // pour voir s'il avance encore
  private bloque = 0;
  private arrete = 0;
  private readonly monde: Monde;

  // decalage : sur le côté de la ligne ; rangee : 0 devant, 1 derrière...
  constructor(monde: Monde, engage: Engage, decalage: number, rangee: number) {
    this.monde = monde;
    this.numero = engage.numero;
    this.apparence = engage.apparence;
    this.nom = engage.apparence.nom;
    this.humain = engage.humain;
    this.joueur = engage.joueur;
    this.niveau = engage.niveau;

    const c = monde.circuit;
    const grille = monde.conduite.grille;
    this.angle = c.angleDepart;
    const recul = grille.recul + rangee * grille.rangee;
    const porte = c.portes[0];
    this.x = porte.x - Math.cos(this.angle) * recul - Math.sin(this.angle) * decalage;
    this.y = porte.y - Math.sin(this.angle) * recul + Math.cos(this.angle) * decalage;
    this.indice = plusProche(c, this.x, this.y, -1);
    const s = c.trace[this.indice].s;
    this.progres = s > c.longueur / 2 ? s - c.longueur : s;
    this.meilleurProgres = this.progres;
  }

  // Les joueurs reçoivent les coups de pouce du niveau choisi
  get aide(): boolean {
    return this.humain && !this.pilote;
  }

  echelle(): number {
    let grandeur = 1;
    if (this.geante > 0) {
      // il grandit vite, et rapetisse à la fin
      grandeur = 1 + 0.6 * Math.min(1, (this.dureeGeante - this.geante) * 4, this.geante * 2);
    }
    return this.monde.conduite.taille * grandeur;
  }

  private dureeGeante = 1;

  // L'effet élastique : un rival loin devant les joueurs ralentit, un rival loin derrière se dépêche
  private elastique(): number {
    const force = this.monde.aides.elastique;
    const enCourse = this.monde.joueurs.filter((j) => !j.fini);
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
    const vitesseVoulue = this.monde.conduite.vitesseMax * this.niveau * this.elan * (1 - Math.min(0.45, virage * 0.28));

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
    if (!this.pilote && this.reserve > 0 && this.turbo <= 0 && virage < 0.25 && Math.abs(ecart) < 0.12) {
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
    if (!this.aide) {
      this.penser(duree);
    }
    const r = this.monde.conduite;
    const aides = this.monde.aides;
    const enTurbo = this.turbo > 0;
    this.turbo = Math.max(0, this.turbo - duree);
    this.geante = Math.max(0, this.geante - duree);
    this.etourdie = Math.max(0, this.etourdie - duree);
    this.glisse = Math.max(0, this.glisse - duree);
    this.attentePouf = Math.max(0, this.attentePouf - duree);
    for (const [type, reste] of this.attentes) {
      this.attentes.set(type, reste - duree);
    }

    let frottement = r.frottement;
    let adherence = r.adherence;
    const horsPiste = !surLaRoute(this.monde.circuit, this.x, this.y, this.indice);
    // En turbo, une licorne vole au-dessus des nuages : ils ne la freinent plus
    if (horsPiste && !(enTurbo && r.turbo.survole)) {
      frottement = this.aide ? Math.min(r.frottementHorsPiste, aides.horsPiste) : r.frottementHorsPiste;
      adherence = r.adherenceHorsPiste;
    }
    if (this.glisse > 0) {
      adherence = this.adherenceGlisse;
    }

    // Devant : la direction du nez. Côté : la direction du flanc droit.
    // La vitesse, en deux parts : celle qui va devant, et celle qui glisse sur le côté.
    const devantX = Math.cos(this.angle);
    const devantY = Math.sin(this.angle);
    let avant = this.vx * devantX + this.vy * devantY;
    let cote = -this.vx * devantY + this.vy * devantX;
    this.glissade = cote;

    let vitesseMax = r.vitesseMax * this.niveau * (this.aide ? 1 : this.elan);
    if (this.geante > 0) {
      vitesseMax *= 1.06;
    }
    if (enTurbo) {
      vitesseMax = r.turbo.vitesse;
      avant += r.acceleration * r.turbo.poussee * duree;
    }
    let virage = r.virage;
    if (this.etourdie > 0) {
      vitesseMax = Math.min(vitesseMax, 200);
      adherence = 1.5;
      virage = r.virage * 0.5;
    }
    const e = this.entrees;
    if (e.avancer) {
      avant += r.acceleration * duree;
    }
    if (e.reculer) {
      avant -= (avant > 0 ? r.frein : r.acceleration) * duree;
    }
    avant -= avant * frottement * duree;
    if (avant > vitesseMax) {
      avant = Math.max(vitesseMax, avant - 900 * duree);   // après le turbo, on ralentit en douceur
    }
    avant = Math.max(-r.marcheArriere, avant);
    cote -= cote * Math.min(1, adherence * duree);

    // Tourner : en roulant (une licorne pivote même arrêtée), et à l'envers en marche arrière
    const roule = Math.max(r.pivot, Math.min(1, Math.abs(avant) / 150));
    const sens = avant < -20 ? -1 : 1;
    if (e.gauche) {
      this.angle -= virage * roule * sens * duree;
    }
    if (e.droite) {
      this.angle += virage * roule * sens * duree;
    }
    if (this.aide && aides.direction > 0 && !e.gauche && !e.droite && avant > 100) {
      this.redresser(duree, roule);
    }

    const c = this.monde.circuit;
    this.vx = avant * devantX - cote * devantY;
    this.vy = avant * devantY + cote * devantX;
    this.x = Math.max(0, Math.min(this.x + this.vx * duree, c.modele.largeur));
    this.y = Math.max(0, Math.min(this.y + this.vy * duree, c.modele.hauteur));
    this.vitesse = avant;

    this.suivreLaTrace(duree);
    this.repecherSiBloque(duree, horsPiste);

    this.tourbillon = this.etourdie > 0 ? this.tourbillon + duree * 12 : 0;

    // La foulée avance avec la vitesse, et chaque pas fait « clop »
    this.phase += Math.abs(avant) * duree * 0.045;
    const pas = Math.floor(this.phase / Math.PI);
    if (pas !== this.dernierPas) {
      this.dernierPas = pas;
      if (this.humain && !this.fini && Math.abs(avant) > 60) {
        this.monde.reagir(this, { genre: "pas", aigu: pas % 2 === 0 });
      }
    }

    if (!this.fini) {
      this.tempsTour += duree;
      this.tempsTotal += duree;
      if (this.humain && this.monde.enChrono) {
        this.enregistrement.push({
          t: this.tempsTour, x: Math.round(this.x), y: Math.round(this.y), angle: Math.round(this.angle * 100) / 100,
        });
      }
    }
  }

  // La barrière, puis la distance parcourue le long de la route.
  // La barrière empêche les raccourcis : le chemin, c'est simplement le point de la trace le plus proche,
  // et un tour tombe pile sur la ligne.
  private suivreLaTrace(duree: number) {
    const c = this.monde.circuit;
    const r = this.monde.conduite;
    const i = plusProche(c, this.x, this.y, this.indice);
    const p = c.trace[i];
    const dx = this.x - p.x;
    const dy = this.y - p.y;
    const d = Math.hypot(dx, dy);
    const bord = c.barriere - r.rayonBarriere;   // le corps s'arrête contre la barrière
    if (d > bord) {
      const ux = dx / d;                   // de la route vers la barrière, long de 1
      const uy = dy / d;
      this.x = p.x + ux * bord;
      this.y = p.y + uy * bord;
      const dehors = this.vx * ux + this.vy * uy;
      if (dehors > 0) {
        this.vx -= ux * dehors * 1.5;      // un petit rebond
        this.vy -= uy * dehors * 1.5;
        if (dehors > 120 && this.attentePouf <= 0) {
          this.attentePouf = 0.3;
          this.monde.reagir(this, { genre: "barriere", x: this.x + ux * r.rayonBarriere, y: this.y + uy * r.rayonBarriere });
        }
      }
      // Le nez dans la barrière : elle le tourne doucement dans le sens de la route (si le thème le veut)
      if (r.redresser > 0 && Math.cos(this.angle) * ux + Math.sin(this.angle) * uy > 0.2) {
        const ecart = angleEntre(Math.atan2(p.ty, p.tx) - this.angle);
        const pas = r.redresser * duree;
        this.angle += Math.max(-pas, Math.min(pas, ecart));
      }
    }
    let ds = p.s - c.trace[this.indice].s;
    if (ds > c.longueur / 2) {
      ds -= c.longueur;                    // il a reculé en passant la ligne
    }
    if (ds < -c.longueur / 2) {
      ds += c.longueur;                    // il a passé la ligne
    }
    this.progres += ds;
    this.indice = i;
  }

  // Le repêchage : un véhicule qui n'avance plus est remis au milieu de la route, dans le bon sens
  private repecherSiBloque(duree: number, horsPiste: boolean) {
    const regle = this.monde.conduite.repechage;
    if (this.fini || this.etourdie > 0) {
      return;
    }
    let repeche = false;
    if (regle.sansProgres !== undefined) {
      if (this.progres > this.meilleurProgres + 40) {
        this.meilleurProgres = this.progres;
        this.bloque = 0;
      } else {
        this.bloque += duree;
        repeche ||= this.bloque >= regle.sansProgres;
      }
    }
    if (regle.horsPiste !== undefined) {
      this.arrete = horsPiste && Math.abs(this.vitesse) < 60 ? this.arrete + duree : 0;
      repeche ||= this.arrete > regle.horsPiste;
    }
    if (!repeche) {
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
    this.bloque = 0;
    this.arrete = 0;
    this.meilleurProgres = this.progres;
    this.monde.reagir(this, { genre: "repeche", avantX, avantY });
  }

  // Les objets de la route : chacun son effet (voir Effet dans theme.ts)
  toucherLesObjets() {
    const m = this.monde;
    const plusLoin = this.geante > 0 ? 20 : 0;   // un géant attrape de plus loin
    for (const objet of m.objets) {
      const { type, image } = objet;
      if (!image.visible || (this.attentes.get(type) ?? 0) > 0
        || Math.hypot(this.x - image.x, this.y - image.y) > type.portee + plusLoin) {
        continue;
      }
      if (type.attente) {
        this.attentes.set(type, type.attente);
      }
      if (this.subir(type)) {
        if (type.retour !== undefined) {
          m.ramasser(objet);
        }
        m.reagir(this, { genre: "objet", type, x: image.x, y: image.y });
      }
    }
  }

  // L'effet d'un objet. Faux : il n'a rien fait (trop grand pour l'orage, déjà en train de glisser...)
  private subir(type: TypeDObjet): boolean {
    const effet = type.effet;
    const malus = this.aide ? this.monde.aides.malus : 1;
    switch (effet.genre) {
      case "reserve":
        this.reserve = Math.min(this.monde.conduite.reserveMax, this.reserve + 1);
        return true;
      case "turbo":
        this.turbo = Math.max(this.turbo, effet.duree);
        return true;
      case "glisse":
        if (this.glisse > 0) {
          return false;
        }
        this.glisse = effet.duree * malus;
        this.adherenceGlisse = effet.adherence;
        return true;
      case "etourdi":
        if (this.geante > 0 || this.turbo > 0) {
          return false;                    // trop grand, ou trop rapide
        }
        this.etourdir(effet.duree * malus);
        return true;
      case "geant":
        this.geante = effet.duree;
        this.dureeGeante = effet.duree;
        this.etourdie = 0;
        return true;
    }
  }

  etourdir(duree: number) {
    this.etourdie = Math.max(this.etourdie, duree);
    this.monde.reagir(this, { genre: "etourdi" });
  }

  lancerTurbo() {
    if (this.reserve <= 0 || this.turbo > 0 || this.fini) {
      return;
    }
    this.reserve--;
    this.turbo = this.monde.conduite.turbo.duree;
    this.monde.reagir(this, { genre: "turbo" });
  }

  // Vrai s'il vient de finir un tour : son chemin dépasse un tour de circuit de plus.
  // Reculer par-dessus la ligne puis la repasser ne compte pas : le chemin, lui, a reculé aussi.
  aFiniUnTour(): boolean {
    return !this.fini && this.progres >= this.tour * this.monde.circuit.longueur;
  }

  // La ligne franchie au dernier tour. Un joueur est ramené tranquillement par l'ordinateur.
  franchirLArrivee(rang: number) {
    this.fini = true;
    this.tempsFinal = this.tempsTotal;
    this.rang = rang;
    if (this.humain) {
      this.pilote = true;
      this.niveau = NIVEAU_APRES_L_ARRIVEE;
    }
  }
}

// ===== Entre les véhicules =====

// Ceux qui se touchent se poussent : ils s'écartent, et échangent la part de leur vitesse qui les
// rapproche (celui de derrière ralentit, celui de devant est poussé). Un géant envoie valser les autres.
export function bousculer(coureurs: Coureur[], conduite: Conduite) {
  for (let i = 0; i < coureurs.length; i++) {
    for (let j = i + 1; j < coureurs.length; j++) {
      const a = coureurs[i];
      const b = coureurs[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const mini = conduite.rayonChoc * (a.echelle() + b.echelle());
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
      let force = conduite.choc;
      if (a.geante > 0 && b.geante <= 0 && b.turbo <= 0) {
        b.etourdir(0.9);
        force = conduite.choc * 2;
      }
      if (b.geante > 0 && a.geante <= 0 && a.turbo <= 0) {
        a.etourdir(0.9);
        force = conduite.choc * 2;
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

// Les places en course : ceux qui ont fini, dans l'ordre d'arrivée, puis les autres selon le chemin parcouru
export function ordreDeCourse(coureurs: Coureur[]): Coureur[] {
  const arrives = coureurs.filter((c) => c.fini).sort((a, b) => a.rang - b.rang);
  const restants = coureurs.filter((c) => !c.fini).sort((a, b) => b.progres - a.progres);
  return [...arrives, ...restants];
}

export interface Resultat {
  coureur: Coureur;
  rang: number;
  temps: number;
  estime: boolean;                         // pas fini : son temps est deviné d'après le chemin déjà fait
  points: number;
}

export function resultatsDeCourse(coureurs: Coureur[], longueurTotale: number, points: number[]): Resultat[] {
  return ordreDeCourse(coureurs).map((c, i) => ({
    coureur: c,
    rang: i + 1,
    temps: c.fini ? c.tempsFinal : c.tempsTotal * longueurTotale / Math.max(1, c.progres),
    estime: !c.fini,
    points: points[i] ?? 0,
  }));
}
