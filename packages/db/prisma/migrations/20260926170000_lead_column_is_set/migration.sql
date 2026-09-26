-- AlterTable
ALTER TABLE "lead_columns" ADD COLUMN     "is_set" BOOLEAN NOT NULL DEFAULT false;

-- Mavjud "Set" ustunlarini belgilash
UPDATE "lead_columns" SET "is_set" = true WHERE lower("name") = 'set';
