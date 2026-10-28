-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "sentAt" DATETIME;

-- Backfill: existing sent/paid invoices use their creation date as the sent date
UPDATE "Invoice" SET "sentAt" = "createdAt" WHERE "status" IN ('sent', 'paid');
