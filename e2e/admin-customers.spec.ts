import { expect, test } from "@playwright/test";
import { createOnboardedCustomer, withDb, type Customer } from "./customer";
import { createStaff, signInStaffWithNewTotp } from "./staff";

// A-06 고객 CRM: 운영자가 휴대폰 번호로 고객을 찾고(목록은 마스킹), 상세에서 통화 메모를 남긴다.

test.describe("운영자 고객 CRM(A-06)", () => {
  let customer: Customer;
  let phone = "";

  test.beforeAll(async () => {
    customer = await createOnboardedCustomer({ withContact: true });
    phone = await withDb(async (db) => {
      const { rows } = await db.query<{ phone: string }>("select phone from public.profiles where id = $1", [customer.userId]);
      return rows[0]!.phone;
    });
  });

  test("휴대폰 번호로 찾고(목록은 마스킹) 상세에서 통화 메모를 남긴다", async ({ page }) => {
    const admin = await createStaff("crm");
    await signInStaffWithNewTotp(page, admin);

    // +821012345678 → 010-1234-5678
    const local = `0${phone.slice(3)}`;
    const dashed = `${local.slice(0, 3)}-${local.slice(3, 7)}-${local.slice(7)}`;
    const masked = `${local.slice(0, 3)}-****-${local.slice(-4)}`;

    await page.getByRole("navigation", { name: "운영자 메뉴" }).getByRole("link", { name: "고객" }).click();
    await expect(page).toHaveURL(/\/admin\/customers$/);
    await expect(page.getByRole("heading", { name: "고객", exact: true })).toBeVisible();
    await page.getByLabel("이름 또는 휴대폰 번호").fill(dashed);
    await page.getByRole("button", { name: "검색" }).click();
    await expect(page).toHaveURL(/\/admin\/customers\?q=/);

    const row = page.getByRole("link", { name: new RegExp(customer.displayName) });
    await expect(row).toHaveCount(1);
    await expect(row.getByTestId("customer-phone")).toHaveText(masked);
    // 목록에는 전체 번호가 나오지 않는다(절대 규칙 9)
    await expect(page.getByText(dashed)).toHaveCount(0);

    await row.click();
    await expect(page).toHaveURL(new RegExp(`/admin/customers/${customer.userId}$`));
    await expect(page.getByRole("heading", { name: customer.displayName })).toBeVisible();
    await expect(page.getByText(dashed)).toBeVisible();
    await expect(page.getByText("인증됨")).toBeVisible();
    await expect(page.getByText("아직 남긴 메모가 없습니다.")).toBeVisible();

    const body = `E2E 통화 메모 ${Date.now()} — 다음 주 주말 라운딩 희망`;
    await page.getByLabel("통화 메모").fill(body);
    await page.getByRole("button", { name: "메모 남기기" }).click();

    const timeline = page.getByRole("list", { name: "메모 타임라인" });
    await expect(timeline.getByText(body)).toBeVisible();
    await expect(timeline.getByText(admin.displayName)).toBeVisible();
    await expect(page.getByLabel("통화 메모")).toHaveValue("");
  });

  test("숫자 일부만 넣으면 전체 번호를 안내하고, 없는 고객은 404", async ({ page }) => {
    await signInStaffWithNewTotp(page, await createStaff("crm"));
    await page.goto("/admin/customers?q=5678");
    await expect(page.getByText("휴대폰 번호는 전체(예: 010-1234-5678)를 입력해 주세요.")).toBeVisible();
    const res = await page.goto("/admin/customers/00000000-0000-4000-a000-000000000000");
    expect(res?.status()).toBe(404);
  });
});
