# L'Arcade

Nos mini jeux dans le navigateur et sur téléphone : un seul jeu Phaser 4 (TypeScript + Vite), un Hub
pour choisir, et chaque jeu chargé seulement quand on le lance. Publié sur GitHub Pages, installable
(PWA), jouable sans réseau. Voir `README.md` pour les commandes et le rangement du code.

## Pour qui, et comment travailler

- L'utilisateur **apprend Phaser**. Les jeux de l'Arcade, c'est Claude qui les écrit ; pour apprendre,
  l'utilisateur fera un jeu de zéro, **lui au clavier, Claude en guide** : dans ce cas, ne pas écrire
  le code à sa place, mais expliquer, indiquer la doc et les exemples Phaser, relire ce qu'il écrit.
  `docs/CARNET-PHASER.md` (leçons 1 et 2, sur le Hub et la voiture) reste une référence ; pas besoin
  d'y ajouter une leçon à chaque nouveau jeu.
- **Coller à la philosophie Phaser** : scènes, objets de jeu, tweens, minuteries (`this.time`), caméra,
  physique Arcade, particules, plutôt que du code maison. Les jeux sont petits : on les réécrit à la
  manière de Phaser, on ne porte pas l'ancien code ligne à ligne. Exception assumée : quand l'outil
  Phaser dessert le jeu (voir la bousculade des voitures dans le carnet, leçon 2).
- Les calculs propres au jeu (circuits, trace, pilote de l'ordinateur...) restent du TypeScript pur, à
  part des scènes.
- Tout en **français** : identifiants, commentaires (qui disent pourquoi), textes du jeu, messages.
- Rien n'est commité, poussé ni publié sans que l'utilisateur le demande : un push sur `main` met à jour
  le site et tous les téléphones.
- Les dernières versions des paquets npm sont les bienvenues.

## Git

- Une histoire **linéaire**, sans commit de fusion : un commit par changement qui a un sens (un jeu, un
  mode, une correction), messages en français. Ce qui accompagne le changement (tests, `CLAUDE.md`,
  une retouche) va **dans le même commit**, pas dans une suite de petits commits.
- Le travail d'un agent dans une autre copie (worktree) s'intègre en le rejouant sur `main`
  (`git rebase --onto main <sa base> <sa branche>`), écrasé en un commit, après relecture et tests.
- Ne réécrire que ce qui n'est pas encore publié : un push sur `main` met le site à jour.

## Vérifier

```sh
npm run check      # les types
npm test           # Playwright joue dans le Edge du poste, au clavier et au doigt
npm run build
```

Les tests lisent l'état du jeu à travers `window.jeu`, qui n'existe qu'en développement (`main.ts`).
Un nouveau jeu ou un nouveau mode vient avec ses tests dans `tests/`. Dans un test, passer par
`appuyer()` (de `tests/outils.ts`) plutôt que `keyboard.press` enchaînés, et pour ouvrir un jeu au doigt,
`toucherLaCarte(page, cle)` (les cartes du Hub changent de place quand un jeu arrive). Pour quitter une partie,
`quitterParLaPause(page)` ; un bouton de manette que plusieurs scènes lisent (la fin et la partie derrière),
`manetteAToutes(page, scenes, bouton)`, dans l'ordre de Phaser (la scène du dessus d'abord). Les tests tournent
en parallèle un par un (`fullyParallel`) : après une action, attendre l'état voulu (`waitForFunction`)
plutôt que le lire tout de suite, une image peut tarder quand dix navigateurs jouent en même temps. Si le
poste travaille déjà (une autre compilation), des tests qui jouent en temps réel échouent par manque de
processeur : `npx playwright test --workers=4` avant de conclure à un défaut. Un test ne vérifie un
comportement qu'une fois : le code commun à plusieurs jeux (ou aux deux thèmes de la course) n'est testé
qu'à un endroit.

## Le socle (`src/socle/`) : à utiliser plutôt que les appels Phaser directs

Chaque fichier dit en tête pourquoi il existe.

- `surTouche(scene, "ENTER", action)` au lieu de `keyboard.on("keydown-...")` (un défaut de Phaser 4.2) ;
  `surChaqueTouche(scene, action)` pour toutes les touches, avec l'événement du navigateur.
- `fonduPuis(scene, action)` au lieu de `camera.fadeOut()` ; `retourAuHub(scene)` pour quitter un jeu.
- `surManette(scene, MANETTE.B, action)` (`manette.ts`) au lieu de `gamepad.on("down")` et ses numéros : dans les
  menus, listes et fins, A ou Start valide (`VALIDER`), B revient ; en partie, chaque jeu décide. Le stick gauche
  fait comme la croix (un coup, un pas) partout où l'on écoute ses directions.
- `uneSeuleFois()` (`fin.ts`) : une garde contre un double départ (rejouer OU revenir) ; `ecranDeFin(scene, ...)` :
  l'écran « GAME OVER » à deux boutons (tir, platformer).
- `mettreEnPause(scene, { quitter, autres, possible, ... })` (`pause.ts`) : la pause par-dessus la partie, « Reprendre »
  et « Le menu » ; Échap, P, Start, et d'elle-même quand le jeu perd la main. Elle rend la fonction qui l'ouvre, pour
  le ⏸ (`boutonPause`) du tableau de bord. `possible` la fait taire quand la fin est affichée (tir, platformer,
  démineur ; la course a la sienne).
- `ListeDeBoutons` (`listeDeBoutons.ts`) : des boutons les uns sous les autres, au clavier, à la manette, à la souris
  et au doigt (titre et fin de la baston, menu du platformer, la pause).
- `BoutonsAuDoigt` (`doigts.ts`) : des ronds tenus au doigt, plusieurs à la fois (platformer, course, baston) ;
  chaque jeu dessine et éclaire ses ronds.
- `boutonDuSon(scene, cle)`, `toucheDuSon`, `appliquerLeSon` (`son.ts`) : le son coupé ou remis (M), rangé sous
  `<cle>/son` ; `retourAuHub` le remet. Ne jamais relire `sound.mute` (voir `docs/PIEGES-PHASER.md`).
- `TouchesPhysiques` : une touche qui sert à **jouer** se reconnaît à sa place (`event.code`, « KeyW » = le
  Z d'un AZERTY) ; une touche qui sert à écrire, ou un raccourci nommé par sa lettre (M pour le son), à
  sa lettre. `etiquette(code)` donne ce qui est écrit sur la touche de ce clavier.
- `elargir(scene)` : au doigt, le jeu prend la proportion du téléphone ; ses scènes se placent alors
  d'après `this.scale.width`, pas `LARGEUR`.
- `barreDeChargement(scene, couleur)` dans le preload de chaque jeu (elle demande aussi la disposition du
  clavier) ; `annoncer(scene, texte, ...)` pour une annonce en grand ; `boutonFermer` pour un ✕.
- `lire` / `ecrire` / `oublier` / `oublierTout` (sauvegardes), `estTactile()`, `boutonArcade(scene)` (le
  « ← Arcade » de chaque menu), `quandNouvelleVersion` (mise à jour au Hub seulement, jamais en pleine partie).
- `SourisCapturee` (`souris.ts`) : quand un objet suit le curseur (la raquette, le vaisseau), un clic capture la
  souris (elle ne sort plus du jeu) ; Échap la rend et met en pause.
- `vibrer(scene, "leger" | "moyen" | "fort", manette?)` (`vibration.ts`) : la manette et le téléphone vibrent (un
  choc, un coup reçu, un K.O.) ; ce que le navigateur ne sait pas faire ne fait rien.
- `rendu.ts` : WebGL, ou canvas 2D quand le WebGL de l'appareil tourne au processeur (`?rendu=canvas` ou
  `?rendu=webgl` dans l'adresse l'impose ; les tests ouvrent en WebGL). En canvas, il refait les teintes que
  Phaser ignore.
- `correctifs.ts` : les défauts de Phaser réparés en attendant une version qui les corrige.

## Ajouter un jeu

Un dossier `src/jeux/<cle>/` dont `index.ts` exporte par défaut `{ scenes, premiere }` (type
`ModuleDeJeu`, avec des `donnees` de départ si besoin), et sa fiche dans `src/jeux/catalogue.ts`. Les
noms de scène commencent par la clé du jeu (`course-piste`). L'ordre de `scenes` est l'ordre d'affichage :
une scène lancée par-dessus (tableau de bord, arrivée) vient après. Ses sons et images vont dans
`public/<cle>/`.

La course est un seul jeu avec des thèmes (voitures, licornes) : avant d'y toucher, lire
`src/jeux/course/LISEZMOI.md`. Le Tamago a ses règles dans `src/jeux/tamago/REGLES.md` : les garder à jour
quand elles changent. Les images de la catapulte sont des PNG dessinés en code (`outils/catapulte/`) : les
retoucher là, puis les redessiner, plutôt que de modifier les PNG.

## Les pièges de Phaser

`docs/PIEGES-PHASER.md` : ce que Phaser fait exprès mais qu'on ne devine pas, ce qui a changé depuis
Phaser 3 (les exemples en ligne sont souvent écrits pour lui), et les défauts de la 4.2 déjà contournés.
Le lire avant d'écrire un jeu ; y ajouter chaque piège nouveau, rangé à sa place. Quand Phaser surprend,
lire sa source (`node_modules/phaser/src/`) avant de contourner, et tester par le vrai chemin (la
physique, le clavier) plutôt qu'en appelant la fonction à la main.

## D'où viennent les jeux

Les jeux viennent des ateliers de PixelForge (`C:\Data\PixelForge\ateliers\`) et des anciennes versions
en JavaScript pur (`C:\Data\Jeux\Voiture`, `C:\Data\Jeux\Licorne`, publiées sur kamicoder.github.io).
Les anciens jeux ne servent plus que de **référence pour le comportement** : l'Arcade ne garde pas la
compatibilité de leurs sauvegardes. Un défaut de jeu trouvé ici existe peut-être aussi là-bas : le
signaler à l'utilisateur.

Les idées pour améliorer les jeux, relevées par des agents et à trier par l'utilisateur : `docs/IDEES.md` (en
retirer ce qui est fait). Pistes ouvertes : les petits outils de socle que les agents ont réclamés (saisie de texte, couleurs,
fondu de toutes les caméras).
