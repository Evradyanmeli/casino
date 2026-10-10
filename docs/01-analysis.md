# Analyse du problème : Casino Social (Monnaie Virtuelle)

## 1. Contexte

Une plateforme de **social casino** est un service en ligne où les joueurs utilisent une monnaie strictement virtuelle (sans valeur réelle) pour jouer à des jeux de casino. Contrairement au gambling réel, l'objectif est le divertissement pur : pas de dépôt d'argent réel, pas de retrait possible. Le marché du social casino représentait environ **10,11 milliards USD en 2026**, avec une projection à 14,23 milliards en 2030 (Research and Markets). Des plateformes comme **Stake.us**, **Roobet**, **BC.Game**, **Pulsz**, **High 5 Casino**, et **McLuck** dominent ce secteur aux États-Unis avec des millions d'utilisateurs mensuels.

Ces plateformes génèrent des revenus via :
- Achats optionnels de monnaie virtuelle (IAP)
- Récompenses publicitaires (rewarded ads)
- Abonnements VIP

Les utilisateurs viennent pour l'expérience ludique, les classements, les défis quotidiens et l'interaction sociale.

## 2. Acteurs

### Joueur
- S'inscrit et se connecte (email + Google OAuth)
- Gère son profil et son portefeuille virtuel
- Choisit un jeu, place des mises, encaisse des gains virtuels
- Consulte son historique, ses statistiques et son classement
- Participe aux défis et récompenses quotidiennes

### Administrateur
- Gère les utilisateurs (bannissement, modération)
- Configure les jeux (paramètres, RTP, house edge)
- Consulte les statistiques et tableaux de bord
- Consulte le **House Account** (capital maison, rentabilité virtuelle)
- Publie des notifications et événements
- Modère les chats et les comportements

## 3. Objectifs métier

1. **Expérience réaliste** — reproduire le sensation des vrais casinos avec une monnaie virtuelle
2. **Fidélisation** — classements, récompenses quotidiennes, streaks, achievements
3. **13 jeux** — offrir une variété pour tous les types de joueurs (dont 3 variantes de slots)
4. **Accessibilité** — responsive, bilingue FR/EN, mobile-first
5. **Transparence** — système provably fair pour les jeux internes, RNG certifié
6. **Social** — chat, profils, leaderboards, tournois
7. **Monétisation optionnelle** — achats de monnaie virtuelle, pas obligatoire

## 4. Flux principaux

### Joueur
1. Inscription (email + mot de passe) → validation email
2. Connexion → dashboard avec solde et jeux disponibles
3. Obtention de monnaie virtuelle (jeton de bienvenue, récompense quotidienne, achat optionnel)
4. Sélection d'un jeu → interface de jeu → paramétrage de la mise
5. Déroulement de la partie (temps réel via Socket.io)
6. Résultat → mise à jour du solde → historique
7. Consultation du profil, classements, défis

### Administrateur
1. Connexion au panel admin
2. Dashboard avec KPIs (utilisateurs actifs, parties jouées, distribution des jeux)
3. Gestion des utilisateurs (recherche, suspension, suppression)
4. Configuration des jeux (house edge, limites de mise, maintenance)
5. Consultation des logs et de l'historique
6. Publication d'événements et campagnes

## 5. Contraintes

### Techniques
- **Frontend** : React (TypeScript recommandé)
- **Backend** : Node.js (TypeScript recommandé)
- **Temps réel** : Socket.io pour les parties en direct
- **Internationalisation** : i18n français / anglais
- **Design responsive** : mobile-first, adaptatif desktop/tablette
- **Base de données** : PostgreSQL (ACID) + Redis (cache, sessions, pub/sub)
- **State management frontend** : Zustand ou Redux Toolkit

### Métier
- Monnaie strictement virtuelle, pas de transactions réelles
- Pas de gambling réel — purement divertissement
- Mention légale obligatoire : "Ce jeu est un divertissement sans argent réel"
- Age minimum : 18+
- **House Account** : capital de départ pour la maison, tracking de rentabilité
  - Chaque perte joueur → crédit maison ; chaque gain joueur → débit maison
  - Les jetons quotidiens offerts sont déduits du house account (dépense marketing)
  - Dashboard de visualisation de la rentabilité virtuelle
- **Multi-joueurs & Bots** : complément automatique par bot si < 1 autre joueur
  - Bots avec stratégies réalistes (basées sur les règles standards du jeu)

### Réglementaires
- Afficher clairement qu'aucun argent réel n'est engagé
- Terminologie libre : "miser", "gagner", "paris" utilisés sans restriction (contexte de jeu)
- Conforme GDPR pour les utilisateurs européens
- Options de jeu responsable : limites de temps, limites de dépense de monnaie virtuelle

### Qualité et architecture
- Tests unitaires et d'intégration (Vitest / Jest)
- CI/CD via GitHub Actions
- Logging structuré (ELK stack ou équivalent)
- Monitoring (Prometheus / Grafana)
- Scalabilité horizontale via adapter Redis pour Socket.io

## 6. Références et solutions existantes

### Plateformes de référence
| Plateforme | Particularité | Jeux populaires |
|---|---|---|
| **Stake.us** / **Stake.com** | Leader mondial, jeux originaux (Stake Originals), provably fair, 99% RTP sur les jeux internes | Crash, Dice, Plinko, Mines, Limbo, Keno |
| **Roobet** | Interface épurée, programme VIP transparent, communauté forte | Crash, Towers, Mines, Slots |
| **BC.Game** | Multi-devises, nombreux bonus, plus de 10 000 jeux | Crash, Dice, Plinko, Slots, Live Casino |
| **Pulsz** | Modèle sweepstakes, gold coins + sweeps coins | Slots, Blackjack, Roulette |
| **High 5 Casino** | Marque établie, jeux propriétaires | Slots, Table Games, Bingo |

### Mécaniques de jeu

#### 1. Slot Machine 3 Rouleaux
- 3 rouleaux, 1-5 lignes de paiement
- Symboles classiques : cerise, cloche, sept, bar, diamant
- RTP : 94-96%
- Jackpot progressif interne possible

#### 2. Slot Machine 4 Rouleaux
- 4 rouleaux, 1-10 lignes de paiement
- Symboles classiques + bonus (wild, scatter)
- RTP : 95-97%
- Free spins sur 3+ scatter

#### 3. Slot Machine 5 Rouleaux
- 5 rouleaux, 1-25 lignes de paiement (ways to win)
- Symboles thématiques + wild, scatter, multiplicateurs
- RTP : 96-98%
- Bonus rounds interactifs

#### 4. Blackjack
- Joueur vs croupier (ou RNG dealer)
- Objectif : battre la main du croupier sans dépasser 21
- Valeurs : cartes numériques = valeur faciale, figures = 10, As = 1 ou 11
- Actions : Hit, Stand, Double, Split, Surrender
- House edge : ~0.5% avec stratégie de base
- Implémentation : serveur-authoritative, une main à la fois

#### 5. Roulette
- Roue avec 37 (européenne) ou 38 (américaine) numéros
- Types de mises : plein, cheval, carré, douzaine, colonne, rouge/noir, pair/impair, manque/passe
- Paiements : 35:1 pour un plein, 1:1 pour les chances simples
- House edge : 2.7% (européenne), 5.26% (américaine)
- Implémentation : RNG détermine le numéro gagnant

#### 6. Poker (Texas Hold'em)
- Le plus complexe : multi-joueurs (2-9 par table)
- Tours d'enchères : pré-flop, flop, turn, river
- Mains : quinte flush royale > quinte flush > carré > full > couleur > suite > brelan > double paire > paire > carte haute
- Logique : blinds, showdown, side pots
- Défis : gestion des temps (timer), détection d'abandon, bot detection
- **Lobby** : interface listant toutes les tables (nom, stakes, nb joueurs, waitlist), bouton "Rejoindre"
- **Waitlist** : file d'attente par table. Quand place libre → notification au 1er de la waitlist, 30s pour accepter
- **Création de table** : apparaît dans le lobby, les joueurs rejoignent depuis la liste
- **Bots étiquetés "Bot"** : stratégie réaliste mais identifiés comme non-humains
- **Timer d'action** : 15-30s par tour de mise
- Implémentation : serveur-authoritative, rooms Socket.io, gestion d'état complexe

#### 7. Dés / Craps
- Jet de deux dés, pariez sur le résultat
- Mises principales : Pass Line, Don't Pass, Come, Don't Come
- Mises secondaires : Place bets, Field bets, Proposition bets
- House edge : 1.36% (Pass Line) à 16.67% (certains props)
- Implémentation : RNG pour les dés, logique de point

#### 8. Bingo
- Grille de N numéros (souvent 5x5 = 75 boules, style BINGO)
- Tirage aléatoire de numéros
- Objectif : compléter une ligne, colonne, diagonale ou motif
- Modes possibles : 1 joueur (solo), multi-joueurs (salle avec cartes automatiques)
- Implémentation : ticketing + tirage périodique

#### 9. Mines
- Grille 5x5 (25 cases), M mines cachées (1-24)
- Le joueur clique sur des cases : gemme = gain, mine = perte
- Cash out possible à tout moment
- Multiplicateur augmente avec chaque gemme découverte
- RTP : 99%, House edge : 1%
- Provably fair : Fisher-Yates shuffle sur les positions, scellé par HMAC-SHA256

#### 10. Crash
- Multiplicateur démarre à 1x et monte
- Le joueur doit cash out avant le crash
- Point de crash prédéterminé via HMAC-SHA256
- Distribution : 2% instant bust, ~49% ≥2x, ~10% ≥10x
- RTP : 98%, House edge : 2%
- Modes : solo ou multi-joueurs (live bets)

#### 11. Plinko
- Bille lâchée du haut d'un triangle de chevilles
- Rangées configurables (8-16)
- Niveaux de risque : Low, Medium, High
- Multiplicateurs : 0x (perte) à 1000x+
- RTP : 97-99% selon configuration
- Provably fair : résultat prédéterminé, l'animation est une visualisation

#### 12. Wheel of Fortune (Big Six / Money Wheel)
- Roue verticale avec 54 segments
- Symboles : $1 (24x), $2 (15x), $5 (7x), $10 (4x), $20 (2x), Joker (2x)
- Paiements : de 1:1 à 40:1 selon le symbole
- House edge : 11-24% (jeu à forte marge)

#### 13. Limbo
- Inverse du Crash : le joueur définit un multiplicateur cible
- Résultat généré instantanément
- Win si le résultat ≥ multiplicateur cible
- RTP : 99%, House edge : 1%
- Probabilité de win : 49.5% à 2x, 9.9% à 10x, 0.99% à 100x
- Multiplicateur max : 1 000 000x (Stake)

### Librairies Node.js pour le temps réel

| Librairie | Cas d'usage |
|---|---|
| **Socket.io** | Standard de facto : rooms, namespaces, fallback transports, adapter Redis pour scaling horizontal |
| **Fastify** | Framework HTTP plus rapide qu'Express, support natif WebSocket |
| **Bull / BullMQ** | File d'attente basée Redis pour tâches asynchrones |
| **Drizzle ORM / Prisma** | ORM TypeScript pour PostgreSQL |
| **ioredis** | Client Redis robuste pour pub/sub, cache, sessions |

### Librairies React pour animations

| Librairie | Cas d'usage |
|---|---|
| **Motion (ex Framer Motion)** | Animations déclaratives, layout transitions, gestures, spring physics — standard pour React |
| **React Spring** | Animations physiques (ressort), bon pour interactions complexes |
| **Three.js / React Three Fiber** | Animations 3D (roue de fortune, slots 3D) |
| **GSAP** | Timeline complexes, mais plus impératif et moins React-friendly |
| **CSS Modules + Tailwind CSS** | Animations légères via transitions/animations CSS |

### Architecture typique (monolithique modulaire)

```
┌─────────────────────────────────────┐
│            Load Balancer            │
├─────────────────────────────────────┤
│    Frontend React (responsive web)  │
├─────────────────────────────────────┤
│         API Gateway (Fastify)       │
├─────────────────────────────────────┤
│  Auth    │  Wallet   │  Game(s)     │
│  Service │  Service  │  Engine(s)   │
├─────────────────────────────────────┤
│  Socket.IO  │  Redis  │  PostgreSQL │
│  (real-time)│ (cache) │   (data)    │
└─────────────────────────────────────┘
```

- **Monolithique modulaire** : services séparés par domaine (auth, wallet, game) mais dans un même processus/déploiement, facilitant le développement et le déploiement
- **Serveur-authoritative** : toute logique de jeu est validée côté serveur pour anti-triche
- **Provably Fair** : hash chain + client seed + nonce pour transparence

## 7. Classification

**Grande application — monolithique modulaire validé par l'utilisateur**

Justification :
- 13 jeux (3 slots + 10 autres) avec des mécaniques très différentes, nécessitant une architecture flexible
- Temps réel multi-joueurs (Poker, Crash multi) = complexité
- Gestion de portefeuille virtuel avec concurrence (transactions atomiques)
- Frontend riche avec animations complexes
- i18n, responsive, accessibilité
- Backoffice admin complet

Le monolithe modulaire est privilégié pour :
- Éviter la complexité opérationnelle des microservices au début
- Permettre une itération rapide
- Séparer les domaines logiques (auth, wallet, chaque jeu) sans séparation réseau
- Pouvoir extraire des services plus tard si nécessaire

## 8. Risques

### Critique : Poker (Texas Hold'em)
- **Multi-joueurs** : gestion de 2-9 joueurs par table, matchmaking, sessions
- **Logique complexe** : tours d'enchères, combinaisons, side pots, splits
- **Temps réel** : synchronisation d'état entre tous les joueurs, timers par tour
- **Anti-triche** : détection de bots, collusion entre joueurs
- **Lobby + invitations** : système d'invitation push, timeout 10s, fallback bot
- **Stratégie de repli** : version simplifiée (heads-up uniquement ou poker à 1 joueur vs dealer)

### Haute : Système de bots multi-joueurs
- Bots doivent jouer de manière réaliste (stratégies cohérentes)
- Logique spécifique par jeu : poker (mise selon main), crash (cashout timing), etc.
- Bots ne doivent pas être détectables comme non-humains
- Solution : arbres de décision paramétrables, comportements aléatoires

### Moyenne : House Account & tracking de rentabilité
- Calcul correct : capital initial + pertes joueurs - gains joueurs - jetons gratuits
- Transactions concurrentes : un gain joueur et une perte maison doivent être atomiques
- Solution : transactions PostgreSQL, double-entry ledger

### Haute : Performance temps réel
- 11 jeux simultanés avec mise à jour en temps réel
- Socket.io nécessite scaling horizontal via Redis adapter
- Les jeux Crash et Plinko (multi-joueurs) génèrent un volume élevé d'événements
- Solution : namespaces Socket.io par jeu, Redis pub/sub, cluster Node.js

### Haute : Anti-triche / Fair play
- Un joueur pourrait tenter de manipuler le RNG côté client
- Solution : tout calcul de résultat côté serveur (server-authoritative)
- Logs immutables pour audit
- Rate limiting sur les actions de jeu

### Moyenne : Portefeuille virtuel
- Concurrence d'accès : un joueur pourrait jouer plusieurs parties simultanément
- Solution : transactions atomiques PostgreSQL (SERIALIZABLE), verrouillage optimiste
- Décrémentation automatique des mises, pas de double dépense

### Faible : Complexité du Bingo multi-joueurs
- Gestion de salles, ticketing, tirages synchronisés
- Solution plus simple initialement : Bingo solo uniquement

### Moyenne : i18n temps réel
- Traduction dynamique des événements Socket.io (messages de jeu, chat, notifications)
- Solution : structure JSON avec clés de traduction côté client, événements normalisés

### Moyenne : Responsive pour jeux complexes
- Roulette animée, slots 3D, Plinko physique — difficiles sur mobile
- Solution : design mobile-first dès le départ, versions simplifiées sur petit écran

### Moyenne : Modération de contenu
- Chat, pseudos, profils peuvent contenir du contenu inapproprié
- Solution : filtres automatiques + signalement + modération manuelle

### Faible : Juridique / réglementaire
- Certains pays encadrent les social casinos (loot boxes, monnaie virtuelle)
- Solution : mentions légales claires, géo-blocage si nécessaire

### Faible : Coûts d'infrastructure
- Stack temps réel (Socket.io + Redis + PostgreSQL) peut devenir coûteux
- Solution : monitoring des coûts, scaling horizontal progressif

### Moyenne : Sécurité des comptes
- Credential stuffing, rate limiting, gestion des sessions
- Solution : rate limiting, 2FA optionnel, monitoring des connexions suspectes

### Surveillance
- Monitoring via Prometheus/Grafana
- Logs centralisés via ELK
- Alertes sur anomalies de solde, spikes de latence
- Tests de charge réguliers sur Socket.io
