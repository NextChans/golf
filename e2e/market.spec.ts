import { expect, test } from "@playwright/test";
import { createOnboardedCustomer, loginAsCustomer } from "./customer";
import { brokerageFee, formatManWon } from "../lib/domain/market/schema";
import { FEE_POLICY } from "../lib/mock/market";
import { getMarketDetail } from "../lib/mock/market-detail";
import { findMarketItem } from "../lib/mock/market";

/** 홈 팝업(공지 → 혜택 시트)을 차례로 닫는다 */
async function closeHomePopups(page: import("@playwright/test").Page) {
  await page.getByRole("dialog", { name: "거래 수수료 기준이 바뀝니다" }).getByRole("button", { name: "닫기" }).click();
  await page.getByRole("dialog", { name: /수수료 최대/ }).getByRole("button", { name: "닫기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

// 회원권 앱 미리보기(D-80, 목업 데이터). 팝업·탭 이동·검색 조건·판매 예상가·로그인 분기를 확인한다.
// 앱 홈은 루트(/, D-87). 나머지 화면은 /market/** 그대로.
test.describe("회원권 앱(홈 / 와 /market/**)", () => {
  test("홈 팝업: 공지를 닫으면 혜택 시트가 보이고, 닫은 뒤 같은 세션에서는 다시 뜨지 않는다", async ({ page }) => {
    await page.goto("/");
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
    await page.goto("/");
    await page.getByRole("button", { name: "오늘 그만 보기" }).click();
    await page.getByRole("button", { name: "다시 보지 않기" }).click();
    const next = await context.newPage(); // sessionStorage는 새 탭에서 비어 있다
    await next.goto("/");
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
    await page.goto("/?tab=sell");
    await page.getByRole("button", { name: "닫기" }).last().click();
    await page.getByRole("button", { name: "닫기" }).click();
    await page.getByRole("combobox", { name: "보유 회원권 골프장명" }).fill("청람");
    await page.getByRole("option", { name: /청람레이크CC.*개인 정회원/ }).getByRole("button").click();
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

  test("홈: 헤더는 스크롤해도 고정되어 알림 링크가 보인다", async ({ page }) => {
    await page.goto("/");
    await closeHomePopups(page);
    await page.mouse.wheel(0, 1500);
    await page.waitForFunction(() => window.scrollY > 800);
    await expect(page.getByRole("link", { name: "알림", exact: false }).first()).toBeInViewport();
  });

  test("홈: 목록 카드는 처음 5건이고 더보기로 늘어난다", async ({ page }) => {
    await page.goto("/");
    await closeHomePopups(page);
    const cards = page.getByRole("link", { name: /구매가능/ });
    await expect(cards).toHaveCount(5);
    await page.getByRole("button", { name: "더보기" }).click();
    await expect(cards).toHaveCount(10);
  });

  test("홈: 상세를 본 회원권이 최근 확인한 회원권에 나타난다", async ({ page }) => {
    await page.goto("/");
    await closeHomePopups(page);
    await expect(page.getByRole("heading", { name: "최근 확인한 회원권" })).toHaveCount(0);
    await page.getByRole("link", { name: /구매가능/ }).first().click();
    await expect(page).toHaveURL(/\/market\/items\//);
    const name = (await page.getByRole("heading", { level: 1 }).first().innerText()).trim();
    await page.waitForFunction(() => window.localStorage.getItem("googolf.market.recent") !== null);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "최근 확인한 회원권" })).toBeVisible();
    await expect(page.locator("#recent-title ~ ul").getByText(name, { exact: false }).first()).toBeVisible();
  });

  test("홈: 지역 타일을 누르면 해당 지역 결과로 간다", async ({ page }) => {
    await page.goto("/");
    await closeHomePopups(page);
    await page.getByRole("link", { name: "강원", exact: true }).click();
    await expect(page).toHaveURL(/\/market\/search\/results\?region=gangwon$/);
  });

  test("홈: 프로모 배너는 1/4로 시작하고 슬라이드가 링크를 가진다", async ({ page }) => {
    await page.goto("/");
    await closeHomePopups(page);
    const promo = page.getByRole("region", { name: "Googolf 소식" });
    await promo.scrollIntoViewIfNeeded();
    await expect(promo.getByText("1/4")).toBeVisible();
    await expect(promo.getByRole("link")).toHaveCount(4);
    await expect(promo.getByRole("link", { name: /첫 거래 수수료 할인/ })).toHaveAttribute("href", "/market/login");
    await expect(promo.getByRole("link", { name: /주간 시세 리포트/ })).toHaveAttribute("href", "/market/report");
  });

  test("홈: 푸터에 회사 정보 자리와 중개 서비스 고지문이 보인다", async ({ page }) => {
    await page.goto("/");
    await closeHomePopups(page);
    const footer = page.locator("footer");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toContainText("(준비 중)");
    await expect(footer).toContainText("중개 서비스입니다");
  });

  test("홈: 초대 링크 보내기는 홈(/) 주소를 복사하고 오류를 보이지 않는다", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(() => { Object.defineProperty(navigator, "share", { value: undefined, configurable: true }); });
    await page.goto("/");
    await closeHomePopups(page);
    const button = page.getByRole("button", { name: "초대 링크 보내기" });
    await button.scrollIntoViewIfNeeded();
    await button.click();
    await expect(page.getByText("링크를 복사했어요")).toBeVisible();
    await expect(page.getByText(/복사하지 못했어요/)).toHaveCount(0);
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe("http://localhost:3000/");
    expect(copied).not.toContain("?");
  });
});

// 회원권 상세 개편(D-85): 탭·차트·표·계산기·FAQ. 솔빛힐스CC(m01, 개인 정회원)는 법인 정회원(m17)과 같은 골프장이다.
test.describe("회원권 상세(/market/items/[id])", () => {
  test("직접 진입하면 팝업 없이 가격 카드와 탭 4개가 보인다", async ({ page }) => {
    await page.goto("/market/items/m01");
    await expect(page.getByRole("heading", { name: "솔빛힐스CC" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const card = page.getByRole("region", { name: "가격 정보" });
    for (const label of ["현재 시세", "즉시 구매가", "즉시 판매가", "최근 거래가"]) await expect(card).toContainText(label);
    const tabs = page.getByRole("navigation", { name: "상세 정보 탭" });
    await expect(tabs.getByRole("link")).toHaveText(["시세", "회원권 정보", "이용 정보", "골프장 정보"]);
    await expect(tabs.getByRole("link", { name: "시세" })).toHaveAttribute("aria-current", "true");
    // 현재 시세 설명 토글
    await card.getByRole("button", { name: /현재 시세/ }).click();
    await expect(card).toContainText("주간 조사 기준 평균 시세");
  });

  test("매물·입찰이 없으면 가격 카드와 표가 빈 상태를 보인다", async ({ page }) => {
    await page.goto("/market/items/m06"); // 매물 없음(askPrice null)
    await expect(page.getByRole("region", { name: "가격 정보" })).toContainText("매물 없음");
    await page.getByRole("button", { name: "구매 가능 매물" }).click();
    await expect(page.getByText("구매 가능한 매물이 없어요")).toBeVisible();
    await page.getByRole("button", { name: "판매 입찰" }).click();
    await expect(page.getByRole("table", { name: "판매 입찰" })).toBeVisible();
  });

  test("탭 '이용 정보'를 누르면 그린피 표로 이동하고 탭이 활성화된다", async ({ page }) => {
    await page.goto("/market/items/m01");
    const tabs = page.getByRole("navigation", { name: "상세 정보 탭" });
    await tabs.getByRole("link", { name: "이용 정보" }).click();
    await expect(tabs.getByRole("link", { name: "이용 정보" })).toHaveAttribute("aria-current", "true");
    await expect(tabs.getByRole("link", { name: "시세" })).not.toHaveAttribute("aria-current", "true");
    const table = page.getByRole("table", { name: /그린피/ });
    await expect(table).toBeVisible();
    await expect(table).toContainText("특별회원");
    await expect(table).toContainText("비회원");
  });

  test("기간 탭을 바꾸면 시세 동향 문장의 기간이 바뀐다", async ({ page }) => {
    await page.goto("/market/items/m01");
    const sentence = page.getByTestId("trend-sentence");
    await expect(page.getByRole("button", { name: "3년" })).toHaveAttribute("aria-pressed", "true");
    await expect(sentence).toContainText("최근 3년간");
    await page.getByRole("button", { name: "6개월" }).click();
    await expect(page.getByRole("button", { name: "6개월" })).toHaveAttribute("aria-pressed", "true");
    await expect(sentence).toContainText("최근 6개월간");
    await page.getByRole("button", { name: "전체" }).click();
    await expect(sentence).toContainText("전체 기간 동안");
  });

  test("개인/법인 토글로 입회 체크리스트 값이 바뀐다", async ({ page }) => {
    await page.goto("/market/items/m01");
    const list = page.getByTestId("admission-list");
    const d = getMarketDetail(findMarketItem("m01")!);
    await expect(list).toContainText(d.admission.personal[0]!.value);
    await expect(list).not.toContainText("법인 서류 확인");
    await page.getByRole("button", { name: "법인", exact: true }).click();
    await expect(list).toContainText("법인 서류 확인");
    await expect(list).toContainText("법인 대표자·임원 명의로 입회");
    await expect(page.getByText("정회원 1명만 이용 가능해요")).toBeVisible();
  });

  test("계산기: 구매·판매 비용을 수수료 규칙대로 보여 주고 잘못된 입력은 알린다", async ({ page }) => {
    await page.goto("/market/items/m01");
    const input = page.getByLabel("얼마에 구매하고 싶으신가요?");
    await expect(input).toHaveValue("48000"); // 기본값 = 현재 시세(만원)
    const price = 11_400 * 10_000;
    const fee = brokerageFee(price, "개인 정회원", FEE_POLICY);
    await input.fill("11400");
    await expect(page.getByText("1억 1,400만원").first()).toBeVisible();
    await page.getByRole("button", { name: "계산하기" }).click();
    const result = page.getByRole("region", { name: "예상 비용" });
    await expect(result).toContainText(`중개 수수료${formatManWon(fee)}`);
    await expect(result).toContainText(`총 예상 비용${formatManWon(price + fee)}`);

    await page.getByRole("button", { name: "판매 비용" }).click();
    await expect(result).toHaveCount(0);
    await page.getByLabel("얼마에 판매하고 싶으신가요?").fill("11400");
    await page.getByRole("button", { name: "계산하기" }).click();
    await expect(result).toContainText(`예상 수령액${formatManWon(price - fee)}`);
    await expect(result).toContainText("명의개서 비용과 세금은 별도");

    await page.getByRole("button", { name: "100만원 늘리기" }).click();
    await expect(page.getByLabel("얼마에 판매하고 싶으신가요?")).toHaveValue("11500");

    await page.getByLabel("얼마에 판매하고 싶으신가요?").fill("0");
    await page.getByRole("button", { name: "계산하기" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "1만원 이상" })).toBeVisible();
    await page.getByLabel("얼마에 판매하고 싶으신가요?").fill("5000001");
    await page.getByRole("button", { name: "계산하기" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "5,000,000만원 이하" })).toBeVisible();
    await expect(page.getByText("쿠폰은 거래 매칭 후 적용 가능해요")).toBeVisible();
  });

  test("FAQ 항목을 펼칠 수 있다", async ({ page }) => {
    await page.goto("/market/items/m01");
    const summary = page.getByText("거래 대금은 어떻게 보관되나요?");
    await summary.scrollIntoViewIfNeeded();
    await expect(page.getByText(/검토 중이에요/)).toBeHidden();
    await summary.click();
    await expect(page.getByText(/검토 중이에요/)).toBeVisible();
  });

  test("주소 복사와 맨 위로 버튼", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/market/items/m01");
    const d = getMarketDetail(findMarketItem("m01")!);
    await expect(page.getByRole("link", { name: "상담 문의" })).toHaveAttribute("href", "/market/mypage/support");
    await expect(page.getByRole("button", { name: "맨 위로" })).toHaveCount(0);
    await page.getByRole("button", { name: "주소 복사" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "맨 위로" })).toBeVisible();
    await page.getByRole("button", { name: "주소 복사" }).click();
    await expect(page.getByText("주소를 복사했어요")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(d.address);
    await page.getByRole("button", { name: "맨 위로" }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByRole("button", { name: "맨 위로" })).toHaveCount(0);
  });

  test("하단 CTA 링크와 공유 폴백", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(() => { Object.defineProperty(navigator, "share", { value: undefined, configurable: true }); });
    await page.goto("/market/items/m02");
    await expect(page.getByRole("link", { name: "구매하기" })).toHaveAttribute("href", "/memberships");
    await expect(page.getByRole("link", { name: "판매하기" })).toHaveAttribute("href", "/market/mypage/asks/new?item=m02");
    await page.getByRole("button", { name: "공유" }).click();
    await expect(page.getByText("링크를 복사했어요")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/market\/items\/m02$/);
  });

  test("같은 골프장의 다른 회원권 유형으로 이동하고, 유형이 하나뿐이면 비활성이다", async ({ page }) => {
    await page.goto("/market/items/m01");
    const select = page.getByRole("combobox", { name: "회원권 종류" });
    await expect(select).toBeEnabled();
    await select.selectOption({ label: "법인 정회원" });
    await expect(page).toHaveURL(/\/market\/items\/m17$/);
    await expect(page.getByRole("heading", { name: "솔빛힐스CC" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "회원권 종류" })).toHaveValue("m17");

    await page.goto("/market/items/m03");
    await expect(page.getByRole("combobox", { name: "회원권 종류" })).toBeDisabled();
  });
});
