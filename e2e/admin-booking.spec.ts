import { expect, test } from "@playwright/test";
import { createOnboardedCustomer, getBookingStatus, loginAsCustomer, withDb } from "./customer";
import { createStaff, signInStaffWithNewTotp } from "./staff";

/** 고객 요청을 DB 함수로 만든다(고객 화면 흐름은 booking.spec이 검증) */
async function createRequest(customerId: string): Promise<string> {
  return withDb(async (db) => {
    await db.query("begin");
    const claims = JSON.stringify({ sub: customerId, role: "authenticated", aal: "aal1", app_metadata: { role: "customer", onboarded: true } });
    await db.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    await db.query("set local role authenticated");
    const { rows } = await db.query<{ id: string }>(
      `select id from public.create_booking_request(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', null,
         (now() at time zone 'Asia/Seoul')::date + 10, 'part_1', null, null, 3, null, 'E2E 운영자 흐름')`,
    );
    await db.query("commit");
    return rows[0]!.id;
  });
}

test("운영자 배정 → 제안 → 고객 수락", async ({ page, browser }) => {
  const [customer, staff] = await Promise.all([createOnboardedCustomer(), createStaff("inbox")]);
  const requestId = await createRequest(customer.userId);

  await signInStaffWithNewTotp(page, staff);

  await test.step("신규 탭에서 요청을 찾고 전화번호는 마스킹", async () => {
    await page.getByRole("link", { name: "요청 인박스" }).click();
    const row = page.locator(`a[href="/admin/bookings/${requestId}"]`);
    await expect(row).toBeVisible();
    await expect(row).toContainText(customer.displayName);
    await expect(row).toContainText(/010-\*\*\*\*-\d{4}/);
    await row.click();
    await expect(page.getByTestId("admin-booking-status")).toHaveText("접수");
  });

  await test.step("나에게 배정", async () => {
    await page.getByRole("button", { name: "나에게 배정" }).click();
    await expect(page.getByTestId("admin-booking-status")).toHaveText("확인 중");
    await expect(page.getByTestId("assignee-name")).toHaveText(staff.displayName);
  });

  await test.step("티타임 제안", async () => {
    await page.getByLabel("티타임(KST)").fill(await futureLocal(10, "07:40"));
    await page.getByLabel("1인 그린피(원)").fill("190,000");
    await page.getByRole("button", { name: "티타임 제안" }).click();
    await expect(page.getByTestId("admin-booking-status")).toHaveText("제안 도착");
    await expect(page.getByText("1인 190,000원")).toBeVisible();
  });

  await test.step("고객이 수락", async () => {
    const ctx = await browser.newContext();
    await loginAsCustomer(ctx, customer);
    const cp = await ctx.newPage();
    await cp.goto(`/bookings/${requestId}`);
    await expect(cp.getByText("총 570,000원")).toBeVisible();
    await cp.getByRole("button", { name: "이 시간으로 확정" }).click();
    await expect(cp.getByTestId("booking-status")).toHaveText("예약 확정");
    await ctx.close();
    expect(await getBookingStatus(requestId)).toBe("confirmed");
  });

  await test.step("운영자 화면에 확정 반영, 확정 건 취소만 가능", async () => {
    await page.reload();
    await expect(page.getByTestId("admin-booking-status")).toHaveText("예약 확정");
    await expect(page.getByRole("button", { name: "예약 불가 처리" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "예약 취소" })).toBeVisible();
  });
});

test("예약 불가 처리는 사유가 고객 타임라인에 남는다", async ({ page }) => {
  const [customer, staff] = await Promise.all([createOnboardedCustomer(), createStaff("reject")]);
  const requestId = await createRequest(customer.userId);
  await signInStaffWithNewTotp(page, staff);
  await page.goto(`/admin/bookings/${requestId}`);

  page.once("dialog", (d) => d.accept());
  await page.getByLabel("불가 사유").fill("해당 날짜 만석");
  await page.getByRole("button", { name: "예약 불가 처리" }).click();
  await expect(page.getByTestId("admin-booking-status")).toHaveText("예약 불가");
  await expect(page.getByText("요청하신 조건으로는 예약이 어렵습니다: 해당 날짜 만석")).toBeVisible();
  expect(await getBookingStatus(requestId)).toBe("rejected");
});

test("다른 운영자 담당 건은 제안 폼 대신 안내가 보인다", async ({ page }) => {
  const [customer, staff, other] = await Promise.all([createOnboardedCustomer(), createStaff("viewer"), createStaff("assignee")]);
  const requestId = await createRequest(customer.userId);
  await withDb(async (db) => {
    await db.query("begin");
    const claims = JSON.stringify({ sub: other.userId, role: "authenticated", aal: "aal2", app_metadata: { role: "admin", providers: ["email"] } });
    await db.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    await db.query("set local role authenticated");
    await db.query("select public.assign_booking($1, $2, 1)", [requestId, other.userId]);
    await db.query("commit");
  });
  await signInStaffWithNewTotp(page, staff);
  await page.goto(`/admin/bookings/${requestId}`);
  await expect(page.getByText("제안은 담당자 또는 최고관리자만 할 수 있습니다.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "티타임 제안" })).toHaveCount(0);
});

/** 오늘(KST)+days일의 "YYYY-MM-DDTHH:MM" */
async function futureLocal(days: number, hhmm: string) {
  const d = new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
  return `${d}T${hhmm}`;
}
