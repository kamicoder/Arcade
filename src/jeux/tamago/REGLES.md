# Tamago : les règles

Un animal virtuel qui vit **pendant qu'on joue avec lui**, et dort quand on s'en va. La mécanique vient
du vrai Tamagotchi (1996), ramenée à l'échelle d'une partie : le but est de s'amuser, pas d'être obligé
d'ouvrir le jeu pour le nourrir. L'âme vient de TAMAGO-XTREME 3000 : les lignées, les cacas qui
parlent, les événements absurdes. Les chiffres sont dans `reglages.ts`, à régler en jouant.

## 1. Le temps

- **Il ne vit que quand son écran est affiché.** Le jeu fermé, un autre jeu de l'Arcade, un autre
  onglet, le téléphone verrouillé : tout est en pause, rien ne baisse, rien ne se perd.
- **Partir, c'est le coucher** : il s'endort (un petit « bonne nuit ») et se réveille à ton retour, reposé.
- **Il grandit en temps de jeu** : 1 an pour 15 minutes passées avec lui.

## 2. Ce qu'on surveille

- **Ventre** et **Moral** : 4 cœurs chacun. Il perd un cœur de Ventre toutes les 3 minutes et un cœur
  de Moral toutes les 4 minutes (deux fois plus vite pour un bébé).
- **Discipline** : de 0 à 100 %, par pas de 25 %.
- **Poids** : chaque forme a son poids de base. Les friandises font grossir, les jeux font maigrir.
- **Les crottes** : une toutes les 4 à 6 minutes (plus souvent chez un bébé), jusqu'à 4 à l'écran.

## 3. Les soins

| Soin | Effet |
|---|---|
| 🍙 Repas | +1 cœur de Ventre, +1 g. Il refuse quand il est plein |
| 🍬 Friandise | +1 cœur de Moral, +2 g. Il ne refuse jamais (attention au poids) |
| 🎮 Jouer | Un petit jeu de 5 manches (deviner gauche ou droite). 3 manches gagnées donnent +1 cœur de Moral ; une partie fait toujours perdre 1 g |
| 🧽 Nettoyer | Enlève toutes les crottes |
| 💊 Soigner | Une dose de médicament ; il en faut 1 à 3 selon la maladie |
| 📢 Gronder | Pendant un caprice : +25 % de discipline. Hors caprice : il est vexé, −1 cœur de Moral |
| 🤚 Caresser | Toucher le Tamago (ou ce bouton) : il rit. Compte pour la lignée Stylée, au plus une fois toutes les 30 s |

## 4. Les appels et les oublis

Il **appelle** quand son Ventre ou son Moral tombe à zéro, ou par **caprice** : il appelle alors que tout va
bien, et il faut le gronder.

- Un appel ignoré **1 minute** devient un **oubli**. Comme le jeu est en pause quand tu n'es pas là, un
  oubli veut toujours dire « je l'ai vu, et je n'ai rien fait ».
- **Un caprice ignoré** ne fait pas d'oubli, mais sa discipline reste basse, et ça se verra.

## 5. La maladie

Il tombe malade si des crottes restent **5 minutes**, s'il devient **trop gros** (le double de son poids de
base), ou une fois par stade, au hasard. Malade, il refuse de jouer, et il faut 1 à 3 doses de
médicament. Une maladie laissée **10 minutes** le fait partir (voir la fin).

## 6. Grandir : tes soins décident de ce qu'il devient

| Stade | Durée |
|---|---|
| Œuf | 5 tapes pour le réchauffer, puis quelques secondes |
| Bébé | 5 minutes (toujours la même forme) |
| Enfant | 20 minutes |
| Ado | 40 minutes |
| Adulte | le reste de sa vie |

**La lignée** vient de ton **style** : chaque soin donne des points à une lignée, et celle qui en a le plus
quand il grandit l'emporte. À égalité, celle d'avant reste ; sinon, le hasard choisit. Les lignées et leurs noms viennent de TAMAGO-XTREME.

| Ton style | Lignée |
|---|---|
| Beaucoup de repas | Gourmand (Pioupiou, Drakounet, DRAGOMEGA...) |
| Beaucoup de jeux | Joyeux (Bébou, Renardo, LEONALD...) |
| Les crottes nettoyées vite | Propre (Germy, Krakouille, KTHULU JR...) |
| Beaucoup de friandises et de caresses | Stylé (Glamy, Feelia, ARCHIMAGE...) |

**La variante** vient de la **qualité** des soins pendant le stade : **gentille** avec 0 à 2 oublis et au
moins 75 % de discipline, sinon **sauvage**, avec les formes « bad » de XTREME (Krakmaw, Cradox,
PLAGUEBORN...). Chaque stade recalcule la variante : on peut se rattraper.

**La forme secrète**, la légende (ETERNADRAKE, STAR LORD...), est réservée à un adulte élevé sans aucun oubli
de bout en bout, avec 100 % de discipline.

## 7. La fin : jamais d'écran triste

Le vrai Tamagotchi meurt (un fantôme, une pierre tombale), XTREME aussi (« Ton Tamago est parti... »).
Ici, il ne meurt jamais :

- **De vieillesse**, après 3 à 5 heures de jeu (de 12 à 20 ans) : plus il a eu d'oublis, plus tôt. Il
  **repart sur sa planète**, et laisse un œuf.
- **D'abandon** : 10 minutes le Ventre vide, ou malade sans soin. Il **s'enfuit** (« parti vivre chez le
  voisin, qui a des croquettes »), et un nouvel œuf attend.
- **L'album** garde le souvenir de chaque Tamago : sa forme, son nom, son âge, comment il est parti.

## 8. Le grain de folie de XTREME

- **Les crottes vivantes** bougent et parlent (« Je pue donc je suis »). Quatre crottes laissées 2 minutes
  font venir le **ROI CACA** : il faut le taper 5 fois.
- **Des événements absurdes**, quelques-uns par jour : l'OVNI, l'aigle voleur, la fée ménage, la pluie de
  bonbons... Un toutes les quelques minutes ; ils agissent en cœurs.
- **Des visiteurs** (le livreur de pizza, l'alien touriste, le squelette amical) et leur **carnet d'amis**.
- **La parole** : ses répliques selon son humeur, avec tout l'humour d'XTREME.
- **Le journal** de sa vie.

## 9. Les thèmes : deux habillages, les mêmes règles

- **Rétro** : un écran LCD vert à gros points, des bips, la coque en forme d'œuf. Idée pour ne pas
  dessiner 40 personnages à la main : dessiner l'emoji de chaque forme en tout petit, puis le
  transformer en points d'écran LCD.
- **Néon** : le look de TAMAGO-XTREME, avec les emojis, les couleurs fluo et les particules.

## 10. Plus tard, une fois le cœur amusant

La météo, la cuisine, le familier, l'arène, les rêves, les accessoires, la photo, d'autres lignées
(Hyperactif, Studieux), le thème Rétro. L'arbre de talents d'XTREME n'est pas repris tel quel : une vingtaine de ses talents ne
faisaient rien.

## Les choix faits

- Le thème **Néon** d'abord, avec les emojis ; le thème Rétro pourra avoir de vrais dessins.
- **Un seul Tamago** par appareil.
- Les vitesses et la durée de vie : celles de ces pages, à régler en jouant.
