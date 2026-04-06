# Facturo - Application de gestion commerciale & livraisons (PWA)

Application complete de facturation, gestion des livraisons et suivi des taches.
Stack: Next.js 14 + NestJS + PostgreSQL + PWA (mode offline)

## Roles & acces

| Role | Acces |
| --- | --- |
| Admin / Gerant | Acces total: utilisateurs, factures, livraisons, taches, parametres |
| Commercial | Creation de factures, proformas, bons de livraison; consultation de ses documents |
| Livreur | Ses taches uniquement; marquer terminee/non terminee, ajouter des remarques |

## Prerequis

- Node.js 20+
- PostgreSQL 14+ ou Docker
- npm 9+

## Demarrage rapide (Development)

Tu peux travailler sans Docker avec un PostgreSQL local administre depuis pgAdmin.
Docker reste disponible dans le projet, mais il n'est pas obligatoire.

### 1. Base de donnees PostgreSQL

Option recommandee - PostgreSQL local + pgAdmin

1. Installe PostgreSQL sur ta machine.
2. Ouvre pgAdmin et connecte-toi a ton serveur local.
3. Cree l'utilisateur et la base:

```sql
CREATE USER facturo WITH PASSWORD 'facturo_pass';
CREATE DATABASE facturo_db OWNER facturo;
```

4. Verifie que `backend/.env` contient bien:

```env
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=facturo
DB_PASS=facturo_pass
DB_NAME=facturo_db
```

Option alternative - Docker

```bash
docker run -d \
  --name facturo_postgres \
  -e POSTGRES_USER=facturo \
  -e POSTGRES_PASSWORD=facturo_pass \
  -e POSTGRES_DB=facturo_db \
  -p 5432:5432 \
  postgres:15-alpine
```

### 2. Backend (NestJS)

```bash
cd backend
npm install
Copy-Item .env.example .env
npm run start:dev
```

Initialiser la base de donnees:

```bash
npx ts-node src/seed.ts
```

Comptes crees par le seed:

| Email | Mot de passe | Role |
| --- | --- | --- |
| admin@facturo.dz | Admin@1234 | Admin |
| commercial@facturo.dz | Commercial@1234 | Commercial |
| livreur@facturo.dz | Livreur@1234 | Livreur |

L'API tourne sur `http://localhost:4000/api`.

### 3. Frontend (Next.js)

```bash
cd frontend
npm install
Copy-Item .env.local.example .env.local
npm run dev
```

L'application tourne sur `http://localhost:3000`.

## Demarrage avec Docker Compose

```bash
docker-compose up -d
docker exec facturo_api npx ts-node src/seed.ts
```

## Fonctionnalites

- Creation de factures, proformas et bons de livraison
- Export PDF et Word
- Gestion des livraisons et des taches
- Gestion des utilisateurs avec roles
- Parametres entreprise
- Mode offline (PWA)

## Structure du projet

```text
facturo/
|-- backend/
|   |-- src/
|   |   |-- auth/
|   |   |-- users/
|   |   |-- invoices/
|   |   |-- tasks/
|   |   |-- company/
|   |   `-- seed.ts
|   |-- Dockerfile
|   `-- package.json
|-- frontend/
|   |-- src/
|   |-- public/
|   |-- Dockerfile
|   `-- package.json
`-- docker-compose.yml
```

## Variables d'environnement

### Backend (`backend/.env`)

| Variable | Defaut | Description |
| --- | --- | --- |
| PORT | 4000 | Port du serveur |
| DB_HOST | 127.0.0.1 | Hote PostgreSQL |
| DB_PORT | 5432 | Port PostgreSQL |
| DB_USER | facturo | Utilisateur DB |
| DB_PASS | facturo_pass | Mot de passe DB |
| DB_NAME | facturo_db | Nom de la base |
| JWT_SECRET | a changer | Cle secrete JWT |
| FRONTEND_URL | http://localhost:3000 | URL du frontend |

### Frontend (`frontend/.env.local`)

| Variable | Defaut | Description |
| --- | --- | --- |
| NEXT_PUBLIC_API_URL | http://localhost:4000/api | URL de l'API |

## Utilisation avec pgAdmin

pgAdmin sert a administrer PostgreSQL; il ne remplace pas PostgreSQL lui-meme.
Pour Facturo sans Docker:

1. Demarre ton serveur PostgreSQL local.
2. Ouvre pgAdmin et cree la base `facturo_db` avec l'utilisateur `facturo`.
3. Verifie `backend/.env`.
4. Lance le backend avec `npm run start:dev`.
5. Lance le frontend avec `npm run dev`.

## Version desktop Windows

La PWA actuelle est conservee. En plus, le projet contient maintenant une couche `desktop/`
pour generer une vraie application Windows installable.

Flux de build desktop:

```bash
cd C:\Users\ALEM\Facturo
npm run build:backend
npm run build:frontend
npm run desktop:prepare
```

Cela prepare le runtime desktop dans `desktop/runtime`.

Ensuite, pour generer un installateur Windows:

```bash
cd C:\Users\ALEM\Facturo\desktop
npm install
npm run build
```

Resultat attendu:

- PWA toujours disponible dans le navigateur
- application desktop Windows via Electron
- installateur genere dans `desktop/dist`

Notes:

- la version desktop embarque le frontend et le backend de Facturo
- PostgreSQL reste externe et doit etre disponible sur la machine cible, ou pointer vers un serveur PostgreSQL accessible
- pendant le build desktop, le plugin PWA est desactive uniquement pour cette cible afin d'eviter les conflits de build Windows

## Licence

Projet proprietaire - (c) 2026 Facturo
