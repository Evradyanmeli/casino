# Audit — Architecture technique

> Audit du document `docs/04-architecture.md`
> Références : `01-analysis.md`, `02-requirements.md`

---

## Score global : **93 % — VALIDÉ**

---

## Grille d'évaluation

| Critère | Note | Commentaire |
|---------|------|-------------|
| 1. Cohérence classification | 10/10 | Large app, monolithique modulaire, validé utilisateur |
| 2. Cohérence analyse | 10/10 | 13 jeux, économie, auth, i18n — tout est couvert |
| 3. Cohérence specs | 9/10 | 150+ user stories couvertes ; légers doublons d'IDs US (127-130) |
| 4. Stack technique | 10/10 | React/TS, Fastify, PostgreSQL, Redis, Prisma, Socket.io — validé |
| 5. Architecture hexagonale | 10/10 | Ports & adapters impeccables pour les 24 modules |
| 6. Data model | 10/10 | ER complet, types corrects, relations, double-entry, soft delete, provably fair, indexes |
| 7. API design | 10/10 | REST endpoints exhaustifs + WebSocket events (namespaces, C→S, S→C) |
| 8. Sécurité | 10/10 | JWT, OAuth2, bcrypt(≥12), 2FA, rate limiting, Helmet, serveur-authoritative, Provably Fair, GDPR |
| 9. Structure dossiers | 9/10 | Claire, modulaire ; seul `nginx.conf` référencé mais absent de la structure |
| 10. Docker | 7/10 | docker-compose correct mais manque ELK, Prometheus/Grafana, BullMQ worker, healthchecks backend/frontend |

---

## Points forts

- **Architecture hexagonale parfaitement documentée** : 24 modules avec ports, adapters, entités, services — séparation des couches exemplaire.
- **Data model exhaustif** : 19 entités avec types précis, relations FK, indexes, double-entry accounting, soft delete GDPR.
- **API design complet** : ~90 endpoints REST + 50+ événements WebSocket couvrant tous les cas d'usage, avec namespaces Socket.io par jeu.
- **Sécurité très complète** : JWT court, refresh token rotation, bcrypt cost ≥12, 2FA, rate limiting multi-niveau, Helmet, CORS, CSRF, Provably Fair, atomicité des transactions.
- **Couverture totale des 13 jeux** avec leurs mécaniques spécifiques bien détaillées.

---

## Problèmes détectés

| # | Gravité | Description |
|---|---------|-------------|
| P1 | Faible | **IDs US dupliqués** dans `02-requirements.md` : US-127, US-128, US-129, US-130 apparaissent à la fois dans "Notifications" et "Daily Race / Challenges". L'architecture elle-même n'est pas impactée (les modules Notifications et Race sont bien séparés). |
| P2 | Faible | **nginx.conf manquant** : le Dockerfile frontend (multi-stage) copy `nginx.conf` mais ce fichier n'apparaît ni dans la structure de dossiers ni dans le docker-compose. |
| P3 | Moyen | **ELK Stack et Prometheus/Grafana absents du docker-compose**. Ces outils sont mentionnés dans la stack et les contraintes techniques (CT-012, CT-013) mais aucun service docker-compose n'est défini pour eux. |
| P4 | Moyen | **BullMQ worker non visible** : BullMQ est dans la stack technique mais aucun service worker dédié n'apparaît dans docker-compose ou la structure. Est-ce un process in-app ou un service séparé ? |
| P5 | Faible | **Pas de healthcheck backend/frontend** dans docker-compose (seuls postgres et redis en ont). |
| P6 | Mineur | **Module 23 (Multiplayer Lobby & Waitlist)** a un périmètre qui chevauche partiellement le module 8 (Poker) — la waitlist poker est gérée à la fois via `PokerTableRepository` / `PostgresWaitlistRepository` (module 8) et `WaitlistRepository` / `PostgresWaitlistRepository` (module 23). Clarification souhaitable. |

---

## Recommandations

1. **Ajouter les services manquants au docker-compose** : Elasticsearch, Logstash, Kibana, Prometheus, Grafana — ne serait-ce qu'en commentaire ou profile Docker pour dév/local.
2. **Ajouter un service worker BullMQ** optionnel ou préciser que les jobs sont traités in-process.
3. **Ajouter `nginx.conf` dans la structure de dossiers** (ou utiliser un serveur statique Node.js si Nginx complexifie le déploiement).
4. **Uniformiser la gestion de la waitlist** : soit tout dans le module 23 (générique), soit tout dans le module 8 (poker-spécifique).
5. **Ajouter les healthchecks** backend et frontend dans le docker-compose.
6. **Corriger les IDs US dupliqués** dans `02-requirements.md` (US-127 → US-NOTIF-001, etc.).

---

## Questions de clarification pour l'utilisateur

1. **BullMQ** : les jobs asynchrones (distribution des prix, emails, rotation des tâches) sont-ils traités dans le même process backend ou via un worker séparé ?
2. **nginx.conf** : faut-il fournir une config Nginx par défaut, ou préférer un serveur statique (ex: serve) dans le Dockerfile frontend ?
3. **Monitoring/Logging** : souhaitez-vous que Prometheus/Grafana et ELK soient inclus dans le docker-compose principal ou déployés séparément ?
4. **Waitlist** : le module 23 (Multiplayer Lobby & Waitlist) est-il prévu pour être générique (réutilisable pour Bingo, Poker, etc.) ou spécifique au Poker ? Un chevauchement existe avec le module 8.
