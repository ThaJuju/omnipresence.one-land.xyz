# DEPLOY.md — Déploiement & Transfert sur machine principale

> Ce fichier contient toutes les commandes nécessaires pour installer, déployer,
> mettre à jour et maintenir la plateforme sur un VPS Linux (Ubuntu/Debian).
> À conserver précieusement — à jour avec chaque changement d'infra.

---

## 0. Prérequis sur le VPS

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm
npm install -g pnpm

# pm2
npm install -g pm2

# PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Git
sudo apt install -y git
```

---

## 1. Première installation (from scratch)

```bash
# 1. Créer l'utilisateur dédié (optionnel mais recommandé)
sudo adduser discordpanel
sudo usermod -aG sudo discordpanel
su - discordpanel

# 2. Cloner le repo
git clone https://github.com/TON_REPO/discordpanel.git /var/www/blackmdt
cd /var/www/blackmdt

# 3. Créer le fichier .env
cp .env.example .env
nano .env   # Remplir toutes les valeurs

# 4. Créer la base de données PostgreSQL
sudo -u postgres psql -c "CREATE USER discordpanel_user WITH PASSWORD 'TON_MOT_DE_PASSE';"
sudo -u postgres psql -c "CREATE DATABASE discordpanel OWNER discordpanel_user;"

# 5. Installer les dépendances
pnpm install --frozen-lockfile

# 6. Générer le client Prisma
pnpm db:generate

# 7. Appliquer les migrations
pnpm db:migrate:prod

# 8. Build
pnpm build

# 9. Créer le dossier uploads
mkdir -p /var/www/blackmdt/uploads
chmod 755 /var/www/blackmdt/uploads

# 10. Démarrer avec pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # Suivre les instructions affichées
```

---

## 2. Mise à jour

```bash
cd /var/www/blackmdt
git pull origin main
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate:prod
pnpm build
pm2 reload ecosystem.config.js --update-env
pm2 status
pm2 logs --lines 50
```

---

## 3. Commandes pm2

```bash
pm2 status
pm2 logs
pm2 logs discordpanel-web
pm2 logs discordpanel-bot
pm2 logs --lines 100
pm2 restart discordpanel-web
pm2 restart discordpanel-bot
pm2 restart all
pm2 stop discordpanel-web
pm2 delete discordpanel-web
pm2 monit
pm2 reload ecosystem.config.js
```

---

## 4. Base de données

```bash
sudo -u postgres psql discordpanel
pnpm db:migrate:prod
pnpm db:migrate:status
pnpm db:studio  # dev uniquement

# Backup
pg_dump -U discordpanel_user -h localhost discordpanel > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurer
psql -U discordpanel_user -h localhost discordpanel < backup_YYYYMMDD_HHMMSS.sql

# Reset DANGER — dev uniquement
pnpm db:reset
```

---

## 5. Variables d'environnement

Le fichier `.env` est à **`/var/www/blackmdt/.env`**.

Après chaque modification :
```bash
pm2 restart all
```

---

## 6. Ports utilisés

| Service | Port |
|---|---|
| Web (Next.js) | **3003** |
| Bot (HTTP interne) | 3001 |
| PostgreSQL | 5432 |

---

## 7. Config Nginx (reverse proxy)

```nginx
# /etc/nginx/sites-available/discordpanel
server {
    server_name votre-domaine.com;

    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/discordpanel /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL avec certbot
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.com
```

---

## 8. Diagnostic

```bash
# Vérifier les ports
ss -tlnp | grep -E '3001|3003|5432'

# Tester le web
curl http://localhost:3003/api/health

# Tester le bot
curl -H "x-internal-secret: TON_SECRET" http://localhost:3001/health

# Tester la DB
psql postgresql://discordpanel_user:PASSWORD@localhost:5432/discordpanel -c "SELECT 1;"

# Logs d'erreur uniquement
pm2 logs discordpanel-web --err
pm2 logs discordpanel-bot --err

pm2 flush   # Vider les logs
pm2 monit   # Monitoring ressources
```

---

## 9. Scripts pnpm

```bash
pnpm install                  # Installer les dépendances
pnpm install --frozen-lockfile # Production

pnpm db:generate              # Régénérer le client Prisma
pnpm db:migrate               # Migration dev
pnpm db:migrate:prod          # Migration production
pnpm db:migrate:status        # Statut des migrations
pnpm db:studio                # Interface web Prisma (dev)
pnpm db:seed                  # Seed
pnpm db:reset                 # Reset DANGER

pnpm dev                      # Dev local (web + bot)
pnpm dev:web                  # Next.js seul
pnpm dev:bot                  # Bot seul

pnpm build                    # Build tout
pnpm build:web                # Build Next.js
pnpm build:bot                # Build bot

pnpm lint                     # ESLint
pnpm typecheck                # TypeScript check
```

---

## 10. Checklist avant déploiement

- [ ] `pnpm typecheck` passe sans erreur
- [ ] `pnpm lint` passe sans erreur
- [ ] Toutes les nouvelles variables `.env` sont dans `.env.example`
- [ ] Migrations Prisma dans `packages/db/prisma/migrations/`
- [ ] `pnpm build` réussit
- [ ] `.env` du VPS mis à jour
- [ ] Backup DB avant `db:migrate:prod`

---

*Fin de DEPLOY.md — Web sur le port 3003, bot HTTP sur 3001.*
