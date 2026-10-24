import { expect, test } from "@playwright/test";
import { createOnboardedCustomer, loginAsCustomer } from "./customer";

// 회원권 앱 미리보기(D-80, 목업 데이터). 팝업·탭 이동·검색 조건·판매 예상가·로그인 분기를 확인한다.
test.describe("회원권 앱(/market)", () => {
  test("홈 팝업: 공지를 닫으면 혜택 시트가 보이고, 닫은 뒤 같은 세션에서는 다시 뜨지 않는다", async ({ page }) => {
    await page.goto("/market");
    const notice = page.getByRole("dialog", { name: "거래 수수료 기준이 바뀝니다" });
    await expect(notice).toBeVisible();
    await notice.getByRole("button", { name: "닫기" }).click();
    await expect(notice).toBeHidden();

    const sheet = page.getByRole("dialog", { name: /수수료 최대/ });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "닫기" }).click();
    await expect(sheet).toBeHidden();

    await page.reload();
    await expect(page.getByRole("link", { name: "어떤 회원권을 찾고 계신가요?" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("오늘 그만 보기·다시 보지 않기는 새 세션에서도 유지된다", async ({ page, context }) => {
    await page.goto("/market");
    await page.getByRole("button", { name: "오늘 그만 보기" }).click();
    await page.getByRole("button", { name: "다시 보지 않기" }).click();
    const next = await context.newPage(); // sessionStorage는 새 탭에서 비어 있다
    await next.goto("/market");
    await expect(next.getByRole("link", { name: "어떤 회원권을 찾고 계신가요?" })).toBeVisible();
    await expect(next.getByRole("dialog")).toHaveCount(0);
  });

  test("탭 바로 네 화면을 오가고, 비로그인 마이페이지는 로그인으로 잇는다", async ({ page }) => {
    await page.goto("/market/mypage");
    const tabs = page.getByRole("navigation", { name: "앱 메뉴" });
    await expect(tabs.getByRole("link", { name: "마이페이지" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: /로그인 · 회원가입/ })).toHaveAttribute("href", "/market/login?next=/market/mypage");

    await tabs.getByRole("link", { name: "나의 회원권" }).click();
    await expect(page.getByRole("heading", { name: "나의 회원권" })).toBeVisible();
    await expect(page.getByText("내 회원권의 가치")).toBeVisible();

    await tabs.getByRole("link", { name: "회원권 검색" }).click();
    await expect(page.getByRole("heading", { name: "맞춤 회원권 검색" })).toBeVisible();
  });

  test("맞춤 검색: 지역·가격대를 고르면 건수 버튼이 바뀌고 결과로 이동한다", async ({ page }) => {
    await page.goto("/market/search");
    await expect(page.getByRole("button", { name: "전체보기" })).toBeVisible();
    await page.getByRole("button", { name: "강원", exact: true }).click();
    await page.getByRole("button", { name: "1억원 ~ 2억원 미만" }).click();
    await expect(page.getByRole("button", { name: "강원", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "2건 보기" }).click();
    await expect(page).toHaveURL(/\/market\/search\/results\?region=gangwon&band=1e-2e$/);
    await expect(page.getByText("회원권 2건")).toBeVisible();

    await page.getByRole("link", { name: /백운파인CC/ }).click();
    await expect(page.getByRole("heading", { name: "백운파인CC" })).toBeVisible();
  });

  test("판매 탭: 골프장을 고르면 예상 판매가와 수령액을 보여 준다", async ({ page }) => {
    await page.goto("/market?tab=sell");
    await page.getByRole("button", { name: "닫기" }).last().click();
    await page.getByRole("button", { name: "닫기" }).click();
    await page.getByRole("combobox", { name: "보유 회원권 골프장명" }).fill("청람");
    await page.getByRole("option", { name: /청람레이크CC/ }).getByRole("button").click();
    const result = page.getByRole("region", { name: "예상 판매가" });
    await expect(result).toContainText("4,600만원");
    await expect(result).toContainText("예상 수령액");
    await expect(result).toContainText("4,550만원");
  });

  test("로그인 고객은 마이페이지에 이름이, 나의 회원권에 보유 회원권이 보인다", async ({ page, context }) => {
    const customer = await createOnboardedCustomer();
    await loginAsCustomer(context, customer);
    await page.goto("/market/mypage");
    await expect(page.getByRole("link", { name: new RegExp(`${customer.displayName}님`) })).toHaveAttribute("href", "/me");
    await page.getByRole("navigation", { name: "앱 메뉴" }).getByRole("link", { name: "나의 회원권" }).click();
    await expect(page.getByRole("link", { name: /대관령그린CC/ })).toBeVisible();
  });

  test("가입: 로그인 → 회원 유형 → 개인(카카오만)·기업(사업자번호 검증 후 카카오)", async ({ page }) => {
    await page.goto("/market/mypage");
    await page.getByRole("link", { name: /로그인 · 회원가입/ }).click();
    await expect(page).toHaveURL(/\/market\/login\?next=/);
    // 고객 로그인 수단은 카카오 하나(D-81)
    await expect(page.getByRole("button", { name: "카카오로 계속하기" })).toHaveCount(1);
    await expect(page.getByLabel("이메일")).toHaveCount(0);

    await page.getByRole("link", { name: "회원가입" }).click();
    await page.getByRole("link", { name: /개인회원/ }).click();
    await expect(page.getByRole("heading", { name: "개인 회원가입" })).toBeVisible();
    await expect(page.getByRole("list", { name: "가입 단계 1/3" })).toBeVisible();
    await expect(page.locator('input[name="next"]')).toHaveValue("/market/mypage");

    await page.goto("/market/signup/business");
    const next = page.getByRole("button", { name: "다음" });
    await expect(next).toBeDisabled();
    await page.getByLabel("사업자명").fill("구골프");
    await page.getByLabel("사업자등록번호").fill("2208162518");
    await page.getByLabel("사업자명").click();
    await expect(page.getByText("사업자등록번호를 다시 확인해 주세요.")).toBeVisible();
    await expect(next).toBeDisabled();
    await page.getByLabel("사업자등록번호").fill("2208162517");
    await expect(page.getByLabel("사업자등록번호")).toHaveValue("220-81-62517");
    await next.click();
    await expect(page.getByRole("heading", { name: /담당자 카카오 계정을/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "카카오로 계속하기" })).toBeVisible();
  });

  test("로그인한 고객이 앱 로그인 화면에 오면 돌아갈 곳으로 보낸다", async ({ page, context }) => {
    await loginAsCustomer(context, await createOnboardedCustomer());
    await page.goto("/market/login?next=/market/my");
    await expect(page).toHaveURL(/\/market\/my$/);
  });
});
