# Plateforme de Casino Social (Monnaie Virtuelle)

## Description
Créer une plateforme de casino en ligne avec une monnaie interne (virtuelle, sans argent réel).
Type : "Social casino" — purement ludique, pas de gambling réel.

## Jeux souhaités
1. Slot machine 3 rouleaux
2. Slot machine 4 rouleaux
3. Slot machine 5 rouleaux
4. Blackjack
5. Roulette
6. Poker (Texas Hold'em)
7. Dés / Craps
8. Bingo
9. Mines (click-to-reveal)
10. Crash
11. Plinko
12. Wheel of Fortune
13. Limbo

## Stack technique
- Frontend : React (JS/TS)
- Backend : Node.js (JS/TS)

## Interface
- Bilingue français / anglais (i18n)
- Design adaptatif (responsive)

## Comptes utilisateurs
- Inscription / Connexion (email + Google OAuth)
- Profil joueur
- Historique des parties
- Solde de monnaie virtuelle
- Âge minimum : 18+

## Interface
- Responsive web (pas de PWA)
- Terminologie libre : "miser", "gagner", "paris" utilisés

## Jeux supplémentaires (confirmés)
- Crash
- Plinko
- Wheel of Fortune
- Limbo

## House Account
- La maison a un capital de départ virtuel
- Chaque perte d'un joueur = gain pour la maison et vice-versa
- Dashboard admin pour voir la rentabilité virtuelle de la maison
- Les jetons quotidiens offerts sont déduits du house account (dépense marketing)

## Multi-joueurs & Bots
- Lobby avec liste des parties disponibles, waitlist par partie
- Si pas assez de participants, un bot étiqueté "Bot" complète
- 1 bot minimum identifiable, les autres joueurs rejoignent depuis la lobby
- Les bots suivent des stratégies réalistes mais sont clairement identifiés comme IA

## Poker spécifiquement
- Interface "lobby" listant les tables (nom, stakes, nb joueurs, taille waitlist)
- Rejoindre une table → assis si place libre, sinon waitlist
- Création de table → apparaît dans le lobby, les joueurs rejoignent depuis la liste
- Quand une place se libère → notification au 1er de la waitlist, 30s pour accepter
- Bots étiquetés "Bot" (stratégie réaliste, identifiés comme IA)

## Contraintes
- Monnaie strictement virtuelle (pas de transactions réelles)
- Pas de gambling réel — purement divertissement
