# Rapport d'audit : Spécifications

**Auditeur** : Pipeline Agent Auditeur  
**Document audité** : `docs/02-requirements.md`  
**Références** : `docs/00-problem-statement.md`, `docs/01-analysis.md`

---

## Score de cohérence : **92 %**

| Critère | Score | Poids |
|---|---|---|
| Cohérence avec le problème original | 97 % | 25 % |
| Cohérence avec l'analyse | 93 % | 25 % |
| Complétude (tous les modules couverts) | 90 % | 25 % |
| Non-ambiguïté | 88 % | 25 % |

---

## Éléments vérifiés

- [x] Cohérence avec le problème original
- [x] Cohérence avec l'analyse (traçabilité des US vers les §)
- [x] Complétude (tous les modules couverts)
- [ ] Non-ambiguïté — **réserves** (voir ci-dessous)

---

## Détail par critère

### 1. Cohérence avec le problème original — 97 %

Toutes les exigences du problème sont respectées :

| Exigence | Statut | Référence dans 02-requirements |
|---|---|---|
| 13 jeux listés | ✅ | US-015 à US-113 (modules slots 3/4/5, blackjack, roulette, poker, craps, bingo, mines, crash, plinko, wheel, limbo) |
| Stack React/Node.js | ✅ | CT-001, CT-004 |
| Bilingue FR/EN (i18n) | ✅ | US-141 à US-144, NF-016, NF-017 |
| Responsive web | ✅ | NF-015 |
| Email + Google OAuth | ✅ | US-001, US-002 |
| Âge minimum 18+ | ✅ | RM-001 |
| Monnaie virtuelle | ✅ | RM-002, RM-008 |
| House Account | ✅ | US-013, RM-005 |
| Lobby poker + waitlist | ✅ | US-050, US-053 |
| Bots étiquetés "Bot" | ✅ | US-062, RM-003 |
| Notifications waitlist (30s) | ✅ | US-053 |
| Mention légale "sans argent réel" | ✅ | US-145, CR-001 |
| Pas de gambling réel | ✅ | CR-001, CR-002 |

**Anomalie mineure** : le problème mentionne un "Historique des parties" général. Les US couvrent l'historique par jeu (US-048 roulette, US-073 craps, US-087 mines, US-093 crash, US-113 limbo) et l'historique des transactions (US-011), mais il manque une US pour un historique de parties unifié (tous jeux confondus).

### 2. Cohérence avec l'analyse — 93 %

**Traçabilité** : chaque US référence un ou plusieurs paragraphes de l'analyse (01-analysis.md). Vérification faite pour l'ensemble des 150 US + 23 NF + 14 CT + 10 RM + 6 CR.

**Points positifs** :
- Tous les modules de l'analyse sont représentés (auth, wallet, house account, 13 jeux, admin, i18n, social, chat, classements, notifications, jeu responsable)
- Les références croisées sont précises (ex. US-053 → §6-Waitlist)
- Les règles métier (RM) couvrent les contraintes fortes de l'analyse

**Problèmes détectés** :

| # | Problème | Impact |
|---|---|---|
| 1 | **US-041 (Assurance Blackjack)** : l'analyse mentionne Hit, Stand, Double, Split, Surrender mais pas l'Assurance. US-041 introduit une fonctionnalité non couverte par l'analyse. | Mineur — [Should], optionnel |
| 2 | **Stratégies de bots** : l'analyse (§5-Métier, §7-Risques) demande des "stratégies réalistes" pour les bots. RM-010 ne couvre que le complément par bots au Poker. Aucune spécification sur les stratégies de bots pour les autres jeux multi-joueurs (Crash, Bingo multi). | Moyen — risque de bot irréaliste |
| 3 | **Tournois** : l'analyse mentionne les tournois dans l'objectif Social (§3-6). Aucune US ne couvre cette fonctionnalité. | Mineur — [Nice] potentiel |
| 4 | **Tableau de bord d'accueil** : l'analyse décrit un dashboard post-connexion avec solde et jeux disponibles (§4-Joueur #2). Aucune US explicite pour cette page d'accueil (le solde est dans US-008, mais la navigation vers les jeux est implicite). | Mineur — implicite dans l'architecture UI |
| 5 | **Certaines US [Nice]** ont une référence faible à l'analyse (ex. US-014 → §2-Joueur, US-049 → §2-Joueur, US-079 → §2-Joueur). Les §2-Joueur et §3 sont génériques et ne décrivent pas spécifiquement ces fonctionnalités. | Mineur — acceptable pour des [Nice] |

### 3. Complétude — 90 %

**Modules couverts** (vérification exhaustive) :

| Module | US / Références | Couvert ? |
|---|---|---|
| Authentification & Comptes | US-001 à US-007 | ✅ |
| Portefeuille & House Account | US-008 à US-014 | ✅ |
| Slot 3 rouleaux | US-015 à US-021 | ✅ |
| Slot 4 rouleaux | US-022 à US-027 | ✅ |
| Slot 5 rouleaux | US-028 à US-033 | ✅ |
| Blackjack | US-034 à US-042 | ✅ |
| Roulette | US-043 à US-049 | ✅ |
| Poker Texas Hold'em | US-050 à US-066 | ✅ |
| Dés / Craps | US-067 à US-073 | ✅ |
| Bingo | US-074 à US-080 | ✅ |
| Mines | US-081 à US-087 | ✅ |
| Crash | US-088 à US-094 | ✅ |
| Plinko | US-095 à US-101 | ✅ |
| Wheel of Fortune | US-102 à US-107 | ✅ |
| Limbo | US-108 à US-113 | ✅ |
| Chat & Social | US-114 à US-120 | ✅ |
| Classements & Défis | US-121 à US-126 | ✅ |
| Notifications | US-127 à US-130 | ✅ |
| Admin Dashboard | US-131 à US-140 | ✅ |
| i18n | US-141 à US-144 | ✅ |
| Jeu responsable & Conformité | US-145 à US-150 | ✅ |
| Spécifications non-fonctionnelles | NF-001 à NF-023 | ✅ |
| Contraintes techniques | CT-001 à CT-014 | ✅ |
| Règles métier | RM-001 à RM-010 | ✅ |
| Contraintes réglementaires | CR-001 à CR-006 | ✅ |

**Lacunes** :

| Lacune | Détail |
|---|---|
| **Bots multi-jeux** | Les bots ne sont spécifiés que pour le Poker (RM-010). L'analyse évoque des bots pour tout jeu multi-joueurs. Crash mode multi et Bingo multi n'ont pas de spécification bot. |
| **Historique de parties unifié** | Pas d'US pour une vue "Mes parties" agrégeant l'historique tous jeux. |
| **Tournois** | Mentionnés dans l'analyse (§3-6), absents des specs. |
| **Profil joueur** | US-004 couvre la modification, mais pas la consultation du profil public (US-118 est [Nice] et ne couvre que le profil des *autres* joueurs). |
| **Home/Dashboard** | Pas d'US pour la page d'accueil post-connexion listant les jeux disponibles. |

### 4. Non-ambiguïté — 88 %

**US précises et testables** : la grande majorité des US sont bien formulées avec des critères observables (ex. US-053 : notification popup + son, 30s pour accepter).

**Ambiguïtés détectées** :

| ID | Ambiguïté | Recommandation |
|---|---|---|
| US-014 | "seuil configurable" — configurable par le joueur ou l'admin ? | Préciser l'acteur et l'interface de configuration |
| US-020 | "nombre configurable de parties" pour l'auto-spin — plage non spécifiée | Ajouter "de 5 à 100 parties" ou la plage choisie |
| US-057 | "timer de la table" pour l'augmentation des blinds — intervalle non spécifié | Préciser "toutes les X minutes" (ex. 10 min) |
| US-065 | "stack de départ" — y a-t-il un min/max ? | Ajouter les limites (ex. min = 20 BB, max = 100 BB) |
| US-079 | "jackpot Bingo augmente" — mécanisme d'accumulation non défini | Préciser "X % de chaque ticket alimente le jackpot" |
| NF-004 | "1 000 joueurs simultanés sans dégradation" — métrique de dégradation non définie | Ajouter "sans dépasser les seuils NF-001 et NF-002" |
| US-099 | "jusqu'à 10 billes simultanées" — le "simultané" est-il réel (parallèle) ou séquentiel rapide ? | Clarifier "10 billes lancées en rafale avant que la première n'atteigne le bas" |
| US-138 | "campagnes de bonus" — périmètre exact non défini (multiplicateur sur quotidienne seulement ? Aussi sur gains ?) | Lister les types de campagnes supportées |

---

## Verdict

**✅ ACCEPTÉ avec réserves mineures**

Le document `02-requirements.md` est de très bonne qualité : structure claire, traçabilité systématique vers l'analyse, couverture complète des 13 jeux, des contraintes techniques, métier et réglementaires.

**Problèmes à corriger avant implémentation** :

1. **Ajouter la spécification des bots multi-jeux** — les stratégies de bots pour Crash (mode multi) et Bingo (mode multi) doivent être décrites, pas seulement pour le Poker.
2. **Corriger les 8 ambiguïtés** listées ci-dessus (US-014, US-020, US-057, US-065, US-079, NF-004, US-099, US-138).
3. **Supprimer ou justifier US-041 (Insurance)** si l'Assurance Blackjack est souhaitée hors-analyse.
4. **(Optionnel) Ajouter US pour le dashboard d'accueil** et l'historique de parties unifié.

**Forces du document** :
- Traçabilité rigoureuse (chaque US référence l'analyse)
- Priorisation claire ([Must] / [Should] / [Nice])
- NF specs détaillées avec critères d'acceptation mesurables
- Règles métier et contraintes réglementaires explicites

---

## Recommandations

1. **Court terme** : corriger les ambiguïtés avant le sprint de dev (gain rapide en qualité)
2. **Moyen terme** : ajouter une section "Bots & Comportement IA" décrivant les stratégies par jeu (Poker, Crash, Bingo)
3. **Long terme** : considérer l'ajout des tournois si aligné avec la feuille deroute produit
