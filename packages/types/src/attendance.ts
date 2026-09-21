export type AttendanceValue = "PRESENT" | "ABSENT" | "EXCUSED";

export type AttendanceStats = {
  present: number;
  absent: number;
  excused: number;
  /** O'tgan (bugungacha) dars kunlari, lekin belgi qo'yilmagan. */
  empty: number;
  /** Bugungacha bo'lgan jami darslar. */
  held: number;
  /** Qatnashish foizi: keldi / (o'tgan darslar − sababli). Darslar bo'lmasa — null. */
  percent: number | null;
};

/**
 * @param lessonDates guruhning barcha dars kunlari ("YYYY-MM-DD")
 * @param records     talabaning shu guruhdagi belgilari: sana → holat
 * @param today       "YYYY-MM-DD" — bundan keyingi darslar hisobga olinmaydi
 */
export function attendanceStats(lessonDates: string[], records: Map<string, AttendanceValue>, today: string): AttendanceStats {
  let present = 0;
  let absent = 0;
  let excused = 0;
  let empty = 0;
  let held = 0;

  for (const date of lessonDates) {
    if (date > today) continue;
    held++;
    const status = records.get(date);
    if (status === "PRESENT") present++;
    else if (status === "ABSENT") absent++;
    else if (status === "EXCUSED") excused++;
    else empty++;
  }

  const denominator = held - excused;
  return { present, absent, excused, empty, held, percent: denominator > 0 ? Math.round((present / denominator) * 100) : null };
}
