import { describe, expect, it } from "vitest";
import {
  BOOKING_STATUS_LABEL, BOOKING_STATUS_VARIANT, type BookingStatus, customerActions, describeTimePref,
  formatRemaining, isClosedForCustomer, isTerminal, remainingMs,
} from "./status";

const ALL: BookingStatus[] = ["requested", "in_review", "proposed", "confirmed", "rejected", "cancelled"];

describe("라벨", () => {
  it("모든 상태에 라벨·variant", () => {
    for (const s of ALL) {
      expect(BOOKING_STATUS_LABEL[s]).toBeTruthy();
      expect(BOOKING_STATUS_VARIANT[s]).toBeTruthy();
    }
    expect(BOOKING_STATUS_LABEL.proposed).toBe("제안 도착");
    expect(BOOKING_STATUS_VARIANT.rejected).toBe("destructive");
    expect(BOOKING_STATUS_VARIANT.cancelled).toBe("outline");
    expect(BOOKING_STATUS_VARIANT.requested).toBe("secondary");
  });
});

describe("describeTimePref", () => {
  it("1부·2부는 고정 시간", () => {
    expect(describeTimePref("part_1", null, null)).toBe("1부 (06:00~10:00)");
    expect(describeTimePref("part_2", null, null)).toBe("2부 (11:00~15:00)");
  });
  it("range는 초를 버린다", () => {
    expect(describeTimePref("range", "07:00:00", "09:30:00")).toBe("07:00~09:30");
    expect(describeTimePref("range", "07:00", "09:30")).toBe("07:00~09:30");
    expect(describeTimePref("range", null, null)).toBe("시간 지정");
  });
});

describe("customerActions", () => {
  const table: Record<BookingStatus, [boolean, boolean, boolean, boolean]> = {
    // [offered 있을 때 accept, decline, cancel, offered 없을 때 accept]
    requested: [false, false, true, false],
    in_review: [false, false, true, false],
    proposed: [true, true, true, false],
    confirmed: [false, false, false, false],
    rejected: [false, false, false, false],
    cancelled: [false, false, false, false],
  };
  for (const s of ALL) {
    it(s, () => {
      const [a, d, c, aNo] = table[s];
      expect(customerActions(s, true)).toEqual({ canAccept: a, canDecline: d, canCancel: c });
      const no = customerActions(s, false);
      expect([no.canAccept, no.canDecline, no.canCancel]).toEqual([aNo, aNo, c]);
    });
  }
});

describe("isTerminal / isClosedForCustomer", () => {
  it("confirmed는 종료 아님, 고객에게는 닫힘", () => {
    expect(ALL.filter(isTerminal)).toEqual(["rejected", "cancelled"]);
    expect(ALL.filter(isClosedForCustomer)).toEqual(["confirmed", "rejected", "cancelled"]);
  });
});

describe("formatRemaining", () => {
  it("만료", () => {
    expect(formatRemaining(0)).toBe("만료됨");
    expect(formatRemaining(-1000)).toBe("만료됨");
    expect(formatRemaining(Number.NaN)).toBe("만료됨");
  });
  it("1시간 미만: 분 초", () => {
    expect(formatRemaining(1)).toBe("0분 1초");
    expect(formatRemaining(65_000)).toBe("1분 5초");
    expect(formatRemaining(3_599_000)).toBe("59분 59초");
  });
  it("24시간 미만: 시간 분", () => {
    expect(formatRemaining(3_600_000)).toBe("1시간 0분");
    expect(formatRemaining(5_400_000)).toBe("1시간 30분");
    expect(formatRemaining(86_399_000)).toBe("23시간 59분");
  });
  it("그 이상: 일 시간", () => {
    expect(formatRemaining(86_400_000)).toBe("1일 0시간");
    expect(formatRemaining(2 * 86_400_000 + 5 * 3_600_000)).toBe("2일 5시간");
  });
});

describe("remainingMs", () => {
  const expires = "2026-10-20T10:30:00Z";
  const server = Date.parse("2026-10-20T10:00:00Z");
  it("클라이언트 시계가 틀려도 서버 기준으로 계산", () => {
    const clientRender = server + 7 * 60_000; // 클라이언트가 7분 빠름
    expect(remainingMs(expires, server, clientRender, clientRender)).toBe(30 * 60_000);
    expect(remainingMs(expires, server, clientRender, clientRender + 60_000)).toBe(29 * 60_000);
    const slow = server - 3_600_000; // 1시간 느림
    expect(remainingMs(expires, server, slow, slow + 30 * 60_000)).toBe(0);
    expect(remainingMs(expires, server, slow, slow + 31 * 60_000)).toBe(-60_000);
  });
  it("잘못된 시각은 0", () => {
    expect(remainingMs("nope", server, server, server)).toBe(0);
  });
});
