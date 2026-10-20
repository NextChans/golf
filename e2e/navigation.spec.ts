import { expect, test } from "@playwright/test";
import { createOnboardedCustomer, loginAsCustomer } from "./customer";

// 화면 간 이동 경로(wayfinding). URL로 바로 들어가는 테스트만으로는 링크 누락을 못 잡는다(M3 회귀).
test.describe("고객 내비게이션", () => {
  test("홈 → 내 예약 → 새 요청 → 내 정보 → 내 예약을 링크로만 이동한다", async ({ page, context }) => {
    await loginAsCustomer(context, await createOnboardedCustomer());
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "전체 메뉴" });
    await nav.getByRole("link", { name: "내 예약" }).click();
    await expect(page).toHaveURL(/\/bookings$/);

    await page.getByRole("link", { name: "새 요청" }).first().click();
    await expect(page).toHaveURL(/\/bookings\/new$/);

    await nav.getByRole("link", { name: "내 정보" }).click();
    await expect(page).toHaveURL(/\/me$/);

    await page.getByRole("link", { name: /내 예약 보기/ }).click();
    await expect(page).toHaveURL(/\/bookings$/);
  });

  test("비로그인 홈에서는 로그인과 부킹 요청으로 갈 수 있다", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "부킹 요청하기" }).click();
    await expect(page).toHaveURL(/\/login\?next=(%2F|\/)bookings(%2F|\/)new$/);
  });
});
