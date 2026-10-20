import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEAL_STATUS_LABEL } from "./status";

// DB app.deal_status_label(타임라인·알림)과 화면 라벨이 어긋나지 않게 한다(D-61)
describe("거래 상태 라벨", () => {
  it("최신 마이그레이션의 DB 라벨과 화면 라벨이 같다", () => {
    const sql = readFileSync("supabase/migrations/20261020000012_deal_status_label.sql", "utf8");
    for (const [status, label] of Object.entries(DEAL_STATUS_LABEL)) {
      expect(sql).toContain(`when '${status}' then '${label}'`);
    }
  });
});
