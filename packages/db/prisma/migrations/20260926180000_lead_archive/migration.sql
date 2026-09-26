-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "archive_note" TEXT,
ADD COLUMN     "archive_reason_id" UUID,
ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "archived_by_id" UUID;

-- CreateTable
CREATE TABLE "lead_archive_reasons" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_archive_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_archive_reasons_organization_id_name_key" ON "lead_archive_reasons"("organization_id", "name");

-- CreateIndex
CREATE INDEX "leads_organization_id_archived_at_idx" ON "leads"("organization_id", "archived_at");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_archive_reason_id_fkey" FOREIGN KEY ("archive_reason_id") REFERENCES "lead_archive_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-Level Security: yangi tenant jadvali (rls.integration.test.ts shuni talab qiladi).
GRANT SELECT, INSERT, UPDATE, DELETE ON "lead_archive_reasons" TO markazai_app;
ALTER TABLE "lead_archive_reasons" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "lead_archive_reasons"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);
