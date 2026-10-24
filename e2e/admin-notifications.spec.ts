import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { withDb } from "./customer";
import { createStaff, signInStaffWithNewTotp } from "./staff";

test("운영자는 실패(dead) 알림을 보고 다시 보낼 수 있다", async ({ page }) => {
  const staff = await createStaff("notify");
  // 테스트 픽스처: 5회 실패한 운영자 알림(운영에서는 fail_notification만 dead를 만든다)
  const id = await withDb(async (db) => {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.notification_outbox (event_type, recipient_kind, channel, template_code, payload, dedupe_key, status, attempts, last_error)
       values ('e2e', 'admins', 'slack', 'ADMIN_DEAL_REQUESTED', '{}'::jsonb, $1, 'dead', 5, 'slack webhook 404') returning id::text`,
      [`e2e:${randomUUID()}`],
    );
    return rows[0]!.id;
  });

  await signInStaffWithNewTotp(page, staff);
  await page.getByRole("link", { name: "알림", exact: true }).click();
  await expect(page.getByRole("heading", { name: "알림 발송" })).toBeVisible();
  const row = page.getByRole("list", { name: "실패 알림 목록" }).getByRole("listitem").filter({ hasText: `#${id} ` });
  await expect(row).toContainText("slack webhook 404");
  await row.getByRole("button", { name: "다시 보내기" }).click();
  await expect(row).toHaveCount(0);

  const status = await withDb(async (db) =>
    (await db.query<{ status: string; attempts: number }>("select status::text as status, attempts from public.notification_outbox where id = $1", [id])).rows[0]);
  expect(status).toEqual({ status: "pending", attempts: 0 });
});
