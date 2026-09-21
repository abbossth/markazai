import bcrypt from "bcryptjs";
import type { PrismaClient } from "../src/generated/client";
import { fromISODate, lessonDatesInMonth } from "@markazai/types";

// Deterministik tasodifiy sonlar — seed har safar bir xil natija beradi.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const utcDate = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

const FIRST_NAMES_M = ["Akmal", "Bekzod", "Sardor", "Jasur", "Otabek", "Dilshod", "Rustam", "Timur", "Farrux", "Shahzod", "Aziz", "Umid"];
const FIRST_NAMES_F = ["Malika", "Nigora", "Zilola", "Madina", "Feruza", "Sevara", "Kamola", "Gulnora", "Shahnoza", "Laylo", "Dildora", "Nilufar"];
const LAST_NAMES = ["Karimov", "Rahimov", "Toshpulatov", "Yusupov", "Abdullayev", "Ergashev", "Qodirov", "Nazarov", "Saidov", "Ismoilov"];

/**
 * Demo ma'lumotlar: 4 kurs, 3 xona, 4 o'qituvchi, 6 guruh, 28 talaba, davomat, baholar,
 * to'lovlar (ikkala tur: tizim va qo'lda), chegirmalar, imtihonlar, izohlar.
 * Talabalar mavjud bo'lsa, hech narsa qilmaydi (idempotent).
 */
export async function seedDemoData(prisma: PrismaClient, orgId: string, actor: { id: string; name: string }) {
  if ((await prisma.student.count({ where: { organizationId: orgId } })) > 0) {
    console.log("Demo ma'lumotlar allaqachon mavjud — o'tkazib yuborildi.");
    return;
  }

  const rand = rng(2026);
  const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;
  const now = new Date();
  const today = utcDate(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;

  // ── Kurslar, xonalar, teglar ──
  const courseDefs = [
    { name: "Ingliz tili", price: 450_000, color: "#2563eb" },
    { name: "Rus tili", price: 400_000, color: "#dc2626" },
    { name: "Matematika", price: 350_000, color: "#16a34a" },
    { name: "Python dasturlash", price: 700_000, color: "#9333ea" },
  ];
  const courses = await Promise.all(
    courseDefs.map((c) => prisma.course.create({ data: { organizationId: orgId, durationMonths: 6, ...c } })),
  );
  const rooms = await Promise.all(
    [
      { name: "101", capacity: 12 },
      { name: "102", capacity: 15 },
      { name: "Lab", capacity: 10 },
    ].map((r) => prisma.room.create({ data: { organizationId: orgId, ...r } })),
  );
  const tags = await Promise.all(
    [
      { name: "Yangi", color: "#0ea5e9" },
      { name: "VIP", color: "#f59e0b" },
      { name: "Chegirmali", color: "#10b981" },
    ].map((t) => prisma.tag.create({ data: { organizationId: orgId, ...t } })),
  );

  // ── O'qituvchilar (biri tizimga kira oladi: TEACHER rolli User bilan bog'langan) ──
  const teacherUser = await prisma.user.upsert({
    where: { organizationId_phone: { organizationId: orgId, phone: "998903333333" } },
    update: {},
    create: {
      organizationId: orgId,
      phone: "998903333333",
      name: "Nodira Yusupova",
      roles: ["TEACHER"],
      position: "Ingliz tili o'qituvchisi",
      passwordHash: await bcrypt.hash("password123", 10),
    },
  });
  const teacherDefs = [
    { name: "Nodira Yusupova", phone: "998903333333", gender: "FEMALE" as const, userId: teacherUser.id },
    { name: "Sherzod Aliyev", phone: "998904444444", gender: "MALE" as const, userId: null },
    { name: "Gulbahor Rasulova", phone: "998905555555", gender: "FEMALE" as const, userId: null },
    { name: "Bobur Mirzayev", phone: "998906666666", gender: "MALE" as const, userId: null },
  ];
  const teachers = await Promise.all(teacherDefs.map((t) => prisma.teacher.create({ data: { organizationId: orgId, ...t } })));

  // ── Guruhlar ──
  const groupDefs = [
    { name: "A-3", course: 0, teacher: 0, room: 0, days: "ODD", time: "09:00", start: [year, month - 3, 1] },
    { name: "B-1", course: 0, teacher: 0, room: 1, days: "EVEN", time: "14:00", start: [year, month - 2, 1] },
    { name: "R-2", course: 1, teacher: 1, room: 1, days: "ODD", time: "16:00", start: [year, month - 4, 1] },
    { name: "M-5", course: 2, teacher: 2, room: 0, days: "EVEN", time: "11:00", start: [year, month - 2, 1] },
    { name: "PY-1", course: 3, teacher: 3, room: 2, days: "ODD", time: "18:00", start: [year, month - 1, 1] },
    { name: "PY-2", course: 3, teacher: 3, room: 2, days: "WEEKEND", time: "10:00", start: [year, month - 1, 1] },
  ] as const;

  const groups = [];
  for (const g of groupDefs) {
    const [y, m, d] = g.start;
    // month - N manfiy bo'lsa Date.UTC o'zi yilni to'g'rilaydi.
    const startDate = utcDate(y, m, d);
    groups.push(
      await prisma.group.create({
        data: {
          organizationId: orgId,
          name: g.name,
          courseId: courses[g.course]!.id,
          teacherId: teachers[g.teacher]!.id,
          roomId: rooms[g.room]!.id,
          days: g.days,
          customDays: [],
          startTime: g.time,
          startDate,
          endDate: new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 6, 0)),
          price: courses[g.course]!.price,
        },
      }),
    );
  }
  await prisma.groupTag.createMany({
    data: [
      { organizationId: orgId, groupId: groups[0]!.id, tagId: tags[1]!.id },
      { organizationId: orgId, groupId: groups[4]!.id, tagId: tags[0]!.id },
    ],
  });

  // ── Talabalar ──
  type Plan = { status: "ACTIVE" | "FROZEN" | "NO_GROUP" | "TRIAL" | "LEFT_AFTER_TRIAL" | "LEFT_ACTIVE_GROUP"; groupIdx: number[] };
  const plans: Plan[] = [];
  for (let i = 0; i < 20; i++) plans.push({ status: "ACTIVE", groupIdx: i % 5 === 4 ? [i % 6, (i + 2) % 6] : [i % 6] });
  plans.push({ status: "FROZEN", groupIdx: [0] }, { status: "FROZEN", groupIdx: [3] });
  plans.push({ status: "NO_GROUP", groupIdx: [] }, { status: "NO_GROUP", groupIdx: [] });
  plans.push({ status: "TRIAL", groupIdx: [1] }, { status: "TRIAL", groupIdx: [4] });
  plans.push({ status: "LEFT_AFTER_TRIAL", groupIdx: [] });
  plans.push({ status: "LEFT_ACTIVE_GROUP", groupIdx: [2] });

  const students = [];
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i]!;
    const female = i % 2 === 1;
    const name = `${pick(female ? FIRST_NAMES_F : FIRST_NAMES_M)} ${pick(LAST_NAMES)}${female ? "a" : ""}`;
    // Ba'zilari shu oyda qo'shilgan ("Bu oy qo'shildi" filtri uchun).
    const createdAt = i % 7 === 0 ? utcDate(year, month, Math.max(1, today.getUTCDate() - 3)) : utcDate(year, month - 3, 5 + i);
    students.push(
      await prisma.student.create({
        data: {
          organizationId: orgId,
          name,
          phone: `998${90 + (i % 9)}${String(1000000 + i * 37331).slice(0, 7)}`,
          gender: female ? "FEMALE" : "MALE",
          birthDate: utcDate(2004 + (i % 10), 1 + (i % 12), 1 + (i % 27)),
          status: plan.status,
          freezeReason: plan.status === "FROZEN" ? (i % 2 ? "Oilaviy sabab" : "Safarga ketgan") : null,
          note: i % 4 === 0 ? "Ota-onasi bilan bog'lanish kerak" : null,
          externalId: `EXT-${1000 + i}`,
          createdAt,
        },
      }),
    );
  }

  await prisma.studentTag.createMany({
    data: students.flatMap((s, i) =>
      i % 5 === 0 ? [{ organizationId: orgId, studentId: s.id, tagId: tags[i % 3]!.id }] : [],
    ),
  });

  // ── A'zoliklar ──
  const enrollments: { organizationId: string; groupId: string; studentId: string; joinedAt: Date; leftAt: Date | null }[] = [];
  plans.forEach((plan, i) => {
    for (const gi of new Set(plan.groupIdx)) {
      const group = groups[gi]!;
      enrollments.push({
        organizationId: orgId,
        groupId: group.id,
        studentId: students[i]!.id,
        joinedAt: group.startDate,
        leftAt: plan.status === "LEFT_ACTIVE_GROUP" ? utcDate(year, month - 1, 20) : null,
      });
    }
  });
  await prisma.groupStudent.createMany({ data: enrollments });

  // ── Davomat, baholar, to'lovlar ──
  const attendance: { organizationId: string; groupId: string; studentId: string; date: Date; status: "PRESENT" | "ABSENT" | "EXCUSED" }[] = [];
  const grades: { organizationId: string; groupId: string; studentId: string; date: Date; score: number }[] = [];
  const payments: { organizationId: string; studentId: string; groupId: string; amount: number; date: Date; type: "SYSTEM" | "MANUAL"; description: string; receivedById?: string }[] = [];

  const activeEnrollments = enrollments.filter((e) => !e.leftAt);
  for (const group of groups) {
    const members = activeEnrollments.filter((e) => e.groupId === group.id);
    // Oxirgi 3 oy (joriy oy — faqat bugungacha)
    for (let back = 2; back >= 0; back--) {
      const d = new Date(Date.UTC(year, month - 1 - back, 1));
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      const dates = lessonDatesInMonth({ days: group.days, customDays: group.customDays, startDate: group.startDate, endDate: group.endDate }, y, m).filter(
        (iso) => fromISODate(iso) <= today,
      );
      if (dates.length === 0) continue;

      for (const e of members) {
        for (const iso of dates) {
          const r = rand();
          attendance.push({
            organizationId: orgId,
            groupId: group.id,
            studentId: e.studentId,
            date: fromISODate(iso),
            status: r < 0.85 ? "PRESENT" : r < 0.95 ? "ABSENT" : "EXCUSED",
          });
          if (r < 0.85 && rand() < 0.35) {
            grades.push({ organizationId: orgId, groupId: group.id, studentId: e.studentId, date: fromISODate(iso), score: 55 + Math.floor(rand() * 46) });
          }
        }

        // Tizim yechimi (SYSTEM) davomatdan keyin rebuildAllCharges bilan quriladi.
        const chargeDate = fromISODate(dates[0]!);
        // O'tgan oylarda ko'pchilik to'laydi; joriy oyda ~50%; ba'zilari umuman to'lamaydi (qarzdor).
        const studentIdx = students.findIndex((s) => s.id === e.studentId);
        const chronicDebtor = studentIdx % 6 === 3;
        const paysThisMonth = back > 0 ? !chronicDebtor : rand() < 0.5 && !chronicDebtor;
        if (paysThisMonth) {
          const partial = studentIdx % 8 === 5;
          const amount = partial ? Math.round(group.price / 2 / 1000) * 1000 : group.price;
          payments.push({ organizationId: orgId, studentId: e.studentId, groupId: group.id, amount, date: chargeDate, type: "MANUAL", description: "Naqd to'lov", receivedById: actor.id });
        }
      }
    }
  }
  await prisma.attendance.createMany({ data: attendance });
  await prisma.grade.createMany({ data: grades });
  await prisma.payment.createMany({ data: payments });
  // Davomatga ko'ra dars-dars yechim (SYSTEM) va talabalar balansi.
  const { rebuildAllCharges, recomputeBalances } = await import("../src/billing");
  await rebuildAllCharges(prisma, orgId);
  await recomputeBalances(prisma, orgId);

  // ── Chegirmalar, imtihonlar, izohlar, tarix ──
  const discountTargets = activeEnrollments.slice(2, 4);
  for (const e of discountTargets) {
    await prisma.discount.create({
      data: { organizationId: orgId, studentId: e.studentId, groupId: e.groupId, amount: 50_000, fromDate: utcDate(year, month - 1, 1), reason: "Aka-uka chegirmasi" },
    });
  }
  await prisma.exam.createMany({
    data: [
      { organizationId: orgId, groupId: groups[0]!.id, name: "Oraliq nazorat", date: utcDate(year, month, 25), durationMinutes: 90, maxScore: 100, passScore: 60 },
      { organizationId: orgId, groupId: groups[4]!.id, name: "Python asoslari testi", date: utcDate(year, month - 1, 28), durationMinutes: 60, maxScore: 50, passScore: 30 },
    ],
  });
  await prisma.onlineLesson.create({
    data: { organizationId: orgId, groupId: groups[4]!.id, title: "1-dars yozuvi", url: "https://example.com/lesson-1" },
  });
  await prisma.comment.createMany({
    data: [
      { organizationId: orgId, authorId: actor.id, studentId: students[0]!.id, body: "Darslarda faol qatnashyapti." },
      { organizationId: orgId, authorId: actor.id, groupId: groups[0]!.id, body: "Guruh uchun qo'shimcha dars rejalashtirildi." },
    ],
  });
  await prisma.historyLog.createMany({
    data: [
      ...students.map((s) => ({ organizationId: orgId, entityType: "student", entityId: s.id, action: "created", actorId: actor.id, actorName: actor.name })),
      ...groups.map((g) => ({ organizationId: orgId, entityType: "group", entityId: g.id, action: "created", actorId: actor.id, actorName: actor.name })),
    ],
  });

  console.log(
    `Demo ma'lumotlar: ${courses.length} kurs, ${teachers.length} o'qituvchi, ${groups.length} guruh, ${students.length} talaba, ${attendance.length} davomat, ${payments.length} to'lov.`,
  );
}

const LEAD_NAMES = [
  "Aziza Normatova", "Bobur Sattorov", "Charos Ismailova", "Doston Hamidov", "Elmira Yuldasheva",
  "Farhod Qosimov", "Gavhar Nabiyeva", "Hasan Ochilov", "Iroda Xolmatova", "Javlon Rustamov",
  "Kamila Aliyeva", "Lola Ergasheva", "Murod Salimov", "Nargiza Tursunova", "Otabek Sharipov",
];

/**
 * Demo lidlar: standart ustunlar, "Lidlar" ustunida 2 ta ro'yxat, 15 lid, eslatmalar,
 * qo'ng'iroq va SMS jurnali. Lidlar mavjud bo'lsa, hech narsa qilmaydi (idempotent).
 */
export async function seedLeadsData(prisma: PrismaClient, orgId: string, actor: { id: string; name: string }) {
  if ((await prisma.lead.count({ where: { organizationId: orgId } })) > 0) {
    console.log("Demo lidlar allaqachon mavjud — o'tkazib yuborildi.");
    return;
  }
  const { ensureDefaultLeadColumns } = await import("../src/lead-defaults");
  const columns = await ensureDefaultLeadColumns(prisma, orgId);
  const [colLeads, colExpect, colSet] = columns;
  if (!colLeads || !colExpect || !colSet) throw new Error("Standart ustunlar yaratilmadi");

  const lists = await Promise.all(
    [
      { name: "Instagram", position: 0, isLocked: true },
      { name: "Telegram", position: 1, isLocked: false },
    ].map((l) => prisma.leadList.create({ data: { organizationId: orgId, columnId: colLeads.id, ...l } })),
  );
  const [courses, tags, users] = await Promise.all([
    prisma.course.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
    prisma.tag.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
  ]);
  const sources = ["INSTAGRAM", "TELEGRAM", "FACEBOOK", "WEBSITE", "REFERRAL", "WALK_IN", "PHONE"] as const;
  const patterns = ["ODD", "EVEN", "WEEKEND", null] as const;
  const now = Date.now();

  // Konteynerlar: [ustun, ro'yxat|null]. Ko'p lid "Lidlar" ustunida, qolganlari keyingi ustunlarda.
  const slots: [typeof colLeads, (typeof lists)[number] | null][] = [
    [colLeads, lists[0]!], [colLeads, lists[0]!], [colLeads, lists[0]!],
    [colLeads, lists[1]!], [colLeads, lists[1]!],
    [colLeads, null], [colLeads, null], [colLeads, null],
    [colExpect, null], [colExpect, null], [colExpect, null], [colExpect, null],
    [colSet, null], [colSet, null], [colSet, null],
  ];
  const positions = new Map<string, number>();
  const leads = [];
  for (let i = 0; i < LEAD_NAMES.length; i++) {
    const [column, list] = slots[i]!;
    const key = `${column.id}:${list?.id ?? "none"}`;
    const position = positions.get(key) ?? 0;
    positions.set(key, position + 1);
    leads.push(
      await prisma.lead.create({
        data: {
          organizationId: orgId,
          name: LEAD_NAMES[i]!,
          phone: `998${93 + (i % 5)}${String(3000000 + i * 41213).slice(0, 7)}`,
          source: sources[i % sources.length],
          columnId: column.id,
          listId: list?.id ?? null,
          position,
          note: i % 3 === 0 ? "Narxi haqida so'radi" : null,
          assignedToId: users[i % users.length]?.id,
          courseId: courses[i % courses.length]?.id,
          daysPattern: patterns[i % patterns.length],
          createdAt: new Date(now - i * 26 * 3_600_000),
          tags: i % 4 === 0 && tags[0] ? { create: [{ organizationId: orgId, tagId: tags[0].id }] } : undefined,
        },
      }),
    );
  }

  await prisma.reminder.createMany({
    data: [
      { organizationId: orgId, title: "Qayta qo'ng'iroq qilish", dueAt: new Date(now - 3 * 3_600_000), responsibleId: actor.id, leadId: leads[0]!.id, createdById: actor.id },
      { organizationId: orgId, title: "Sinov darsiga taklif", note: "Shanba kuni", dueAt: new Date(now + 20 * 3_600_000), responsibleId: actor.id, leadId: leads[8]!.id, createdById: actor.id },
      { organizationId: orgId, title: "Guruh to'lovlarini tekshirish", dueAt: new Date(now + 48 * 3_600_000), responsibleId: actor.id, groupId: (await prisma.group.findFirst({ where: { organizationId: orgId } }))?.id, createdById: actor.id },
    ],
  });
  await prisma.callLog.create({
    data: { organizationId: orgId, leadId: leads[0]!.id, outcome: "NO_ANSWER", direction: "OUTGOING", note: "Javob bermadi", createdById: actor.id },
  });
  await prisma.smsLog.create({
    data: { organizationId: orgId, leadId: leads[1]!.id, phone: leads[1]!.phone, text: "Assalomu alaykum! Kurslarimiz haqida ma'lumot yubordik.", status: "MOCK", provider: "mock", sentById: actor.id },
  });
  await prisma.historyLog.createMany({
    data: leads.map((l) => ({ organizationId: orgId, entityType: "lead", entityId: l.id, action: "created", actorId: actor.id, actorName: actor.name })),
  });
  console.log(`Demo lidlar: ${leads.length} lid, ${lists.length} ro'yxat, 3 eslatma.`);
}

/** Demo xarajatlar va kassadan yechib olish (bu va o'tgan oy). Mavjud bo'lsa, hech narsa qilmaydi (idempotent). */
export async function seedFinanceData(prisma: PrismaClient, orgId: string, actor: { id: string }) {
  if ((await prisma.expense.count({ where: { organizationId: orgId } })) > 0) {
    console.log("Demo xarajatlar allaqachon mavjud — o'tkazib yuborildi.");
    return;
  }
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const day = (offsetMonths: number, d: number) => new Date(Date.UTC(y, m - 1 + offsetMonths, Math.min(d, offsetMonths === 0 ? Math.max(1, now.getUTCDate()) : 28)));

  await prisma.expense.createMany({
    data: [
      { category: "Ijara", amount: 5_000_000, date: day(-1, 1), description: "Bino ijarasi" },
      { category: "Kommunal", amount: 820_000, date: day(-1, 12), description: "Elektr va suv" },
      { category: "Marketing", amount: 1_200_000, date: day(-1, 20), description: "Instagram reklama" },
      { category: "Ijara", amount: 5_000_000, date: day(0, 1), description: "Bino ijarasi" },
      { category: "Kommunal", amount: 790_000, date: day(0, 10), description: "Elektr va suv" },
      { category: "Jihozlar", amount: 640_000, date: day(0, 15), description: "Marker va doska" },
    ].map((e) => ({ ...e, organizationId: orgId, createdById: actor.id })),
  });
  await prisma.withdrawal.createMany({
    data: [
      { amount: 3_000_000, date: day(-1, 25), note: "Egasi uchun" },
      { amount: 2_000_000, date: day(0, 14), note: "Egasi uchun" },
    ].map((w) => ({ ...w, organizationId: orgId, createdById: actor.id })),
  });
  console.log("Demo xarajatlar: 6 ta xarajat, 2 ta yechib olish.");
}

/**
 * Demo o'qituvchi ma'lumotlari: maosh modellari (foiz / belgilangan), ish jadvali, filial, ustoz davomati.
 * Mavjud bo'lsa (maosh modeli sozlangan o'qituvchi bor), hech narsa qilmaydi (idempotent).
 */
export async function seedTeacherData(prisma: PrismaClient, orgId: string, branchId: string) {
  if ((await prisma.teacher.count({ where: { organizationId: orgId, OR: [{ percent: { not: null } }, { fixedSalary: { not: null } }] } })) > 0) {
    console.log("Demo o'qituvchi ma'lumotlari allaqachon mavjud — o'tkazib yuborildi.");
    return;
  }
  const teachers = await prisma.teacher.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } });
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const start = new Date(Date.UTC(y, m - 4, 1));
  const todayIso = new Date(Date.UTC(y, m - 1, now.getUTCDate())).toISOString().slice(0, 10);

  const plans: Record<string, { type: "PERCENT" | "FIXED"; percent?: number; fixed?: number; days?: number[] }> = {
    "Bobur Mirzayev": { type: "PERCENT", percent: 40 },
    "Sherzod Aliyev": { type: "PERCENT", percent: 35 },
    "Nodira Yusupova": { type: "FIXED", fixed: 3_000_000, days: [1, 3, 5] },
    "Gulbahor Rasulova": { type: "FIXED", fixed: 2_600_000, days: [2, 4, 6] },
  };

  for (const t of teachers) {
    const plan = plans[t.name];
    if (!plan) continue;
    await prisma.teacher.update({
      where: { id: t.id },
      data: {
        salaryType: plan.type,
        percent: plan.percent ?? null,
        fixedSalary: plan.fixed ?? null,
        workDays: plan.days ?? [],
        workStart: plan.days ? "09:00" : null,
        workEnd: plan.days ? "18:00" : null,
        workStartDate: start,
        birthDate: new Date(Date.UTC(1988 + (teachers.indexOf(t) % 6), 2 + teachers.indexOf(t), 10)),
      },
    });
    await prisma.teacherBranch.create({ data: { organizationId: orgId, teacherId: t.id, branchId } });
  }

  // Belgilangan oyliklilar uchun o'tgan va joriy oy davomati (bugungacha).
  const { lessonDatesBetween, fromISODate } = await import("@markazai/types");
  const rows: { organizationId: string; teacherId: string; date: Date; status: "PRESENT" | "ABSENT" | "EXTRA" }[] = [];
  let i = 0;
  for (const t of teachers) {
    const plan = plans[t.name];
    if (plan?.type !== "FIXED" || !plan.days) continue;
    const from = new Date(Date.UTC(y, m - 2, 1));
    const to = fromISODate(todayIso);
    const dates = lessonDatesBetween({ days: "OTHER", customDays: plan.days, startDate: from }, from, to);
    for (const iso of dates) {
      i++;
      rows.push({ organizationId: orgId, teacherId: t.id, date: fromISODate(iso), status: i % 9 === 0 ? "ABSENT" : "PRESENT" });
    }
    // Bitta "qo'shimcha" kun: o'tgan oyning birinchi yakshanbasi
    const firstSunday = new Date(Date.UTC(y, m - 2, 1));
    while (firstSunday.getUTCDay() !== 0) firstSunday.setUTCDate(firstSunday.getUTCDate() + 1);
    rows.push({ organizationId: orgId, teacherId: t.id, date: firstSunday, status: "EXTRA" });
  }
  await prisma.teacherAttendance.createMany({ data: rows });
  console.log(`Demo o'qituvchilar: maosh modellari sozlandi, ${rows.length} ta ustoz davomati.`);
}
