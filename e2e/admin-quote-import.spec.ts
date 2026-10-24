import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { withDb } from "./customer";
import { createStaff, signInStaffWithNewTotp } from "./staff";

const SEED_COURSE_ID = "00000000-0000-4000-a000-000000000001";
const SEED_COURSE_NAME = "구골프 레이크CC";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const kstDate = (daysAgo: number) => new Date(Date.now() + KST_OFFSET_MS - daysAgo * 86_400_000).toISOString().slice(0, 10);

test("운영자는 CSV로 시세를 일괄 반영하고, 오류 행이 있으면 반영할 수 없다", async ({ page }) => {
  // 같은 골프장에 같은 종류는 하나뿐이므로 실행마다 다른 종류의 상품을 DB에 직접 만든다
  const kind = `CSV ${Date.now()}-${randomBytes(3).toString("hex")}`;
  const productId = await withDb(async (db) => {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.membership_products (golf_course_id, kind, name) values ($1, $2, $3) returning id`,
      [SEED_COURSE_ID, kind, `${SEED_COURSE_NAME} ${kind} 회원권`],
    );
    return rows[0]!.id;
  });
  const [d1, d2] = [kstDate(1), kstDate(0)];
  const staff = await createStaff("quote-import");
  await signInStaffWithNewTotp(page, staff);

  await test.step("상품·시세 탭에서 일괄 입력 화면으로", async () => {
    await page.goto("/admin/memberships?tab=products");
    await page.getByRole("link", { name: "시세 일괄 입력" }).click();
    await expect(page).toHaveURL(/\/admin\/memberships\/quotes\/import$/);
    await expect(page.getByRole("heading", { name: "시세 일괄 입력" })).toBeVisible();
    await expect(page.getByRole("link", { name: "양식 내려받기" })).toHaveAttribute("href", /^data:text\/csv/);
  });

  await test.step("오류 행이 있으면 반영 버튼이 꺼지고 행에 오류가 보인다", async () => {
    await page.getByLabel("CSV 붙여넣기").fill(
      [
        "골프장,종류,기준일,매수시세,매도시세",
        `${SEED_COURSE_NAME},${kind},${d1},325000000,315000000`,
        `${SEED_COURSE_NAME},없는 종류 ${kind},${d2},1,1`,
      ].join("\n"),
    );
    await page.getByRole("button", { name: "미리보기" }).click();
    const table = page.getByRole("region", { name: "미리보기" }).getByRole("table");
    await expect(table.getByRole("row").filter({ hasText: "없는 종류" })).toContainText("상품을 찾을 수 없습니다(골프장·종류 확인)");
    await expect(page.getByTestId("quote-import-summary")).toContainText("오류 1행");
    await expect(page.getByRole("button", { name: "2건 반영" })).toBeDisabled();
  });

  await test.step("정상 2행을 미리보기 후 반영한다", async () => {
    await page.getByLabel("CSV 붙여넣기").fill(
      [
        "골프장,종류,기준일,매수시세,매도시세",
        `${SEED_COURSE_NAME},${kind},${d1},"325,000,000",315000000`,
        `${SEED_COURSE_NAME},${kind},${d2},,320000000원`,
      ].join("\r\n"),
    );
    // 내용을 고치면 이전 미리보기는 사라진다
    await expect(page.getByRole("region", { name: "미리보기" })).toHaveCount(0);
    await page.getByRole("button", { name: "미리보기" }).click();
    const rows = page.getByRole("region", { name: "미리보기" }).getByRole("table").getByRole("row");
    await expect(rows).toHaveCount(3); // 머리글 + 2행
    await expect(rows.nth(1)).toContainText("325,000,000원");
    await expect(rows.nth(1)).toContainText("OK");
    await expect(rows.nth(2)).toContainText("320,000,000원");
    await expect(rows.nth(2)).toContainText("OK");

    await page.getByRole("button", { name: "2건 반영" }).click();
    await expect(page.getByRole("status")).toHaveText("2건을 반영했습니다.");
    await expect(page.getByRole("link", { name: "상품·시세 목록 보기" })).toBeVisible();
  });

  await test.step("DB에 출처 csv로 저장되었다", async () => {
    const saved = await withDb(async (db) =>
      (await db.query<{ quoted_on: string; buy_price: string | null; sell_price: string | null; source: string }>(
        `select to_char(quoted_on, 'YYYY-MM-DD') as quoted_on, buy_price::text, sell_price::text, source
           from public.membership_quotes where product_id = $1 order by quoted_on`,
        [productId],
      )).rows,
    );
    const expected = [
      { quoted_on: d1, buy_price: "325000000", sell_price: "315000000", source: "csv" },
      { quoted_on: d2, buy_price: null, sell_price: "320000000", source: "csv" },
    ];
    expect(saved).toEqual(expected);
  });

  await test.step("상품·시세 목록에 최신 시세가 보인다", async () => {
    await page.getByRole("link", { name: "상품·시세 목록 보기" }).click();
    await expect(page).toHaveURL(/\/admin\/memberships\?tab=products$/);
    const item = page.getByRole("list", { name: "상품 목록" }).getByRole("listitem").filter({ hasText: kind });
    await expect(item).toContainText("매도 320,000,000원");
  });
});
