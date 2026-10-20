import { describe, expect, it } from "vitest";
import { courseSchema, parseCourseForm, REGION_LABEL, REGIONS } from "./schema";

const form = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};

const base = { name: "구골프 CC", region: "seoul_gyeonggi" };

describe("courseSchema", () => {
  it("필수값만 있으면 나머지는 null, 운영 여부는 false", () => {
    const r = parseCourseForm(form(base));
    expect(r.success).toBe(true);
    expect(r.data).toEqual({
      id: null, name: "구골프 CC", region: "seoul_gyeonggi", address: null,
      weekdayGreenFee: null, weekendGreenFee: null, cancellationPolicy: null, contactPhone: null, isActive: false,
    });
  });

  it("쉼표가 들어간 금액을 숫자로 바꾸고 체크박스 on을 true로", () => {
    const r = parseCourseForm(form({
      ...base, weekdayGreenFee: "180,000", weekendGreenFee: " 230000 ", isActive: "on",
      address: "  경기도 용인시  ", contactPhone: "031-000-0000",
    }));
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ weekdayGreenFee: 180000, weekendGreenFee: 230000, isActive: true, address: "경기도 용인시" });
  });

  it("이름은 trim 후 1~100자", () => {
    expect(parseCourseForm(form({ ...base, name: "   " })).success).toBe(false);
    expect(parseCourseForm(form({ region: "jeju" })).success).toBe(false);
    expect(parseCourseForm(form({ ...base, name: "가".repeat(101) })).success).toBe(false);
    expect(parseCourseForm(form({ ...base, name: "가".repeat(100) })).success).toBe(true);
  });

  it("지역은 enum만", () => {
    expect(parseCourseForm(form({ ...base, region: "busan" })).success).toBe(false);
    for (const region of REGIONS) expect(parseCourseForm(form({ ...base, region })).success).toBe(true);
  });

  it("그린피는 0 이상의 정수", () => {
    expect(parseCourseForm(form({ ...base, weekdayGreenFee: "0" })).data?.weekdayGreenFee).toBe(0);
    expect(parseCourseForm(form({ ...base, weekdayGreenFee: "-1" })).success).toBe(false);
    expect(parseCourseForm(form({ ...base, weekdayGreenFee: "1000.5" })).success).toBe(false);
    expect(parseCourseForm(form({ ...base, weekendGreenFee: "abc" })).success).toBe(false);
    expect(parseCourseForm(form({ ...base, weekendGreenFee: "100000000" })).success).toBe(false);
  });

  it("취소 규정 2000자, 연락처 30자, 주소 200자 제한", () => {
    expect(parseCourseForm(form({ ...base, cancellationPolicy: "a".repeat(2000) })).success).toBe(true);
    expect(parseCourseForm(form({ ...base, cancellationPolicy: "a".repeat(2001) })).success).toBe(false);
    expect(parseCourseForm(form({ ...base, contactPhone: "1".repeat(31) })).success).toBe(false);
    expect(parseCourseForm(form({ ...base, address: "a".repeat(201) })).success).toBe(false);
  });

  it("id는 비어 있으면 신규(null), 값이 있으면 uuid여야 한다", () => {
    expect(parseCourseForm(form({ ...base, id: "" })).data?.id).toBeNull();
    expect(parseCourseForm(form({ ...base, id: "not-a-uuid" })).success).toBe(false);
    const id = "3f1e6c1e-2a4b-4c8d-9e0f-1a2b3c4d5e6f";
    expect(parseCourseForm(form({ ...base, id })).data?.id).toBe(id);
  });

  it("객체 입력도 받는다(boolean 그대로)", () => {
    expect(courseSchema.parse({ ...base, isActive: true }).isActive).toBe(true);
  });

  it("모든 지역에 한국어 라벨이 있다", () => {
    expect(REGIONS.map((r) => REGION_LABEL[r])).toEqual(["서울·경기", "강원", "충청", "전라", "경상", "제주"]);
  });
});
