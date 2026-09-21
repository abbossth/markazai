-- CreateEnum
CREATE TYPE "CoinKind" AS ENUM ('ATTENDANCE', 'MANUAL');

-- AlterTable
ALTER TABLE "center_settings" ADD COLUMN     "coins_per_lesson" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "coin_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "group_id" UUID,
    "amount" INTEGER NOT NULL,
    "kind" "CoinKind" NOT NULL,
    "reason" TEXT,
    "date" DATE NOT NULL,
    "lesson_date" DATE,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coin_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coin_logs_organization_id_student_id_idx" ON "coin_logs"("organization_id", "student_id");

-- CreateIndex
CREATE INDEX "coin_logs_organization_id_date_idx" ON "coin_logs"("organization_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "coin_logs_student_id_group_id_lesson_date_kind_key" ON "coin_logs"("student_id", "group_id", "lesson_date", "kind");

-- AddForeignKey
ALTER TABLE "coin_logs" ADD CONSTRAINT "coin_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_logs" ADD CONSTRAINT "coin_logs_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

