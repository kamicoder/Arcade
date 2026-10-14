# Les pièges de Phaser 4

Ce que l'Arcade a appris à ses dépens, rangé selon ce que c'est vraiment. La plupart ne sont pas des
bugs de Phaser : c'est sa façon de faire, logique une fois qu'on la connaît, mais qu'on ne devine pas.

## Ce que Phaser fait exprès

**La physique Arcade**

- Dans `update()`, `sprite.x` a **un pas de physique de retard** : Phaser avance le corps avant `update()`
  et ne recopie sa place sur l'image qu'après. Pour une décision qui dépend de la place exacte (une
  barrière, une collision faite à la main), lire `body.center`. Une voiture restait coincée contre les
  pneus (c'est une des raisons pour lesquelles la course calcule sa conduite à la main).
- Les corps Arcade ne tournent pas : un rond (`setCircle`) pour ce qui tourne.
- `physics.add.group()` remet à zéro la vitesse et la gravité de chaque objet qu'on y ajoute : pour des
  objets déjà réglés, un groupe simple (`add.group()`).
- L'ordre des deux objets reçus par le rappel d'un `overlap` dépend du genre de groupe : face à un
  groupe de **physique** (`physics.add.group`), l'objet seul vient toujours en premier, quel que soit
  l'ordre donné ; un groupe **simple** (`add.group`) est déplié en ses enfants et garde l'ordre donné.
  Plutôt que de s'en souvenir, reconnaître chacun (par sa classe, ou `=== seul`), comme `surUnDe` dans
  `tir/scenes/Partie.ts` : le tir détruisait le vaisseau qu'un ennemi percutait, et le jeu s'arrêtait
  net. Un test qui appelle la fonction du choc à la main ne voit pas ce défaut.
- Avec plusieurs pas de physique par image, un `overlap` peut revenir au pas suivant même après
  `body.enable = false` : protéger ce qui ne doit compter qu'une fois (une pièce, un ennemi écrasé).
- Pour le ralenti, `world.timeScale` est à l'envers : `world.timeScale = 3` ralentit.

**La physique Matter** (la catapulte)

- Changer l'échelle d'une image Matter (`setScale`, un tween sur `scale`) change aussi son **corps** : un
  corps ramené à l'échelle 0 ne s'en remet pas, et un dandinement par tween le déforme à chaque image.
  Faire apparaître en fondu (`alpha`), et ne jamais animer l'échelle d'un objet qui a un corps.
- Un corps créé immobile (`isStatic: true` dans ses options) n'a pas encore de masse : le libérer ensuite
  (`setStatic(false)`) lui donne une masse `NaN`, et sa position devient `NaN` au premier pas. Le créer
  mobile, puis `setStatic(true)`.
- Avec `enableSleeping`, un corps immobile une seconde s'endort, **même immobile parce que statique** (le
  boulet qui attend dans la fronde). Libéré puis lancé, il ne bouge pas : le réveiller (`setAwake()`).
  Un test qui tire tout de suite ne le voit pas : attendre comme un joueur.
- Un corps **retiré** du monde ne réveille pas ceux qui reposaient sur lui : endormis, ils restent en l'air
  (une poutre dont les piliers ont éclaté). Réveiller les corps (`setAwake()`) quand on en retire un.

**Les scènes**

- `scene.restart` garde le `timeScale` et la pause de la physique, de l'horloge et des tweens : les
  remettre dans `create`.
- Les sons ne sont pas des objets de la scène : les détruire à son `SHUTDOWN`. Idem pour les écouteurs
  posés sur une **autre** scène, ou sur les événements de la scène elle-même (`this.events`), qui
  survivent à son arrêt : préférer sa méthode `update()`.
- Une scène en pause n'entend plus le clavier : une touche lâchée pendant la pause reste « tenue ».

**Le son**

- Ne jamais **relire** `sound.mute` pour savoir si le son est coupé. Avec le Web Audio, il relit le gain du
  nœud de coupure, que Chrome et Edge ne recalculent que quand un son le traverse : au Hub, où rien ne
  joue, il peut répondre « coupé » longtemps après qu'on a remis le son (le son, lui, revient bien). Le
  jeu sait ce qu'il a demandé (sa sauvegarde, `socle/son.ts`) ; un test écoute l'événement `"mute"` que
  Phaser émet à chaque changement.

**Le clavier et le doigt**

- Un appui bref (enfoncé et relâché dans la même image, ou une tape au doigt) n'est jamais vu « tenu » :
  pour un coup ou un saut, retenir l'appui jusqu'à l'image suivante (voir `baston/commandes.ts`).

**Les caméras et l'écran**

- Plusieurs caméras (écran partagé, éditeur) : chaque objet doit être ignoré par les caméras qui ne
  doivent pas le montrer (`camera.ignore`), sinon il s'affiche et répond aux clics deux fois. Et
  `fonduPuis` n'assombrit que la caméra principale.
- Les effets de caméra (`zoomTo`, `pan`) veulent une fonction d'ease (`Phaser.Math.Easing.Sine.Out`),
  pas son nom en texte comme les tweens.
- `scale.setGameSize` : seules les caméras placées en (0, 0) et à la taille d'avant suivent la nouvelle
  taille (celles des scènes arrêtées aussi). Son événement `RESIZE` est le même que celui d'une fenêtre
  qui change de forme : pour les distinguer, comparer `gameSize.width` à la largeur d'avant (4e argument).

**Les images**

- Retirer une texture encore affichée casse l'affichage.
- Une `TileSprite` répète sa texture : ce qui touche un bord « bave » sur le bord d'en face. Une marge
  transparente règle le problème.
- Un `Rectangle` arrondi ne se redessine que par `setSize` (changer `.width` casse les coins).

## Ce qui a changé depuis Phaser 3

Les exemples et les réponses trouvés en ligne sont souvent écrits pour Phaser 3.

- La teinte « pleine » : `setTint(c).setTintMode(Phaser.TintModes.FILL)` (plus de `setTintFill`).
- Une `RenderTexture` n'affiche ses tampons qu'après `render()`.
- `Graphics.strokePoints` / `fillPoints` veulent des `Phaser.Math.Vector2` (les types refusent `{ x, y }`).

## Les défauts de Phaser 4.2, contournés

De vrais bugs de la version utilisée. Chacun est réparé à un seul endroit, qui dit comment savoir s'il
sert encore : à relire à chaque mise à jour de Phaser.

- Un appui de touche dont le relâchement tombe dans la même image est traité deux fois : `surTouche`
  (`socle/clavier.ts`).
- Des traits partent du coin de l'écran vers les formes à contour, sur certains téléphones (des sommets
  NaN, que la carte graphique d'un ordinateur ignore mais que celle d'un Pixel 7 dessine) :
  `socle/correctifs.ts`, surveillé par un test du Hub qui compte les sommets NaN. **Ce qui marche sur
  l'ordinateur peut casser sur un téléphone.**
- Le haut des emojis est coupé sur Android : `socle/correctifs.ts`.

## Du côté du navigateur

- `document.fonts.check(...)` répond vrai pour une police inconnue : chercher dans `document.fonts`.
