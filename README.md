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

`db:push` prepare le schema sur une base de developpement neuve. Aucune migration
Prisma n'est encore versionnee : ne pas utiliser cette commande comme procedure
de migration en production et ne pas ajouter `--accept-data-loss` sur une base
contenant des donnees a conserver.

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

Preparer d'abord le schema PostgreSQL depuis `backend/` avec les commandes
`npm ci`, `npm run db:generate` et `npm run db:push`, sur la base visee.
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
