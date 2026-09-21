import { describe, expect, it } from "vitest";
import { changedPositions, insertBefore } from "./ordering";

describe("insertBefore", () => {
  it("berilgan elementdan oldin qo'yadi", () => {
    expect(insertBefore(["a", "b", "c"], "x", "b")).toEqual(["a", "x", "b", "c"]);
  });
  it("beforeId null bo'lsa oxiriga qo'yadi", () => {
    expect(insertBefore(["a", "b"], "x", null)).toEqual(["a", "b", "x"]);
  });
  it("beforeId topilmasa (filtr/eskirgan holat) oxiriga qo'yadi", () => {
    expect(insertBefore(["a", "b"], "x", "zzz")).toEqual(["a", "b", "x"]);
  });
  it("element allaqachon ro'yxatda bo'lsa (konteyner ichida ko'chirish) takrorlanmaydi", () => {
    expect(insertBefore(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(insertBefore(["a", "b", "c"], "a", null)).toEqual(["b", "c", "a"]);
  });
  it("o'zidan oldin qo'yishga urinish o'zgarishsiz qoladi", () => {
    expect(insertBefore(["a", "b", "c"], "b", "b")).toEqual(["a", "c", "b"]);
  });
});

describe("changedPositions", () => {
  it("faqat o'zgargan pozitsiyalarni qaytaradi", () => {
    const before = new Map([["a", 0], ["b", 1], ["c", 2]]);
    expect(changedPositions(before, ["a", "c", "b"])).toEqual([{ id: "c", position: 1 }, { id: "b", position: 2 }]);
  });
  it("yangi element (before'da yo'q) doim kiradi", () => {
    expect(changedPositions(new Map([["a", 0]]), ["a", "x"])).toEqual([{ id: "x", position: 1 }]);
  });
});
