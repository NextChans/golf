import { expect, test, type Page } from "@playwright/test";
import nextEnv from "@next/env";
import pg from "pg";
import { createOnboardedCustomer, getBookingStatus, loginAsCustomer, seedProposal, type Customer } from "./customer";

// M3 고객 부킹(F-02, F-03). 운영자 제안은 픽스처(seedProposal)가 DB 함수로 만든다(어드민 UI는 M4).

async function countRequests(userId: string) {
  nextEnv.loadEnvConfig(process.cwd());
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres" });
  await db.connect();
  try {
    const { rows } = await db.query("select count(*)::int as n from public.booking_requests where user_id = $1", [userId]);
    return rows[0].n as number;
  } finally {
    await db.end();
  }
}

function kstDatePlus(days: number) {
  const d = new Date(Date.now() + 9 * 3600_000 + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

async function requestBooking(page: Page) {
  await page.goto("/bookings/new");
  await page.getByLabel("라운딩 날짜").fill(kstDatePlus(7));
  await expect(page.getByRole("radio", { name: /1부/ })).toBeChecked(); // 기본값
  await page.getByRole("button", { name: "4명" }).click();
  await page.getByLabel("1인 그린피 예산(선택)").fill("200000");
  await page.getByRole("button", { name: "부킹 요청하기" }).click();
  await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("booking-status")).toHaveText("접수");
  return page.url().split("/").pop()!;
}

test.describe("고객 부킹", () => {
  let customer: Customer;

  test.beforeEach(async ({ context }) => {
    customer = await createOnboardedCustomer();
    await loginAsCustomer(context, customer);
  });

  test("요청 생성 → 운영자 제안 → 수락 → 예약 확정", async ({ page }) => {
    await page.goto("/bookings");
    await expect(page.getByText("아직 요청한 예약이 없습니다")).toBeVisible();

    const id = await requestBooking(page);
    await expect(page.getByText("부킹 요청이 접수되었습니다.")).toBeVisible();

    await seedProposal(id, { greenFee: 180000, validMinutes: 120 });
    await page.reload();
    await expect(page.getByTestId("booking-status")).toHaveText("제안 도착");
    await expect(page.getByTestId("proposal-remaining")).toHaveText(/(1시간 59분|2시간 0분|1시간 58분) 남음/);
    await expect(page.getByText("총 720,000원")).toBeVisible();

    await page.getByRole("button", { name: "이 시간으로 확정" }).click();
    await expect(page.getByTestId("booking-status")).toHaveText("예약 확정");
    await expect(page.getByLabel("확정된 티타임")).toBeVisible();
    await expect(page.getByRole("button", { name: "요청 취소" })).toHaveCount(0);
    expect(await getBookingStatus(id)).toBe("confirmed");

    await page.goto("/bookings");
    await expect(page.getByRole("link", { name: /예약 확정/ })).toBeVisible();
  });

  test("제안 거절은 확인 중으로, 고객 취소는 취소됨으로", async ({ page }) => {
    const id = await requestBooking(page);
    await seedProposal(id);
    await page.reload();
    await page.getByRole("button", { name: "다른 시간 요청" }).click();
    await expect(page.getByTestId("booking-status")).toHaveText("확인 중");
    expect(await getBookingStatus(id)).toBe("in_review");

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "요청 취소" }).click();
    await expect(page.getByTestId("booking-status")).toHaveText("취소됨");
    expect(await getBookingStatus(id)).toBe("cancelled");
  });

  test("요청 버튼을 연달아 눌러도 1건만 생성된다", async ({ page }) => {
    await page.goto("/bookings/new");
    await page.getByLabel("라운딩 날짜").fill(kstDatePlus(10));
    const submit = page.getByRole("button", { name: "부킹 요청하기" });
    // 같은 폼(같은 멱등키)으로 두 번 제출
    await page.evaluate(() => {
      const form = document.querySelector("form")!;
      form.requestSubmit();
      form.requestSubmit();
    });
    await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}$/);
    await expect(submit).toHaveCount(0);
    expect(await countRequests(customer.userId)).toBe(1);
  });

  test("필수 입력 누락은 필드별 오류를 보여준다", async ({ page }) => {
    await page.goto("/bookings/new");
    await page.getByRole("button", { name: "부킹 요청하기" }).click();
    await expect(page.getByText("날짜를 선택해 주세요.")).toBeVisible();
    await expect(page).toHaveURL(/\/bookings\/new$/);
    expect(await countRequests(customer.userId)).toBe(0);
  });

  test("다른 고객의 예약은 볼 수 없다", async ({ page, browser }) => {
    const id = await requestBooking(page);
    const other = await createOnboardedCustomer();
    const ctx = await browser.newContext();
    await loginAsCustomer(ctx, other);
    const p2 = await ctx.newPage();
    const res = await p2.goto(`/bookings/${id}`);
    expect(res?.status()).toBe(404);
    await expect(p2.getByRole("heading", { name: "예약을 찾을 수 없습니다" })).toBeVisible();
    await ctx.close();
  });
});
