# Spécifications fonctionnelles et non-fonctionnelles

> Référence : [01-analysis.md](./01-analysis.md)

---

## 1. Spécifications fonctionnelles

### Module: Authentification & Comptes

- [US-001] En tant que visiteur, je veux m'inscrire avec email + mot de passe ou Google OAuth afin de créer un compte sur la plateforme [Must] (cf. §2-Acteurs, §4-Joueur #1)
- [US-002] En tant que joueur, je veux me connecter par email/mot de passe ou Google OAuth afin d'accéder à mon profil et mon solde [Must] (cf. §2-Joueur, §4-Joueur #2)
- [US-003] En tant que joueur, je veux réinitialiser mon mot de passe via email afin de retrouver l'accès à mon compte [Must] (cf. §4-Joueur #1)
- [US-004] En tant que joueur, je veux modifier mon profil (pseudo, avatar, préférences) afin de personnaliser mon expérience [Should] (cf. §2-Joueur)
- [US-005] En tant que joueur, je veux configurer la 2FA (TOTP) afin de sécuriser mon compte [Should] (cf. §5-Risques-Sécurité des comptes)
- [US-006] En tant que joueur, je veux supprimer mon compte (GDPR) afin d'exercer mon droit à l'effacement [Must] (cf. §5-Réglementaires-GDPR)
- [US-007] En tant que joueur, je veux consulter et gérer mes sessions actives afin de me déconnecter à distance si nécessaire [Should] (cf. §5-Risques-Sécurité)

### Module: Dashboard / Lobby d'accueil

- [US-DASH-001] En tant que joueur connecté, je veux voir une page d'accueil (lobby) avec une grille visuelle de tous les jeux disponibles, mon solde en haut, et mes notifications [Must] (cf. §4-Joueur #2)
- [US-DASH-002] En tant que joueur, je veux voir mes statistiques rapides sur le dashboard (parties jouées aujourd'hui, plus gros gain, streak actuel) [Should] (cf. §2-Joueur)
- [US-DASH-003] En tant que joueur, je veux accéder aux récompenses quotidiennes depuis le dashboard [Must] (cf. §4-Joueur #3)

### Module: Portefeuille Virtuel & House Account

- [US-008] En tant que joueur, je veux consulter mon solde de monnaie virtuelle en temps réel afin de connaître mon capital disponible [Must] (cf. §2-Joueur, §4-Joueur #2)
- [US-009] En tant que joueur, je veux recevoir une récompense quotidienne de 1 000 jetons (streak cumulable : jour 1 = 1 000, jour 7 = 2 500, jour 30 = 10 000) afin de revenir régulièrement sur la plateforme [Must] (cf. §2-Joueur, §3-Fidélisation, §5-Métier-House Account)
- [US-010] En tant que joueur, je veux recevoir un bonus de bienvenue unique de 5 000 jetons après inscription afin de commencer à jouer immédiatement [Must] (cf. §4-Joueur #3)
- [US-011] En tant que joueur, je veux consulter l'historique complet de mes transactions (mises, gains, bonus, achats) filtré par date et type afin de suivre mon activité [Must] (cf. §2-Joueur, §5-Métier)
- [US-012] En tant que joueur, je veux acheter des jetons virtuels supplémentaires (IAP) via Stripe/PayPal afin de continuer à jouer [Nice] (cf. §1-Contexte §8)
- [US-013] En tant qu'admin, je veux consulter le House Account (capital initial de 50 000 000 jetons, pertes/gains cumulés, jetons distribués, rentabilité) afin de suivre la santé économique virtuelle [Must] (cf. §2-Admin, §5-Métier-House Account)
- [US-014] En tant que joueur, je veux être notifié lorsque mon solde passe en dessous d'un seuil configurable (dans les paramètres du profil, de 0 à 50 000) afin d'anticiper un rechargement [Nice] (cf. §2-Joueur)

### Module: Slot Machine 3 Rouleaux

- [US-015] En tant que joueur, je veux choisir ma mise (montant fixe ou personnalisé) avant de lancer la slot 3 rouleaux [Must] (cf. §6-1-Slot 3 Rouleaux)
- [US-016] En tant que joueur, je veux lancer les 3 rouleaux et voir une animation de rotation avant l'affichage du résultat [Must] (cf. §6-1, §4-Joueur #5-#6)
- [US-017] En tant que joueur, je veux voir les symboles gagnants et le montant gagné après chaque tour [Must] (cf. §4-Joueur #6)
- [US-018] En tant que joueur, je veux configurer le nombre de lignes de paiement (1-5) actives afin d'adapter mon risque [Must] (cf. §6-1)
- [US-019] En tant que joueur, je veux voir le gain combiné de toutes les lignes de paiement actives [Must] (cf. §6-1)
- [US-020] En tant que joueur, je veux activer le mode "Auto Spin" pour enchaîner 5 à 100 parties automatiquement [Should] (cf. §4-Joueur)
- [US-021] En tant que joueur, je veux voir la table des paiements (RTP, symboles, combinaisons) avant de jouer [Should] (cf. §2-Joueur)

### Module: Slot Machine 4 Rouleaux

- [US-022] En tant que joueur, je veux choisir ma mise et lancer la slot 4 rouleaux avec animation [Must] (cf. §6-2-Slot 4 Rouleaux)
- [US-023] En tant que joueur, je veux configurer le nombre de lignes de paiement (1-10) actives [Must] (cf. §6-2)
- [US-024] En tant que joueur, je veux voir les symboles Wild remplacer les symboles manquants pour former des combinaisons gagnantes [Must] (cf. §6-2)
- [US-025] En tant que joueur, je veux déclencher un tour de Free Spins lorsque 3 symboles Scatter ou plus apparaissent [Must] (cf. §6-2)
- [US-026] En tant que joueur, je veux voir le nombre de Free Spins restants et les gains accumulés pendant le bonus [Must] (cf. §6-2)
- [US-027] En tant que joueur, je veux voir la table des paiements incluant les règles Wild et Scatter [Should] (cf. §2-Joueur)

### Module: Slot Machine 5 Rouleaux

- [US-028] En tant que joueur, je veux choisir ma mise et lancer la slot 5 rouleaux avec animation [Must] (cf. §6-3-Slot 5 Rouleaux)
- [US-029] En tant que joueur, je veux utiliser le système "Ways to Win" (jusqu'à 243 façons) sans lignes de paiement fixes [Must] (cf. §6-3)
- [US-030] En tant que joueur, je veux voir les symboles Wild, Scatter et Multiplicateurs actifs [Must] (cf. §6-3)
- [US-031] En tant que joueur, je veux déclencher un Bonus Round interactif (choix d'objets, roue bonus) via 3+ Scatters [Must] (cf. §6-3)
- [US-032] En tant que joueur, je veux accumuler un jackpot progressif interne lorsque la combinaison maximale apparaît [Should] (cf. §6-1, §6-3)
- [US-033] En tant que joueur, je veux voir la table des paiements et le montant du jackpot progressif [Should] (cf. §2-Joueur)

### Module: Blackjack

- [US-034] En tant que joueur, je veux placer une mise et recevoir 2 cartes (le croupier reçoit 1 visible + 1 cachée) pour débuter une main [Must] (cf. §6-4-Blackjack)
- [US-035] En tant que joueur, je veux tirer une carte (Hit) ou rester (Stand) afin de tenter de battre le croupier [Must] (cf. §6-4)
- [US-036] En tant que joueur, je veux doubler ma mise (Double) sur les deux premières cartes, avec une seule carte supplémentaire [Must] (cf. §6-4)
- [US-037] En tant que joueur, je veux séparer une paire (Split) en deux mains distinctes avec une mise supplémentaire [Must] (cf. §6-4)
- [US-038] En tant que joueur, je veux me rendre (Surrender) après les deux premières cartes afin de récupérer la moitié de ma mise [Should] (cf. §6-4)
- [US-039] En tant que joueur, je veux qu'une main Blackjack (As + 10/figure) soit automatiquement gagnante (3:2) sauf si le croupier a aussi Blackjack [Must] (cf. §6-4)
- [US-040] En tant que joueur, je veux que le croupier tire jusqu'à 17 (Stand on 17) selon les règles standards [Must] (cf. §6-4)
- [US-041] En tant que joueur, je veux voir l'assurance proposée lorsque le croupier montre un As [Should] (cf. §6-4)
- [US-042] En tant que joueur, je veux voir les statistiques de ma session (mains jouées, win rate) [Should] (cf. §2-Joueur)

### Module: Roulette

- [US-043] En tant que joueur, je veux choisir une mise sur une roulette européenne (37 cases, 1 zéro) et placer des jetons sur une grille interactive [Must] (cf. §6-5-Roulette)
- [US-044] En tant que joueur, je veux placer des mises Plein (35:1), Cheval (17:1), Carré (8:1), Douzaine (2:1), Colonne (2:1), Rouge/Noir (1:1), Pair/Impair (1:1), Manque/Passe (1:1) [Must] (cf. §6-5)
- [US-045] En tant que joueur, je veux voir une animation de roue qui tourne puis de bille qui s'arrête sur un numéro [Must] (cf. §4-Joueur #5-#6)
- [US-046] En tant que joueur, je veux que les gains soient calculés et crédités automatiquement selon la grille de paiement [Must] (cf. §6-5)
- [US-047] En tant que joueur, je veux pouvoir annuler/refaire une mise avant le lancement de la roue [Should] (cf. §2-Joueur)
- [US-048] En tant que joueur, je veux voir l'historique des 10 derniers numéros gagnants afin d'informer ma stratégie [Should] (cf. §2-Joueur)
- [US-049] En tant que joueur, je veux utiliser la fonction "Mise favorite" pour rejouer la même combinaison rapidement [Nice] (cf. §2-Joueur)

### Module: Poker Texas Hold'em

- [US-050] En tant que joueur, je veux accéder au lobby du poker listant toutes les tables actives (nom, stakes, nb joueurs/max, taille waitlist) et pouvoir en rejoindre une [Must] (cf. §6-Lobby, §4-Joueur)
- [US-051] En tant que joueur, je veux créer une nouvelle table (nom, blinds, max joueurs 2-9) qui apparaît immédiatement dans le lobby [Must] (cf. §6-Création de table)
- [US-052] En tant que joueur, je veux rejoindre une table avec une place disponible et m'asseoir immédiatement [Must] (cf. §6-Lobby)
- [US-053] En tant que joueur, je veux rejoindre la waitlist d'une table complète et être notifié (popup + son) lorsqu'une place se libère, avec 30 secondes pour accepter sous peine de perdre la place [Must] (cf. §6-Waitlist)
- [US-054] En tant que joueur, je veux recevoir mes 2 cartes privatives au début de chaque main [Must] (cf. §6-Poker)
- [US-055] En tant que joueur, je veux suivre les tours d'enchères : pré-flop, flop (3 cartes communes), turn (1 carte), river (1 carte) [Must] (cf. §6-Poker)
- [US-056] En tant que joueur, je veux miser (Bet/Call), relancer (Raise), ou me coucher (Fold) pendant chaque tour d'enchères [Must] (cf. §6-Poker)
- [US-057] En tant que joueur, je vois les blinds augmenter automatiquement selon le timer de la table [Must] (cf. §6-Poker)
- [US-058] En tant que joueur, je veux un timer de 15 à 30 secondes pour agir, avec coucher automatique en cas d'inaction [Must] (cf. §6-Timer d'action)
- [US-059] En tant que joueur, je veux voir le pot central et les side pots en cas de tapis [Must] (cf. §6-Poker §7-Risques-Logique complexe)
- [US-060] En tant que joueur, je veux voir le showdown automatique avec classement des mains (quinte flush royale > ... > carte haute) et distribution des gains [Must] (cf. §6-Poker)
- [US-061] En tant que joueur, je veux quitter une table via le lobby à tout moment [Must] (cf. §6-Lobby)
- [US-062] En tant que joueur, je veux voir les bots étiquetés "[Bot]" dans leur nom et tag visuel pour distinguer joueurs humains des IA [Must] (cf. §6-Bots étiquetés)
- [US-063] En tant que joueur, je veux que les tables avec moins de 2 joueurs humains soient automatiquement complétées par des bots [Must] (cf. §6-Bots, §5-Métier-Multi-joueurs & Bots)
- [US-064] En tant que joueur, je veux voir le chat de table pendant la partie pour interagir avec les autres joueurs [Should] (cf. §3-Social, §5-Risques-Modération)
- [US-065] En tant que joueur, je veux configurer mon stack de départ à la table (min 20 BB, max 100 BB, dans la limite de mon solde) [Should] (cf. §2-Joueur)
- [US-066] En tant que joueur, je veux voir mon historique de mains et mes statistiques de session [Nice] (cf. §2-Joueur)

### Module: Dés / Craps

- [US-067] En tant que joueur, je veux placer une mise Pass Line avant le premier lancer (Come Out) afin de parier que le tireur gagne [Must] (cf. §6-7-Craps)
- [US-068] En tant que joueur, je veux placer des mises Don't Pass, Come, Don't Come selon les règles standards du craps [Must] (cf. §6-7)
- [US-069] En tant que joueur, je veux placer des mises secondaires (Place, Field, Proposition) pendant la phase Point [Must] (cf. §6-7)
- [US-070] En tant que joueur, je veux voir une animation de lancer de deux dés avec affichage du total [Must] (cf. §4-Joueur #5-#6)
- [US-071] En tant que joueur, je veux que les gains soient calculés selon les probabilités standard (Pass Line 1:1, Field 2:1/1:1, etc.) [Must] (cf. §6-7)
- [US-072] En tant que joueur, je veux voir le point actuel et le tableau des mises disponibles à tout moment [Should] (cf. §2-Joueur)
- [US-073] En tant que joueur, je veux voir l'historique des 20 derniers lancers [Nice] (cf. §2-Joueur)

### Module: Bingo

- [US-074] En tant que joueur, je veux acheter une ou plusieurs cartes de Bingo (grille 5x5) pour une partie à venir [Must] (cf. §6-8-Bingo)
- [US-075] En tant que joueur, je veux voir les numéros tirés s'afficher en temps réel et ma/mes cartes se marquer automatiquement [Must] (cf. §6-8)
- [US-076] En tant que joueur, je veux être déclaré gagnant automatiquement lorsque je complète une ligne, colonne, diagonale ou motif [Must] (cf. §6-8)
- [US-077] En tant que joueur, je veux jouer en mode solo (contre RNG) avec tirage instantané [Should] (cf. §6-8, §7-Risques-Bingo)
- [US-078] En tant que joueur, je veux jouer en mode multi-joueurs (salle avec mini 2 joueurs) avec tirage périodique synchronisé [Should] (cf. §6-8)
- [US-079] En tant que joueur, je veux voir le jackpot Bingo augmenter de 2% de chaque ticket acheté jusqu'à ce qu'il soit gagné [Nice] (cf. §2-Joueur)
- [US-080] En tant que joueur, je veux voir le nombre de joueurs dans la salle et le numéro du prochain tirage [Should] (cf. §2-Joueur)

### Module: Mines

- [US-081] En tant que joueur, je veux configurer le nombre de mines cachées (1-24) sur une grille 5x5 avant de commencer [Must] (cf. §6-9-Mines)
- [US-082] En tant que joueur, je veux cliquer sur les cases de la grille pour révéler des gemmes (gain) ou des mines (perte) [Must] (cf. §6-9)
- [US-083] En tant que joueur, je veux voir le multiplicateur actuel augmenter à mesure que je découvre des gemmes [Must] (cf. §6-9)
- [US-084] En tant que joueur, je veux encaisser (Cash Out) mon gain à tout moment avant de toucher une mine [Must] (cf. §6-9)
- [US-085] En tant que joueur, je veux voir un résultat Provably Fair vérifiable à chaque partie [Must] (cf. §6-9-Provably fair)
- [US-086] En tant que joueur, je veux changer le nombre de mines entre chaque partie [Should] (cf. §2-Joueur)
- [US-087] En tant que joueur, je veux voir l'historique de mes parties Mines (gemmes trouvées, gain total) [Should] (cf. §2-Joueur)

### Module: Crash

- [US-088] En tant que joueur, je veux placer une mise avant le début d'un vol et voir la courbe du multiplicateur augmenter en temps réel [Must] (cf. §6-10-Crash)
- [US-089] En tant que joueur, je veux encaisser (Cash Out) mon gain avant que le multiplicateur ne crash afin d'éviter de tout perdre [Must] (cf. §6-10)
- [US-090] En tant que joueur, je veux voir le point de crash passé après l'explosion pour vérifier le résultat [Must] (cf. §6-10)
- [US-091] En tant que joueur, je veux voir les mises et gains des autres joueurs en temps réel [Must] (cf. §6-10-Modes multi-joueurs)
- [US-092] En tant que joueur, je veux utiliser une fonction de Cash Out automatique à un multiplicateur choisi [Should] (cf. §2-Joueur)
- [US-093] En tant que joueur, je veux voir l'historique des derniers crash points sur un graphique [Should] (cf. §2-Joueur)
- [US-094] En tant que joueur, je veux vérifier le Provably Fair de chaque vol [Must] (cf. §6-10-Point de crash)

### Module: Plinko

- [US-095] En tant que joueur, je veux choisir le nombre de rangées (8-16) et le niveau de risque (Low/Medium/High) avant de lâcher une bille [Must] (cf. §6-11-Plinko)
- [US-096] En tant que joueur, je veux voir une animation physique de bille qui rebondit sur les chevilles et tombe dans une fente [Must] (cf. §6-11)
- [US-097] En tant que joueur, je veux que la fente d'arrivée détermine mon gain selon le multiplicateur de la rangée [Must] (cf. §6-11)
- [US-098] En tant que joueur, je veux voir la grille des multiplicateurs correspondant à ma configuration (risque × rangées) [Must] (cf. §6-11)
- [US-099] En tant que joueur, je veux lâcher 1 à 10 billes en rafale rapide avec la même configuration (lancées séquentiellement avant que la première n'atteigne le bas) [Should] (cf. §2-Joueur)
- [US-100] En tant que joueur, je veux vérifier le résultat Provably Fair de chaque bille [Must] (cf. §6-11-Provably fair)
- [US-101] En tant que joueur, je veux voir la distribution statistique des résultats après une série de lancers [Nice] (cf. §2-Joueur)

### Module: Wheel of Fortune (Big Six / Money Wheel)

- [US-102] En tant que joueur, je veux placer des jetons sur un ou plusieurs segments de la roue verticale avant le lancer [Must] (cf. §6-12-Wheel of Fortune)
- [US-103] En tant que joueur, je veux voir une animation de roue qui tourne, ralentit et s'arrête sur un segment gagnant [Must] (cf. §6-12)
- [US-104] En tant que joueur, je veux être payé selon le ratio du segment gagnant (1:1 pour $1, 40:1 pour Joker) [Must] (cf. §6-12)
- [US-105] En tant que joueur, je veux voir la probabilité et le paiement de chaque segment avant de miser [Should] (cf. §2-Joueur)
- [US-106] En tant que joueur, je veux utiliser la mise rapide "tout sur un segment" [Nice] (cf. §2-Joueur)
- [US-107] En tant que joueur, je veux voir le nombre total de jetons misés sur chaque segment en temps réel [Nice] (cf. §6-12)

### Module: Limbo

- [US-108] En tant que joueur, je veux définir un multiplicateur cible (ex: 2x, 10x, 1000x) avant de lancer [Must] (cf. §6-13-Limbo)
- [US-109] En tant que joueur, je veux voir le résultat instantané (nombre aléatoire) et savoir si j'ai gagné (résultat ≥ cible) [Must] (cf. §6-13)
- [US-110] En tant que joueur, je veux que la mise soit déduite et le gain crédité automatiquement en cas de victoire [Must] (cf. §6-13)
- [US-111] En tant que joueur, je veux vérifier le Provably Fair de chaque tour [Must] (cf. §6-13, §5-Métier-Provably fair)
- [US-112] En tant que joueur, je veux voir la probabilité de gagner pour le multiplicateur cible choisi avant de miser [Should] (cf. §6-13)
- [US-113] En tant que joueur, je veux utiliser l'historique des multiplicateurs gagnants pour les 100 derniers tours [Nice] (cf. §2-Joueur)

### Module: Chat & Social

- [US-114] En tant que joueur, je veux envoyer et recevoir des messages dans un chat global (hall) afin d'interagir avec la communauté [Must] (cf. §3-Social, §5-Risques-Modération)
- [US-115] En tant que joueur, je veux envoyer et recevoir des messages dans un chat de jeu (par table/salle) afin de communiquer pendant la partie [Must] (cf. §3-Social, §6-Poker-Chat)
- [US-116] En tant que joueur, je veux signaler un message inapproprié à la modération [Should] (cf. §5-Risques-Modération)
- [US-117] En tant que joueur, je veux voir les messages de jeu (victoire, gros gain, jackpot) apparaître dans le chat sous forme d'annonces système [Should] (cf. §3-Social)
- [US-118] En tant que joueur, je veux consulter le profil public des autres joueurs (pseudo, avatar, niveau, badges) [Nice] (cf. §3-Social)
- [US-119] En tant que joueur, je veux ignorer (mute) un autre joueur dans le chat [Nice] (cf. §5-Risques-Modération)
- [US-120] En tant que joueur, je veux utiliser des émojis dans le chat [Should] (cf. §3-Social)

### Module: Tâches Quotidiennes

- [US-121] En tant que joueur, je veux voir une liste de 3 à 5 tâches quotidiennes (ex: "Jouer 10 parties de Slots", "Gagner 3 mains de Blackjack", "Multiplicateur 5x+ sur Crash") qui se réinitialisent chaque jour à minuit [Must] (cf. §3-Fidélisation)
- [US-122] En tant que joueur, je veux gagner des jetons bonus en complétant chaque tâche (ex: 250 jetons par tâche, 1 000 bonus si toutes complétées) [Must] (cf. §3-Fidélisation)
- [US-123] En tant que joueur, je veux voir ma progression en temps réel avec barre de progression pour chaque tâche [Must] (cf. §2-Joueur)
- [US-124] Les tâches quotidiennes varient chaque jour et couvrent différents jeux (rotation sur les 13 jeux) [Should] (cf. §3-Fidélisation)

### Module: Classements & Courses

- [US-125] En tant que joueur, je veux voir le classement quotidien "Daily Race" : top 50 joueurs par montant total misé sur la journée, avec des prix décroissants (1er = 2 500, 2e = 1 500, 3e = 1 000, 4-10e = 500, 11-50e = 100 jetons) [Must] (cf. §3-Fidélisation)
- [US-126] En tant que joueur, je veux voir le classement hebdomadaire "Weekly Race" : top 100 joueurs par volume de jeu, avec des prix plus importants [Should] (cf. §3-Fidélisation)
- [US-127] En tant que joueur, je veux voir mon rang actuel mis à jour en temps réel pendant les courses [Should] (cf. §2-Joueur)
- [US-128] En tant que joueur, je veux voir la dotation totale restante de la course et le temps restant [Must] (cf. §2-Joueur)

### Module: Défis Spéciaux & Compétitions

- [US-129] En tant que joueur, je veux voir les défis "Multiplicateur" actifs : être le premier à atteindre un multiplicateur cible (ex: 1000x sur une slot) pour gagner un prix fixe [Should] (cf. §3-Fidélisation)
- [US-130] En tant que joueur, je veux participer aux "Slot Battles" : choisir un camp, jouer sur un jeu désigné, le camp avec le plus de points gagne [Nice] (cf. §3-Fidélisation)
- [US-131] En tant que joueur, je veux voir les défis "Originaux" : atteindre un multiplicateur sur un jeu spécifique (Mines, Plinko, Crash, Limbo) pour gagner une part d'un prize pool hebdomadaire [Nice] (cf. §3-Fidélisation)
- [US-132] En tant que joueur, je veux gagner des badges/achievements visibles sur mon profil pour des accomplissements (ex: "Roi des Slots" = 1000 parties de slot, "As du Blackjack" = 100 victoires) [Should] (cf. §3-Fidélisation)

### Module: Programme de Fidélité VIP

- [US-133] En tant que joueur, je veux accumuler des points de fidélité (XP) en jouant, quel que soit le jeu [Must] (cf. §1-Contexte)
- [US-134] En tant que joueur, je veux monter de niveau (rangs : Bronze, Argent, Or, Platine, Diamant) avec des paliers débloquant des bonus croissants [Should] (cf. §3-Fidélisation)
- [US-135] En tant que joueur, je veux voir ma barre d'XP et ma progression vers le prochain rang [Must] (cf. §2-Joueur)

### Module: Système de notifications

- [US-127] En tant que joueur, je veux recevoir une notification toast en jeu lorsque la récompense quotidienne est disponible [Must] (cf. §4-Joueur #3)
- [US-128] En tant que joueur, je veux recevoir une notification sonore lorsqu'un gain important (≥ 50x mise) est remporté [Should] (cf. §3-Social)
- [US-129] En tant que joueur, je veux recevoir une notification lorsqu'un défi est complété [Should] (cf. §3-Fidélisation)
- [US-130] En tant que joueur, je veux recevoir une notification lorsqu'une place se libère sur une table de poker où je suis en waitlist [Must] (cf. §6-Waitlist)

### Module: Admin Dashboard

- [US-131] En tant qu'admin, je veux me connecter via une interface sécurisée distincte au panel d'administration [Must] (cf. §2-Admin, §4-Admin #1)
- [US-132] En tant qu'admin, je veux voir un dashboard avec KPIs (utilisateurs actifs, parties jouées, distribution par jeu, solde total, House Account) [Must] (cf. §2-Admin, §4-Admin #2, §5-Métier-House Account)

### Module: Admin - Gestion Économique

- [US-ECO-001] En tant qu'admin, je veux configurer tous les paramètres économiques : bonus de bienvenue, récompense quotidienne (montant de base et paliers de streak), mises min/max par jeu, prix des compétitions et courses, récompenses de tâches [Must] (cf. §5-Métier-House Account)
- [US-ECO-002] En tant qu'admin, je veux recharger le House Account via un bouton "Dépôt" (sans coût réel, monnaie purement virtuelle) en spécifiant un montant, afin d'injecter des jetons dans l'économie si nécessaire [Must] (cf. §5-Métier-House Account)
- [US-ECO-003] En tant qu'admin, je veux configurer les paramètres de chaque jeu (house edge, limites de mise min/max, activation/désactivation) [Must] (cf. §2-Admin, §4-Admin #4)
- [US-ECO-004] En tant qu'admin, je veux créer des campagnes de bonus (multiplicateur de récompense quotidienne x2/x3, week-end bonus, bonus de dépôt, free spins offerts) [Should] (cf. §2-Admin, §4-Admin #6)

### Module: Admin - Utilisateurs & Modération

- [US-133] En tant qu'admin, je veux gérer les utilisateurs (recherche, suspension, bannissement, suppression) [Must] (cf. §2-Admin, §4-Admin #3)
- [US-135] En tant qu'admin, je veux consulter l'historique détaillé des transactions de tout utilisateur [Must] (cf. §2-Admin, §4-Admin #5)
- [US-136] En tant qu'admin, je veux publier des notifications et annonces visibles par tous les joueurs [Should] (cf. §2-Admin, §4-Admin #6)
- [US-137] En tant qu'admin, je veux modérer le chat (supprimer des messages, bannir un joueur du chat) [Should] (cf. §2-Admin, §4-Admin #7)

### Module: Admin - Audit & Logs

- [US-139] En tant qu'admin, je veux voir les logs applicatifs et d'audit (connexions, actions sensibles) [Must] (cf. §4-Admin #5, §5-Qualité-Logging)
- [US-LOG-001] En tant qu'admin, je veux que toute action admin (modification économique, recharge house, suspension utilisateur, changement de config jeu) soit automatiquement enregistrée dans un journal d'audit horodaté avec l'identité de l'admin [Must] (cf. §5-Métier-House Account)
- [US-LOG-002] En tant qu'admin, je veux consulter et filtrer le journal d'audit par date, type d'action et admin [Must] (cf. §4-Admin #5)
- [US-LOG-003] En tant qu'admin, je veux que les logs incluent les valeurs AVANT et APRÈS modification pour traçabilité complète [Should] (cf. §5-Métier)
- [US-140] En tant qu'admin, je veux exporter les rapports de données et logs (CSV/JSON) [Nice] (cf. §2-Admin)

### Module: Internationalisation (i18n)

- [US-141] En tant que joueur, je veux que l'interface soit disponible en français et en anglais, avec détection automatique basée sur les préférences du navigateur [Must] (cf. §3-Accessibilité, §5-Risques-i18n temps réel)
- [US-142] En tant que joueur, je veux basculer manuellement la langue à tout moment via un sélecteur dans le header [Must] (cf. §3-Accessibilité)
- [US-143] En tant que joueur, je veux que les messages Socket.io (chat, annonces de jeu, notifications) soient affichés dans la langue sélectionnée [Must] (cf. §5-Risques-i18n temps réel)
- [US-144] En tant que joueur, je veux que les textes statiques (menus, règles des jeux, pages légales) soient externalisés et traduits [Must] (cf. §3-Accessibilité)

### Module: Jeu Responsable & Conformité

- [US-145] En tant que joueur, je veux voir la mention "Ce jeu est un divertissement sans argent réel" sur chaque page de jeu [Must] (cf. §5-Réglementaires)
- [US-146] En tant que joueur, je veux configurer une limite de temps de jeu quotidienne avec blocage automatique [Must] (cf. §5-Réglementaires-Jeu responsable)
- [US-147] En tant que joueur, je veux activer l'auto-exclusion (période de 24h à 30 jours) pendant laquelle je ne peux pas me connecter [Must] (cf. §5-Réglementaires-Jeu responsable)
- [US-148] En tant que joueur, je veux consulter une page d'aide avec des ressources sur le jeu responsable [Should] (cf. §5-Réglementaires)
- [US-149] En tant que joueur, je veux consentir explicitement aux CGU et à la politique de confidentialité lors de l'inscription (GDPR) [Must] (cf. §5-Réglementaires-GDPR)
- [US-150] En tant que joueur, je veux exporter mes données personnelles au format JSON (GDPR) [Must] (cf. §5-Réglementaires-GDPR)

---

## 2. Spécifications non-fonctionnelles

| ID | Catégorie | Spécification | Critère d'acceptation | Priorité |
|---|---|---|---|---|
| NF-001 | Performance | Latence des événements Socket.io < 100 ms (95e percentile) | Mesuré avec des outils de monitoring temps réel | Must |
| NF-002 | Performance | Temps de réponse API REST < 200 ms (95e percentile) | Tests de charge avec k6 ou Artillery | Must |
| NF-003 | Performance | Le temps de chargement initial (First Contentful Paint) < 2s sur connexion standard | Lighthouse audit ≥ 90 | Should |
| NF-004 | Performance | Support de 1 000 joueurs simultanés sans dégradation (sans dépasser les seuils NF-001 et NF-002) | Tests de charge avec simulateur de connexions | Must |
| NF-005 | Sécurité | Authentification par JWT avec refresh tokens, durée de vie access_token = 15 min | Revue de code, test d'intrusion | Must |
| NF-006 | Sécurité | Mots de passe hashés avec bcrypt (cost factor ≥ 12) | Revue de code | Must |
| NF-007 | Sécurité | Rate limiting : max 5 tentatives de connexion par minute par IP | Test de résilience | Must |
| NF-008 | Sécurité | Rate limiting par action de jeu : max 10 actions/s par joueur | Test de résilience | Must |
| NF-009 | Sécurité | Toute logique de jeu est serveur-authoritative (résultat validé côté serveur) | Revue de code, test d'intégration | Must |
| NF-010 | Sécurité | 2FA optionnel via TOTP (Time-based One-Time Password) | Test fonctionnel | Should |
| NF-011 | Disponibilité | Uptime 99,9 % (hors maintenance planifiée) | Monitoring SLA | Must |
| NF-012 | Disponibilité | Backup complet PostgreSQL quotidien, backup WAL toutes les heures | Test de restauration | Must |
| NF-013 | Disponibilité | Redis en mode haute disponibilité (sentinel ou cluster) | Test de basculement | Should |
| NF-014 | Compatibilité | Support Chrome, Firefox, Safari, Edge (2 dernières versions majeures) | Tests e2e multi-navigateurs | Must |
| NF-015 | Compatibilité | Interface responsive : mobile (≥320px), tablette (≥768px), desktop (≥1024px) | Tests responsive, Lighthouse | Must |
| NF-016 | i18n | 100 % des textes UI externalisés dans des fichiers JSON de traduction | Audit de code | Must |
| NF-017 | i18n | Les événements Socket.io utilisent des clés de traduction (pas de texte brut) | Revue de code | Must |
| NF-018 | Sécurité | Connexions HTTPS obligatoires (TLS 1.3) | Test SSL | Must |
| NF-019 | Qualité | Couverture de tests unitaires ≥ 80 % (Vitest) | Rapport de couverture CI | Must |
| NF-020 | Qualité | Tests e2e couvrant les 10 flux critiques (inscription, connexion, jeu principal, cash out, etc.) | Tests Playwright passent en CI | Must |
| NF-021 | Qualité | Logging structuré (JSON) avec corrélation par requête (request ID) | Revue de code | Should |
| NF-022 | Performance | Cache Redis pour les données fréquemment lues (solde, classements, configurations) | Revue de code | Must |
| NF-023 | Scalabilité | Architecture permettant le scaling horizontal via adapter Redis Socket.io | Test avec multiple instances | Must |

---

## 3. Contraintes techniques

| ID | Contrainte | Détail |
|---|---|---|
| CT-001 | Frontend | React 18+ avec TypeScript, build Vite |
| CT-002 | Styling | Tailwind CSS, animations via Motion (ex Framer Motion) |
| CT-003 | State management | Zustand |
| CT-004 | Backend | Node.js + TypeScript, framework Fastify |
| CT-005 | Temps réel | Socket.io avec adapter Redis pour scaling |
| CT-006 | Base de données | PostgreSQL pour les données persistantes (ACID) |
| CT-007 | Cache & files d'attente | Redis pour cache, sessions, pub/sub, BullMQ |
| CT-008 | ORM | Prisma |
| CT-009 | Tests unitaires | Vitest |
| CT-010 | Tests e2e | Playwright |
| CT-011 | CI/CD | GitHub Actions |
| CT-012 | Monitoring | Prometheus + Grafana |
| CT-013 | Logging | ELK Stack (Elasticsearch, Logstash, Kibana) |
| CT-014 | Architecture | Monolithique modulaire (services séparés par domaine dans un même processus) |

---

## 4. Règles métier

| ID | Règle | Description |
|---|---|---|
| RM-001 | Âge minimum | L'utilisateur doit confirmer avoir 18 ans ou plus lors de l'inscription |
| RM-002 | Monnaie virtuelle | Aucune transaction en argent réel. Toute la monnaie est strictement virtuelle |
| RM-003 | Identification des bots | Tout bot est visuellement identifiable par le tag "[Bot]" et/ou un badge dédié |
| RM-004 | House edge configurable | L'admin peut modifier le house edge de chaque jeu via le panel (par défaut : valeur du §6) |
| RM-005 | Distribution des jetons quotidiens | Les jetons gratuits quotidiens sont déduits du solde House Account |
| RM-006 | Bonus de bienvenue | Un nouveau joueur reçoit 5 000 jetons de bienvenue une seule fois après inscription |
| RM-007 | RNG certifié | Les jeux utilisent un RNG cryptographiquement sûr (CSPRNG) ou HMAC-SHA256 pour le Provably Fair |
| RM-008 | Atomicité des transactions | Une mise et la mise à jour du solde sont atomiques (transaction PostgreSQL) |
| RM-009 | Résultat serveur-authoritative | Tout résultat de jeu est calculé et validé côté serveur, jamais côté client |
| RM-010 | Complément par bots | Pour Poker, si moins de 2 joueurs humains, des bots sont ajoutés pour atteindre le minimum (2 joueurs) |
| RM-011 | House capital initial | Le House Account démarre avec 50 000 000 jetons de capital virtuel |
| RM-012 | Mise minimale Poker | La mise minimale au Poker est de 100 jetons |
| RM-013 | Mise minimale autres jeux | La mise minimale pour tous les autres jeux est de 10 jetons |
| RM-014 | Paramètres économiques configurables | L'admin peut modifier bonus bienvenue, daily reward, prix compétitions, house edge via le panel |
| RM-015 | Recharge House Account | L'admin peut ajouter des jetons au House Account via "Dépôt" (gratuit, virtuel) |
| RM-016 | Audit obligatoire | Toute action admin est horodatée et loggée avec identité, valeur avant/après |

---

## 5. Contraintes réglementaires

| ID | Contrainte | Description |
|---|---|---|
| CR-001 | Mention légale | Afficher "Ce jeu est un divertissement sans argent réel" sur chaque page de jeu |
| CR-002 | Terminologie | "Miser", "gagner", "paris" sont utilisables librement dans le contexte du jeu |
| CR-003 | GDPR | Conforme au Règlement Général sur la Protection des Données (consentement, export, effacement) |
| CR-004 | Jeu responsable | Proposer des options de limite de temps, limites de dépense, et auto-exclusion |
| CR-005 | Cookies | Bannière de consentement cookies conforme GDPR |
| CR-006 | CGU | Conditions Générales d'Utilisation accessibles depuis le footer de toute page |

---

## 6. Définitions et vocabulaire

| Terme | Définition |
|---|---|
| House Account | Compte virtuel tracking le capital de la maison : capital initial + pertes joueurs - gains joueurs - jetons gratuits distribués |
| House Edge | Avantage mathématique de la maison sur chaque jeu, exprimé en pourcentage |
| RTP | Return To Player : pourcentage des mises retourné aux joueurs sur le long terme (100 % - house edge) |
| Provably Fair | Système de vérification cryptographique permettant au joueur de vérifier que le résultat n'a pas été manipulé |
| Serveur-Authoritative | Architecture où le serveur valide et exécute toute la logique de jeu (anti-triche) |
| Monnaie Virtuelle | Jetons sans valeur monétaire réelle, utilisables uniquement sur la plateforme pour jouer |
