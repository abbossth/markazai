-- Row-Level Security (0.1): barcha tenant jadvallari `organization_id` bo'yicha ajratiladi.
-- Bu fayl QO'LDA yozilgan SQL migratsiya (Prisma RLS'ni boshqarmaydi) va versiyalanadi.
--
-- Model:
--   * `markazai_app` — ilova ishlaganda ulanadigan cheklangan rol (egasi emas, BYPASSRLS yo'q): policy'lar unga qo'llanadi.
--   * Jadval egasi (migratsiya/seed/test ulanishi) RLS'dan o'tadi — u ishonchli, ilova sifatida ishlatilmaydi.
--   * Joriy tashkilot session sozlamasi `app.current_org` orqali beriladi (ilova har ulanishda o'rnatadi).
--     O'rnatilmagan/bo'sh bo'lsa `NULLIF(...)` NULL beradi va HECH QANDAY qator ko'rinmaydi (fail-closed).
--
-- Yangi jadval qo'shilganda (organization_id bilan) shu yerdagi kabi policy qo'shilishi SHART:
-- packages/db/src/rls.integration.test.ts buni tekshiradi va yo'q bo'lsa yiqiladi.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'markazai_app') THEN
    -- NOLOGIN: parolni va LOGIN huquqini DBA beradi (README → "RLS"): ALTER ROLE markazai_app LOGIN PASSWORD '...';
    CREATE ROLE markazai_app NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO markazai_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO markazai_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO markazai_app;
-- Migratsiya jadvaliga ilova tegmaydi.
REVOKE ALL ON TABLE "_prisma_migrations" FROM markazai_app;


ALTER TABLE "attendance" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "attendance"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "branches"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "call_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "call_logs"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "center_settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "center_settings"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "coin_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "coin_logs"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "comments"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "courses"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "dashboard_layouts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "dashboard_layouts"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "discounts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "discounts"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "exams" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "exams"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "expenses"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "grades" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "grades"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "group_students" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "group_students"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "group_tags" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "group_tags"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "groups"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "history_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "history_logs"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "holidays" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "holidays"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "integrations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "integrations"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "lead_columns" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "lead_columns"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "lead_forms" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "lead_forms"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "lead_lists" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "lead_lists"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "lead_tags" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "lead_tags"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "leads"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "online_lessons" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "online_lessons"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payments"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "reminder_tags" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "reminder_tags"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "reminders" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "reminders"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "rooms" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "rooms"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "salary_payments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "salary_payments"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "sms_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "sms_logs"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "student_tags" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "student_tags"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "students"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tags"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "teacher_attendance" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "teacher_attendance"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "teacher_branches" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "teacher_branches"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "teachers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "teachers"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "user_branches" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "user_branches"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "users"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);

ALTER TABLE "withdrawals" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "withdrawals"
  USING ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org', true), '')::uuid);
