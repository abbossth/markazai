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
- [ ] 3–10. `markazai-prompt-v3.md` 8-bo'limiga qarang

## Testlar

```bash
cd packages/types && npx vitest run   # jadval, davomat va moliyaviy hisob-kitob mantig'i
```
