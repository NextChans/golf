import { expect, test } from "@playwright/test";
import { createOnboardedCustomer, withDb } from "./customer";
import { createStaff, signInStaffWithNewTotp } from "./staff";

const PRODUCT = "00000000-0000-4000-b000-000000000002"; // seed 구골프 레이크CC 주중회원

/** 테스트 전용 공개 매물 + 고객 매수 상담(DB 함수로 생성). 다른 spec과 매물을 공유하지 않는다 */
async function seedInquiry(customerId: string): Promise<{ listingId: string; dealId: string }> {
  return withDb(async (db) => {
    const { rows: [listing] } = await db.query<{ id: string }>(
      `insert into public.membership_listings (product_id, asking_price, description, status)
       values ($1, 93000000, 'E2E 매물', 'listed') returning id`, [PRODUCT]);
    await db.query("begin");
    const claims = JSON.stringify({ sub: customerId, role: "authenticated", aal: "aal1", app_metadata: { role: "customer", onboarded: true } });
    await db.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    await db.query("set local role authenticated");
    const { rows: [deal] } = await db.query<{ id: string }>(
      `select id from public.create_deal_inquiry(gen_random_uuid(), 'buy', $1, null, 90000000, '평일 오후', null)`, [listing!.id]);
    await db.query("commit");
    return { listingId: listing!.id, dealId: deal!.id };
  });
}

const listingStatus = (id: string) =>
  withDb(async (db) => (await db.query<{ status: string }>("select status::text as status from public.membership_listings where id = $1", [id])).rows[0]!.status);

test("상담 신청 → 협의 시작(매물 상담 중) → 취소 시 매물 공개 복원", async ({ page }) => {
  const [customer, staff] = await Promise.all([createOnboardedCustomer(), createStaff("deal")]);
  const { listingId, dealId } = await seedInquiry(customer.userId);
  page.on("dialog", (d) => d.accept());

  await signInStaffWithNewTotp(page, staff);
  await page.getByRole("link", { name: "회원권 상담", exact: true }).click();
  const row = page.locator(`a[href="/admin/deals/${dealId}"]`);
  await expect(row).toContainText(customer.displayName);
  await expect(row).toContainText(/010-\*\*\*\*-\d{4}/);
  await row.click();
  await expect(page.getByTestId("admin-deal-status")).toHaveText("상담 접수");

  await page.getByRole("button", { name: "가격 협의 시작" }).click();
  await expect(page.getByTestId("admin-deal-status")).toHaveText("협의 중");
  await expect(page.getByTestId("deal-assignee")).toHaveText(staff.displayName);
  expect(await listingStatus(listingId)).toBe("reserved");

  await page.getByLabel("취소 사유").fill("고객 사정으로 보류");
  await page.getByRole("button", { name: "거래 취소" }).click();
  await expect(page.getByTestId("admin-deal-status")).toHaveText("취소됨");
  expect(await listingStatus(listingId)).toBe("listed");
});

test("조건 저장 → 단계 진행 → 거래 완료 시 매물 판매완료", async ({ page }) => {
  const [customer, staff] = await Promise.all([createOnboardedCustomer(), createStaff("deal-done")]);
  const { listingId, dealId } = await seedInquiry(customer.userId);
  page.on("dialog", (d) => d.accept());

  await signInStaffWithNewTotp(page, staff);
  await page.goto(`/admin/deals/${dealId}`);
  await page.getByRole("button", { name: "가격 협의 시작" }).click();
  await expect(page.getByTestId("admin-deal-status")).toHaveText("협의 중");

  // 계약일 없이는 진행 불가(버튼 비활성 + 안내)
  await expect(page.getByText("계약일을 먼저 저장해 주세요.")).toBeVisible();
  await page.getByLabel("합의가(원)").fill("91,500,000");
  await page.getByLabel("계약일").fill("2026-12-01");
  await page.getByRole("button", { name: "조건 저장" }).click();
  await expect(page.getByTestId("agreed-price")).toHaveText("91,500,000원");

  for (const [button, status] of [
    ["계약 예정(으)로 진행", "계약 예정"],
    ["계약 완료(으)로 진행", "계약 완료"],
    ["명의 이전 중(으)로 진행", "명의 이전 중"],
    ["거래 완료(으)로 진행", "거래 완료"],
  ] as const) {
    await page.getByRole("button", { name: button }).click();
    await expect(page.getByTestId("admin-deal-status")).toHaveText(status);
  }
  expect(await listingStatus(listingId)).toBe("sold");
  await expect(page.getByRole("button", { name: "거래 취소" })).toHaveCount(0);
});
