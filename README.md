# CasinoX

Casino social de divertissement, sans argent reel. Backend Fastify/TypeScript,
base PostgreSQL via Prisma, Socket.IO et interface React/Vite.

## Prerequis

- Node.js 22.13 ou plus recent et npm (`.nvmrc` selectionne Node 22).
- Une base PostgreSQL dediee, avec les droits de creation de tables.
- Docker et le plugin Docker Compose pour le lancement en conteneurs.

Les lockfiles npm sont versionnes : utiliser `npm ci` dans chaque application.
Les fichiers `docs/` decrivent la conception ; ce README decrit le lancement actuel.

## Configuration privee

Pour le developpement local, creer `backend/.env` a partir de
`backend/.env.example`. Pour Docker, creer aussi `.env` a la racine a partir de
`.env.example`. Ne jamais versionner ces fichiers prives.

Renseigner `DATABASE_URL` et generer deux secrets independants avec
`openssl rand -hex 32`, pour `JWT_SECRET` et `COOKIE_SECRET`. Le backend refuse
de demarrer si ces secrets manquent ou font moins de 32 caracteres.
`CORS_ORIGIN` doit correspondre exactement a l'origine du frontend.

Pour mettre a niveau un `.env` existant sans modifier l'URL PostgreSQL ni les
autres reglages, depuis la racine du projet :

```sh
node backend/scripts/configure-secrets.mjs
docker compose config --quiet
```

Le script genere seulement les secrets manquants, trop courts ou identiques,
sans afficher leurs valeurs. Remplacer `JWT_SECRET` invalide les sessions au
prochain redemarrage du backend : les utilisateurs devront se reconnecter.
Sur une installation Docker, ces secrets doivent etre dans le `.env` racine,
pas seulement dans `backend/.env`.

PostgreSQL n'est pas inclus dans Compose : son adresse doit etre accessible
depuis les conteneurs. `localhost` dans le conteneur backend ne designe pas
la machine hote. Les identifiants doivent etre encodes pour une URL si necessaire.

Le backend utilise actuellement le meme service JWT pour les jetons d'acces
et de rafraichissement ; `JWT_REFRESH_SECRET` n'est pas une option implementee.

## Installation Locale

Dans `backend/` :

```sh
npm ci
npm run db:generate
npm run db:push
npm run dev
```

`db:push` prepare le schema sur une base de developpement neuve. La migration
financiere versionnee est un delta, pas une baseline complete : `migrate deploy`
ne convient pas a une base historique peuplee creee avec `db push` (P3005).
Voir la procedure de mise a niveau ci-dessous. Ne jamais ajouter
`--accept-data-loss` ou `--force-reset` sur une base a conserver.

Dans un second terminal, depuis `frontend/` :

```sh
npm ci
npm run dev
```

Frontend : `http://localhost:5173`. Sante du backend :
`http://localhost:3000/api/health`. Vite transmet `/api` et `/socket.io` au backend.
Aucun secret n'est necessaire dans le frontend. Toute variable `VITE_*` est
publique dans le navigateur.

## Donnees De Demonstration

Sur une base isolee uniquement, renseigner `SEED_ADMIN_PASSWORD` et
`SEED_PLAYER_PASSWORD` dans `backend/.env`, puis lancer dans `backend/` :

```sh
npm run db:seed
```

Le seed cree les comptes `admin@casino.com` et `player@demo.com`, ainsi que
des donnees de demonstration. Il est desactive avec `NODE_ENV=production` et
n'est jamais lance par `setup.sh`. Le relancer peut ajouter des transactions et
des parties ; il ne change pas les mots de passe des comptes deja existants.
Changer ou supprimer les anciens comptes de demonstration sur toute instance
accessible, s'ils ont ete crees avec les anciens mots de passe du projet.

## Docker

Pour une base neuve, preparer d'abord le schema PostgreSQL depuis `backend/`
avec `npm ci`, `npm run db:generate` et `npm run db:push`.
Pour une base existante, suivre la procedure de mise a niveau ci-dessous.
Configurer ensuite le `.env` racine, avec une URL accessible depuis Docker.

Depuis la racine :

```sh
bash setup.sh
docker compose logs backend
```

Le script conserve le `.env` existant et s'arrete en cas d'erreur. Le frontend
est accessible sur `http://localhost`, et la sante via
`http://localhost/api/health`. Compose lance Redis, le backend et le frontend,
mais pas PostgreSQL. Le demarrage des conteneurs ne prouve pas que le backend
est pret : verifier les logs et l'endpoint de sante.

## Verification

Dans chacun des repertoires `backend/` et `frontend/` :

```sh
npm run lint
npm run build
npm test -- --run --pool=forks --maxWorkers=1 --minWorkers=1
```

Les tests unitaires ne necessitent pas de base partagee. Pour la regression
E2E poker, installer Chromium et cibler explicitement une instance de test isolee,
depuis `frontend/` :

```sh
npx playwright install chromium
CASINO_QA_URL=http://localhost:5173 npm run test:poker:e2e
```

Ce test cree des comptes et des transactions. Ses rapports sont locaux et exclus
du depot. Les validations unitaires ne constituent pas une certification de
securite ni une autorisation de mise en production.

La recette visuelle frontend utilise Chromium et des transports integralement
mockes : aucune connexion backend, creation de compte ou mise reelle. Depuis
`frontend/`, lancer `npm run test:visual`. Elle couvre les 13 jeux et le lobby en
320/390/768/1440 px, conserve les captures dans `reports/frontend-visual/` et
controle les debordements, le masquage des commandes et les erreurs JavaScript.
Les suites Vitest de jeux verifient aussi le deroulement des animations avec
des resultats serveur fixes, les actions repetees et le mouvement reduit.

Les validations financieres PostgreSQL utilisent leur propre cluster local,
ignorent l'URL applicative et le suppriment a la fin. Depuis `backend/`, avec
les binaires PostgreSQL installes et un utilisateur non-root :

```sh
npm run build
node scripts/financial.integration.mjs /usr/lib/postgresql/14/bin
node scripts/validate-financial-migration.mjs /usr/lib/postgresql/14/bin
```

## Politique Financiere

Les jeux contre la maison transferent les jetons entre joueur et caisse
`admin@casino.com`. La mise et le gain maximal sont reserves avant acceptation ;
une caisse insuffisante refuse la mise sans modifier les probabilites.
Le dashboard distingue disponible, reserves bots, reserves jeux et total.
Poker public transfere les stacks, et Bingo partage les tickets entre prix et
commission maison. Les bonus, recompenses, achats simules et recharges admin
sont des emissions explicites au journal, pas des paiements de la caisse.

Les POST financiers acceptent `Idempotency-Key` (1 a 128 caracteres parmi
lettres, chiffres, `.`, `_`, `:`, `-`). Conserver la meme cle pour rejouer la
meme operation ; utiliser une nouvelle cle pour une nouvelle intention.
Reutiliser une cle dans le meme perimetre avec un autre payload renvoie 409.
Sans cle, aucun dedoublonnage generique n'est garanti. Les connexions Socket
utilisent les protections propres aux sessions Poker/Bingo.

Le backend reste mono-instance : les parties sont en memoire. Au redemarrage,
les mises interrompues et les checkpoints d'escrow sont rembourses. Une reponse
de demarrage rejouee apres redemarrage n'est pas une restauration de partie.
La progression XP/taches post-paiement n'est pas durablement exactly-once.

## Mise A Niveau

Avant de changer une base existante, prendre un backup PostgreSQL natif et
verifier sa restauration sur une copie isolee. Le backup JSON applicatif
inclut desormais `FinancialOperation` et requiert donc le nouveau schema.
Ne pas l'utiliser comme seul backup avant la migration.

Inspecter le delta sur la copie restauree, depuis `backend/` :

```sh
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
```

Le delta attendu change seulement le defaut de `User.balance` a zero et ajoute
`FinancialOperation` avec ses index/contraintes. Les soldes existants restent
intacts. S'arreter si d'autres changements apparaissent.

Repeter la procedure sur la copie puis, en maintenance sans backend actif,
appliquer le delta verifie via `prisma db push --skip-generate` (sans options
de perte de donnees), regenerer le client et deployer les images compatibles.
Verifier les soldes, escrows, absence de derive de schema et la sante avant
reouverture. Ne jamais seed/reset la base applicative. L'adoption de Prisma
Migrate exige une baseline historique complete revue separement.

## Publication Git

Les sources, configurations partageables, documents et lockfiles sont inclus.
Les secrets, bases locales, caches, builds, rapports QA, sauvegardes et fichiers
personnels d'outillage sont exclus. Ne pas utiliser `git add -f` pour les inclure.

Avant le premier commit :

```sh
git add --dry-run .
git add .
git diff --cached --stat
git diff --cached
git commit -m "Initial commit"
```

Creer un depot distant vide, puis remplacer l'URL ci-dessous par son URL reelle :

```sh
git remote add origin <URL_DU_DEPOT>
git push -u origin HEAD
```

Si `origin` existe deja, verifier `git remote -v` plutot que l'ajouter a nouveau.
Si le depot distant contient deja des commits, les reconcilier avant le push ;
ne pas forcer le push pour les ecraser.

## Licence

Aucune licence de reutilisation n'a encore ete choisie. La publication du depot
ne remplace pas ce choix ; ajouter une licence adaptee avant de proposer le
projet comme logiciel libre.
