-- CreateEnum
CREATE TYPE "SalaryType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "TeacherAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXTRA');

-- AlterTable
ALTER TABLE "teachers" ADD COLUMN     "fixed_salary" INTEGER,
ADD COLUMN     "percent" INTEGER,
ADD COLUMN     "salary_type" "SalaryType" NOT NULL DEFAULT 'PERCENT',
ADD COLUMN     "work_days" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "work_end" TEXT,
ADD COLUMN     "work_start" TEXT,
ADD COLUMN     "work_start_date" DATE;

-- CreateTable
CREATE TABLE "teacher_branches" (
    "organization_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,

    CONSTRAINT "teacher_branches_pkey" PRIMARY KEY ("teacher_id","branch_id")
);

-- CreateTable
CREATE TABLE "teacher_attendance" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "status" "TeacherAttendanceStatus" NOT NULL,
    "marked_by_id" UUID,

    CONSTRAINT "teacher_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_payments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "expense_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teacher_branches_organization_id_idx" ON "teacher_branches"("organization_id");

-- CreateIndex
CREATE INDEX "teacher_attendance_organization_id_date_idx" ON "teacher_attendance"("organization_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_attendance_teacher_id_date_key" ON "teacher_attendance"("teacher_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "salary_payments_expense_id_key" ON "salary_payments"("expense_id");

-- CreateIndex
CREATE INDEX "salary_payments_organization_id_period_idx" ON "salary_payments"("organization_id", "period");

-- AddForeignKey
ALTER TABLE "teacher_branches" ADD CONSTRAINT "teacher_branches_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_branches" ADD CONSTRAINT "teacher_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_attendance" ADD CONSTRAINT "teacher_attendance_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

