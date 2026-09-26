-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "teacher_id" UUID;

-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "teacher_id" UUID;

-- CreateIndex
CREATE INDEX "comments_organization_id_teacher_id_idx" ON "comments"("organization_id", "teacher_id");

-- CreateIndex
CREATE INDEX "reminders_organization_id_teacher_id_idx" ON "reminders"("organization_id", "teacher_id");

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
