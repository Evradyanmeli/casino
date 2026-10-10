# Architecture technique

> Références : [01-analysis.md](./01-analysis.md), [02-requirements.md](./02-requirements.md)
> Validation : Architecture monolithique modulaire (hexagonale) validée par l'utilisateur

---

## 1. Stack technique

| Couche | Technologie | Version | Justification |
|--------|-------------|---------|---------------|
| **Frontend** | React | 18+ | Standard industriel, écosystème riche, compatibilité Socket.io |
| | TypeScript | 5.x | Typage statique, maintenabilité |
| | Vite | 5.x | Build rapide, HMR natif, tree-shaking |
| | React Router | 6.x | Routing déclaratif, lazy loading |
| | Zustand | 4.x | State management léger, performant, TypeScript-first |
| | Socket.io-client | 4.x | Temps réel bi-directionnel, fallback transports |
| | i18next | 23.x | i18n complet, lazy loading, détection de langue |
| | Motion (ex Framer Motion) | 11.x | Animations déclaratives, layout transitions |
| | Tailwind CSS | 3.x | Utility-first, responsive, mobile-first |
| **Backend** | Node.js | 22+ (LTS) | Runtime performant, event loop adapté au temps réel |
| | TypeScript | 5.x | Typage partagé frontend/backend |
| | Fastify | 5.x | Framework HTTP haute performance, validation native |
| | Socket.io | 4.x | WebSocket + fallback, rooms, namespaces, Redis adapter |
| | Prisma | 5.x | ORM TypeScript, migrations, type-safety |
| | ioredis | 5.x | Client Redis robuste, cluster/pub-sub support |
| | BullMQ | 5.x | File d'attente Redis pour tâches asynchrones |
| | Passport.js | 0.7 | Stratégies d'auth (JWT, Google OAuth2) |
| | Zod | 3.x | Validation de schémas côté serveur |
| **Base de données** | PostgreSQL | 16 | ACID, transactions, JSONB, performance |
| **Cache / Session** | Redis | 7 | Cache, sessions, pub/sub, files d'attente |
| **Conteneurisation** | Docker + docker-compose | - | Reproducibilité, isolation, scaling |
| **Tests** | Vitest | 2.x | Frontend + backend, compatible Vite |
| | Playwright | - | Tests e2e multi-navigateurs |
| **CI/CD** | GitHub Actions | - | Intégration continue, déploiement |
| **Monitoring** | Prometheus + Grafana | - | Métriques, alerting |
| **Logging** | ELK Stack | - | Logs centralisés, Kibana dashboards |

---

## 2. Architecture hexagonale (ports & adapters)

L'architecture suit le pattern **hexagonal** (ports & adapters) en **monolithique modulaire** : chaque domaine est un module isolé avec ses propres ports (interfaces) et adapters (implémentations concrètes), mais tous les modules vivent dans le même processus Node.js.

### 2.1 Principes directeurs

- **Séparation des préoccupations** : domaine métier (domain), infrastructure technique (infrastructure), API de présentation (api)
- **Dépendances vers l'intérieur** : `api` → `domain` ← `infrastructure` (les adapters dépendent des ports, pas l'inverse)
- **Indépendance technologique** : le domaine ne connaît ni Fastify, ni Prisma, ni Redis
- **Testabilité** : chaque port peut être mocké pour les tests unitaires
- **Évolutivité** : un module peut être extrait en microservice si nécessaire

### 2.2 Structure par module

Chaque module de domaine suit cette structure :

```
domain/<module>/
├── ports/
│   ├── <Module>Repository.ts      (interface de persistence)
│   ├── <Module>Service.ts         (interface de service métier)
│   └── events/                    (ports d'événements sortants)
├── services/
│   └── <Module>DomainService.ts   (implémentation métier pure)
├── models/
│   └── <Module>.ts                (entités / value objects)
└── errors/
    └── <Module>Errors.ts          (erreurs métier)
```

```
infrastructure/
├── database/
│   ├── adapters/                  (implémentations Prisma/PostgreSQL)
│   └── migrations/                (Prisma migrations)
├── redis/
│   └── adapters/                  (cache, pub/sub, sessions)
├── auth/
│   └── adapters/                  (Passport, JWT, Google OAuth)
└── socket/
    └── handlers/                  (Socket.io event handlers)
```

```
api/
├── routes/                        (Fastify route definitions)
├── middleware/                     (auth, validation, admin guards)
├── controllers/                   (request handlers)
└── schemas/                       (Zod validation schemas)
```

### 2.3 Modules détaillés

#### Module 1 : Auth (Authentification)

- **Ports** : `AuthRepository`, `AuthService`, `TokenService`, `SessionService`, `OAuthService`
- **Adapters** : `PostgresAuthRepository`, `PassportAuthAdapter`, `JwtTokenAdapter`, `RedisSessionAdapter`, `GoogleOAuthAdapter`
- **Entités** : `User` (credentials, status, role), `Session` (token, refresh, expires), `OAuthProfile`
- **Services** : `RegisterUser`, `AuthenticateUser`, `RefreshToken`, `ResetPassword`, `Verify2FA`, `DeleteAccount`

#### Module 2 : User (Profil & Gestion)

- **Ports** : `UserRepository`, `ProfileService`, `StatsService`
- **Adapters** : `PostgresUserRepository`, `AvatarStorageAdapter`
- **Entités** : `Profile` (pseudo, avatar, preferences), `Stats` (games_played, wins, biggest_win), `Level` (xp, rank, badges)
- **Services** : `UpdateProfile`, `GetStats`, `CalculateLevel`, `ExportData`

#### Module 3 : Economy (Portefeuille & Wallet)

- **Ports** : `WalletRepository`, `TransactionRepository`, `HouseAccountRepository`, `BonusService`
- **Adapters** : `PostgresWalletRepository`, `PostgresTransactionRepository`, `PostgresHouseAccountRepository`
- **Entités** : `Wallet` (balance, locked_balance), `Transaction` (amount, type, reference, status), `HouseAccount` (capital, total_bets, total_wins, total_bonus)
- **Services** : `CreditBalance`, `DebitBalance`, `GetBalance`, `GetHistory`, `GetHouseAccount`, `CalculateProfitability`

#### Module 4 : DailyRewards (Récompenses quotidiennes)

- **Ports** : `DailyRewardRepository`, `StreakService`
- **Adapters** : `PostgresDailyRewardRepository`, `CacheStreakAdapter` (Redis)
- **Entités** : `DailyReward` (user_id, streak, last_claim, amount, streak_pallet)
- **Services** : `ClaimDailyReward`, `CalculateStreakBonus`, `ResetStreak`

#### Module 5 : Slots (3, 4, 5 rouleaux)

- **Ports** : `GameSessionRepository`, `SlotsEngine`, `PaytableService`, `RandomProvider`
- **Adapters** : `PostgresGameSessionRepository`, `DeterministicRandomAdapter` (HMAC-SHA256), `DefaultPaytableProvider`
- **Entités** : `SlotsSession` (reels, symbols, paylines, bet, win, free_spins_remaining, bonus_round)
- **Services** : `SpinReels`, `CalculateWins`, `TriggerFreeSpins`, `TriggerBonusRound`, `CalculateProgressiveJackpot`

#### Module 6 : Blackjack

- **Ports** : `BlackjackEngine`, `GameSessionRepository`, `DeckProvider`, `RandomProvider`
- **Adapters** : `PostgresGameSessionRepository`, `SecureDeckProvider`, `DeterministicRandomAdapter`
- **Entités** : `BlackjackSession` (hand, dealer_hand, bet, status, insurance, split_hands), `Deck` (cards, shuffle_state)
- **Services** : `DealInitial`, `Hit`, `Stand`, `Double`, `Split`, `Surrender`, `DealerPlay`, `ResolveHand`

#### Module 7 : Roulette

- **Ports** : `RouletteEngine`, `GameSessionRepository`, `RandomProvider`, `BetValidator`
- **Adapters** : `PostgresGameSessionRepository`, `DeterministicRandomAdapter`
- **Entités** : `RouletteSession` (bet_positions, bet_amounts, winning_number, total_win), `BetType` (enum: plein, cheval, carre, douzaine, colonne, rouge_noir, pair_impair, manque_passe)
- **Services** : `PlaceBet`, `SpinWheel`, `CalculateRouletteWins`, `GetHistory`

#### Module 8 : Poker (Texas Hold'em)

- **Ports** : `PokerTableRepository`, `PokerHandRepository`, `PokerEngine`, `BotStrategyProvider`, `WaitlistRepository`, `RandomProvider`
- **Adapters** : `PostgresPokerTableRepository`, `PostgresPokerHandRepository`, `AiBotStrategyAdapter`, `PostgresWaitlistRepository`, `SocketPokerBroadcastAdapter`
- **Entités** : `PokerTable` (id, name, blinds, max_players, status, players, deck, community_cards, pot, side_pots), `PokerHand` (table_id, player_id, cards, bet, folded, winnings), `WaitlistEntry`
- **Services** : `CreateTable`, `JoinTable`, `LeaveTable`, `StartHand`, `DealCards`, `PreFlop`, `Flop`, `Turn`, `River`, `Showdown`, `CalculateHandWinner`, `HandleTimer`, `BotAutoComplete`, `ManageWaitlist`

#### Module 9 : Crash

- **Ports** : `CrashEngine`, `GameSessionRepository`, `RandomProvider`, `CrashBroadcast`
- **Adapters** : `PostgresGameSessionRepository`, `DeterministicRandomAdapter`, `SocketCrashBroadcastAdapter`
- **Entités** : `CrashSession` (id, multiplier, crash_point, status, bets), `CrashBet` (user_id, bet_amount, cashed_out_at, win_amount)
- **Services** : `StartRound`, `PlaceBet`, `CashOut`, `CalculateMultiplier`, `Crash`, `DistributeWins`

#### Module 10 : Plinko

- **Ports** : `PlinkoEngine`, `GameSessionRepository`, `RandomProvider`, `PlinkoMultiplierProvider`
- **Adapters** : `PostgresGameSessionRepository`, `DeterministicRandomAdapter`, `DefaultMultiplierProvider`
- **Entités** : `PlinkoSession` (rows, risk_level, bet_amount, path, landing_slot, multiplier, win_amount)
- **Services** : `DropBall`, `CalculatePath`, `DetermineSlot`, `GetMultiplierGrid`

#### Module 11 : Mines

- **Ports** : `MinesEngine`, `GameSessionRepository`, `RandomProvider`, `ProvablyFairProvider`
- **Adapters** : `PostgresGameSessionRepository`, `DeterministicRandomAdapter`, `HMACSHA256ProvablyFair`
- **Entités** : `MinesSession` (grid_size, mine_count, revealed_cells, mine_positions, current_multiplier, status, cash_out_amount)
- **Services** : `StartGame`, `RevealCell`, `CashOut`, `CalculateMultiplier`, `VerifyProvablyFair`

#### Module 12 : WheelOfFortune

- **Ports** : `WheelEngine`, `GameSessionRepository`, `RandomProvider`
- **Adapters** : `PostgresGameSessionRepository`, `DeterministicRandomAdapter`
- **Entités** : `WheelSession` (segments, bets_by_segment, winning_segment, total_win), `WheelSegment` (label, multiplier, probability)
- **Services** : `PlaceBet`, `SpinWheel`, `DetermineWinner`, `CalculatePayout`

#### Module 13 : Limbo

- **Ports** : `LimboEngine`, `GameSessionRepository`, `RandomProvider`, `ProvablyFairProvider`
- **Adapters** : `PostgresGameSessionRepository`, `DeterministicRandomAdapter`, `HMACSHA256ProvablyFair`
- **Entités** : `LimboSession` (target_multiplier, result_multiplier, bet_amount, win_amount, won)
- **Services** : `Play`, `CalculateResult`, `VerifyProvablyFair`

#### Module 14 : Craps

- **Ports** : `CrapsEngine`, `GameSessionRepository`, `RandomProvider`, `DiceProvider`
- **Adapters** : `PostgresGameSessionRepository`, `DeterministicRandomAdapter`, `SecureDiceProvider`
- **Entités** : `CrapsSession` (point, phase, bets, dice_result, status), `CrapsBet` (type, amount, win_amount)
- **Services** : `PlaceBet`, `RollDice`, `ResolveBets`, `UpdatePoint`, `HandleComeOut`

#### Module 15 : Bingo

- **Ports** : `BingoEngine`, `BingoRoomRepository`, `RandomProvider`, `TimerProvider`
- **Adapters** : `PostgresBingoRoomRepository`, `DeterministicRandomAdapter`, `BullMqTimerAdapter`
- **Entités** : `BingoCard` (grid, marked_numbers, pattern), `BingoRoom` (id, players, cards, drawn_numbers, status, jackpot), `BingoSession`
- **Services** : `BuyCard`, `DrawNumber`, `CheckWin`, `StartRoom`, `EndRoom`, `CalculateJackpot`

#### Module 16 : Tasks & Achievements

- **Ports** : `TaskRepository`, `AchievementRepository`, `ProgressTracker`, `TaskGenerator`
- **Adapters** : `PostgresTaskRepository`, `PostgresAchievementRepository`, `CacheProgressAdapter` (Redis)
- **Entités** : `Task` (id, type, description, progress, max_progress, reward, completed, expires_at), `Achievement` (id, name, badge_url, unlocked_at)
- **Services** : `GetDailyTasks`, `TrackProgress`, `ClaimTask`, `RotateTasks`, `CheckAchievement`, `UnlockAchievement`

#### Module 17 : Daily Race (Compétition)

- **Ports** : `RaceRepository`, `RaceScoreTracker`, `PrizeDistributor`
- **Adapters** : `PostgresRaceRepository`, `CacheRaceAdapter` (Redis leaderboard), `PostgresPrizeDistributor`
- **Entités** : `RaceEntry` (user_id, score, rank, prize, period_start, race_type), `RaceConfig` (prize_tiers, duration)
- **Services** : `UpdateScore`, `GetLeaderboard`, `EndRace`, `DistributePrizes`, `StartNewRace`

#### Module 18 : Shop (Achats de jetons)

- **Ports** : `PackageRepository`, `PurchaseRepository`, `PaymentGateway`
- **Adapters** : `PostgresPackageRepository`, `PostgresPurchaseRepository`, `SimulatedPaymentAdapter` (pas de vrai paiement — divertissement sans argent réel)
- **Entités** : `Package` (id, name, tokens, price, bonus_percentage, popular), `Purchase` (id, user_id, package_id, amount_paid, tokens_received, payment_method, status)
- **Services** : `ListPackages`, `BuyPackage`, `ProcessPayment`, `DeliverTokens`

#### Module 19 : Admin Dashboard

- **Ports** : `KpiProvider`, `AdminRepository`, `ReportGenerator`
- **Adapters** : `PostgresKpiProvider`, `PostgresAdminRepository`, `CsvReportGenerator`, `JsonReportGenerator`
- **Entités** : `AdminAction` (admin_id, action, entity_type, entity_id, before, after, timestamp)
- **Services** : `GetDashboardKpis`, `SearchUsers`, `ModerateChat`, `PublishGlobalNotification`

#### Module 20 : Responsible Gaming (Jeu responsable)

- **Ports** : `LimitRepository`, `ExclusionRepository`, `GameGuard`
- **Adapters** : `PostgresLimitRepository`, `PostgresExclusionRepository`, `RedisGuardCache`
- **Entités** : `DailyLimit` (user_id, time_spent_minutes, betting_limit, reset_at), `SelfExclusion` (user_id, excluded_until, reason)
- **Services** : `SetTimeLimit`, `SetBettingLimit`, `SelfExclude`, `CheckLimits`, `CheckExclusion`

#### Module 21 : Chat

- **Ports** : `MessageRepository`, `ChatModeration`, `ChatBroadcast`
- **Adapters** : `PostgresMessageRepository`, `PostgresChatModeration`, `SocketChatBroadcastAdapter`
- **Entités** : `ChatMessage` (id, user_id, channel, content, emojis, created_at, flagged), `MutedUser` (user_id, muted_until)
- **Services** : `SendMessage`, `MuteUser`, `FlagMessage`, `RemoveMessage`, `GetHistory`

#### Module 22 : Notifications

- **Ports** : `NotificationRepository`, `NotificationSender`, `NotificationTemplate`
- **Adapters** : `PostgresNotificationRepository`, `SocketNotificationSender`, `I18nNotificationTemplate`
- **Entités** : `Notification` (id, user_id, type, title_key, data, read, created_at)
- **Services** : `SendNotification`, `MarkAsRead`, `GetUnread`, `ClearAll`

#### Module 23 : Multiplayer Lobby & Waitlist

- **Ports** : `LobbyRepository`, `WaitlistRepository`, `MatchmakingService`
- **Adapters** : `RedisLobbyAdapter`, `PostgresWaitlistRepository`, `DefaultMatchmakingAdapter`
- **Entités** : `LobbyGame` (game_type, tables, players_in_lobby), `WaitlistSession` (user_id, game_type, table_id, joined_at, status)
- **Services** : `GetLobbyState`, `JoinWaitlist`, `LeaveWaitlist`, `NotifyNextPlayer`, `AutoFill`

#### Module 24 : i18n (Internationalisation)

- **Ports** : `TranslationProvider`, `LanguageDetector`
- **Adapters** : `JsonFileTranslationAdapter`, `BrowserLanguageDetector`
- **Services** : `ServerTranslate` (pour messages Socket.io), `GetAvailableLanguages`, `DetectLanguage`
- **Note** : Les traductions côté client sont gérées par i18next. Le serveur expose des clés de traduction (pas de texte brut) dans les événements Socket.io, le client résout la traduction dans la langue active.

---

## 3. Data model

### 3.1 Diagramme entité-relation (Mermaid ER)

```mermaid
erDiagram
    users ||--o{ transactions : has
    users ||--o{ game_sessions : plays
    users ||--o{ daily_rewards : claims
    users ||--o{ tasks : assigned
    users ||--o{ race_entries : competes
    users ||--o{ chat_messages : sends
    users ||--o{ notifications : receives
    users ||--o{ admin_logs : audited_by
    users ||--o{ responsible_limits : configures
    users ||--o{ shop_purchases : buys
    users ||--o{ poker_tables : sits_at
    users ||--o{ waitlist_entries : waits_in
    users ||--o{ user_achievements : unlocks
    poker_tables ||--o{ poker_hands : contains
    poker_tables ||--o{ waitlist_entries : has_waiting
    poker_hands ||--o{ poker_actions : includes
    bingo_rooms ||--o{ bingo_cards : contains
    bingo_rooms ||--o{ game_sessions : bingo_session

    users {
        uuid id PK
        varchar(255) email UK
        varchar(50) pseudo UK
        varchar(255) password_hash
        varchar(255) google_id UK
        date birth_date
        enum("user","admin") role
        bigint balance "default 0"
        bigint total_earned
        int xp "default 0"
        int level "default 1"
        enum("active","suspended","banned","self_excluded") status
        boolean email_verified "default false"
        varchar(255) avatar_url
        varchar(32) totp_secret
        jsonb preferences
        timestamp created_at "default now()"
        timestamp updated_at
        timestamp deleted_at "nullable, soft delete GDPR"
    }

    transactions {
        uuid id PK
        uuid user_id FK
        bigint amount "positive=credit, negative=debit"
        enum("bet","win","bonus","purchase","daily_reward","task_reward","race_prize","admin_recharge","house_funding","withdrawal","refund") type
        varchar(100) reference
        jsonb metadata
        bigint balance_before
        bigint balance_after
        timestamp created_at "default now()"
    }

    game_sessions {
        uuid id PK
        uuid user_id FK
        uuid table_id FK "nullable, for poker/bingo"
        enum("slots_3","slots_4","slots_5","blackjack","roulette","poker","crash","plinko","mines","wheel","limbo","craps","bingo") game_type
        bigint bet_amount
        bigint win_amount "default 0"
        enum("pending","win","lose","cash_out","push") result
        jsonb result_data "reels, hand, cards, grid state, etc"
        jsonb provably_fair "seed, hash, nonce"
        timestamp created_at "default now()"
    }

    daily_rewards {
        uuid id PK
        uuid user_id FK UK
        int streak "default 0"
        date last_claim
        bigint amount "default 0"
        timestamp created_at
    }

    tasks {
        uuid id PK
        uuid user_id FK
        varchar(100) task_type
        varchar(255) description_key "i18n key"
        int progress "default 0"
        int max_progress
        bigint reward
        boolean completed "default false"
        boolean claimed "default false"
        date assigned_date
        timestamp created_at
    }

    user_achievements {
        uuid id PK
        uuid user_id FK
        varchar(100) achievement_key
        varchar(255) description_key "i18n key"
        varchar(255) badge_url
        timestamp unlocked_at
    }

    race_entries {
        uuid id PK
        uuid user_id FK
        enum("daily","weekly") race_type
        bigint score "total bet amount"
        int rank "nullable, set at end"
        bigint prize "default 0"
        timestamp period_start
        timestamp period_end
        boolean distributed "default false"
    }

    chat_messages {
        uuid id PK
        uuid user_id FK
        varchar(50) channel "global, table:{id}, game:{type}"
        text content
        jsonb emojis
        boolean flagged "default false"
        uuid flagged_by "nullable"
        timestamp created_at "default now()"
        timestamp deleted_at "nullable, soft delete"
    }

    notifications {
        uuid id PK
        uuid user_id FK
        varchar(100) type
        varchar(255) title_key "i18n key"
        jsonb data "interpolated values"
        boolean read "default false"
        timestamp created_at "default now()"
    }

    admin_logs {
        uuid id PK
        uuid admin_id FK
        enum("economy_update","user_suspend","user_ban","game_config","house_recharge","bonus_campaign","notification_broadcast","chat_moderate") action
        varchar(100) entity_type
        uuid entity_id
        jsonb before "snapshot before change"
        jsonb after "snapshot after change"
        timestamp created_at "default now()"
    }

    responsible_limits {
        uuid id PK
        uuid user_id FK UK
        int daily_time_minutes "nullable"
        bigint daily_betting_limit "nullable"
        timestamp self_exclusion_until "nullable"
        timestamp created_at
        timestamp updated_at
    }

    shop_packages {
        uuid id PK
        varchar(100) name
        bigint tokens
        decimal price "real currency amount"
        int bonus_percentage "default 0"
        boolean popular "default false"
        boolean active "default true"
        timestamp created_at
    }

    shop_purchases {
        uuid id PK
        uuid user_id FK
        uuid package_id FK
        decimal amount_paid
        bigint tokens_received
        enum("stripe","paypal") payment_method
        enum("pending","completed","failed","refunded") status
        timestamp created_at
    }

    poker_tables {
        uuid id PK
        varchar(100) name
        bigint small_blind
        bigint big_blind
        int max_players "2-9"
        int min_players_bots "2"
        enum("waiting","playing","finished") status
        jsonb current_state "deck, community_cards, pot, side_pots, current_turn"
        timestamp created_at
    }

    poker_hands {
        uuid id PK
        uuid table_id FK
        uuid player_id FK
        jsonb cards "2 hole cards"
        bigint total_bet
        bigint win_amount "default 0"
        enum("preflop","flop","turn","river","showdown","folded") state
        timestamp created_at
    }

    poker_actions {
        uuid id PK
        uuid hand_id FK
        uuid player_id FK
        enum("fold","check","call","bet","raise","all_in") action_type
        bigint amount
        timestamp created_at
    }

    waitlist_entries {
        uuid id PK
        uuid user_id FK
        uuid table_id FK
        bigint stack_size "min 20BB, max 100BB"
        timestamp joined_at
        enum("waiting","notified","accepted","expired","cancelled") status
    }

    bingo_rooms {
        uuid id PK
        varchar(100) name
        enum("waiting","playing","finished") status
        int max_players
        jsonb drawn_numbers
        bigint jackpot "default 0"
        timestamp created_at
    }

    bingo_cards {
        uuid id PK
        uuid room_id FK
        uuid user_id FK
        jsonb grid "5x5 matrix"
        jsonb marked_positions
        boolean won "default false"
        timestamp created_at
    }
```

### 3.2 Notes sur le modèle de données

- **Transactions double-entry** : chaque transaction enregistre `balance_before` et `balance_after` pour traçabilité complète. Le `type` permet de filter par catégorie. Une transaction `house_funding` est créée pour chaque mouvement impactant le House Account.
- **Soft delete** : les utilisateurs et messages de chat utilisent `deleted_at` pour conformité GDPR (droit à l'effacement).
- **jsonb metadata** : utilisé pour stocker des données flexibles (ex : détails de paiement, informations de session de jeu).
- **Provably fair** : chaque session de jeu stocke `result_data.provably_fair` contenant `server_seed`, `client_seed`, `nonce`, `hash` pour vérification.
- **Indexation** : index sur `(user_id, created_at DESC)` pour transactions, game_sessions, notifications. Index sur `(game_type, created_at DESC)` pour l'historique par jeu. Index sur `race_entries(race_type, period_start, score DESC)` pour les leaderboards.

---

## 4. API Design

### 4.1 REST API endpoints

| Method | Path | Description | Auth | Module |
|--------|------|-------------|------|--------|
| **Auth** | | | | |
| POST | `/api/v1/auth/register` | Inscription email + mot de passe | No | Auth |
| POST | `/api/v1/auth/login` | Connexion email/mot de passe | No | Auth |
| POST | `/api/v1/auth/google` | Connexion Google OAuth2 | No | Auth |
| POST | `/api/v1/auth/refresh` | Rafraîchir token JWT | Refresh | Auth |
| POST | `/api/v1/auth/logout` | Déconnexion (invalider session) | Yes | Auth |
| POST | `/api/v1/auth/forgot-password` | Demande de réinitialisation | No | Auth |
| POST | `/api/v1/auth/reset-password` | Réinitialisation avec token | No | Auth |
| POST | `/api/v1/auth/2fa/enable` | Activer 2FA TOTP | Yes | Auth |
| POST | `/api/v1/auth/2fa/verify` | Vérifier code 2FA | Yes | Auth |
| DELETE | `/api/v1/auth/account` | Supprimer compte (GDPR) | Yes | Auth |
| GET | `/api/v1/auth/sessions` | Lister sessions actives | Yes | Auth |
| DELETE | `/api/v1/auth/sessions/:id` | Déconnecter session distante | Yes | Auth |
| **Users / Profile** | | | | |
| GET | `/api/v1/users/me` | Obtenir profil complet | Yes | User |
| PUT | `/api/v1/users/me` | Mettre à jour profil | Yes | User |
| PUT | `/api/v1/users/me/avatar` | Changer avatar | Yes | User |
| GET | `/api/v1/users/me/stats` | Obtenir statistiques | Yes | User |
| GET | `/api/v1/users/me/transactions` | Historique transactions | Yes | Economy |
| GET | `/api/v1/users/me/transactions/:id` | Détail transaction | Yes | Economy |
| GET | `/api/v1/users/me/export` | Exporter données (GDPR) | Yes | User |
| GET | `/api/v1/users/:id/public` | Profil public d'un joueur | Yes | User |
| GET | `/api/v1/users/me/leaderboard` | Classement global XP/niveau | Yes | User |
| **Economy / Wallet** | | | | |
| GET | `/api/v1/economy/balance` | Solde actuel | Yes | Economy |
| GET | `/api/v1/economy/history` | Historique filtré (type, date) | Yes | Economy |
| **Daily Rewards** | | | | |
| POST | `/api/v1/economy/daily-reward/claim` | Réclamer récompense quotidienne | Yes | DailyReward |
| GET | `/api/v1/economy/daily-reward/status` | État du streak actuel | Yes | DailyReward |
| **Shop** | | | | |
| GET | `/api/v1/shop/packages` | Lister les packs disponibles | Yes | Shop |
| POST | `/api/v1/shop/buy` | Acheter un pack | Yes | Shop |
| GET | `/api/v1/shop/purchases` | Historique des achats | Yes | Shop |
| **Games - Slots** | | | | |
| POST | `/api/v1/games/slots-3/bet` | Placer mise slot 3 rouleaux | Yes | Slots |
| POST | `/api/v1/games/slots-4/bet` | Placer mise slot 4 rouleaux | Yes | Slots |
| POST | `/api/v1/games/slots-5/bet` | Placer mise slot 5 rouleaux | Yes | Slots |
| GET | `/api/v1/games/slots-3/history` | Historique slot 3 rlx | Yes | Slots |
| GET | `/api/v1/games/slots-4/history` | Historique slot 4 rlx | Yes | Slots |
| GET | `/api/v1/games/slots-5/history` | Historique slot 5 rlx | Yes | Slots |
| GET | `/api/v1/games/slots-3/paytable` | Table des paiements | Yes | Slots |
| GET | `/api/v1/games/slots-4/paytable` | Table des paiements + Wild/Scatter | Yes | Slots |
| GET | `/api/v1/games/slots-5/paytable` | Table des paiements + jackpot | Yes | Slots |
| **Games - Blackjack** | | | | |
| POST | `/api/v1/games/blackjack/bet` | Démarrer main avec mise | Yes | Blackjack |
| POST | `/api/v1/games/blackjack/hit` | Tirer une carte | Yes | Blackjack |
| POST | `/api/v1/games/blackjack/stand` | Rester | Yes | Blackjack |
| POST | `/api/v1/games/blackjack/double` | Doubler | Yes | Blackjack |
| POST | `/api/v1/games/blackjack/split` | Séparer | Yes | Blackjack |
| POST | `/api/v1/games/blackjack/surrender` | Se rendre | Yes | Blackjack |
| POST | `/api/v1/games/blackjack/insurance` | Prendre assurance | Yes | Blackjack |
| GET | `/api/v1/games/blackjack/history` | Historique mains | Yes | Blackjack |
| **Games - Roulette** | | | | |
| POST | `/api/v1/games/roulette/bet` | Placer mises sur grille | Yes | Roulette |
| POST | `/api/v1/games/roulette/spin` | Lancer la roue | Yes | Roulette |
| POST | `/api/v1/games/roulette/clear-bets` | Annuler les mises | Yes | Roulette |
| GET | `/api/v1/games/roulette/history` | Derniers numéros gagnants | Yes | Roulette |
| **Games - Crash** | | | | |
| POST | `/api/v1/games/crash/bet` | Placer mise sur prochain vol | Yes | Crash |
| POST | `/api/v1/games/crash/cash-out` | Encaisser avant crash | Yes | Crash |
| GET | `/api/v1/games/crash/history` | Historique crash points | Yes | Crash |
| **Games - Plinko** | | | | |
| POST | `/api/v1/games/plinko/bet` | Lâcher une ou plusieurs billes | Yes | Plinko |
| GET | `/api/v1/games/plinko/multipliers` | Grille des multiplicateurs | Yes | Plinko |
| GET | `/api/v1/games/plinko/history` | Historique des lancers | Yes | Plinko |
| **Games - Mines** | | | | |
| POST | `/api/v1/games/mines/start` | Démarrer partie (config mines) | Yes | Mines |
| POST | `/api/v1/games/mines/reveal` | Révéler une case | Yes | Mines |
| POST | `/api/v1/games/mines/cash-out` | Encaisser gain | Yes | Mines |
| GET | `/api/v1/games/mines/history` | Historique parties | Yes | Mines |
| POST | `/api/v1/games/mines/verify` | Vérifier provably fair | Yes | Mines |
| **Games - Wheel of Fortune** | | | | |
| POST | `/api/v1/games/wheel/bet` | Placer mises sur segments | Yes | Wheel |
| POST | `/api/v1/games/wheel/spin` | Lancer la roue | Yes | Wheel |
| GET | `/api/v1/games/wheel/segments` | Segments et probabilités | Yes | Wheel |
| GET | `/api/v1/games/wheel/history` | Historique des tours | Yes | Wheel |
| **Games - Limbo** | | | | |
| POST | `/api/v1/games/limbo/bet` | Jouer un tour (cible + mise) | Yes | Limbo |
| GET | `/api/v1/games/limbo/history` | Historique tours | Yes | Limbo |
| POST | `/api/v1/games/limbo/verify` | Vérifier provably fair | Yes | Limbo |
| **Games - Craps** | | | | |
| POST | `/api/v1/games/craps/bet` | Placer mise (Pass/Come/etc) | Yes | Craps |
| POST | `/api/v1/games/craps/roll` | Lancer les dés | Yes | Craps |
| GET | `/api/v1/games/craps/state` | État de la table (point, phase) | Yes | Craps |
| GET | `/api/v1/games/craps/history` | Historique lancers | Yes | Craps |
| **Games - Bingo** | | | | |
| GET | `/api/v1/games/bingo/rooms` | Lister salles disponibles | Yes | Bingo |
| POST | `/api/v1/games/bingo/rooms/create` | Créer salle de bingo | Yes | Bingo |
| POST | `/api/v1/games/bingo/rooms/:id/join` | Rejoindre salle | Yes | Bingo |
| POST | `/api/v1/games/bingo/rooms/:id/cards/buy` | Acheter une ou plusieurs cartes | Yes | Bingo |
| GET | `/api/v1/games/bingo/history` | Historique parties bingo | Yes | Bingo |
| **Games - Poker** | | | | |
| GET | `/api/v1/games/poker/tables` | Lister les tables actives | Yes | Poker |
| POST | `/api/v1/games/poker/tables` | Créer une table | Yes | Poker |
| GET | `/api/v1/games/poker/tables/:id` | Détail table (joueurs, blinds, etc.) | Yes | Poker |
| POST | `/api/v1/games/poker/tables/:id/join` | Rejoindre une table | Yes | Poker |
| POST | `/api/v1/games/poker/tables/:id/leave` | Quitter une table | Yes | Poker |
| POST | `/api/v1/games/poker/tables/:id/action` | Action de jeu (fold/check/call/bet/raise/all-in) | Yes | Poker |
| POST | `/api/v1/games/poker/tables/:id/waitlist` | Rejoindre waitlist | Yes | Poker |
| GET | `/api/v1/games/poker/history` | Historique mains jouées | Yes | Poker |
| **Tasks / Achievements** | | | | |
| GET | `/api/v1/tasks` | Lister tâches quotidiennes | Yes | Tasks |
| POST | `/api/v1/tasks/:id/progress` | Mettre à jour progression | Yes | Tasks |
| POST | `/api/v1/tasks/:id/claim` | Réclamer récompense tâche | Yes | Tasks |
| GET | `/api/v1/achievements` | Liste accomplissements | Yes | Tasks |
| **Daily Race** | | | | |
| GET | `/api/v1/race/daily` | Classement course quotidienne | Yes | Race |
| GET | `/api/v1/race/weekly` | Classement course hebdomadaire | Yes | Race |
| GET | `/api/v1/race/status` | Temps restant et dotation | Yes | Race |
| **Notifications** | | | | |
| GET | `/api/v1/notifications` | Liste notifications | Yes | Notif |
| POST | `/api/v1/notifications/:id/read` | Marquer comme lue | Yes | Notif |
| POST | `/api/v1/notifications/read-all` | Tout marquer comme lu | Yes | Notif |
| **Responsible Gaming** | | | | |
| GET | `/api/v1/responsible/limits` | Voir ses limites | Yes | Responsible |
| POST | `/api/v1/responsible/limits` | Configurer limites (temps/mise) | Yes | Responsible |
| POST | `/api/v1/responsible/self-exclude` | Activer auto-exclusion | Yes | Responsible |
| GET | `/api/v1/responsible/help` | Ressources jeu responsable | No | Responsible |
| **Chat** | | | | |
| GET | `/api/v1/chat/global/history` | Historique chat global | Yes | Chat |
| POST | `/api/v1/chat/global/message` | Envoyer message global | Yes | Chat |
| POST | `/api/v1/chat/flag/:id` | Signaler un message | Yes | Chat |
| GET | `/api/v1/chat/table/:tableId/history` | Historique chat de table | Yes | Chat |
| **Admin - Dashboard** | | | | |
| GET | `/api/v1/admin/dashboard` | KPIs dashboard admin | Admin | Admin |
| GET | `/api/v1/admin/dashboard/charts` | Données graphiques (distribution jeux, etc.) | Admin | Admin |
| **Admin - Economy** | | | | |
| GET | `/api/v1/admin/economy/house` | État du House Account | Admin | Economy |
| POST | `/api/v1/admin/economy/recharge` | Recharger House Account | Admin | Economy |
| GET | `/api/v1/admin/economy/params` | Paramètres économiques actuels | Admin | Economy |
| PUT | `/api/v1/admin/economy/params` | Modifier paramètres économiques | Admin | Economy |
| **Admin - Games** | | | | |
| GET | `/api/v1/admin/games` | Configurations des jeux | Admin | Admin |
| PUT | `/api/v1/admin/games/:game/config` | Modifier config (house edge, limites, activation) | Admin | Admin |
| **Admin - Users** | | | | |
| GET | `/api/v1/admin/users` | Lister utilisateurs (recherche, filtre) | Admin | Admin |
| GET | `/api/v1/admin/users/:id` | Détail utilisateur (profil, statut, transactions) | Admin | Admin |
| PUT | `/api/v1/admin/users/:id/status` | Suspendre / activer / bannir | Admin | Admin |
| PUT | `/api/v1/admin/users/:id/balance` | Ajuster solde manuellement | Admin | Admin |
| DELETE | `/api/v1/admin/users/:id` | Supprimer compte utilisateur | Admin | Admin |
| **Admin - Chat Moderation** | | | | |
| GET | `/api/v1/admin/chat/flagged` | Messages signalés | Admin | Chat |
| DELETE | `/api/v1/admin/chat/messages/:id` | Supprimer message | Admin | Chat |
| POST | `/api/v1/admin/chat/mute` | Mute un joueur du chat | Admin | Chat |
| **Admin - Notifications** | | | | |
| POST | `/api/v1/admin/notifications/broadcast` | Publier annonce globale | Admin | Notif |
| POST | `/api/v1/admin/bonus-campaigns` | Créer campagne bonus | Admin | Economy |
| **Admin - Audit** | | | | |
| GET | `/api/v1/admin/logs` | Journal d'audit (filtré par date, admin, action) | Admin | Admin |
| GET | `/api/v1/admin/logs/export` | Exporter logs (CSV/JSON) | Admin | Admin |
| **Admin - Shop** | | | | |
| GET | `/api/v1/admin/shop/packages` | Lister tous les packs | Admin | Shop |
| POST | `/api/v1/admin/shop/packages` | Créer pack | Admin | Shop |
| PUT | `/api/v1/admin/shop/packages/:id` | Modifier pack | Admin | Shop |
| DELETE | `/api/v1/admin/shop/packages/:id` | Désactiver pack | Admin | Shop |
| **Challenges & Competitions** | | | | |
| GET | `/api/v1/challenges` | Défis actifs (multiplicateur, slot battles) | Yes | Race |
| POST | `/api/v1/challenges/:id/join` | Participer à un défi | Yes | Race |
| GET | `/api/v1/challenges/:id/leaderboard` | Classement du défi | Yes | Race |

### 4.2 WebSocket events (Socket.io)

#### Namespaces

```
/                    → namespace général (notifications, chat global)
/game/slots          → namespace slots
/game/blackjack      → namespace blackjack
/game/roulette       → namespace roulette
/game/crash          → namespace crash (multi-joueurs)
/game/plinko         → namespace plinko
/game/mines          → namespace mines
/game/wheel          → namespace wheel of fortune
/game/limbo          → namespace limbo
/game/craps          → namespace craps
/game/bingo          → namespace bingo (multi-joueurs)
/game/poker          → namespace poker (multi-joueurs)
```

#### Client → Server events

| Event | Payload | Description |
|-------|---------|-------------|
| `game:join` | `{game, tableId?}` | Rejoindre une room de jeu |
| `game:leave` | `{game, tableId?}` | Quitter une room de jeu |
| `game:bet` | `{game, bet, config}` | Placer une mise |
| `blackjack:hit` | `{sessionId}` | Tirer carte |
| `blackjack:stand` | `{sessionId}` | Rester |
| `blackjack:double` | `{sessionId}` | Doubler |
| `blackjack:split` | `{sessionId}` | Séparer |
| `blackjack:surrender` | `{sessionId}` | Se rendre |
| `blackjack:insurance` | `{sessionId, accept}` | Prendre assurance |
| `roulette:spin` | `{sessionId}` | Lancer roue |
| `crash:cash-out` | `{sessionId}` | Encaisser |
| `crash:auto-cashout` | `{multiplier}` | Configurer cashout auto |
| `plinko:drop` | `{rows, risk, count}` | Lâcher billes |
| `mines:reveal` | `{sessionId, cell}` | Révéler case |
| `mines:cash-out` | `{sessionId}` | Encaisser |
| `wheel:spin` | `{sessionId}` | Lancer roue |
| `limbo:play` | `{target, bet}` | Jouer tour |
| `craps:roll` | `{sessionId}` | Lancer dés |
| `poker:action` | `{tableId, action, amount?}` | Action poker |
| `poker:join` | `{tableId}` | Rejoindre table |
| `poker:leave` | `{tableId}` | Quitter table |
| `chat:message` | `{channel, content}` | Envoyer message |
| `chat:typing` | `{channel}` | Indicateur de frappe |
| `lobby:join` | `{gameType?}` | Rejoindre lobby |
| `lobby:leave` | `{gameType?}` | Quitter lobby |

#### Server → Client events

| Event | Payload | Description |
|-------|---------|-------------|
| `game:result` | `{game, sessionId, result, win}` | Résultat d'un jeu |
| `game:error` | `{game, code, messageKey}` | Erreur de jeu |
| `game:state` | `{game, state}` | État mis à jour |
| `blackjack:dealt` | `{hand, dealerCard}` | Cartes distribuées |
| `blackjack:action-result` | `{hand, dealerHand, result}` | Résultat action |
| `roulette:spinning` | `{sessionId}` | Roue commence à tourner |
| `roulette:result` | `{number, color}` | Numéro gagnant |
| `crash:starting` | `{countdown}` | Nouveau vol dans Xs |
| `crash:update` | `{multiplier, totalBets}` | Multiplicateur en cours |
| `crash:crashed` | `{crashPoint, winners}` | Vol a crashé |
| `crash:bet-placed` | `{userId, amount}` | Mise d'un joueur (public) |
| `crash:cash-out` | `{userId, multiplier, win}` | Cash-out d'un joueur (public) |
| `plinko:result` | `{path, slot, multiplier, win}` | Résultat bille |
| `mines:reveal` | `{cell, isMine, multiplier}` | Case révélée |
| `mines:game-over` | `{won, amount}` | Partie terminée |
| `wheel:spinning` | `{sessionId}` | Roue tourne |
| `wheel:result` | `{segment, multiplier}` | Segment gagnant |
| `limbo:result` | `{result, target, won, win}` | Résultat limbo |
| `craps:roll-result` | `{dice, total, point}` | Résultat lancer dés |
| `poker:table:{id}:state` | `{table}` | État complet de la table |
| `poker:table:{id}:action` | `{playerId, action, amount}` | Action d'un joueur |
| `poker:table:{id}:your-turn` | `{timeout}` | C'est ton tour |
| `poker:table:{id}:hand-start` | `{handId, cards}` | Nouvelle main |
| `poker:table:{id}:showdown` | `{hands, winner, pot}` | Résultat showdown |
| `poker:table:{id}:timeout` | `{playerId}` | Joueur timeout |
| `poker:table:{id}:player-join` | `{player}` | Joueur rejoint |
| `poker:table:{id}:player-leave` | `{playerId}` | Joueur quitte |
| `poker:waitlist:notified` | `{tableId, timeout}` | Place libre sur table |
| `bingo:room:{id}:state` | `{room}` | État de la salle bingo |
| `bingo:room:{id}:number` | `{number, cards}` | Numéro tiré |
| `bingo:room:{id}:winner` | `{player, pattern, jackpot}` | Gagnant bingo |
| `bingo:room:{id}:player-join` | `{player}` | Joueur rejoint bingo |
| `chat:message` | `{user, content, channel, timestamp}` | Nouveau message chat |
| `chat:system` | `{messageKey, data}` | Annonce système (gros gain, etc.) |
| `chat:typing` | `{user, channel}` | Indicateur de frappe |
| `notification` | `{type, titleKey, data}` | Notification utilisateur |
| `notification:badge` | `{count}` | Mise à jour compteur notifs |
| `race:update` | `{raceType, leaderboard}` | Mise à jour classement |
| `race:countdown` | `{raceType, timeLeft}` | Temps restant course |
| `lobby:stats` | `{gameType, players, totalBets}` | Statistiques lobby |
| `user:balance` | `{balance}` | Mise à jour solde |
| `user:xp` | `{xp, level}` | Mise à jour XP/niveau |
| `admin:announcement` | `{title, message}` | Annonce admin globale |
| `error` | `{code, messageKey}` | Erreur générique |

---

## 5. Sécurité

### 5.1 Authentification

| Mécanisme | Détail |
|-----------|--------|
| **JWT Tokens** | Access token : 15 min (court). Refresh token : 7 jours (stocké en Redis avec rotation). Signature HMAC-SHA256. |
| **Google OAuth2** | Stratégie Passport `google-oauth20`. Scopes : `profile`, `email`. Link automatique si email correspond à un compte existant. |
| **Bcrypt** | Hash des mots de passe avec cost factor ≥ 12. Salt automatique. |
| **2FA (TOTP)** | Optionnel. QR code à scanner, code 6 chiffres, fenêtre de ±1 step. Implémentation via `otplib`. |
| **Rate limiting** | Login : max 5 tentatives/min/IP. Register : max 3/min/IP. Actions de jeu : max 10/s/joueur. API globale : 100 req/min/utilisateur. Implémentation Fastify `@fastify/rate-limit`. |
| **Password reset** | Token JET unique, 15 min d'expiration, envoyé par email. Invalidation après utilisation. |

### 5.2 Protection des API

| Mesure | Détail |
|--------|--------|
| **Helmet** | Middleware de sécurité HTTP (CSP, X-Frame-Options, XSS filter, HSTS, etc.) |
| **CORS** | Configuration stricte : origines autorisées (frontend), méthodes HTTP, credentials |
| **Input validation** | Zod schemas sur chaque route. Sanitization des entrées : strip XSS, limiter longueur. |
| **SQL injection** | Prévention via Prisma (parametrized queries). Aucune concaténation SQL. |
| **Admin routes** | Guard middleware vérifiant `user.role === 'admin'`. Double vérification JWT + rôle. |
| **CSRF** | Double cookie submit pattern ou SameSite=Strict. |
| **Security headers** | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` |

### 5.3 Sécurité des jeux

| Mesure | Détail |
|--------|--------|
| **Serveur-authoritative** | 100% de la logique de jeu exécutée côté serveur. Le client n'est qu'un affichage. |
| **Provably Fair** | HMAC-SHA256(server_seed, client_seed, nonce). Le joueur peut vérifier après coup. |
| **Atomicité des transactions** | Mise et mise à jour du solde dans une transaction PostgreSQL SERIALIZABLE. |
| **Anti-triche** | Rate limiting par action de jeu. Validation de chaque action côté serveur. Pas de double mise possible. |
| **Bot detection** | Analyse comportementale : temps de réaction, patterns de clics. Logs pour détection de collusion (poker). |

### 5.4 Conformité

| Mesure | Détail |
|--------|--------|
| **GDPR** | Consentement explicite à l'inscription. Droit d'accès (export JSON). Droit à l'effacement (soft delete + purge après 30 jours). |
| **Mention légale** | "Ce jeu est un divertissement sans argent réel" sur chaque page de jeu. |
| **Cookies** | Bannière de consentement. Cookies fonctionnels uniquement (session, JWT) + analytics si configuré. |
| **Jeu responsable** | Limites de temps, limites de mise, auto-exclusion. Page d'aide et ressources. |

---

## 6. Structure des dossiers

```
casinox/
├── frontend/
│   ├── public/
│   │   ├── locales/              (fallback i18n)
│   │   └── assets/               (images, sounds, fonts)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/               (Button, Input, Modal, Select, Toast, Spinner, Badge, Card, Slider, ProgressBar)
│   │   │   ├── layout/           (Header, Footer, Sidebar, PageContainer, GameLayout)
│   │   │   ├── games/
│   │   │   │   ├── slots/        (Slots3, Slots4, Slots5, Reel, Payline, Paytable)
│   │   │   │   ├── blackjack/    (BlackjackTable, Card, Hand, ChipSelector, ActionButtons)
│   │   │   │   ├── roulette/     (RouletteWheel, BetGrid, ChipPlacer, HistoryNumbers)
│   │   │   │   ├── crash/        (CrashGraph, BetPanel, CashOutButton, HistoryChart)
│   │   │   │   ├── plinko/       (PlinkoBoard, Ball, MultiplierGrid, RiskSelector)
│   │   │   │   ├── mines/        (MinesGrid, Cell, MultiplierDisplay, CashOutButton)
│   │   │   │   ├── wheel/        (WheelCanvas, SegmentBets, BetPlacer)
│   │   │   │   ├── limbo/        (LimboGame, MultiplierInput, ResultDisplay)
│   │   │   │   ├── craps/        (CrapsTable, DiceAnimation, BetBoard)
│   │   │   │   ├── bingo/        (BingoCard, NumberCaller, RoomLobby)
│   │   │   │   └── poker/        (PokerTable, Cards, ChipStack, ActionPanel, Timer, Lobby, WaitlistModal)
│   │   │   ├── admin/            (AdminDashboard, AdminUsers, AdminEconomy, AdminGames, AdminLogs, AdminChat, AdminShop)
│   │   │   └── shared/           (BalanceDisplay, LanguageSelector, NotificationBell, UserAvatar, XPBar, StreakBadge, ChatWidget)
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useBalance.ts
│   │   │   ├── useSocket.ts
│   │   │   ├── useNotification.ts
│   │   │   ├── useGame.ts
│   │   │   ├── usePoker.ts
│   │   │   ├── useChat.ts
│   │   │   ├── useRace.ts
│   │   │   ├── useTasks.ts
│   │   │   ├── useResponsibleGaming.ts
│   │   │   ├── useI18n.ts
│   │   │   ├── useAdmin.ts
│   │   │   └── useIntersectionObserver.ts
│   │   ├── services/
│   │   │   ├── api.ts            (Axios instance, interceptors, refresh token)
│   │   │   ├── socket.ts         (Socket.io client, namespaces, event manager)
│   │   │   ├── auth.ts           (login, register, google, logout, refresh)
│   │   │   └── i18n.ts           (i18next config, language detection)
│   │   ├── i18n/
│   │   │   ├── fr.json
│   │   │   ├── en.json
│   │   │   └── index.ts
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── ForgotPassword.tsx
│   │   │   ├── ResetPassword.tsx
│   │   │   ├── Lobby.tsx
│   │   │   ├── Profile.tsx
│   │   │   ├── GamePage.tsx      (generic wrapper, routes by game type)
│   │   │   ├── PokerLobby.tsx
│   │   │   ├── PokerTable.tsx
│   │   │   ├── Shop.tsx
│   │   │   ├── Race.tsx
│   │   │   ├── Tasks.tsx
│   │   │   ├── ResponsibleGaming.tsx
│   │   │   ├── Admin/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Users.tsx
│   │   │   │   ├── Economy.tsx
│   │   │   │   ├── Games.tsx
│   │   │   │   ├── AuditLogs.tsx
│   │   │   │   ├── Chat.tsx
│   │   │   │   └── Shop.tsx
│   │   │   └── NotFound.tsx
│   │   ├── store/
│   │   │   ├── authStore.ts      (Zustand)
│   │   │   ├── balanceStore.ts
│   │   │   ├── gameStore.ts
│   │   │   ├── pokerStore.ts
│   │   │   ├── notificationStore.ts
│   │   │   ├── chatStore.ts
│   │   │   └── uiStore.ts        (theme, sidebar, modals)
│   │   ├── types/
│   │   │   ├── api.ts
│   │   │   ├── game.ts
│   │   │   ├── user.ts
│   │   │   ├── poker.ts
│   │   │   ├── socket.ts
│   │   │   └── common.ts
│   │   ├── utils/
│   │   │   ├── formatters.ts     (currency, date, number)
│   │   │   ├── validators.ts     (email, pseudo, password)
│   │   │   ├── constants.ts
│   │   │   └── helpers.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── Dockerfile
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── .eslintrc.cjs
│   └── package.json
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── domain/
│   │   │   ├── auth/
│   │   │   │   ├── ports/
│   │   │   │   │   ├── AuthRepository.ts
│   │   │   │   │   ├── AuthService.ts
│   │   │   │   │   └── TokenService.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── RegisterUser.ts
│   │   │   │   │   ├── AuthenticateUser.ts
│   │   │   │   │   └── ResetPassword.ts
│   │   │   │   ├── models/
│   │   │   │   │   ├── User.ts
│   │   │   │   │   └── Session.ts
│   │   │   │   └── errors/
│   │   │   │       └── AuthErrors.ts
│   │   │   ├── user/
│   │   │   ├── economy/
│   │   │   ├── daily-reward/
│   │   │   ├── games/
│   │   │   │   ├── slots-3/
│   │   │   │   ├── slots-4/
│   │   │   │   ├── slots-5/
│   │   │   │   ├── blackjack/
│   │   │   │   ├── roulette/
│   │   │   │   ├── crash/
│   │   │   │   ├── plinko/
│   │   │   │   ├── mines/
│   │   │   │   ├── wheel/
│   │   │   │   ├── limbo/
│   │   │   │   ├── craps/
│   │   │   │   └── bingo/
│   │   │   ├── poker/
│   │   │   │   ├── ports/
│   │   │   │   ├── services/
│   │   │   │   ├── models/
│   │   │   │   └── errors/
│   │   │   ├── tasks/
│   │   │   ├── race/
│   │   │   ├── shop/
│   │   │   ├── admin/
│   │   │   ├── chat/
│   │   │   ├── notifications/
│   │   │   └── responsible/
│   │   ├── infrastructure/
│   │   │   ├── database/
│   │   │   │   ├── adapters/    (Prisma implementations per module)
│   │   │   │   └── PrismaClient.ts
│   │   │   ├── redis/
│   │   │   │   ├── adapters/    (cache, session, pub/sub)
│   │   │   │   └── RedisClient.ts
│   │   │   ├── auth/
│   │   │   │   ├── PassportAuthAdapter.ts
│   │   │   │   ├── JwtTokenAdapter.ts
│   │   │   │   └── GoogleOAuthAdapter.ts
│   │   │   └── socket/
│   │   │       ├── handlers/
│   │   │       │   ├── AuthSocketHandler.ts
│   │   │       │   ├── GameSocketHandler.ts
│   │   │       │   ├── PokerSocketHandler.ts
│   │   │       │   ├── ChatSocketHandler.ts
│   │   │       │   └── LobbySocketHandler.ts
│   │   │       └── SocketServer.ts
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── auth.routes.ts
│   │   │   │   ├── user.routes.ts
│   │   │   │   ├── economy.routes.ts
│   │   │   │   ├── games/       (one file per game)
│   │   │   │   ├── poker.routes.ts
│   │   │   │   ├── tasks.routes.ts
│   │   │   │   ├── race.routes.ts
│   │   │   │   ├── shop.routes.ts
│   │   │   │   ├── admin.routes.ts
│   │   │   │   ├── chat.routes.ts
│   │   │   │   └── responsible.routes.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.middleware.ts
│   │   │   │   ├── admin.middleware.ts
│   │   │   │   ├── validation.middleware.ts
│   │   │   │   └── rate-limit.middleware.ts
│   │   │   ├── controllers/
│   │   │   ├── schemas/
│   │   │   └── docs/            (OpenAPI/Swagger)
│   │   └── app.ts               (Fastify app bootstrap)
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   ├── Dockerfile
│   ├── tsconfig.json
│   ├── .eslintrc.cjs
│   └── package.json
├── docker-compose.yml
├── .env.example
├── .gitignore
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
└── README.md
```

---

## 7. Docker

### 7.1 Services docker-compose

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: casinox
      POSTGRES_USER: casinox
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U casinox"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      NODE_ENV: ${NODE_ENV}
      DATABASE_URL: postgresql://casinox:${DB_PASSWORD}@postgres:5432/casinox
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      CORS_ORIGIN: ${CORS_ORIGIN}
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        VITE_API_URL: ${VITE_API_URL}
        VITE_SOCKET_URL: ${VITE_SOCKET_URL}
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 7.2 Frontend Dockerfile

```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:1.25-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 7.3 Backend Dockerfile

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY prisma/ ./prisma/
RUN npx prisma generate
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/app.js"]
```

### 7.4 Stratégie de scaling

1. **Horizontal scaling backend** : augmenter le nombre de réplicas backend. L'adapter Redis Socket.io synchronise les événements entre instances.
2. **Redis** : mode sentinel ou cluster pour haute disponibilité.
3. **PostgreSQL** : read replicas pour les requêtes de reporting/audit. Primary pour les écritures transactionnelles.
4. **Load balancer** : Nginx ou Traefik devant les instances backend et le frontend.
5. **File d'attente** : BullMQ (Redis) pour les tâches asynchrones (distribution des prix de course, envoi d'emails, rotation des tâches quotidiennes).



