-- AlterTable
ALTER TABLE "center_settings" ADD COLUMN     "address" TEXT,
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "login_welcome" TEXT,
ADD COLUMN     "offer_text" TEXT,
ADD COLUMN     "receipt_footer" TEXT,
ADD COLUMN     "receipt_header" TEXT,
ADD COLUMN     "receipt_show_branch" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "receipt_show_cashier" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "receipt_show_logo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "telegram" TEXT;

-- CreateTable
CREATE TABLE "holidays" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_forms" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "submit_label" TEXT NOT NULL,
    "success_message" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "column_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "holidays_organization_id_date_key" ON "holidays"("organization_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "lead_forms_organization_id_key" ON "lead_forms"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_organization_id_kind_key" ON "integrations"("organization_id", "kind");

