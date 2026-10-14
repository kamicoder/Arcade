// Un niveau : la fronde à gauche, le château et ses slimes à droite, la physique Matter (des blocs qui
// tombent, roulent, s'empilent et se cognent pour de vrai). Les calculs du tir et des chocs sont dans
// tir.ts ; ici, on les branche sur les objets de Phaser.
//
// Le déroulé d'un tir : « attente » (le château se pose), « pret » (un boulet dans la fronde),
// « vise » (on tire l'élastique), « vol » (le boulet est parti, tout bouge), puis, quand tout est calme,
// le boulet suivant... jusqu'à « fini » : plus de slime (gagné), ou plus de boulet (raté).

import Phaser from "phaser";
import { NIVEAUX, type Niveau as DonneesDuNiveau, type Bloc } from "../niveaux";
import { tirerJusqua, vitesseDuTir, tirParAngle, trajectoire, degats, etoiles, type Point } from "../tir";
import { garder } from "../progression";
import { paysage } from "../decor";
import {
  MONDE, ZOOM, SOL, FRONDE, REPOS, ZONE_DE_PRISE, BOULETS, FROTTEMENT_DE_L_AIR, ECART_DU_TRIPLE, MATIERES, FORMES,
  SLIMES, SEUIL_DE_CHOC, CALME_AU_DEBUT, VITESSE_CALME, TIR_MAX, POINTS_PAR_BOULET_RESTANT, SAUVEGARDE,
  type GenreDeBoulet, type Matiere, type GenreDeSlime,
} from "../reglages";
import { surTouche } from "../../../socle/clavier";
import { surManette, MANETTE } from "../../../socle/manette";
import { fonduPuis } from "../../../socle/retour";
import { appliquerLeSon, toucheDuSon } from "../../../socle/son";

export type Etat = "attente" | "pret" | "vise" | "vol" | "fini";

// Un objet du niveau, et ce qu'on sait de lui
interface Piece {
  image: Phaser.Physics.Matter.Image;
  sorte: "bloc" | "slime" | "boulet";
  matiere?: Matiere;
  forme?: Bloc["forme"];
  genre?: GenreDeSlime | GenreDeBoulet;
  vie: number;
  vieMax: number;
  detruite: boolean;
}

export interface DonneesDeNiveau {
  numero: number;
}

// Les débris et les gouttes, une gerbe par matière
const ECLATS = ["eclat-bois", "eclat-pierre", "eclat-glace", "goutte"];

export class Niveau extends Phaser.Scene {
  numero = 0;
  niveau!: DonneesDuNiveau;
  etat: Etat = "attente";
  score = 0;
  file: GenreDeBoulet[] = [];              // les boulets qui attendent leur tour
  boulet: Piece | null = null;             // celui de la fronde
  enVol: Piece[] = [];                     // ceux qui volent (trois, après la division du triple)
  slimes: Piece[] = [];
  blocs: Piece[] = [];
  angle = 35;                              // la visée au clavier : l'angle (degrés) et la force (0 à 1)
  force = 0.8;
  private pieces = new Map<Phaser.GameObjects.GameObject, Piece>();
  private elastique!: Phaser.GameObjects.Graphics;
  private elastiqueDevant!: Phaser.GameObjects.Graphics;
  private pointilles!: Phaser.GameObjects.Graphics;
  private enAttente: Phaser.GameObjects.Image[] = [];
  private gerbes = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();
  private calmeJusqua = 0;                 // pas de dégâts avant ce moment : le château se pose
  private calmeDepuis = 0;                 // depuis quand plus rien ne bouge
  private tirDepuis = 0;
  private divise = false;                  // le triple s'est déjà divisé
  private dernierBruit = 0;
  private quitte = false;

  constructor() {
    super({
      key: "catapulte-niveau",
      physics: {
        default: "matter",
        // Le sommeil : un bloc posé qui ne bouge plus s'endort, et les piles tiennent sans trembler.
        // Plus d'itérations que par défaut : des empilements plus solides.
        matter: { gravity: { x: 0, y: 1 }, enableSleeping: true, positionIterations: 10, velocityIterations: 8 },
      },
    });
  }

  init(donnees: DonneesDeNiveau) {
    this.numero = donnees.numero ?? 0;
    this.niveau = NIVEAUX[this.numero];
    this.etat = "attente";
    this.score = 0;
    this.file = [...this.niveau.boulets];
    this.boulet = null;
    this.enVol = [];
    this.slimes = [];
    this.blocs = [];
    this.pieces = new Map();
    this.enAttente = [];
    this.gerbes = new Map();
    this.divise = false;
    this.quitte = false;
  }

  create() {
    // Le monde entier se voit d'un coup : la caméra le réduit, centrée dessus
    this.cameras.main.setZoom(ZOOM).centerOn(MONDE.largeur / 2, MONDE.hauteur / 2).fadeIn(300);
    appliquerLeSon(this, SAUVEGARDE);
    paysage(this, MONDE.largeur, MONDE.hauteur, SOL);
    // Le sol : un rectangle immobile, bien plus large que l'écran (ce qui tombe au bord ne passe pas dessous)
    this.matter.add.rectangle(MONDE.largeur / 2, SOL + 100, MONDE.largeur * 3, 200, { isStatic: true, label: "sol", friction: 0.9 });

    for (const nom of ECLATS) {
      this.gerbes.set(nom, this.add.particles(0, 0, "catapulte-" + nom, {
        emitting: false, lifespan: { min: 500, max: 1000 }, speed: { min: 60, max: 260 }, angle: { min: 190, max: 350 },
        gravityY: 700, rotate: { min: 0, max: 360 }, alpha: { start: 1, end: 0 },
      }).setDepth(8));
    }

    for (const bloc of this.niveau.blocs) {
      this.poserUnBloc(bloc);
    }
    for (const place of this.niveau.slimes) {
      this.poserUnSlime(place.genre, place.x, place.y);
    }

    this.add.image(FRONDE.x, FRONDE.y, "catapulte-fronde").setDepth(1);
    this.elastique = this.add.graphics().setDepth(2);
    this.elastiqueDevant = this.add.graphics().setDepth(6);
    this.pointilles = this.add.graphics().setDepth(7);

    this.matter.world.on("collisionstart", (evenement: Phaser.Types.Physics.Matter.MatterCollisionData & { pairs: { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }[] }) =>
      this.chocs(evenement.pairs));
    this.ecouter();

    // Le château se pose, puis le premier boulet arrive dans la fronde
    this.calmeJusqua = this.time.now + CALME_AU_DEBUT;
    this.montrerLesBouletsEnAttente();
    this.time.delayedCall(CALME_AU_DEBUT, () => this.placerLeBoulet());
    this.scene.launch("catapulte-tableau");
  }

  // —— Le château ——

  private poserUnBloc(bloc: Bloc) {
    const [l, h] = FORMES[bloc.forme];
    const m = MATIERES[bloc.matiere];
    const image = this.matter.add.image(bloc.x, bloc.y, `catapulte-${bloc.matiere}-${bloc.forme}`, undefined, {
      label: "bloc", density: m.densite, friction: m.frottement, frictionStatic: m.frottement + 0.2, restitution: m.rebond,
      angle: ((bloc.angle ?? 0) * Math.PI) / 180, chamfer: { radius: 2 },
    });
    image.setDepth(3).setDisplaySize(l, h);
    const piece: Piece = { image, sorte: "bloc", matiere: bloc.matiere, forme: bloc.forme, vie: m.vie, vieMax: m.vie, detruite: false };
    this.pieces.set(image, piece);
    this.blocs.push(piece);
  }

  private poserUnSlime(genre: GenreDeSlime, x: number, y: number) {
    const fiche = SLIMES[genre];
    const image = this.matter.add.image(x, y, "catapulte-" + fiche.image, undefined, {
      label: "slime", shape: { type: "circle", radius: fiche.rayon }, density: 0.0015, friction: 0.9, frictionStatic: 1, restitution: 0.15,
    });
    // Le chef a sa couronne au-dessus du corps : l'image descend un peu par rapport au rond
    image.setDepth(4).setOrigin(0.5, genre === "chef" ? 0.6 : 0.52);
    const piece: Piece = { image, sorte: "slime", genre, vie: fiche.vie, vieMax: fiche.vie, detruite: false };
    this.pieces.set(image, piece);
    this.slimes.push(piece);
  }

  // —— La fronde et le tir ——

  private montrerLesBouletsEnAttente() {
    this.enAttente.forEach((image) => image.destroy());
    this.enAttente = this.file.map((genre, i) => {
      const fiche = BOULETS[genre];
      return this.add.image(FRONDE.x - 60 - i * 36, SOL - fiche.rayon, "catapulte-" + fiche.image).setDepth(3);
    });
  }

  private placerLeBoulet() {
    const genre = this.file.shift();
    this.montrerLesBouletsEnAttente();
    if (!genre || this.etat === "fini") {
      return;
    }
    const fiche = BOULETS[genre];
    const image = this.matter.add.image(REPOS.x, REPOS.y, "catapulte-" + fiche.image, undefined, {
      label: "boulet", shape: { type: "circle", radius: fiche.rayon }, density: fiche.densite, friction: 0.5, restitution: 0.3,
      frictionAir: FROTTEMENT_DE_L_AIR,
    });
    // Immobile dans la fronde jusqu'au tir. Rendu immobile APRÈS sa création : créé immobile (isStatic dans
    // ses options), Matter ne connaît pas encore sa masse, et le libérer lui donnerait une masse NaN.
    image.setStatic(true);
    // Il arrive en fondu (pas en grossissant : changer l'échelle d'une image Matter change aussi son corps)
    image.setDepth(5).setAlpha(0);
    this.tweens.add({ targets: image, alpha: 1, duration: 250 });
    const piece: Piece = { image, sorte: "boulet", genre, vie: 1, vieMax: 1, detruite: false };
    this.pieces.set(image, piece);
    this.boulet = piece;
    this.divise = false;
    this.etat = "pret";
    this.dessinerLElastique(REPOS);
  }

  // Le boulet suit l'élastique tiré jusqu'à ce point ; les pointillés montrent où il ira
  viser(pointeur: Point) {
    if (!this.boulet || (this.etat !== "pret" && this.etat !== "vise")) {
      return;
    }
    if (this.etat === "pret") {
      this.sound.play("catapulte-tension", { volume: 0.5 });
    }
    this.etat = "vise";
    const ou = tirerJusqua(pointeur);
    this.boulet.image.setPosition(ou.x, ou.y);
    this.dessinerLElastique(ou);
    this.pointilles.clear().fillStyle(0xffffff, 0.85);
    for (const [i, p] of trajectoire(ou, vitesseDuTir(ou)).entries()) {
      this.pointilles.fillCircle(p.x, p.y, Math.max(2, 5 - i * 0.18));
    }
  }

  // Lâcher l'élastique : trop peu tiré, le boulet revient ; sinon il part
  lacher() {
    if (this.etat !== "vise" || !this.boulet) {
      return;
    }
    const { x, y } = this.boulet.image;
    if (Math.hypot(x - REPOS.x, y - REPOS.y) < 20) {
      this.boulet.image.setPosition(REPOS.x, REPOS.y);
      this.pointilles.clear();
      this.dessinerLElastique(REPOS);
      this.etat = "pret";
      return;
    }
    this.tirer(vitesseDuTir({ x, y }));
  }

  // Le boulet part, à cette vitesse (en pixels par pas de physique)
  tirer(vitesse: Point) {
    const boulet = this.boulet;
    if (!boulet) {
      return;
    }
    this.boulet = null;
    // Réveillé d'abord : immobile dans la fronde, Matter l'a endormi au bout d'une seconde, et un corps
    // endormi ne bouge pas, même lancé
    boulet.image.setStatic(false).setAwake().setVelocity(vitesse.x, vitesse.y);
    this.enVol = [boulet];
    this.etat = "vol";
    this.tirDepuis = this.time.now;
    this.calmeDepuis = 0;
    this.pointilles.clear();
    this.dessinerLElastique(REPOS);
    this.sound.play("catapulte-tir");
  }

  // En vol, une tape ou Espace : le boulet triple se divise en trois
  pouvoir() {
    const boulet = this.enVol[0];
    if (this.etat !== "vol" || this.divise || !boulet || boulet.genre !== "triple" || boulet.detruite) {
      return;
    }
    this.divise = true;
    const { x, y } = boulet.image;
    const v = boulet.image.body!.velocity as Point;
    const vitesse = Math.hypot(v.x, v.y);
    const angle = Math.atan2(v.y, v.x);
    this.retirer(boulet);
    this.enVol = [-1, 0, 1].map((cote) => {
      const fiche = BOULETS.petit;
      const image = this.matter.add.image(x, y + cote * 10, "catapulte-" + fiche.image, undefined, {
        label: "boulet", shape: { type: "circle", radius: fiche.rayon }, density: fiche.densite, restitution: 0.3, frictionAir: FROTTEMENT_DE_L_AIR,
      });
      image.setDepth(5).setVelocity(Math.cos(angle + cote * ECART_DU_TRIPLE) * vitesse, Math.sin(angle + cote * ECART_DU_TRIPLE) * vitesse);
      const piece: Piece = { image, sorte: "boulet", genre: "petit", vie: 1, vieMax: 1, detruite: false };
      this.pieces.set(image, piece);
      return piece;
    });
    this.gerbes.get("goutte")!.explode(0, x, y);
    this.sound.play("catapulte-tension", { rate: 2 });
  }

  // L'élastique : deux bandes, des branches de la fronde jusqu'au boulet (celle de derrière passe sous lui)
  private dessinerLElastique(boulet: Point) {
    const gauche = { x: FRONDE.x - 20, y: FRONDE.y - 53 };
    const droite = { x: FRONDE.x + 20, y: FRONDE.y - 53 };
    this.elastique.clear().lineStyle(6, 0x5a2a12).lineBetween(droite.x, droite.y, boulet.x, boulet.y);
    this.elastiqueDevant.clear().lineStyle(6, 0x7a3a1a).lineBetween(gauche.x, gauche.y, boulet.x, boulet.y);
  }

  // —— Le clavier, la manette, le doigt et la souris ——

  private ecouter() {
    // Le doigt ou la souris : attraper le boulet (ou poser le doigt n'importe où à gauche), tirer, lâcher
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointeur: Phaser.Input.Pointer) => {
      if (this.etat === "vol") {
        this.pouvoir();
        return;
      }
      const p = { x: pointeur.worldX, y: pointeur.worldY };
      if (this.etat === "pret" && (Math.hypot(p.x - REPOS.x, p.y - REPOS.y) < ZONE_DE_PRISE || p.x < MONDE.largeur * 0.4)) {
        this.viser(p);
      }
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointeur: Phaser.Input.Pointer) => {
      if (this.etat === "vise" && pointeur.isDown) {
        this.viser({ x: pointeur.worldX, y: pointeur.worldY });
      }
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, () => this.lacher());

    // Le clavier et la manette : l'angle et la force, puis on tire ; en vol, le pouvoir du boulet
    const regler = (dAngle: number, dForce: number) => {
      if (this.etat !== "pret" && this.etat !== "vise") {
        return;
      }
      this.angle = Phaser.Math.Clamp(this.angle + dAngle, -10, 80);
      this.force = Phaser.Math.Clamp(Math.round((this.force + dForce) * 10) / 10, 0.3, 1);
      this.viser(tirParAngle(this.angle, this.force));
    };
    const espace = () => {
      if (this.etat === "vol") {
        this.pouvoir();
      } else if (this.etat === "pret") {
        this.viser(tirParAngle(this.angle, this.force));
        this.lacher();
      } else if (this.etat === "vise") {
        this.lacher();
      }
    };
    surTouche(this, "LEFT", () => regler(5, 0));
    surTouche(this, "RIGHT", () => regler(-5, 0));
    surTouche(this, "UP", () => regler(0, 0.1));
    surTouche(this, "DOWN", () => regler(0, -0.1));
    surTouche(this, "SPACE", espace);
    surTouche(this, "ENTER", espace);
    surTouche(this, "ESC", () => this.quitter());
    toucheDuSon(this, SAUVEGARDE);
    surManette(this, MANETTE.GAUCHE, () => regler(5, 0));
    surManette(this, MANETTE.DROITE, () => regler(-5, 0));
    surManette(this, MANETTE.HAUT, () => regler(0, 0.1));
    surManette(this, MANETTE.BAS, () => regler(0, -0.1));
    surManette(this, MANETTE.A, espace);
    surManette(this, [MANETTE.START, MANETTE.SELECT], () => this.quitter());   // en partie, Start : on s'en va
  }

  // —— Les chocs ——

  private chocs(paires: { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }[]) {
    if (this.time.now < this.calmeJusqua) {
      return;
    }
    for (const { bodyA, bodyB } of paires) {
      const a = bodyA.parent ?? bodyA;
      const b = bodyB.parent ?? bodyB;
      const relative = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
      if (relative <= SEUIL_DE_CHOC) {
        continue;
      }
      this.encaisser(a, b, relative);
      this.encaisser(b, a, relative);
    }
  }

  // Ce corps reçoit un choc de l'autre
  private encaisser(corps: MatterJS.BodyType, autre: MatterJS.BodyType, relative: number) {
    const piece = corps.gameObject ? this.pieces.get(corps.gameObject as Phaser.GameObjects.GameObject) : undefined;
    if (!piece || piece.detruite || piece.sorte === "boulet") {
      return;
    }
    const resistance = piece.matiere ? MATIERES[piece.matiere].resistance : 1;
    const coup = degats(relative, autre.mass, corps.mass, resistance);
    if (coup > 0 && relative > 3 && this.time.now - this.dernierBruit > 70) {
      this.dernierBruit = this.time.now;
      this.sound.play("catapulte-" + (piece.matiere ?? "slime"), { volume: Math.min(1, relative / 12) });
    }
    this.blesser(piece, coup);
  }

  // Des dégâts : abîmé à la moitié de sa vie, détruit à zéro
  blesser(piece: Piece, coup: number) {
    if (coup <= 0 || piece.detruite) {
      return;
    }
    piece.vie -= coup;
    if (piece.vie <= 0) {
      this.detruire(piece, true);
      return;
    }
    if (piece.sorte === "bloc" && piece.vie <= piece.vieMax / 2) {
      piece.image.setTexture(`catapulte-${piece.matiere}-${piece.forme}-abime`);
    } else if (piece.sorte === "slime") {
      const fiche = SLIMES[piece.genre as GenreDeSlime];
      piece.image.setTexture(`catapulte-${fiche.image}-aie`);
      this.sound.play("catapulte-ouille", { volume: 0.6 });
      this.time.delayedCall(500, () => !piece.detruite && piece.image.setTexture("catapulte-" + fiche.image));
    }
  }

  // Détruit : il éclate (« avecEclat ») et rapporte ses points ; tombé du monde, il disparaît seulement
  private detruire(piece: Piece, avecEclat: boolean) {
    piece.detruite = true;
    const { x, y } = piece.image;
    const points = piece.sorte === "bloc" ? MATIERES[piece.matiere!].points : piece.sorte === "slime" ? SLIMES[piece.genre as GenreDeSlime].points : 0;
    if (avecEclat) {
      const eclat = piece.sorte === "slime" ? "goutte" : MATIERES[piece.matiere!].eclat;
      this.gerbes.get(eclat)!.explode(piece.sorte === "slime" ? 24 : 12, x, y);
      if (piece.sorte === "slime") {
        this.sound.play("catapulte-slime");
      }
    }
    if (points > 0) {
      this.marquer(points, x, y);
    }
    this.retirer(piece);
    if (piece.sorte === "slime") {
      this.slimes = this.slimes.filter((s) => s !== piece);
    } else if (piece.sorte === "bloc") {
      this.blocs = this.blocs.filter((b) => b !== piece);
    }
    this.reveillerTout();
  }

  // Un bloc posé s'endort (Matter) ; quand une pièce disparaît, rien ne réveille ce qu'elle portait, qui
  // resterait en l'air. On réveille tout le château : ce qui n'est plus porté tombe, le reste se rendort.
  private reveillerTout() {
    for (const piece of this.pieces.values()) {
      const corps = piece.image.body as MatterJS.BodyType | null;
      if (corps?.isSleeping && !corps.isStatic) {
        piece.image.setAwake();
      }
    }
  }

  private retirer(piece: Piece) {
    piece.detruite = true;
    this.pieces.delete(piece.image);
    this.tweens.killTweensOf(piece.image);
    piece.image.destroy();
    this.enVol = this.enVol.filter((p) => p !== piece);
  }

  private marquer(points: number, x: number, y: number) {
    this.score += points;
    const texte = this.add.text(x, y - 20, String(points), {
      fontFamily: "system-ui, sans-serif", fontSize: points >= 500 ? "30px" : "20px", fontStyle: "bold",
      color: points >= 500 ? "#9cf08a" : "#ffffff", stroke: "#1c1a25", strokeThickness: 5,
    }).setOrigin(0.5).setDepth(9);
    this.tweens.add({ targets: texte, y: y - 70, alpha: 0, duration: 900, onComplete: () => texte.destroy() });
  }

  // —— Le temps : la fin d'un tir, ce qui tombe du monde ——

  update(temps: number, delta: number) {
    for (const piece of [...this.pieces.values()]) {
      const { x, y } = piece.image;
      if (y > MONDE.hauteur + 200 || x < -300 || x > MONDE.largeur + 300) {
        this.detruire(piece, false);
      }
    }
    if (this.etat !== "vol") {
      return;
    }
    const toutCalme = [...this.pieces.values()].every((p) => {
      const corps = p.image.body as MatterJS.BodyType | null;
      return !corps || corps.isStatic || corps.isSleeping || corps.speed < VITESSE_CALME;
    });
    this.calmeDepuis = toutCalme ? this.calmeDepuis + delta : 0;
    if (this.calmeDepuis > 600 || temps - this.tirDepuis > TIR_MAX) {
      this.finDuTir();
    }
  }

  private finDuTir() {
    for (const piece of this.enVol) {
      this.retirer(piece);
    }
    if (this.slimes.length === 0) {
      this.finir(true);
    } else if (this.file.length > 0) {
      this.etat = "attente";
      this.time.delayedCall(400, () => this.placerLeBoulet());
    } else {
      this.finir(false);
    }
  }

  private finir(gagne: boolean) {
    this.etat = "fini";
    const restants = this.file.length;
    let etoilesGagnees = 0;
    let record = false;
    if (gagne) {
      // Le total compte chaque boulet qu'il restait ; on le garde tout de suite, et les points de ces
      // boulets s'ajoutent ensuite au score affiché, un par un
      etoilesGagnees = etoiles(restants);
      record = garder(this.numero, { etoiles: etoilesGagnees, score: this.score + restants * POINTS_PAR_BOULET_RESTANT });
      this.enAttente.slice(0, restants).forEach((image, i) => this.time.delayedCall(300 * i, () => {
        this.marquer(POINTS_PAR_BOULET_RESTANT, image.x, image.y - 30);
      }));
    }
    this.sound.play(gagne ? "catapulte-victoire" : "catapulte-defaite");
    this.time.delayedCall(gagne ? 300 * restants + 600 : 500, () => {
      this.scene.launch("catapulte-fin", { gagne, etoiles: etoilesGagnees, score: this.score, record });
    });
  }

  // —— Partir ——

  rejouer() {
    this.scene.stop("catapulte-fin");
    this.scene.stop("catapulte-tableau");
    this.scene.restart({ numero: this.numero });
  }

  suivant() {
    this.scene.stop("catapulte-fin");
    this.scene.stop("catapulte-tableau");
    fonduPuis(this, () => this.scene.restart({ numero: this.numero + 1 }));
  }

  quitter() {
    if (this.quitte) {
      return;
    }
    this.quitte = true;
    fonduPuis(this, () => {
      this.scene.stop("catapulte-tableau");
      this.scene.stop("catapulte-fin");
      const menu = this.scene.get("catapulte-menu") as Phaser.Scene & { choisi: number };
      menu.choisi = this.numero;
      this.scene.start("catapulte-menu");
    });
  }
}
