# Markazai — deploy va launch qo'llanmasi (10-bosqich)

Ikkita **alohida Vercel loyihasi** (bitta monorepo): `tenant-app` (`*.markazai.uz`) va `platform-admin` (`admin.markazai.uz`).
Bu qo'llanmadagi qadamlarning bir qismi tashqi akkaunt talab qiladi (domen registratori, Vercel, Neon/Supabase) — ularni faqat loyiha egasi bajara oladi.
Kod tomoni tayyor va lokal `next build` + `next start` bilan tekshirilgan (`npm run launch:check`).

## 1. Bazalar (2 ta alohida baza)

Neon/Supabase'da ikkita baza: `markazai_tenant` va `markazai_platform` (bir xil klasterda bo'lishi mumkin, lekin **alohida baza va alohida foydalanuvchi**).

```bash
# 1) Tenant bazasi (EGASI ulanishi bilan): sxema + RLS migratsiyasi
DATABASE_URL="postgresql://owner:...@host/markazai_tenant" npm run migrate:deploy -w @markazai/db
# RLS migratsiyasi `markazai_app` rolini (NOLOGIN) yaratadi. Unga parol bering:
psql "$DATABASE_URL" -c "ALTER ROLE markazai_app LOGIN PASSWORD '<kuchli-parol>'"

# 2) Control Plane bazasi
PLATFORM_DATABASE_URL="postgresql://.../markazai_platform" npm run platform:migrate -w @markazai/db
NODE_ENV=production PLATFORM_OWNER_PASSWORD='<kamida 12 belgi>' PLATFORM_DATABASE_URL=... npm run platform:seed -w @markazai/db
```

- Demo seed (`npm run db:seed`) production'da **ishlamaydi** (ma'lum parollar) — kerak bo'lsa `ALLOW_DEMO_SEED=1` (tavsiya etilmaydi).
- Platform seed yaratgan demo tashkilot (`slug=demo`) va `owner@markazai.uz`: birinchi kirishdan keyin parolni almashtiring, keraksiz demo tashkilotni "O'chirilgan" qiling.
- Tenant-app'ning platform bazasiga ulanishi **faqat o'qish** uchun (slug → tashkilot). Tavsiya: platform bazasida alohida `SELECT`-only rol yarating va tenant-app'ga shuning URL'ini bering.

## 2. Domen va DNS (0.2)

1. `markazai.uz` nameserver'larini Vercel'nikiga o'tkazing: `ns1.vercel-dns.com`, `ns2.vercel-dns.com` (wildcard SSL uchun shart).
2. **tenant-app** loyihasiga (Root Directory: `apps/tenant-app`) domenlarni qo'shing: `markazai.uz`, `www.markazai.uz` va **`*.markazai.uz`**.
3. **platform-admin** loyihasiga (Root Directory: `apps/platform-admin`) faqat `admin.markazai.uz` ni qo'shing (Vercel aniq subdomenni wildcard'dan ustun qo'yadi).
4. Har bir `{slug}.markazai.uz` avtomatik ishlaydi, alohida DNS/SSL ishi kerak emas.
5. Ikkala loyihada: Settings → General → "Include source files outside of the Root Directory" yoqilgan bo'lsin (monorepo).

## 3. Muhit o'zgaruvchilari

**tenant-app** (Production):

| O'zgaruvchi | Qiymat |
|---|---|
| `DATABASE_URL` | tenant bazasi **egasi** ulanishi — faqat migratsiya uchun; runtime'da shart emas (qo'ymasangiz ham bo'ladi) |
| `APP_DATABASE_URL` | tenant bazasi, `markazai_app` roli (**shart** — yo'q bo'lsa ilova ishga tushmaydi) |
| `PLATFORM_DATABASE_URL` | Control Plane bazasi (o'qish uchun) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `ROOT_DOMAIN` | `markazai.uz` |
| `PROVISIONING_SECRET` | `openssl rand -hex 24` (platform-admin bilan bir xil) |
| `SECRETS_KEY` | integratsiya sirlarini shifrlash kaliti (`openssl rand -base64 32`); yo'q bo'lsa `AUTH_SECRET` |
| `UPLOAD_DIR` | Vercel'da fayl tizimi vaqtinchalik — `lib/storage.ts`ni S3/R2 bilan almashtirish kerak (logotip/banner) |

`DEFAULT_TENANT_SLUG` production'da **e'tiborga olinmaydi** (noma'lum host rad etiladi).

**platform-admin** (Production) — `.env.example` ga qarang. **`DATABASE_URL` / `APP_DATABASE_URL` bu yerga QO'YILMAYDI** (test buni tekshiradi):
`PLATFORM_DATABASE_URL`, `PLATFORM_AUTH_SECRET` (tenant `AUTH_SECRET`'idan farqli), `PROVISIONING_SECRET`, `TENANT_APP_URL` (masalan `https://markazai.uz` — imzolangan ichki API shu manzilga boradi), `ROOT_DOMAIN`.

> `TENANT_APP_URL` apex domenga ko'rsatsa, tenant-app `/api/internal/*` ni **host'ga bog'liq bo'lmagan** holda `withTenant(orgId)` bilan bajaradi — alohida tenant subdomeni kerak emas.

### 3.1 Funksiyalar hududi (Function Region) — bazaga MOS bo'lishi shart

Vercel Serverless Function'lar sukut bo'yicha `iad1` (AQSh, Virjiniya)da ishlaydi. Agar Postgres bazangiz boshqa hududda
bo'lsa (masalan Neon `ap-southeast-1`, Singapur), har bir so'rov o'sha hududgacha borib-kelib, sahifalar sezilarli sekin
yuklanadi (3+ soniya — bir nechta so'rov ustma-ust qo'shilib ketadi). Bazangiz qaysi hududda bo'lsa, ikkala Vercel
loyihasining **Function Region**ini ham o'sha hududga (yoki eng yaqiniga) o'zgartiring:

**Dashboard orqali:** loyiha → Settings → Functions → Function Region → mos hududni tanlang (masalan Singapur uchun `sin1`) → Save → loyihani qayta deploy qiling (sozlama faqat keyingi deploy'larga qo'llanadi).

**API orqali** (ikkala loyihada ham):
```bash
curl -X PATCH -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json" \
  "https://api.vercel.com/v9/projects/<loyiha-nomi>?teamId=<team-id>" \
  -d '{"serverlessFunctionRegion":"sin1"}'
# so'ng: vercel redeploy <oxirgi-deploy-id> --scope <team>
```

Tekshirish: javob sarlavhasidagi `x-vercel-id`da hudud kodi ko'rinadi (`curl -sI https://markazai.uz/api/health | grep x-vercel-id`) — `::sin1::` (yoki tanlangan hudud) bo'lishi kerak, `::iad1::` emas. Markazai uchun O'zbekiston mijozlari va Neon `ap-southeast-1` bazasi bo'lgani sabab **`sin1` (Singapur)** tavsiya etiladi.

## 4. Deploy tekshiruvi

```bash
npm run launch:check -- markazai.uz --slug <mavjud-tashkilot-slug>
```
Tekshiradi: apex/marketing, tenant login, `/api/health` (baza + **RLS roli** — `rls:false` bo'lsa ilova egasi ulanishi bilan ishlayapti, DARHOL tuzating), wildcard DNS (noma'lum subdomen → 404), `api.` taqiqlangani, Control Plane (login, health, kirishsiz himoya), imzosiz ichki API rad etilishi.

## 5. Birinchi tashqi mijozni qo'lda provisioning qilish (runbook)

1. `https://admin.markazai.uz` → kirish → **Tashkilotlar → Yangisini qo'shish**: nomi, slug (masalan `100x`), rahbar ismi/telefoni, reja va davr.
2. Ekranda chiqadigan **bir martalik parolni** xavfsiz yo'l bilan mijozga yuboring (u boshqa ko'rsatilmaydi; platforma bazasida hech qayerda saqlanmaydi).
3. Mijoz `https://100x.markazai.uz` da CEO sifatida kiradi → **Sozlamalar** (nomi, logotip, brend rangi), **Xodimlar**, **Kurslar**, **Xonalar** ni to'ldiradi.
4. Tekshirish ro'yxati: (a) boshqa tashkilot ma'lumoti ko'rinmasligi (boshqa tashkilot subdomenida shu foydalanuvchi kira olmaydi); (b) Control Plane'da "Foydalanish → Yangilash" agregat sonlarni ko'rsatishi; (c) mijoz to'lagach **To'landi — obunani uzaytirish** obuna sanasini surishi; (d) Control Plane → "To'xtatish" qilinsa login sahifasida "Obunangiz tugagan" chiqishi (≤30 soniya) va "Faollashtirish" bilan tiklanishi.
5. Obuna muddati yaqinlashganini Control Plane bosh sahifasi ("Obuna muddati yaqinlashayotganlar") ko'rsatadi.

## 6. Ma'lum cheklovlar / keyingi ish

- **Slug → tashkilot keshi** hozir jarayon xotirasida (30 soniya). Ko'p nusxali/edge deployda Vercel Edge Config yoki Upstash Redis bilan almashtiriladi (`apps/tenant-app/src/lib/tenant.ts`, `loadTenantBySlug`).
- **Fayl saqlash** mahalliy disk (`lib/storage.ts`) — Vercel'da doimiy emas; S3/R2 kerak.
- **Rate-limit** (`lib/rate-limit.ts`) jarayon xotirasida — ommaviy forma uchun Redis kerak.
- **Payme/Click/Uzum** sozlamalari saqlanadi, lekin avtomatik to'lov qabul qilish (webhook) va SMS provayder (Eskiz) hali ulanmagan; Obuna to'lovi Control Plane'da qo'lda tasdiqlanadi.
- Impersonation (ImpersonationLog) va avtomatik takroriy to'lov — keyinroq (spetsifikatsiyada "ixtiyoriy/keyinroq").
