import { expect, test } from "@playwright/test";
import { createOnboardedCustomer, loginAsCustomer } from "./customer";

// 화면 간 이동 경로(wayfinding). URL로 바로 들어가는 테스트만으로는 링크 누락을 못 잡는다(M3 회귀).
// 부킹 화면 제거(D-87): GlobalNav에는 회원권·모임·내 거래·내 정보만 남고, 로고는 앱 홈(/)으로 간다.
test.describe("고객 내비게이션", () => {
  test("회원권 → 내 거래 → 내 정보 → 내 거래 보기를 링크로만 이동한다", async ({ page, context }) => {
    await loginAsCustomer(context, await createOnboardedCustomer());
    await page.goto("/memberships");

    const nav = page.getByRole("navigation", { name: "전체 메뉴" });
    await expect(nav.getByRole("link", { name: "부킹" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "내 예약" })).toHaveCount(0);

    await nav.getByRole("link", { name: "내 거래" }).click();
    await expect(page).toHaveURL(/\/deals$/);

    await nav.getByRole("link", { name: "내 정보" }).click();
    await expect(page).toHaveURL(/\/me$/);
    await expect(page.getByRole("link", { name: /내 예약 보기/ })).toHaveCount(0);

    await page.getByRole("link", { name: /내 거래 보기/ }).click();
    await expect(page).toHaveURL(/\/deals$/);
  });

  test("비로그인 GlobalNav: 부킹 링크 없이 회원권·모임·로그인, 로고는 앱 홈(/)", async ({ page }) => {
    await page.goto("/memberships");
    const nav = page.getByRole("navigation", { name: "전체 메뉴" });
    await expect(nav.getByRole("link", { name: "부킹" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "내 예약" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "회원권" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "모임" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "로그인" })).toBeVisible();

    await nav.getByRole("link", { name: "Googolf 홈" }).click();
    await expect(page).toHaveURL(/^http:\/\/localhost:3000\/$/);
    await expect(page.getByRole("link", { name: "어떤 회원권을 찾고 계신가요?" })).toBeVisible();
  });
});
