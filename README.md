# Markazai

O'quv markazlar uchun ko'p-tenantli boshqaruv tizimi (CRM). To'liq talablar: `markazai-prompt-v3.md`.

## Tuzilma

```
apps/tenant-app   Next.js 16 — o'quv markaz CRM'i (*.markazai.uz)
packages/db       Prisma 7 schema + client (tenant_db)
packages/types    Umumiy zod sxemalar va konstantalar
```

`apps/platform-admin` (Control Plane) va RLS — 9-bosqichda qo'shiladi.

## Ishga tushirish

Talab: Node 22+, PostgreSQL 16.

```bash
cp .env.example .env            # DATABASE_URL va AUTH_SECRET ni to'ldiring
createdb markazai_tenant
npm install                     # Prisma client'ni ham generatsiya qiladi
npm run db:migrate              # migratsiyalar
npm run db:seed                 # demo CEO va filial
npm run dev -w tenant-app       # http://localhost:3000
```

Demo kirish (seed, parol hammasida `password123`):

| Rol | Telefon |
|---|---|
| CEO | `+998 90 123 45 67` |
| Administrator + Cashier | `+998 90 111 11 11` |
| Marketer | `+998 90 222 22 22` |
| O'qituvchi (faqat o'z guruhlari) | `+998 90 333 33 33` |

Bazani noldan qayta yaratish: `npm run reset -w @markazai/db` (**barcha ma'lumotni o'chiradi** — faqat dev bazada).

`.env` fayli monorepo ildizida turadi — Next.js va Prisma ikkalasi shu yerdan o'qiydi.

## Bosqichlar holati

- [x] 1. Fundament: auth (telefon+parol), UZ/RU/EN, dark/light, layout, global qidiruv
- [x] 2. Talabalar va Guruhlar (ro'yxat/filtr/CRUD, talaba profili, guruh profili, davomat va baholash)
- [x] 3. Lidlar (Kanban, drag-and-drop, lid → talaba, qo'ng'iroq/SMS jurnali, eslatmalar)
- [x] 4. Moliya (tizim yechimi dars-dars, to'lovlar, xarajatlar, yechib olish, qarzdorlar, chek, Excel/PDF)
- [x] 5. O'qituvchilar va davomat (profil, ish jadvali, ustoz davomati, ikki xil maosh modeli, Moliya'da ish haqi)
- [x] 6. Dashboard va Hisobotlar (sozlanadigan vidjetlar + dars jadvali; Reyting, Davomat, Konversiya, Lidlar, Churn, Jurnallar, Excel eksport)
- [ ] 7–10. `markazai-prompt-v3.md` 8-bo'limiga qarang

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
