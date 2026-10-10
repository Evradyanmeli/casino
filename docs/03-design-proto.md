# Design System & Prototype — Casino Social

## Charte Graphique

### Thème
Casino social moderne, sombre et luxueux (dark mode). Inspiré de Stake, Roobet.

### Palette
| Rôle | Couleur | Hex | Usage |
|------|---------|-----|-------|
| Fond principal | Très foncé bleuté | `#0D0D1A` | Body, arrière-plan global |
| Fond secondaire | Bleu foncé | `#1A1A2E` | Cartes, sections, modales |
| Fond tertiaire | Bleu moyen | `#232340` | Hover, inputs |
| Primaire | Or | `#FFD700` | Gains, points forts, CTA |
| Secondaire | Rose/Rouge | `#E8457A` | CTA secondaires, actions |
| Accent | Cyan | `#00E5FF` | Infos, notifications, solde |
| Succès | Vert | `#00C853` | Wins, positif |
| Erreur | Rouge | `#FF1744` | Pertes, négatif |
| Texte principal | Blanc | `#FFFFFF` | Corps de texte |
| Texte secondaire | Gris | `#9E9E9E` | Labels, sous-titres |

### Typographie
- **Headings** : Orbitron (futuriste/casino)
- **Body** : Inter (lisible)
- Tailles : h1 32px, h2 24px, h3 20px, body 16px, small 14px, caption 12px

### Composants
- Boutons arrondis (8px radius), 5 variantes (primary/secondary/accent/outline/ghost)
- Cartes avec bordure subtile, effet glow au hover
- Inputs dark mode
- Modales centrées avec overlay flouté
- Toasts de notification
- Progress bars animées
- Badges colorés
- Tabs, toggles, sliders

## Prototype — Écrans couverts (20 écrans)

| # | Hash | Écran | Description |
|---|------|-------|-------------|
| 1 | `#login` | Connexion | Email/password + Google OAuth |
| 2 | `#register` | Inscription | Email, password, date naissance (18+) |
| 3 | `#lobby` | Dashboard / Lobby | Grille 13 jeux, solde, daily reward, notifications |
| 4 | `#slots3` | Slot 3 Rlx | 3 rouleaux, symboles 🍒🔔💎7️⃣BAR, spin, mise, lignes |
| 5 | `#blackjack` | Blackjack | Table, cartes, Hit/Stand/Double/Split/Surrender |
| 6 | `#roulette` | Roulette | Roue + grille mises (numéros, rouge/noir, douzaines) |
| 7 | `#poker-lobby` | Poker Lobby | Liste tables, stakes, joueurs, waitlist |
| 8 | `#poker-table` | Poker Table | Cartes, tapis, jetons, timer, actions |
| 9 | `#crash` | Crash | Graphique multiplicateur, cashout, mises |
| 10 | `#plinko` | Plinko | Pyramide, rangées/risque, bille |
| 11 | `#mines` | Mines | Grille 5x5, gemmes/mines, cashout |
| 12 | `#wheel` | Wheel of Fortune | Roue segments colorés |
| 13 | `#limbo` | Limbo | Slider cible, résultat instantané |
| 14 | `#craps` | Dés/Craps | Table de dés, types de mises |
| 15 | `#bingo` | Bingo | Grille 5x5, numéros tirés |
| 16 | `#tasks` | Tâches Quotidiennes | 5 tâches avec barres de progression |
| 17 | `#race` | Daily Race | Classement top 10 |
| 18 | `#profile` | Profil Joueur | Stats, badges, XP |
| 19 | `#admin` | Admin Dashboard | KPIs, graphiques |
| 20 | `#admin-economy` | Admin Économie | Sliders house edge, daily reward, recharge |

