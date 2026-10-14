// Les réglages du Tamago : les chiffres de REGLES.md, à changer pour sentir la différence en jouant.
// Toutes les durées sont en millisecondes de JEU : le Tamago ne vit que quand son écran est affiché.

export const SECONDE = 1000;
export const MINUTE = 60 * SECONDE;

// Les jauges : 4 cœurs chacune
export const COEURS = 4;
export const PERTE_VENTRE = 3 * MINUTE;    // un cœur de Ventre en moins
export const PERTE_MORAL = 4 * MINUTE;     // un cœur de Moral en moins
export const BEBE_PLUS_VITE = 2;           // un bébé a faim et s'ennuie deux fois plus vite

// Les crottes
export const CROTTE_MIN = 4 * MINUTE;      // entre deux crottes...
export const CROTTE_MAX = 6 * MINUTE;      // ... (deux fois plus souvent chez un bébé)
export const CROTTES_MAX = 4;
export const CROTTE_FRAICHE = MINUTE;      // nettoyée avant ça, elle compte double pour la lignée Propre
export const MALADE_DES_CROTTES = 5 * MINUTE;
export const ROI_CACA_APRES = 2 * MINUTE;  // 4 crottes laissées tant que ça : le ROI CACA arrive
export const ROI_CACA_VIE = 5;

// Les appels
export const OUBLI_APRES = MINUTE;         // un appel ignoré tant que ça devient un oubli
export const CAPRICE_DUREE = MINUTE;       // un caprice qu'on ne gronde pas finit par passer

// La maladie et la fuite
export const DOSES_MIN = 1;
export const DOSES_MAX = 3;
export const PART_SI_MALADE = 10 * MINUTE;
export const PART_SI_VENTRE_VIDE = 10 * MINUTE;

// Grandir
export const OEUF_TAPES = 5;
export const OEUF_ECLOSION = 4 * SECONDE;  // après la 5e tape
export const DUREE_STADE = { bebe: 5 * MINUTE, enfant: 20 * MINUTE, ado: 40 * MINUTE };
export const UN_AN = 15 * MINUTE;          // l'âge affiché
export const LEGENDE_A = 2 * 60 * MINUTE;  // un adulte parfait devient une légende à cet âge (8 ans)
export const VIE_MAX = 5 * 60 * MINUTE;    // il repart sur sa planète à cet âge...
export const VIE_MIN = 3 * 60 * MINUTE;    // ... moins 15 minutes par oubli, jamais avant celui-ci
export const OUBLI_RACCOURCIT = 15 * MINUTE;

// La discipline : en quarts (0 à 4, soit 0 à 100 %). Les caprices de chaque stade, juste assez pour
// atteindre 100 % si on les gronde tous
export const CAPRICES = { bebe: 0, enfant: 3, ado: 1, adulte: 0 };
export const DISCIPLINE_GENTIL = { bebe: 0, enfant: 3, ado: 4 };   // pour la variante gentille, en fin de stade
export const OUBLIS_GENTIL = 2;           // au plus, pendant le stade

// Le poids de base de chaque stade ; le double rend malade
export const POIDS = { bebe: 5, enfant: 10, ado: 20, adulte: 30 };

// Les surprises (événements absurdes et visiteurs)
export const SURPRISE_MIN = 2 * MINUTE;
export const SURPRISE_MAX = 5 * MINUTE;

// La parole : une réplique de temps en temps
export const PAROLE_MIN = 8 * SECONDE;
export const PAROLE_MAX = 16 * SECONDE;

// Une caresse compte pour la lignée Stylée, mais pas plus d'une fois toutes les 30 secondes
export const CARESSE_COMPTE = 30 * SECONDE;

export const JOURNAL_MAX = 40;
export const SAUVEGARDE = "tamago";
