# Markazai

O'quv markazlar uchun ko'p-tenantli boshqaruv tizimi (CRM). To'liq talablar: `markazai-prompt-v3.md`.

## Tuzilma

```
apps/tenant-app      Next.js 16 — o'quv markaz CRM'i ({slug}.markazai.uz), tenant_db (RLS bilan)
apps/platform-admin  Next.js 16 — Control Plane (admin.markazai.uz), FAQAT platform_db
packages/db          Prisma 7: tenant schema (prisma/schema.prisma) va platform schema (prisma/platform/schema.prisma)
packages/types       Umumiy zod sxemalar, sof hisob-kitob mantig'i (Vitest)
```

Ikki ilova **mustaqil**: alohida muhit o'zgaruvchilari, alohida sessiya sirlari va cookie nomlari; platform-admin tenant bazasiga umuman ulanmaydi
(tenant bilan faqat HMAC bilan imzolangan ichki API orqali gaplashadi). Buni `packages/db/src/platform-isolation.test.ts` tekshiradi.

## Ishga tushirish

Talab: Node 22+, PostgreSQL 16.

```bash
cp .env.example .env            # DATABASE_URL va AUTH_SECRET ni to'ldiring
createdb markazai_tenant
npm install                     # Prisma client'ni ham generatsiya qiladi
npm run db:migrate              # migratsiyalar
npm run db:seed                 # demo CEO va filial
# Control Plane bazasi (platform_db) va ilova roli:
createdb markazai_platform
npm run platform:migrate -w @markazai/db && npm run platform:seed -w @markazai/db
psql markazai_tenant -c "ALTER ROLE markazai_app LOGIN PASSWORD '...'"   # rolni migratsiya yaratgan; APP_DATABASE_URL'ga yozing
cp apps/platform-admin/.env.example apps/platform-admin/.env            # ALOHIDA muhit (tenant DB satri bo'lmasin)
npm run dev -w tenant-app       # http://localhost:3100  (demo markaz; boshqasi: http://acme.localhost:3100)
npm run dev -w platform-admin   # http://localhost:3200  (Control Plane: owner@markazai.uz / admin12345)
```

Demo kirish (seed, parol hammasida `password123`):

| Rol | Telefon |
|---|---|
| CEO | `+998 90 123 45 67` |
| Administrator + Cashier | `+998 90 111 11 11` |
| Marketer | `+998 90 222 22 22` |
| O'qituvchi (faqat o'z guruhlari) | `+998 90 333 33 33` |

Bazani noldan qayta yaratish: `npm run reset -w @markazai/db` (**barcha ma'lumotni o'chiradi** — faqat dev bazada).

### Multi-tenant va RLS

**Qanday ishlaydi.** Tenant bazasidagi 39 ta jadvalning hammasida `organization_id` bor va har birida PostgreSQL RLS policy
(`tenant_isolation`: `organization_id = current_setting('app.current_org')`, `USING` va `WITH CHECK`) yoqilgan — qo'lda yozilgan SQL migratsiya:
`packages/db/prisma/migrations/*_row_level_security`. Ilova baza bilan **cheklangan `markazai_app` roli** (`APP_DATABASE_URL`) orqali ulanadi
(egasi emas, BYPASSRLS yo'q), shuning uchun policy'lar unga har doim qo'llanadi; migratsiya/seed/testlar egasi ulanishida (`DATABASE_URL`) ishlaydi.
`TenantPool` (`packages/db/src/tenant-pool.ts`) har bir ulanish olinganda `set_config('app.current_org', ...)` ni joriy so'rov tashkiloti
(host → slug → Control Plane bazasi) bilan o'rnatadi; kontekst yo'q bo'lsa hech qanday qator ko'rinmaydi (fail-closed).
Ilovadan tashqarida (provisioning, skript) aniq kontekst: `withTenant(orgId, async () => {...})`.

**Tekshirish.**
```bash
npm test -w @markazai/db     # RLS integratsion testlari: har jadvalda policy bor, kontekstsiz 0 qator, boshqa tashkilot ko'rinmaydi va yozib bo'lmaydi
psql "$DATABASE_URL" -c "select count(*) from pg_policies where policyname='tenant_isolation'"   # 39
psql "$APP_DATABASE_URL" -c "select count(*) from students"                                       # 0 (kontekstsiz)
```
Yangi jadval (organization_id bilan) qo'shilganda policy qo'shmasangiz test yiqiladi. Production'da `APP_DATABASE_URL` yo'q bo'lsa ilova ishga tushmaydi.

**Ma'lum cheklov.** Prisma `findUnique` ni bitta so'rovga birlashtirishi (batching) mumkin; ikki tashkilotning bir xil tick'dagi so'rovlari birlashtirilsa, biri "topilmadi" qaytarishi mumkin — ma'lumot oqib chiqmaydi (fail-closed), faqat kamdan-kam yolg'on "topilmadi".

**Subdomenlar.** `ROOT_DOMAIN` (production: `markazai.uz`; dev: `localhost`): `{slug}.ROOT_DOMAIN` — tenant, `admin.` — Control Plane, apex/`www` — marketing.
Dev'da `demo.localhost:3100` (yoki `localhost:3100` — `DEFAULT_TENANT_SLUG`) va `acme.localhost:3100` brauzerda to'g'ridan ishlaydi. Boshqa tashkilotning tokeni bu subdomenda ishlamaydi.
To'xtatilgan yoki obunasi tugagan tashkilot login sahifasida "Obunangiz tugagan" ko'radi (ma'lumot o'chmaydi); holat Control Plane'dan ≤30 soniyada tenant-app'ga yetadi (kesh).

**Provisioning.** platform-admin → tenant-app `POST /api/internal/provision` (HMAC-SHA256, `PROVISIONING_SECRET`, 5 daqiqalik vaqt oralig'i): standart sozlamalar, filial,
Kanban ustunlari va CEO akkaunti (bir martalik parol) yaratiladi. Agregat ko'rsatkichlar (`/api/internal/usage`) faqat sonlarni qaytaradi.

### Sozlamalar bo'yicha eslatmalar

- **Yuklangan fayllar** (logotip, login banneri) `UPLOAD_DIR` (sukut: `apps/tenant-app/.uploads`) ichida saqlanadi va `/api/files/<org>/<fayl>` orqali beriladi. Ishlab chiqarishda `lib/storage.ts` dagi ikki funksiyani (`saveImage`, `readStored`) S3/R2 bilan almashtiring. SVG ataylab qo'llab-quvvatlanmaydi (skript tashishi mumkin); tur fayl mazmuniga qarab aniqlanadi.
- **Integratsiya sirlari** AES-256-GCM bilan shifrlanadi (`SECRETS_KEY`, bo'lmasa `AUTH_SECRET`); UI'da faqat oxirgi 4 belgi ko'rinadi. Kalit almashtirilsa, sirlarni qayta kiriting.
- **Sessiya** har so'rovda bazadagi joriy rollar va `isActive` bilan tekshiriladi: xodim bloklansa/o'chirilsa yoki roli o'zgarsa, amal qilish darhol tugaydi.
- **Ommaviy forma** (`/apply`) kirishsiz ochiq: IP bo'yicha cheklov (jarayon xotirasida — ko'p nusxali deployda Redis/Upstash bilan almashtiring, `lib/rate-limit.ts`), honeypot maydon va takroriy telefon himoyasi bor.
- **Gamifikatsiya** (Sozlamalar → Umumiy → Modullar) o'chiq bo'lsa hamma joyda yashirin. Yoqilganda har bir "keldi" darsi `coinsPerLesson` coin beradi (davomat o'zgarsa moslanadi — `syncAttendanceCoins`, `syncLessonCharge` kabi idempotent); yoqilganda/qiymat o'zgarganda mavjud davomat bo'yicha coinlar tenglashtiriladi. Qo'lda berish/ayirishga sabab majburiy, umumiy coin manfiyga tushmaydi.
- **Dam olish kunlari** dars jadvali, davomat, oylik darslar soni (shu bilan bir dars narxi), o'qituvchi ish kunlari va ish haqiga ta'sir qiladi; qo'shilganda/o'chirilganda shu oydagi tizim yechimlari qayta hisoblanadi.

`.env` fayli monorepo ildizida turadi — Next.js va Prisma ikkalasi shu yerdan o'qiydi.

## Bosqichlar holati

- [x] 1. Fundament: auth (telefon+parol), UZ/RU/EN, dark/light, layout, global qidiruv
- [x] 2. Talabalar va Guruhlar (ro'yxat/filtr/CRUD, talaba profili, guruh profili, davomat va baholash)
- [x] 3. Lidlar (Kanban, drag-and-drop, lid → talaba, qo'ng'iroq/SMS jurnali, eslatmalar)
- [x] 4. Moliya (tizim yechimi dars-dars, to'lovlar, xarajatlar, yechib olish, qarzdorlar, chek, Excel/PDF)
- [x] 5. O'qituvchilar va davomat (profil, ish jadvali, ustoz davomati, ikki xil maosh modeli, Moliya'da ish haqi)
- [x] 6. Dashboard va Hisobotlar (sozlanadigan vidjetlar + dars jadvali; Reyting, Davomat, Konversiya, Lidlar, Churn, Jurnallar, Excel eksport)
- [x] 7. Sozlamalar (umumiy + brend/logotip/login banneri, xodimlar + Excel import, kurslar, xonalar, teglar, dam olish kunlari, arxiv, chek shabloni, lid forma konstruktori + ommaviy `/apply`, integratsiyalar)
- [x] 8. Gamifikatsiya (coin: davomat uchun avtomatik + qo'lda berish/ayirish, tarix, guruh davomatida ko'rsatish/yashirish, coin reytingi hisoboti, Sozlamalarda yoqish)
- [x] 9. Multi-tenant: RLS (39 jadval), `markazai_app` roli, subdomen bo'yicha tenant, platform-admin (tashkilot/rejalar/obuna/billing/monitoring/audit), provisioning, "obuna tugagan" bloklash, reja limitlari va feature flag'lar
- [ ] 10. Domen va launch (`markazai-prompt-v3.md` 8-bo'limi)

## Testlar

```bash
cd packages/types && npx vitest run   # jadval, davomat va moliyaviy hisob-kitob mantig'i (bazasiz)
cd packages/db && npx vitest run      # hisob-kitob integratsion testlari (haqiqiy baza kerak; rollback qilinadi)
```

## Moliya qoidalari

- Tizim yechimi **dars-dars**: davomat belgilanganda avtomatik yoziladi. "Keldi" va "sababsiz kelmadi" yechiladi; "sababli" va belgilanmagan darslar yechilmaydi.
- Dars ulushi = oylik narx (chegirmadan keyin) / oydagi dars soni, kumulyativ yaxlitlash bilan (oy yig'indisi aniq narxga teng).
- `Student.balance` = to'lovlar yig'indisi (SYSTEM manfiy, MANUAL musbat). Buzilgan bo'lsa: `npm run billing:rebuild -w @markazai/db`.
- Ish haqi: **foiz** modelida — o'qituvchi guruhlariga shu oyda kelgan qo'lda kiritilgan to'lovlardan foiz (guruh-guruh yaxlitlanadi); **belgilangan** modelida — oylik × (keldi kunlari / oydagi ish kunlari) + qo'shimcha kunlar (kunlik stavka bo'yicha). To'langan ish haqi "Ish haqi" xarajati sifatida yoziladi.
- Foyda = tushum − xarajat; kassadan yechib olish foydaga ta'sir qilmaydi, faqat kassa qoldig'iga.

## SMS

`src/lib/sms.ts` — `SmsProvider` interfeysi. Eskiz.uz ulanmaguncha mock provayder ishlaydi: xabar `sms_logs` jadvaliga `MOCK` holatida yoziladi, jo'natilmaydi.

## Rollar va ma'lumot ko'rinishi

- Maosh (`salary:read`) — faqat CEO va filial direktori. Administratorlar o'qituvchilarni boshqaradi, lekin maoshni ko'rmaydi.
- Moliya moduli ruxsati bo'lmagan rollar (masalan, O'qituvchi) talaba balansi, qarzi va to'lovlarini ko'rmaydi; ma'lumot serverda maskalanadi va brauzerga yuborilmaydi.
