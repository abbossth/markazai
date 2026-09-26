-- CreateEnum
CREATE TYPE "ChargeMode" AS ENUM ('DAILY', 'CALENDAR', 'GROUP_START', 'MODULE', 'INDIVIDUAL', 'FULL_COURSE');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "charge_mode" "ChargeMode" NOT NULL DEFAULT 'DAILY';

-- CreateTable
CREATE TABLE "help_videos" (
    "id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "help_videos_category_sort_order_idx" ON "help_videos"("category", "sort_order");
