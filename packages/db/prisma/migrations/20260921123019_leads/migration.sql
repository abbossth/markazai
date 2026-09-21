-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('INSTAGRAM', 'TELEGRAM', 'FACEBOOK', 'WEBSITE', 'REFERRAL', 'WALK_IN', 'PHONE', 'OTHER');

-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('ANSWERED', 'NO_ANSWER', 'BUSY', 'WRONG_NUMBER');

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('OUTGOING', 'INCOMING');

-- CreateEnum
CREATE TYPE "SmsStatus" AS ENUM ('SENT', 'FAILED', 'MOCK');

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "lead_id" UUID;

-- CreateTable
CREATE TABLE "lead_columns" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_lists" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "column_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "source" "LeadSource",
    "column_id" UUID NOT NULL,
    "list_id" UUID,
    "position" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "assigned_to_id" UUID,
    "course_id" UUID,
    "days_pattern" "DaysPattern",
    "converted_student_id" UUID,
    "converted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_tags" (
    "organization_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "lead_tags_pkey" PRIMARY KEY ("lead_id","tag_id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "due_at" TIMESTAMP(3) NOT NULL,
    "responsible_id" UUID NOT NULL,
    "lead_id" UUID,
    "group_id" UUID,
    "student_id" UUID,
    "done_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_tags" (
    "organization_id" UUID NOT NULL,
    "reminder_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "reminder_tags_pkey" PRIMARY KEY ("reminder_id","tag_id")
);

-- CreateTable
CREATE TABLE "call_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "lead_id" UUID,
    "student_id" UUID,
    "direction" "CallDirection" NOT NULL DEFAULT 'OUTGOING',
    "outcome" "CallOutcome" NOT NULL,
    "duration_seconds" INTEGER,
    "note" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "lead_id" UUID,
    "student_id" UUID,
    "phone" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "SmsStatus" NOT NULL,
    "provider" TEXT NOT NULL,
    "error" TEXT,
    "sent_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_columns_organization_id_position_idx" ON "lead_columns"("organization_id", "position");

-- CreateIndex
CREATE INDEX "lead_lists_organization_id_column_id_position_idx" ON "lead_lists"("organization_id", "column_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "leads_converted_student_id_key" ON "leads"("converted_student_id");

-- CreateIndex
CREATE INDEX "leads_organization_id_column_id_list_id_position_idx" ON "leads"("organization_id", "column_id", "list_id", "position");

-- CreateIndex
CREATE INDEX "leads_organization_id_phone_idx" ON "leads"("organization_id", "phone");

-- CreateIndex
CREATE INDEX "lead_tags_organization_id_idx" ON "lead_tags"("organization_id");

-- CreateIndex
CREATE INDEX "reminders_organization_id_responsible_id_done_at_due_at_idx" ON "reminders"("organization_id", "responsible_id", "done_at", "due_at");

-- CreateIndex
CREATE INDEX "reminders_organization_id_lead_id_idx" ON "reminders"("organization_id", "lead_id");

-- CreateIndex
CREATE INDEX "reminders_organization_id_group_id_idx" ON "reminders"("organization_id", "group_id");

-- CreateIndex
CREATE INDEX "reminder_tags_organization_id_idx" ON "reminder_tags"("organization_id");

-- CreateIndex
CREATE INDEX "call_logs_organization_id_lead_id_idx" ON "call_logs"("organization_id", "lead_id");

-- CreateIndex
CREATE INDEX "call_logs_organization_id_student_id_idx" ON "call_logs"("organization_id", "student_id");

-- CreateIndex
CREATE INDEX "sms_logs_organization_id_lead_id_idx" ON "sms_logs"("organization_id", "lead_id");

-- CreateIndex
CREATE INDEX "sms_logs_organization_id_student_id_idx" ON "sms_logs"("organization_id", "student_id");

-- CreateIndex
CREATE INDEX "comments_organization_id_lead_id_idx" ON "comments"("organization_id", "lead_id");

-- AddForeignKey
ALTER TABLE "lead_lists" ADD CONSTRAINT "lead_lists_column_id_fkey" FOREIGN KEY ("column_id") REFERENCES "lead_columns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_column_id_fkey" FOREIGN KEY ("column_id") REFERENCES "lead_columns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "lead_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_student_id_fkey" FOREIGN KEY ("converted_student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_tags" ADD CONSTRAINT "lead_tags_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_tags" ADD CONSTRAINT "lead_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_tags" ADD CONSTRAINT "reminder_tags_reminder_id_fkey" FOREIGN KEY ("reminder_id") REFERENCES "reminders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_tags" ADD CONSTRAINT "reminder_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
