# OmniPresence

Panel web de gestion de présence pour serveurs Discord — bot + dashboard multi-tenant.

> **Statut : projet en pause.** Je ne l'utilise plus vraiment et je ne compte pas
> le développer activement. Le code est publié en l'état, sous licence MIT, pour
> qui voudrait s'en inspirer, le forker ou le reprendre.
>
> C'est une alternative auto-hébergée à [panel.presencebot.org](https://panel.presencebot.org/en/).

---

## Ce que ça fait

Un bot Discord et un panel web partagent la même base de données. Chaque serveur
Discord (« guild ») où le bot est invité devient une instance isolée avec sa
propre configuration, ses membres, ses grades et ses données.

**Côté bot (discord.js v14)**

- Commandes slash : `/presence`, `/absence`, `/rapport`, `/monstatus`, `/sync`
- Synchronisation automatique des membres et des rôles (arrivées, départs, mises à jour)
- Tâches planifiées (`node-cron`) : pointage quotidien, rapports quotidiens /
  hebdomadaires / mensuels, rappels, vérification des avertissements, nettoyage
  des guilds inactives
- Serveur HTTP interne pour les appels venant du panel (protégé par secret partagé)

**Côté web (Next.js 14 App Router)**

- Connexion Discord OAuth (NextAuth v5), droits dérivés des rôles Discord
- Dashboard par serveur : présences, absences, avertissements, contributions,
  comptabilité, cartes VDA, grades, notifications, statistiques
- Calendrier (FullCalendar), graphiques (Recharts), exports PDF (PDFKit) et
  Excel (ExcelJS)
- Espace superadmin : instances, groupes multi-serveurs, profil du bot, stats globales
- Interface FR / EN, thème sombre & clair

---

## Stack

| | |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Web | Next.js 14, React 18, Tailwind CSS, Radix UI |
| Bot | discord.js 14, Express, node-cron |
| Données | PostgreSQL 16 + Prisma |
| Auth | NextAuth v5 (Discord OAuth) |
| Prod | pm2 + Nginx |

```
apps/
  bot/        bot Discord + serveur HTTP interne
  web/        panel Next.js
packages/
  db/         schéma Prisma, migrations, client partagé
  shared/     types et utilitaires communs
```

---

## Démarrage rapide

Prérequis : Node.js 20, pnpm 10, PostgreSQL 16, et une application sur le
[Discord Developer Portal](https://discord.com/developers/applications).

```bash
git clone <url-du-repo> omnipresence
cd omnipresence
pnpm install
cp .env.example .env   # puis remplir les valeurs
pnpm db:generate
pnpm db:migrate
pnpm dev
```

`pnpm dev` lance le web et le bot en parallèle. Pour n'en lancer qu'un :
`pnpm dev:web` ou `pnpm dev:bot`.

### Variables d'environnement

Tout est décrit dans [.env.example](.env.example). L'essentiel :

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | OAuth du panel |
| `DISCORD_BOT_TOKEN` | Token du bot |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | Session web (`openssl rand -base64 32`) |
| `BOT_INTERNAL_SECRET` | Secret partagé web ↔ bot (`openssl rand -hex 32`) |
| `SUPERADMIN_DISCORD_ID` | Ton Discord user ID, accès superadmin |
| `WEB_PORT` / `BOT_HTTP_PORT` | Ports d'écoute |
| `UPLOADS_DIR` | Dossier de stockage des fichiers |

### Invitation du bot

Permissions nécessaires : `bot` + `applications.commands`, avec la lecture des
membres du serveur (**Server Members Intent** à activer dans le portail Discord).

---

## Commandes utiles

```bash
pnpm build            # build web + bot
pnpm typecheck        # vérification TypeScript
pnpm lint             # ESLint
pnpm db:studio        # Prisma Studio
pnpm db:migrate       # nouvelle migration (dev)
pnpm db:seed          # jeu de données de départ
```

---

## Déploiement

Le déploiement sur VPS (Nginx, pm2, PostgreSQL, sauvegardes, mises à jour) est
documenté pas à pas dans [DEPLOY.md](DEPLOY.md). `ecosystem.config.js` contient
la configuration pm2 des deux process, et `deploy.sh` enchaîne
build + migrations + redémarrage.

---

## Contribuer

Le projet n'est plus maintenu activement : les issues et pull requests peuvent
rester sans réponse. Les forks sont les bienvenus.

## Licence

[MIT](LICENSE) — © ThaJuju
