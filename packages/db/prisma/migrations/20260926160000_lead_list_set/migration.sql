-- AlterTable
ALTER TABLE "lead_lists" ADD COLUMN     "course_id" UUID,
ADD COLUMN     "days_pattern" "DaysPattern",
ADD COLUMN     "start_time" TEXT,
ADD COLUMN     "teacher_id" UUID;
