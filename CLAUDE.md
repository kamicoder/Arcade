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
`appuyer()` (de `tests/outils.ts`) plutôt que `keyboard.press` enchaînés.

## Le socle (`src/socle/`) : à utiliser plutôt que les appels Phaser directs

- `surTouche(scene, "ENTER", action)` au lieu de `keyboard.on("keydown-...")` : Phaser 4.2 traite deux
  fois un appui dont le relâchement tombe dans la même image. `surChaqueTouche(scene, action)`, son
  cousin, reçoit l'événement du navigateur (sa place `code`, sa lettre `key`) pour toutes les touches.
- `fonduPuis(scene, action)` au lieu de `camera.fadeOut()` : un `fadeOut` lancé pendant un autre fondu
  (le `fadeIn` d'arrivée) est ignoré, et la transition reste bloquée.
- `retourAuHub(scene)` arrête toutes les scènes du jeu et revient au Hub (en 960 × 540).
- `elargir(scene)` (`largeur.ts`) : au doigt, le jeu prend la proportion du téléphone (hauteur 540, largeur
  jusqu'à 1 296) au lieu des bandes noires du mode FIT. La baston s'en sert ; ses scènes se placent alors
  d'après `this.scale.width`, pas `LARGEUR`. `suivreLaLargeur(scene)` relance un menu quand l'écran change
  de forme.
- `TouchesPhysiques` : les touches tenues d'après leur **place** (`event.code`, « KeyW » = le Z d'un AZERTY),
  pour deux joueurs sur un même clavier ; Phaser, lui, reconnaît les touches à la lettre (`keyCode`).
  Une touche qui sert à jouer se reconnaît à sa place ; une touche qui sert à écrire, ou un raccourci
  nommé par sa lettre (M pour le son, N pour nouveau), à sa lettre. `etiquette(code)` donne ce qui est
  écrit sur la touche de ce clavier (« Z » pour « KeyW » en AZERTY), après `chargerLaDisposition()` au
  chargement du jeu.
- `lire` / `ecrire` (sauvegardes protégées), `estTactile()`, `quandNouvelleVersion` (mise à jour au
  Hub seulement, jamais en pleine partie).

## Ajouter un jeu

Un dossier `src/jeux/<cle>/` dont `index.ts` exporte par défaut `{ scenes, premiere }` (type
`ModuleDeJeu`, avec des `donnees` de départ si besoin), et sa fiche dans `src/jeux/catalogue.ts`. Les
noms de scène commencent par la clé du jeu (`course-piste`). L'ordre de `scenes` est l'ordre d'affichage :
une scène lancée par-dessus (tableau de bord, arrivée) vient après. Ses sons et images vont dans
`public/<cle>/`.

## Le jeu de course et ses thèmes (`src/jeux/course/`)

Un seul jeu de course, et des **thèmes** : « voitures » et « licornes ». Le jeu est écrit une fois : les
scènes (`scenes/` : chargement, menu, choix du circuit, course, tableau de bord, arrivée, pause, Grand
Prix et podium, atelier, éditeur), la conduite calculée à la main, le pilote de l'ordinateur, la barrière,
le repêchage et la bousculade (`Coureur.ts`, sans physique Arcade), les circuits et leur trace
(`circuits.ts`), les sauvegardes (`sauvegarde.ts`), le son et la musique (`son.ts`), les boutons et textes
(`interface.ts`). Tous les modes sont communs : Grand Prix, contre l'ordinateur, à deux (avec ou sans
rivaux), contre la montre et son fantôme, atelier, circuit dessiné, niveaux Facile / Normal / Expert.

Un thème (`themes/<nom>/`, l'interface `Theme` de `theme.ts`, documentée champ par champ) n'apporte que
des données et des dessins : son habillage (police, couleurs, fond des menus, fête), ses mots
(« licorne » / « voiture », « 1re » / « 1er »...), ses réglages de conduite et ses niveaux (chaque thème se
conduit comme avant), la largeur de sa route et sa barrière, ses circuits et son Grand Prix (la liste
des courses et le niveau des rivaux), ses objets, ses sons, sa musique, et un `DecorDeCourse` qui
dessine une course (la vue de chaque véhicule, les objets, les gerbes, les traces) et réagit à ses
événements (`Evenement` : une foulée, la barrière, un objet touché...).

- **Les objets** : chaque type déclare son effet, pris dans la liste du jeu (`Effet` : `reserve` pour un
  turbo à garder, `turbo`, `glisse`, `etourdi`, `geant`), sa portée, s'il disparaît et revient (`retour`),
  s'il attend avant de reservir (`attente`), ou s'il se pose tout seul le long du tour (`auto`). Les
  circuits placent les autres par type : `objets: { bidons: [[place, decalage], ...] }`.
- **L'atelier** est commun. Un thème déclare son équipe (`equipe` : les véhicules de départ, chacun une
  `Apparence` avec au moins un `nom`), ses `rubriques` (un champ de l'apparence, son libellé, la liste de
  ses choix, et comment les montrer : `"couleur"`, `"couleurs"`, ou une fonction qui donne un texte),
  `completer` (ce qui se déduit, comme l'ombre d'une robe), `couleur` (sa couleur au tableau de bord), et
  `vehicule.texture` qui dessine une apparence (une animation `<cle>-anim` si `anime`). Le joueur 1 et
  le joueur 2 choisissent chacun un véhicule de l'équipe ; les rivaux sont les autres.
- **Les sauvegardes**, toutes en JSON par `lire` / `ecrire`, sous une seule forme :
  `course/<theme>/niveau`, `.../son`, `.../joueurs` ([j1, j2]), `.../rivaux`, `.../circuit` (le dernier
  choisi), `.../circuit-dessine`, `.../record/<circuit>`, `.../perso/<numero>` (ce que l'atelier a changé à
  ce véhicule de l'équipe), et `course/theme` (le dernier thème joué).
- **Ajouter un thème** (des fusées, des escargots...) : un dossier `themes/<nom>/` dont l'`index.ts`
  exporte un `Theme` (s'inspirer de `voitures/`, le plus court), une ligne dans `themes/index.ts`, et
  une carte dans `catalogue.ts` : `import("./course").then((m) => m.courseAuTheme("<nom>"))`.
- **Le Hub** a une carte par thème, qui lance le même jeu avec son thème. Pour une seule carte,
  `courseAuTheme()` sans thème : le menu propose alors de changer de thème (touche T).

Les tests sont dans `tests/course.spec.ts` ; les premiers jouent la même course dans chaque thème.

## Pièges de Phaser 4 déjà rencontrés

- La teinte « pleine » : `setTint(c).setTintMode(Phaser.TintModes.FILL)` (plus de `setTintFill`).
- Une `RenderTexture` n'affiche ses tampons qu'après `render()`.
- `Graphics.strokePoints` / `fillPoints` veulent des `Phaser.Math.Vector2` (les types refusent `{ x, y }`).
- Les sons ne sont pas des objets de la scène : les détruire à son `SHUTDOWN`. Idem pour les écouteurs
  posés sur une **autre** scène.
- Les corps Arcade ne tournent pas : un rond (`setCircle`) pour ce qui tourne.
- Dans `update()`, `sprite.x` a **un pas de physique de retard** : Phaser avance le corps avant `update()`
  et ne recopie sa place sur l'image qu'après. Pour une décision qui dépend de la place exacte (une
  barrière, une collision faite à la main), lire `body.center`. Une voiture restait coincée contre les pneus
  (c'est une des raisons pour lesquelles la course calcule maintenant sa conduite à la main).
- Un appui bref (enfoncé et relâché dans la même image, ou une tape au doigt) n'est jamais vu « tenu » :
  pour un coup ou un saut, retenir l'appui jusqu'à l'image suivante (voir `baston/commandes.ts`).
- Un `Rectangle` arrondi ne se redessine que par `setSize` (changer `.width` casse les coins).
- Les effets de caméra (`zoomTo`, `pan`) veulent une fonction d'ease (`Phaser.Math.Easing.Sine.Out`),
  pas son nom en texte comme les tweens.
- `scale.setGameSize` : seules les caméras placées en (0, 0) et à la taille d'avant suivent la nouvelle
  taille (celles des scènes arrêtées aussi). Son événement `RESIZE` est le même que celui d'une fenêtre qui
  change de forme : pour les distinguer, comparer `gameSize.width` à la largeur d'avant (4e argument).
- `scene.restart` garde le `timeScale` et la pause de la physique, de l'horloge et des tweens : les remettre
  dans `create`. Et pour la physique, le ralenti est à l'envers : `world.timeScale = 3` ralentit.
- `physics.add.group()` remet à zéro la vitesse et la gravité de chaque objet qu'on y ajoute : pour des
  objets déjà réglés, un groupe simple (`add.group()`).
- Avec plusieurs pas de physique par image, un `overlap` peut revenir au pas suivant même après
  `body.enable = false` : protéger ce qui ne doit compter qu'une fois (une pièce, un ennemi écrasé).
- Plusieurs caméras (écran partagé, éditeur) : chaque objet doit être ignoré par les caméras qui ne
  doivent pas le montrer (`camera.ignore`), sinon il s'affiche et répond aux clics deux fois. Et
  `fonduPuis` n'assombrit que la caméra principale.
- Une scène en pause n'entend plus le clavier : une touche lâchée pendant la pause reste « tenue ».
- Retirer une texture encore affichée casse l'affichage. Une `TileSprite` dont la texture se répète
  « bave » d'un bord sur l'autre : une marge transparente règle le problème.
- `document.fonts.check(...)` répond vrai pour une police inconnue : chercher dans `document.fonts`.

## D'où viennent les jeux

Les jeux viennent des ateliers de PixelForge (`C:\Data\PixelForge\ateliers\`) et des anciennes versions
en JavaScript pur (`C:\Data\Jeux\Voiture`, `C:\Data\Jeux\Licorne`, publiées sur kamicoder.github.io).
Les anciens jeux ne servent plus que de **référence pour le comportement** : l'Arcade ne garde pas la
compatibilité de leurs sauvegardes (elle range les siennes à sa façon, voir la course). Un défaut de
jeu trouvé ici existe peut-être aussi là-bas : le signaler à l'utilisateur.

Avancement : les jeux sont là (la course, avec ses thèmes voitures et licornes, le démineur, la baston de
robots, le platformer), chacun avec ses modes, le doigt, le clavier et la manette. Pistes ouvertes : les
petits outils de socle que les agents ont réclamés (saisie de texte, couleurs, fondu de toutes les
caméras, menus à boutons).
