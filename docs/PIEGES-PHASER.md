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
- Pour le ralenti, `world.timeScale` est à l'envers : `world.timeScale = 3` ralentit. Ceux des tweens et
  des minuteries (`tweens.timeScale`, `time.timeScale`) sont à l'endroit : 0.3 ralentit. Une minuterie qui
  doit finir le ralenti est ralentie elle aussi : pour 200 ms à l'écran, `delayedCall(200 * 0.3)` (le tir).
- `body.reset` efface `blocked` et `touching` : un corps remis pile sur une plateforme n'y est « posé »
  qu'au pas suivant, et son rectangle la touche bord contre bord sans la chevaucher. Le téléporteur du
  platformer y perdait le héros qu'il venait de poser : celui-ci se croyait déjà sorti de l'arrivée, et
  repartait d'où il venait (`Monde.terrain`). Un test qui attend « il est arrivé » ne le voit pas : il faut
  regarder s'il y reste.
- Les écouteurs de `this.events` dans une scène incluent ceux de Phaser : `events.off("postupdate")`
  sans dire lequel retire aussi celui de la physique Arcade (`world.postUpdate`) : plus rien ne bouge.
  Toujours retirer **son** écouteur.

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
- Le ralenti de Matter n'est pas celui d'Arcade : pas de `world.timeScale` (l'écrire ne fait rien, sans
  erreur), mais `matter.world.engine.timing.timeScale`, et dans le bon sens (0,25 = quatre fois plus lent).
  Les particules ont leur propre `timeScale`, à régler en même temps. Et au ralenti, pendant
  `collisionstart`, `body.velocity` est encore le déplacement **du pas** (quatre fois plus petit) : Matter ne
  la ramène à un pas normal qu'après cet événement. Des dégâts calculés d'après elle baisseraient
  au ralenti ; la catapulte la ramène elle-même (`vitesse()` dans `catapulte/scenes/Niveau.ts`, d'après
  `body.deltaTime`).

**Les scènes**

- `scene.restart` garde le `timeScale` et la pause de la physique, de l'horloge et des tweens : les
  remettre dans `create`.
- Les sons ne sont pas des objets de la scène : les détruire à son `SHUTDOWN`. Idem pour les écouteurs
  posés sur une **autre** scène, ou sur les événements de la scène elle-même (`this.events`), qui
  survivent à son arrêt : préférer sa méthode `update()`.
- Une scène en pause n'entend plus le clavier, ni les doigts : une touche ou un bouton au doigt lâché pendant
  la pause reste « tenu ». `TouchesPhysiques` se lâche toute seule à la reprise (l'événement `RESUME` de la
  scène) ; les `BoutonsAuDoigt`, c'est au jeu de les lâcher (`toutLacher`, à la reprise comme `socle/pause.ts`, ou à
  l'événement `PAUSE` de la scène, comme le tableau de bord de la course).
- `this.time.now` continue pendant la pause : c'est l'heure du jeu entier, pas celle de la scène (comme le
  `time` reçu par `update` et `preUpdate`). Une invincibilité qui s'en sert finit pendant la pause, et des
  ennemis qui comptent leur prochain tir dessus tirent tous à la reprise : le tir compte sur son horloge à
  lui, avancée dans `update` (`delta`, qui ne vient pas pendant la pause). Un chrono
  qui s'en sert compte le temps de la pause. Une minuterie de la scène (`this.time.addEvent`, puis
  `getElapsed()`), elle, s'arrête avec la scène : c'est le chrono du démineur.
- Par `this.scene` (le ScenePlugin), tout attend l'image suivante : `start`, `launch`, `stop`, `restart`,
  mais aussi `pause` et `resume` (seul `game.scene`, le gestionnaire lui-même, agit tout de suite). Phaser
  fait lire un appui aux scènes l'une après l'autre, de la plus haute à la plus basse, dans la même image :
  une fin arrêtée par Start est encore active quand la partie, dessous, lit ce même Start. C'est ce qui
  permet à la partie de se taire (le `possible` de `socle/pause.ts`).
- Phaser n'a d'événement que pour les boutons d'une manette, pas pour le stick : il se relit à chaque image
  (`leftStick`, comme `surManette` le fait pour les menus). Et il ignore une manette dont l'heure (`timestamp`,
  celle de son dernier changement) est plus vieille que la scène : une manette simulée dans un test doit la tenir à
  jour (`pousserLeStick`, dans `tests/outils.ts`).
- Chaque scène lit la manette avec sa **propre copie** des boutons (son `GamepadPlugin`), qui ne bouge pas
  quand la scène est arrêtée ou en pause. Une scène qui arrive, ou qui sort d'une pause, prend un bouton
  encore tenu pour un nouvel appui : le Start qui ouvre la pause validerait aussitôt « Reprendre », celui
  qui la ferme la rouvrirait. D'où le petit moment avant d'écouter (`ecranDeFin`, `socle/pause.ts`).
- Une scène ajoutée en cours de route (`scene.add`) se met au-dessus des autres... et sous celles ajoutées
  après elle (les jeux chargés ensuite) : une scène qui doit tout recouvrir se remonte (`scene.bringToTop`).

**Le son**

- Ne jamais **relire** `sound.mute` pour savoir si le son est coupé. Avec le Web Audio, il relit le gain du
  nœud de coupure, que Chrome et Edge ne recalculent que quand un son le traverse : au Hub, où rien ne
  joue, il peut répondre « coupé » longtemps après qu'on a remis le son (le son, lui, revient bien). Le
  jeu sait ce qu'il a demandé (sa sauvegarde, `socle/son.ts`) ; un test écoute l'événement `"mute"` que
  Phaser émet à chaque changement.

**Le clavier et le doigt**

- La souris capturée (`input.mouse.requestPointerLock`) : `pointer.movementX/Y` ne sont lus que si le **pointeur**
  est marqué capturé (`pointer.locked`), ce que fait le gestionnaire du jeu (`onPointerLockChange`) quand le
  navigateur l'annonce. Un test qui imite la capture passe par lui, pas par `mouse.locked` seul. Et le navigateur
  rend la souris sur Échap : c'est son geste, le jeu n'y peut rien (`socle/souris.ts` met alors en pause).

- Un appui bref (enfoncé et relâché dans la même image, ou une tape au doigt) n'est jamais vu « tenu » :
  pour un coup ou un saut, retenir l'appui jusqu'à l'image suivante (voir `baston/commandes.ts`).

**Les caméras et l'écran**

- Plusieurs caméras (écran partagé, éditeur) : chaque objet doit être ignoré par les caméras qui ne
  doivent pas le montrer (`camera.ignore`), sinon il s'affiche et répond aux clics deux fois. Et
  `fonduPuis` n'assombrit que la caméra principale.
- `camera.flash()` part d'un écran **tout blanc** (opaque) : il n'a pas d'argument pour l'atténuer. Pour un
  petit flash, régler `camera.flashEffect.alpha` avant (0.35 pour le turbo de la course) ; Phaser le garde
  pour les flashs suivants. Un test qui veut voir un effet bref écoute son début (`"cameraflashstart"`,
  `"camerashakestart"`) plutôt que de lire `isRunning`, déjà retombé quand le poste est chargé.
- Les effets de caméra (`zoomTo`, `pan`) veulent une fonction d'ease (`Phaser.Math.Easing.Sine.Out`),
  pas son nom en texte comme les tweens.
- Un effet de caméra en route (`zoomTo`, `pan`) continue jusqu'au bout, même si l'on replace la caméra à
  la main (`setZoom`, `centerOn`) : il l'écrase à chaque image. Une nouvelle partie dans la même scène
  l'arrête d'abord (`camera.zoomEffect.reset()`, `camera.panEffect.reset()`, comme le démineur qui rejoue
  pendant que la caméra recule).
- `scale.setGameSize` : seules les caméras placées en (0, 0) et à la taille d'avant suivent la nouvelle
  taille (celles des scènes arrêtées aussi). Son événement `RESIZE` est le même que celui d'une fenêtre
  qui change de forme : pour les distinguer, comparer `gameSize.width` à la largeur d'avant (4e argument).
- `camera.worldView` (ce que la caméra voit) n'est calculé qu'en dessinant. Après avoir déplacé la caméra
  (`startFollow` la pose d'un coup, `centerOn`, `scrollX`), il donne encore la vue d'avant jusqu'à l'image
  suivante : le duo du platformer, qui oublie ce qui est derrière la vue, effaçait le départ qu'il venait de poser.

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
