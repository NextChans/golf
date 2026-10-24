import { randomInt } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createOnboardedCustomer, loginAsCustomer, withDb, type Customer } from "./customer";

// M5 고객 회원권(F-04 매물, F-05 상담 신청, F-06 내 거래).
// 시드 매물은 다른 테스트(어드민 거래 진행 등)가 점유·변경할 수 있으므로 테스트마다 자기 매물을 만든다.

const PRODUCT = "00000000-0000-4000-b000-000000000001"; // 구골프 레이크CC 정회원(시드)

/** 테스트 전용 매물(postgres 권한으로 직접 생성). 다른 매물과 겹치지 않는 호가를 쓴다 */
async function createListing(status: "listed" | "reserved" | "hidden" = "listed") {
  const asking = randomInt(40_000, 49_000) * 10_000; // 4억~4.9억, 만원 단위
  const description = `E2E 매물 ${randomInt(100000, 999999)}`;
  const id = await withDb(async (db) => {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.membership_listings (product_id, asking_price, description, status)
       values ($1, $2, $3, $4) returning id`,
      [PRODUCT, asking, description, status],
    );
    return rows[0]!.id;
  });
  return { id, asking, description };
}

async function dealsOf(userId: string) {
  return withDb(async (db) => {
    const { rows } = await db.query<{ id: string; side: string; status: string; close_reason: string | null; desired_price: string | null }>(
      "select id, side::text, status::text, close_reason, desired_price from public.membership_deals where user_id = $1",
      [userId],
    );
    return rows;
  });
}

async function applyInquiry(page: Page, listingId: string) {
  await page.goto(`/memberships/${listingId}`);
  await page.getByLabel("희망 매수가(선택)").fill("410000000");
  await page.getByLabel("연락 가능 시간(선택)").fill("평일 오후 2~5시");
  await page.getByLabel("요청사항(선택)").fill("명의개서 일정 문의");
  await page.getByRole("button", { name: "상담 신청하기" }).click();
  await expect(page).toHaveURL(/\/deals\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("deal-status")).toHaveText("상담 접수");
  return page.url().split("/").pop()!;
}

test.describe("회원권 공개 화면", () => {
  test("비로그인: 매물 목록 필터 → 상세 → 로그인 안내", async ({ page }) => {
    const listing = await createListing();
    const man = listing.asking / 10_000;
    await page.goto(`/memberships?region=seoul_gyeonggi&min=${man}&max=${man}`);
    await expect(page.getByRole("heading", { name: "회원권 매물" })).toBeVisible();
    await expect(page.getByLabel("지역")).toHaveValue("seoul_gyeonggi");
    const card = page.locator(`a[href="/memberships/${listing.id}"]`);
    await expect(card).toBeVisible();
    await expect(card).toContainText("구골프 레이크CC");
    await expect(card).toContainText("정회원");
    await expect(card).toContainText(`${listing.asking.toLocaleString("ko-KR")}원`);

    // 다른 지역으로 거르면 보이지 않는다
    await page.goto(`/memberships?region=jeju&min=${man}&max=${man}`);
    await expect(page.getByText("조건에 맞는 매물이 없습니다")).toBeVisible();

    await page.goto(`/memberships?min=${man}&max=${man}`);
    await page.locator(`a[href="/memberships/${listing.id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/memberships/${listing.id}$`));
    await expect(page.getByRole("heading", { name: "구골프 레이크CC 정회원" })).toBeVisible();
    await expect(page.getByText(listing.description)).toBeVisible();
    await expect(page.getByRole("heading", { name: "시세 이력" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    const login = page.getByRole("link", { name: "로그인하고 상담 신청" });
    await expect(login).toHaveAttribute("href", `/login?next=${encodeURIComponent(`/memberships/${listing.id}`)}`);
    await expect(page.getByRole("button", { name: "상담 신청하기" })).toHaveCount(0);
  });

  test("시드 매물은 공개, 비공개·없는 매물은 404", async ({ page }) => {
    // 시드 001(호가 3억 1,800만 원, listed)·003(호가 1억 7,500만 원, hidden).
    // 다른 테스트가 남긴 매물이 목록 상한(60건)을 채워도 영향받지 않게 각 시드의 호가로만 거른다
    await page.goto("/memberships?min=31800&max=31800");
    await expect(page.locator('a[href="/memberships/00000000-0000-4000-c000-000000000001"]')).toBeVisible();
    await page.goto("/memberships?min=17500&max=17500");
    await expect(page.locator('a[href="/memberships/00000000-0000-4000-c000-000000000003"]')).toHaveCount(0);
    const seeded = await page.goto("/memberships/00000000-0000-4000-c000-000000000001");
    expect(seeded?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "구골프 레이크CC 정회원" })).toBeVisible();
    await expect(page.getByText("즉시 명의개서 가능")).toBeVisible();

    const seededHidden = await page.goto("/memberships/00000000-0000-4000-c000-000000000003");
    expect(seededHidden?.status()).toBe(404);

    const hidden = await createListing("hidden");
    const res = await page.goto(`/memberships/${hidden.id}`);
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "매물을 찾을 수 없습니다" })).toBeVisible();

    const missing = await page.goto("/memberships/00000000-0000-4000-c000-0000000000ff");
    expect(missing?.status()).toBe(404);
  });

  test("협의 중(reserved) 매물은 '상담 중' 배지만 있고 신청할 수 없다", async ({ page, context }) => {
    const reserved = await createListing("reserved");
    await loginAsCustomer(context, await createOnboardedCustomer());
    await page.goto(`/memberships?min=${reserved.asking / 10_000}&max=${reserved.asking / 10_000}`);
    await expect(page.locator(`a[href="/memberships/${reserved.id}"]`)).toContainText("상담 중");
    await page.goto(`/memberships/${reserved.id}`);
    await expect(page.getByText("다른 고객과 상담이 진행 중인 매물입니다", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "상담 신청하기" })).toHaveCount(0);
  });

  test("매도 상담은 로그인이 필요하다", async ({ page }) => {
    await page.goto("/memberships/sell");
    await expect(page).toHaveURL(/\/login\?next=%2Fmemberships%2Fsell$/);
  });

  test("내비에서 회원권으로 이동할 수 있다", async ({ page }) => {
    await page.goto("/groups");
    await page.getByRole("navigation", { name: "전체 메뉴" }).getByRole("link", { name: "회원권" }).click();
    await expect(page).toHaveURL(/\/memberships$/);
  });
});

test.describe("회원권 상담(고객)", () => {
  let customer: Customer;

  test.beforeEach(async ({ context }) => {
    customer = await createOnboardedCustomer();
    await loginAsCustomer(context, customer);
  });

  test("매수 상담 신청 → 내 거래 → 취소", async ({ page }) => {
    await page.goto("/deals");
    await expect(page.getByText("아직 상담 내역이 없습니다")).toBeVisible();

    const listing = await createListing();
    const id = await applyInquiry(page, listing.id);
    await expect(page.getByText("상담 신청이 접수되었습니다.")).toBeVisible();
    await expect(page.getByText("평일 오후 2~5시")).toBeVisible();
    await expect(page.locator('[aria-current="step"]')).toContainText("상담 접수");

    const [deal] = await dealsOf(customer.userId);
    expect(deal).toMatchObject({ id, side: "buy", status: "inquiry", desired_price: "410000000" });

    // 같은 매물 상세에서는 진행 중 상담으로 안내한다
    await page.goto(`/memberships/${listing.id}`);
    await expect(page.getByRole("button", { name: "상담 신청하기" })).toHaveCount(0);
    await page.getByRole("link", { name: "내 상담 보기" }).click();
    await expect(page).toHaveURL(new RegExp(`/deals/${id}$`));

    // 내비 → 내 거래 목록
    await page.getByRole("navigation", { name: "전체 메뉴" }).getByRole("link", { name: "내 거래" }).click();
    await expect(page).toHaveURL(/\/deals$/);
    await page.getByRole("link", { name: /상담 접수/ }).click();
    await expect(page).toHaveURL(new RegExp(`/deals/${id}$`));

    await page.getByRole("button", { name: "상담 취소" }).click();
    await page.getByLabel("취소 사유(선택)").fill("다른 매물로 결정");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "취소하기" }).click();
    await expect(page.getByTestId("deal-status")).toHaveText("취소됨");
    await expect(page.getByText("취소된 상담입니다")).toBeVisible();
    await expect(page.getByRole("button", { name: "상담 취소" })).toHaveCount(0);
    expect((await dealsOf(customer.userId))[0]).toMatchObject({ status: "cancelled", close_reason: "다른 매물로 결정" });
  });

  test("신청 버튼을 연달아 눌러도 1건만 생성된다", async ({ page }) => {
    const listing = await createListing();
    await page.goto(`/memberships/${listing.id}`);
    const submit = page.getByRole("button", { name: "상담 신청하기" });
    await expect(submit).toBeVisible();
    // 같은 폼(같은 멱등키)으로 두 번 제출. 내비에는 폼이 없어 상담 폼이 문서의 첫 번째 form이다
    await page.evaluate(() => {
      const form = document.querySelector("form")!;
      form.requestSubmit();
      form.requestSubmit();
    });
    await expect(page).toHaveURL(/\/deals\/[0-9a-f-]{36}$/);
    await expect(submit).toHaveCount(0);
    expect(await dealsOf(customer.userId)).toHaveLength(1);
  });

  test("매도 상담 신청", async ({ page }) => {
    await page.goto("/memberships/sell");
    await page.getByLabel("보유 회원권").selectOption(PRODUCT);
    await page.getByLabel("희망 매도가(선택)").fill("300000000");
    await expect(page.getByText("3억 원")).toBeVisible();
    await page.getByLabel("메모(선택)").fill("빠른 매도 희망");
    await page.getByRole("button", { name: "매도 상담 신청하기" }).click();
    await expect(page).toHaveURL(/\/deals\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("deal-status")).toHaveText("상담 접수");
    await expect(page.getByText(/매도 상담 · /)).toBeVisible();
    const [deal] = await dealsOf(customer.userId);
    expect(deal).toMatchObject({ side: "sell", status: "inquiry", desired_price: "300000000" });
  });

  test("다른 고객의 거래는 볼 수 없다", async ({ page, browser }) => {
    const listing = await createListing();
    const id = await applyInquiry(page, listing.id);
    const ctx = await browser.newContext();
    await loginAsCustomer(ctx, await createOnboardedCustomer());
    const p2 = await ctx.newPage();
    const res = await p2.goto(`/deals/${id}`);
    expect(res?.status()).toBe(404);
    await expect(p2.getByRole("heading", { name: "거래를 찾을 수 없습니다" })).toBeVisible();
    await ctx.close();
  });
});

test("연락처가 없는 고객은 연락처 입력 안내를 본다", async ({ page, context }) => {
  await loginAsCustomer(context, await createOnboardedCustomer({ withContact: false }));
  const listing = await createListing();
  await page.goto(`/memberships/${listing.id}`);
  await expect(page.getByTestId("contact-required")).toBeVisible();
  await expect(page.getByRole("button", { name: "상담 신청하기" })).toHaveCount(0);
  await page.goto("/memberships/sell");
  await expect(page.getByTestId("contact-required")).toBeVisible();
});
