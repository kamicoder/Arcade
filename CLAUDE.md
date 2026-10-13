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
  fois un appui dont le relâchement tombe dans la même image.
- `fonduPuis(scene, action)` au lieu de `camera.fadeOut()` : un `fadeOut` lancé pendant un autre fondu
  (le `fadeIn` d'arrivée) est ignoré, et la transition reste bloquée.
- `retourAuHub(scene)` arrête toutes les scènes du jeu et revient au Hub.
- `TouchesPhysiques` : les touches tenues d'après leur **place** (`event.code`, « KeyW » = le Z d'un AZERTY),
  pour deux joueurs sur un même clavier ; Phaser, lui, reconnaît les touches à la lettre (`keyCode`).
- `lire` / `ecrire` (sauvegardes protégées), `estTactile()`, `quandNouvelleVersion` (mise à jour au
  Hub seulement, jamais en pleine partie).

## Ajouter un jeu

Un dossier `src/jeux/<cle>/` dont `index.ts` exporte par défaut `{ scenes, premiere }` (type
`ModuleDeJeu`), et sa fiche dans `src/jeux/catalogue.ts`. Les noms de scène commencent par la clé du
jeu (`voiture-course`). L'ordre de `scenes` est l'ordre d'affichage : une scène lancée par-dessus
(tableau de bord, arrivée) vient après. Ses sons et images vont dans `public/<cle>/`.

## Pièges de Phaser 4 déjà rencontrés

- La teinte « pleine » : `setTint(c).setTintMode(Phaser.TintModes.FILL)` (plus de `setTintFill`).
- Une `RenderTexture` n'affiche ses tampons qu'après `render()`.
- `Graphics.strokePoints` / `fillPoints` veulent des `Phaser.Math.Vector2` (les types refusent `{ x, y }`).
- Les sons ne sont pas des objets de la scène : les détruire à son `SHUTDOWN`. Idem pour les écouteurs
  posés sur une **autre** scène.
- Les corps Arcade ne tournent pas : un rond (`setCircle`) pour ce qui tourne.
- Dans `update()`, `sprite.x` a **un pas de physique de retard** : Phaser avance le corps avant `update()`
  et ne recopie sa place sur l'image qu'après. Pour une décision qui dépend de la place exacte (une
  barrière, une collision faite à la main), lire `body.center`. Une voiture restait coincée contre les pneus.
- Un appui bref (enfoncé et relâché dans la même image, ou une tape au doigt) n'est jamais vu « tenu » :
  pour un coup ou un saut, retenir l'appui jusqu'à l'image suivante (voir `baston/commandes.ts`).
- Un `Rectangle` arrondi ne se redessine que par `setSize` (changer `.width` casse les coins).
- Les effets de caméra (`zoomTo`, `pan`) veulent une fonction d'ease (`Phaser.Math.Easing.Sine.Out`),
  pas son nom en texte comme les tweens.
- `scene.restart` garde le `timeScale` et la pause de la physique, de l'horloge et des tweens : les remettre
  dans `create`. Et pour la physique, le ralenti est à l'envers : `world.timeScale = 3` ralentit.

## D'où viennent les jeux

Les jeux viennent des ateliers de PixelForge (`C:\Data\PixelForge\ateliers\`) et des anciennes versions
en JavaScript pur (`C:\Data\Jeux\Voiture`, `C:\Data\Jeux\Licorne`, publiées sur kamicoder.github.io).
Même origine que l'Arcade : garder les mêmes noms de sauvegarde (`course-de-pixy/...` pour la voiture)
pour que les records d'avant suivent. Un défaut de jeu trouvé ici existe peut-être aussi là-bas :
le signaler à l'utilisateur.

Avancement : Hub et course de voitures complète (contre la montre, contre l'ordinateur, Grand Prix, à
deux en écran partagé, éditeur de circuit). Démineur et baston de robots faits. En cours : Licorne, platformer.
