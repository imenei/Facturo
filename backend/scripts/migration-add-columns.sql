-- Migration pour ajouter les colonnes manquantes en production
-- Exécuter sur la base de données PostgreSQL de production
-- Usage: psql -U helpdz -d helpdz_db -f scripts/migration-add-columns.sql

-- 1. Ajouter la colonne totalMargin (rajoutée dans l'entité Invoice)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "totalMargin" DECIMAL(15,2) DEFAULT 0;

-- 2. Ajouter la colonne lastModifiedById (FK vers users)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "lastModifiedById" UUID;

-- 3. Ajouter une contrainte de clé étrangère si la colonne a été créée
-- (optionnel, dépend de si tu veux l'intégrité référentielle)
-- ALTER TABLE invoices ADD CONSTRAINT fk_last_modified_by FOREIGN KEY ("lastModifiedById") REFERENCES users(id);

-- 4. Ajouter les colonnes pour les tâches (tasks)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "startedDeliveryAt" TIMESTAMP;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "finishedDeliveryAt" TIMESTAMP;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "extraFees" DECIMAL(15,2) DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "extraFeesNote" TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "finalPrice" DECIMAL(15,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "deliveryDurationMinutes" INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "deliveryPhotoUrl" TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "totalMargin" DECIMAL(15,2) DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "marginRate" DECIMAL(5,2) DEFAULT 0;

-- 5. Vérification : lister les colonnes de la table invoices
-- \d invoices