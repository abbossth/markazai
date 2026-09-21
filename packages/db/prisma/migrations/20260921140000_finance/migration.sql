-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'PAYME', 'CLICK', 'UZUM');

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "lesson_date" DATE,
ADD COLUMN     "method" "PaymentMethod" NOT NULL DEFAULT 'CASH';

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_organization_id_date_idx" ON "expenses"("organization_id", "date");

-- CreateIndex
CREATE INDEX "withdrawals_organization_id_date_idx" ON "withdrawals"("organization_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "payments_student_id_group_id_lesson_date_key" ON "payments"("student_id", "group_id", "lesson_date");

