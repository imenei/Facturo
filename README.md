# 🚀 Facturo — Application de gestion commerciale & livraisons (PWA)

Application complète de facturation, gestion des livraisons et suivi des tâches.  
**Stack :** Next.js 14 + NestJS + PostgreSQL + PWA (mode offline)

---

## 🧑‍💼 Rôles & accès

| Rôle | Accès |
|------|-------|
| **Admin / Gérant** | Accès total : utilisateurs, factures, livraisons, tâches, paramètres |
| **Commercial** | Création de factures, proformas, bons de livraison — consultation de ses docs |
| **Livreur** | Ses tâches uniquement — marquer terminée/non terminée, ajouter remarques |

---

## 📦 Prérequis

- Node.js 20+
- PostgreSQL 14+ (ou Docker)
- npm 9+

---

## ⚡ Démarrage rapide (Development)

### 1. Base de données PostgreSQL

**Option A — Docker (recommandé)**
```bash
docker run -d \
  --name facturo_postgres \
  -e POSTGRES_USER=facturo \
  -e POSTGRES_PASSWORD=facturo_pass \
  -e POSTGRES_DB=facturo_db \
  -p 5432:5432 \
  postgres:15-alpine
```

**Option B — PostgreSQL local**
```sql
CREATE USER facturo WITH PASSWORD 'facturo_pass';
CREATE DATABASE facturo_db OWNER facturo;
```

---

### 2. Backend (NestJS)

```bash
cd backend

# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env
# Modifier .env si nécessaire

# Lancer en développement
npm run start:dev
```

**Initialiser la base de données (seed) :**
```bash
npx ts-node src/seed.ts
```

Comptes créés :
| Email | Mot de passe | Rôle |
|-------|-------------|------|
| admin@facturo.dz | Admin@1234 | Admin |
| commercial@facturo.dz | Commercial@1234 | Commercial |
| livreur@facturo.dz | Livreur@1234 | Livreur |

L'API tourne sur : **http://localhost:4000/api**

---

### 3. Frontend (Next.js)

```bash
cd frontend

# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.local.example .env.local

# Lancer en développement
npm run dev
```

L'application tourne sur : **http://localhost:3000**

---

## 🐳 Démarrage avec Docker Compose (Production)

```bash
# À la racine du projet
docker-compose up -d

# Exécuter le seed (première fois)
docker exec facturo_api npx ts-node src/seed.ts
```

---

## 🌐 Fonctionnalités

### 📄 Facturation
- Création de **factures**, **proformas**, **bons de livraison**
- Avec ou sans **TVA** (taux configurable)
- Saisie manuelle des clients et articles
- **Export PDF** et **Word (.docx)**
- Numérotation automatique (FAC-2024-0001)

### 🚚 Livraisons
- Suivi du statut : En attente / Livrée / Non livrée
- Vue globale admin de toutes les livraisons
- Statistiques en temps réel

### ✅ Tâches livreurs
- Création par l'admin avec prix défini
- Assignation à un livreur
- Marquage : Terminée / Non terminée
- Ajout de remarques optionnelles
- Calcul automatique du total gagné

### 👥 Gestion des utilisateurs
- CRUD complet (admin)
- Activation / désactivation des comptes
- 3 rôles : Admin, Commercial, Livreur

### 🏢 Paramètres entreprise
- Logo, signature, cachet (import image)
- Informations légales (NIF, NIS, RC, AI, RIB)
- Mentions légales pied de page

### 📶 Mode Offline (PWA)
- Les données sont mises en cache (IndexedDB)
- Les actions hors-ligne sont mises en file d'attente
- Synchronisation automatique au retour d'internet
- Installable comme application native

---

## 📁 Structure du projet

```
facturo/
├── backend/                  # NestJS API
│   ├── src/
│   │   ├── auth/             # JWT Auth
│   │   ├── users/            # Gestion utilisateurs
│   │   ├── invoices/         # Factures / Proformas / BL
│   │   ├── tasks/            # Tâches livreurs
│   │   ├── company/          # Paramètres entreprise
│   │   └── seed.ts           # Script d'initialisation
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                 # Next.js 14 PWA
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/        # Page connexion
│   │   │   └── (dashboard)/  # Pages protégées
│   │   │       ├── dashboard/
│   │   │       ├── invoices/
│   │   │       ├── deliveries/
│   │   │       ├── tasks/
│   │   │       ├── users/
│   │   │       └── company/
│   │   ├── components/       # Composants réutilisables
│   │   ├── lib/              # API, PDF, Word, IndexedDB
│   │   ├── store/            # Zustand (auth)
│   │   └── hooks/            # useOnlineStatus
│   ├── public/
│   │   └── manifest.json     # PWA manifest
│   ├── Dockerfile
│   └── package.json
│
└── docker-compose.yml
```

---

## 🔒 Sécurité

- Authentification JWT (7 jours)
- Mots de passe hashés bcrypt (salt=12)
- Guards par rôle (RBAC)
- CORS configuré
- Validation des données (class-validator)

---

## 📱 Installation PWA

Ouvrez l'application dans Chrome/Edge → cliquez sur l'icône d'installation dans la barre d'adresse → "Installer Facturo".

L'application fonctionne alors comme un logiciel natif sur ordinateur et smartphone.

---

## 🛠️ Variables d'environnement

### Backend (.env)
| Variable | Défaut | Description |
|----------|--------|-------------|
| PORT | 4000 | Port du serveur |
| DB_HOST | localhost | Hôte PostgreSQL |
| DB_PORT | 5432 | Port PostgreSQL |
| DB_USER | facturo | Utilisateur DB |
| DB_PASS | facturo_pass | Mot de passe DB |
| DB_NAME | facturo_db | Nom de la base |
| JWT_SECRET | *(à changer)* | Clé secrète JWT |
| FRONTEND_URL | http://localhost:3000 | URL du frontend |

### Frontend (.env.local)
| Variable | Défaut | Description |
|----------|--------|-------------|
| NEXT_PUBLIC_API_URL | http://localhost:4000/api | URL de l'API |

---

## 📄 Licence

Projet propriétaire — © 2024 Facturo
