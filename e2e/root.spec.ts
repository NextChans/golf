import { expect, test, type Page } from "@playwright/test";

// D-87: 루트(/)가 회원권 앱 홈. /market은 /로, 제거된 부킹 화면 주소는 홈(/·/admin)으로 보낸다.
const ROOT = /^http:\/\/localhost:3000\/$/;

/** 홈 팝업(공지 → 혜택 시트)을 차례로 닫는다 */
async function closeHomePopups(page: Page) {
  await page.getByRole("dialog", { name: "거래 수수료 기준이 바뀝니다" }).getByRole("button", { name: "닫기" }).click();
  await page.getByRole("dialog", { name: /수수료 최대/ }).getByRole("button", { name: "닫기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** 페이지 오류·콘솔 오류를 모은다. 로컬 `next start`에 없는 Vercel Analytics 스크립트(/_vercel/insights) 404는 제외 */
function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (`${m.text()} ${m.location().url}`.includes("/_vercel/")) return;
    errors.push(`${m.text()} (${m.location().url})`);
  });
  return errors;
}

test.describe("루트 = 회원권 앱 홈(D-87)", () => {
  test("비로그인으로 /에 들어오면 URL 그대로 앱 홈·탭 바·미리보기 띠가 보인다", async ({ page }) => {
    const errors = trackErrors(page);
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(ROOT);
    await expect(page).toHaveTitle("Googolf — 골프 회원권 거래");
    await expect(page.getByText("미리보기 · 시세와 매물은 예시 데이터입니다")).toBeVisible();
    await closeHomePopups(page);
    await expect(page.getByRole("link", { name: "어떤 회원권을 찾고 계신가요?" })).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "앱 메뉴" });
    await expect(tabs).toBeVisible();
    const home = tabs.getByRole("link", { name: "회원권 거래" });
    await expect(home).toHaveAttribute("aria-current", "page");
    await expect(home).toHaveAttribute("href", "/");
    // 기존 apple 스타일 GlobalNav·부킹 소개는 없다
    await expect(page.getByRole("navigation", { name: "전체 메뉴" })).toHaveCount(0);
    await expect(page.getByText(/부킹 요청/)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("/market은 /로 이동하고 쿼리는 유지된다", async ({ page }) => {
    await page.goto("/market");
    await expect(page).toHaveURL(ROOT);
    await page.goto("/market?tab=sell");
    await expect(page).toHaveURL(/^http:\/\/localhost:3000\/\?tab=sell$/);
    await expect(page.getByRole("heading", { name: /지금 팔면 얼마일까/ })).toBeVisible();
  });

  test("제거된 부킹 주소는 오류 없이 홈으로 보낸다(/bookings → /, /admin/bookings → /admin → 운영자 로그인)", async ({ page }) => {
    const errors = trackErrors(page);
    for (const path of ["/bookings", "/bookings/new", "/bookings/00000000-0000-4000-a000-000000000000"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page, path).toHaveURL(ROOT);
    }
    for (const path of ["/admin/bookings", "/admin/bookings/00000000-0000-4000-a000-000000000000"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page, path).toHaveURL(/\/admin\/login\?next=%2Fadmin$/);
    }
    await expect(page.getByRole("heading", { name: "운영자 로그인" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("홈 탭 '회원권 판매'는 /?tab=sell로 가고 판매 탭이 보인다, '회원권 구매'로 돌아온다", async ({ page }) => {
    await page.goto("/");
    await closeHomePopups(page);
    const tabs = page.getByRole("navigation", { name: "거래 구분" });
    await expect(tabs.getByRole("link", { name: "회원권 판매" })).toHaveAttribute("href", "/?tab=sell");
    await tabs.getByRole("link", { name: "회원권 판매" }).click();
    await expect(page).toHaveURL(/^http:\/\/localhost:3000\/\?tab=sell$/);
    await expect(page.getByRole("heading", { name: /지금 팔면 얼마일까/ })).toBeVisible();
    await expect(tabs.getByRole("link", { name: "회원권 판매" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("navigation", { name: "앱 메뉴" }).getByRole("link", { name: "회원권 거래" })).toHaveAttribute("aria-current", "page");

    await tabs.getByRole("link", { name: "회원권 구매" }).click();
    await expect(page).toHaveURL(ROOT);
    await expect(page.getByRole("link", { name: "어떤 회원권을 찾고 계신가요?" })).toBeVisible();
  });

  test("목록 정렬 링크는 /?list=…로 동작한다", async ({ page }) => {
    await page.goto("/");
    await closeHomePopups(page);
    const sort = page.getByRole("navigation", { name: "목록 정렬" });
    const second = sort.getByRole("link").nth(1);
    const href = await second.getAttribute("href");
    expect(href).toMatch(/^\/\?list=[a-z]+$/);
    await second.click();
    await expect(page).toHaveURL(new RegExp(`^http://localhost:3000${href!.replace("?", "\\?")}$`));
    await expect(second).toHaveAttribute("aria-current", "true");
  });

  test("홈 → 상세 → 브라우저 뒤로 → 홈, 상세의 '뒤로' 링크도 홈(/)", async ({ page }) => {
    await page.goto("/");
    await closeHomePopups(page);
    await page.getByRole("link", { name: /구매가능/ }).first().click();
    await expect(page).toHaveURL(/\/market\/items\//);
    await expect(page.getByRole("navigation", { name: "앱 메뉴" })).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(ROOT);
    await expect(page.getByRole("link", { name: "어떤 회원권을 찾고 계신가요?" })).toBeVisible();

    await page.getByRole("link", { name: /구매가능/ }).first().click();
    await expect(page).toHaveURL(/\/market\/items\//);
    await page.getByRole("link", { name: "뒤로" }).click();
    await expect(page).toHaveURL(ROOT);
  });

  test("앱의 다른 화면에서 탭 바 '회원권 거래'와 상단 '뒤로'는 홈(/)으로 간다", async ({ page }) => {
    await page.goto("/market/search");
    await page.getByRole("link", { name: "뒤로" }).click();
    await expect(page).toHaveURL(ROOT);

    await page.goto("/market/mypage");
    await page.getByRole("navigation", { name: "앱 메뉴" }).getByRole("link", { name: "회원권 거래" }).click();
    await expect(page).toHaveURL(ROOT);

    await page.goto("/market/report");
    await page.getByRole("link", { name: "뒤로" }).click();
    await expect(page).toHaveURL(ROOT);
  });
});
