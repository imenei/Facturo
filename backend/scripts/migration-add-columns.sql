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
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "invoiceId" UUID;

-- 5. Colonnes bénéfice / livraison / taille du nom (factures)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "otherCharge" DECIMAL(15,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "deliveryPrice" DECIMAL(15,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "deliveryPersonId" UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "deliveryPersonName" VARCHAR;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "netProfit" DECIMAL(15,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "issuerNameSize" INTEGER DEFAULT 16;

UPDATE invoices
SET "netProfit" = COALESCE("totalMargin", 0) - COALESCE("otherCharge", 0) - COALESCE("deliveryPrice", 0);

CREATE TABLE IF NOT EXISTS invoice_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoiceId" VARCHAR NOT NULL,
  "invoiceNumber" VARCHAR NOT NULL,
  "clientName" VARCHAR,
  "requestedById" UUID,
  reason TEXT NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'pending',
  "reviewedById" UUID,
  "reviewedAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

-- 6. Corbeille et traçabilité facture / bon de livraison
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "sourceInvoiceId" VARCHAR;

-- 7. Remise sur facture
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "adjustmentType" VARCHAR NOT NULL DEFAULT 'discount';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "adjustmentPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "adjustmentAmount" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "otherCharges" JSONB NOT NULL DEFAULT '[]'::jsonb;
UPDATE invoices
SET "adjustmentPercent" = COALESCE("discountPercent", 0),
    "adjustmentAmount" = COALESCE("discountAmount", 0),
    "adjustmentType" = 'discount'
WHERE COALESCE("discountPercent", 0) > 0
  AND COALESCE("adjustmentPercent", 0) = 0;

-- 8. Historique des rappels e-mail
CREATE TABLE IF NOT EXISTS reminder_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoiceId" UUID NOT NULL,
  "invoiceNumber" VARCHAR NOT NULL,
  "recipientEmail" VARCHAR NOT NULL,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  message TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reminder_history_invoice_created
  ON reminder_history ("invoiceId", "createdAt" DESC);

-- 9. Modèle e-mail persistant
CREATE TABLE IF NOT EXISTS notification_settings (
  id VARCHAR PRIMARY KEY,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 10. Vérification : lister les colonnes de la table invoices
-- \d invoices