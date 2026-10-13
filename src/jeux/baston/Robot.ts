// Un robot de combat : sa place dans l'arène, et ce qu'il sait faire.
//
// C'est un Sprite de la physique Arcade : son corps (body) tombe tout seul (la gravité de la scène),
// s'arrête sur le sol (le bord du monde) et ne sort pas de l'arène. Nous, on décide de sa vitesse,
// et surtout de son ÉTAT : ce qu'il fait en ce moment. Une seule donnée, « etat », plutôt que dix
// vrai/faux qui pourraient se contredire (frapper ET sauter ?). L'animation suit l'état.

import Phaser from "phaser";
import type { Commandes } from "./commandes";
import { tirNormal, type Corps, type Modele, type PlanDeTir } from "./modeles";
import { Tir } from "./Tir";
import { cleDePlanche, cleDAnimation, type CouleurDeRobot } from "./textures";
import type { VueDeRobot } from "./ordi";
import {
  SOL, ECHELLE, CORPS, VIE, JAUGE, TIRS, DUREE, ELAN, ACTIF, POING, RECUL, RECUL_FREIN,
  JAUGE_POING, JAUGE_TIR, JAUGE_ENCAISSE, PROFONDEUR,
} from "./reglages";
import { LARGEUR } from "../../socle/style";

export type Etat = "repos" | "marche" | "saut" | "attaque" | "tir" | "special" | "touche" | "ko";

export class Robot extends Phaser.Physics.Arcade.Sprite implements VueDeRobot {
  declare body: Phaser.Physics.Arcade.Body;

  readonly couleur: CouleurDeRobot;
  readonly teinte: number;                 // sa couleur en nombre : barres, tirs
  readonly modele: Modele;
  readonly tirs: Phaser.Physics.Arcade.Group;   // ses tirs qui filent dans l'arène

  vie = VIE;
  jauge = 0;                               // elle se remplit quand il touche, et quand il est touché
  etat: Etat = "repos";
  minuteur = 0;                            // secondes qu'il reste à l'état en cours (0 : pas de fin prévue)
  invincible = 0;                          // secondes d'invincibilité qu'il lui reste
  recul = 0;                               // sa vitesse de recul quand il est touché (pixels/s)
  direction: 1 | -1 = 1;
  private frappait = false;                // la commande « frapper » était-elle déjà là à l'image d'avant ?

  constructor(scene: Phaser.Scene, x: number, couleur: CouleurDeRobot, teinte: number, modele: Modele) {
    super(scene, x, SOL, cleDePlanche(couleur), "repos-0");
    this.couleur = couleur;
    this.teinte = teinte;
    this.modele = modele;

    // Les pieds au milieu du bas de l'image : on le pose sur le sol, et il se retourne sur place
    this.setOrigin(0.5, 1).setScale(ECHELLE).setDepth(PROFONDEUR.robots);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    // Le corps est plus étroit que la case (qui a la place du bras tendu). La taille et le décalage
    // se donnent en pixels de la case, avant l'agrandissement : Phaser multiplie par l'échelle.
    const largeur = CORPS.largeur / ECHELLE;
    this.body.setSize(largeur, CORPS.hauteur / ECHELLE, false);
    this.body.setOffset((this.frame.width - largeur) / 2, this.frame.height - CORPS.hauteur / ECHELLE);
    this.body.setCollideWorldBounds(true);

    this.tirs = scene.physics.add.group();
    this.play(cleDAnimation(couleur, "repos"));
  }

  // ===== Où il est =====

  get centreX(): number {
    return this.body.x + this.body.width / 2;
  }

  corps(): Corps {
    const b = this.body;
    return { gauche: b.x, droite: b.right, haut: b.y, bas: b.bottom, centreX: this.centreX, direction: this.direction };
  }

  // La HURTBOX : la zone qui a mal (son corps)
  hurtbox(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.body.x, this.body.y, this.body.width, this.body.height);
  }

  get enLAir(): boolean {
    return !this.body.blocked.down;
  }

  // Ce que le cerveau de l'ordinateur regarde
  get listeDesTirs(): Tir[] {
    return this.tirs.getChildren() as Tir[];
  }

  // ===== Ce qu'il fait =====

  // Il change d'état ; duree : les secondes que durera ce nouvel état (0 : pas de fin prévue).
  // Un nouvel état : son animation reprend au début.
  passer(etat: Etat, duree = 0) {
    if (etat !== this.etat) {
      this.play(cleDAnimation(this.couleur, etat));
    }
    this.etat = etat;
    this.minuteur = duree;
  }

  // duree : les secondes de jeu de cette image (moins qu'en vrai, pendant le ralenti)
  mettreAJour(commandes: Commandes, duree: number) {
    this.invincible = Math.max(0, this.invincible - duree);

    // Il retombe sur le sol : le saut est fini (vitesse ≥ 0 : pas au moment même où il décolle)
    if (this.etat === "saut" && !this.enLAir && this.body.velocity.y >= 0) {
      this.passer("repos");
    }
    // Un état qui a une fin : on la compte. En l'air, il retombe en saut.
    if (this.minuteur > 0) {
      this.minuteur -= duree;
      if (this.minuteur <= 0) {
        this.passer(this.enLAir ? "saut" : "repos");
      }
    }

    // Un nouvel appui seulement : garder la touche ne refrappe pas
    const frappe = commandes.frapper && !this.frappait;
    this.frappait = commandes.frapper;

    let marche = 0;
    if (this.etat === "repos" || this.etat === "marche") {
      // Au sol, les mains libres : il peut tout faire
      if (frappe) {
        this.passer("attaque", DUREE.attaque);
      } else if ((commandes.tirer || commandes.special) && this.jauge >= JAUGE) {
        this.lancerLeSpecial();
      } else if (commandes.tirer && this.tirs.getLength() < TIRS) {
        this.tirer();
      } else if (commandes.saut) {
        this.body.setVelocityY(this.modele.saut);
        this.passer("saut");
      } else {
        marche = this.marcher(commandes);
        this.passer(marche !== 0 ? "marche" : "repos");
      }
    } else if (this.etat === "saut") {
      marche = this.marcher(commandes);    // en l'air, il se dirige, mais il ne frappe pas
    }

    // Touché, il glisse en arrière, de moins en moins vite
    this.body.setVelocityX(marche + this.recul);
    this.recul *= Math.pow(RECUL_FREIN, duree * 60);
    if (Math.abs(this.recul) < 60) {
      this.recul = 0;                      // moins d'un pixel par tour : il s'arrête
    }

    // Un tir sorti de l'arène disparaît
    for (const tir of this.listeDesTirs.slice()) {
      if (tir.x + tir.width / 2 < 0 || tir.x - tir.width / 2 > LARGEUR) {
        tir.destroy();
      }
    }

    // Invincible, il clignote : 4 tours sur 8, on ne le voit pas
    const tours = Math.ceil(this.invincible * 60);
    this.setVisible(this.etat === "ko" || tours % 8 < 4);
  }

  private marcher(commandes: Commandes): number {
    return ((commandes.droite ? 1 : 0) - (commandes.gauche ? 1 : 0)) * this.modele.vitesse;
  }

  private lancer(plan: PlanDeTir, special: boolean) {
    new Tir(this.scene, this.tirs, plan, this.teinte, special);
  }

  private tirer() {
    this.lancer(tirNormal(this.corps()), false);
    this.scene.sound.play("baston-tir");
    this.passer("tir", DUREE.tir);
  }

  private lancerLeSpecial() {
    this.jauge = 0;                        // le coup spécial vide la jauge
    for (const plan of this.modele.tirsSpeciaux(this.corps())) {
      this.lancer(plan, true);
    }
    this.scene.sound.play("baston-special");
    this.passer("special", DUREE.special);
    this.emit("special", this);            // la scène en fait du spectacle
  }

  // Il se tourne vers l'autre robot
  regarder(autre: Robot) {
    this.direction = autre.centreX > this.centreX ? 1 : -1;
    this.setFlipX(this.direction === -1);
  }

  remplir(points: number) {
    this.jauge = Math.min(JAUGE, this.jauge + points);
  }

  // ===== Les coups =====

  // Les trois temps d'un coup de poing : l'élan, l'actif (il fait mal), puis la récupération
  phaseDuCoup(): "elan" | "actif" | "recuperation" {
    const ecoule = DUREE.attaque - this.minuteur;
    if (ecoule < ELAN) {
      return "elan";
    }
    return ecoule < ELAN + ACTIF ? "actif" : "recuperation";
  }

  // La HITBOX du coup : le rectangle qui fait mal, devant lui (null s'il ne frappe pas)
  poing(): Phaser.Geom.Rectangle | null {
    if (this.etat !== "attaque" || this.phaseDuCoup() !== "actif") {
      return null;
    }
    const x = this.direction === 1 ? this.body.right : this.body.x - POING.largeur;
    const y = this.body.y + POING.hauteurDepuisLeHaut - POING.hauteur / 2;
    return new Phaser.Geom.Rectangle(x, y, POING.largeur, POING.hauteur);
  }

  // Son poing (sa hitbox de cette image, prise avant les coups) et ses tirs contre le corps de la cible.
  // Un tir qui ne touche pas (la cible est invincible) passe à travers.
  toucher(cible: Robot, poing: Phaser.Geom.Rectangle | null) {
    if (poing && Phaser.Geom.Intersects.RectangleToRectangle(poing, cible.hurtbox())) {
      if (cible.encaisser(this.modele.degats, this.direction)) {
        this.remplir(JAUGE_POING);
      }
    }
    // La physique trouve les tirs qui chevauchent la cible. On ne les détruit qu'après :
    // pas pendant qu'elle parcourt le groupe.
    const arrives: Tir[] = [];
    this.scene.physics.overlap(cible, this.tirs, (_cible, objet) => {
      const tir = objet as Tir;
      if (cible.encaisser(tir.degats, tir.direction)) {
        this.remplir(JAUGE_TIR);
        arrives.push(tir);
      }
    });
    arrives.forEach((tir) => tir.destroy());
  }

  // Il reçoit un coup qui le pousse vers « direction ». Renvoie true si le coup l'a vraiment touché.
  encaisser(degats: number, direction: number): boolean {
    if (this.invincible > 0 || this.etat === "ko") {
      return false;                        // il vient d'être touché, ou il est déjà K.O.
    }
    this.vie = Math.max(0, this.vie - degats);
    this.invincible = DUREE.invincible;
    this.recul = direction * RECUL;
    this.remplir(JAUGE_ENCAISSE);          // encaisser remplit aussi la jauge : de quoi se venger
    if (this.vie === 0) {
      this.passer("ko");                   // plus de vie : K.O., pour de bon
    } else {
      this.passer("touche", DUREE.touche);
    }
    return true;
  }
}
