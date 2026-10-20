import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createStaff, signInStaffWithNewTotp } from "./staff";

const stamp = `${Date.now()}-${randomBytes(3).toString("hex")}`;
const SEED_COURSE_ID = "00000000-0000-4000-a000-000000000001";
const SEED_COURSE_NAME = "구골프 레이크CC";

test("운영자는 회원권 상품·시세·매물을 등록하고 공개 전환·호가 수정을 한다", async ({ page }) => {
  // 같은 골프장에 같은 종류는 하나뿐이므로 실행마다 다른 종류를 쓴다
  const kind = `E2E ${stamp}`;
  const productName = `${SEED_COURSE_NAME} ${kind} 회원권`;
  // 이 테스트 전용 운영자(admin) 계정. 다른 spec과 상태를 공유하지 않는다.
  const staff = await createStaff("memberships");
  await signInStaffWithNewTotp(page, staff);

  await test.step("상품 추가", async () => {
    await page.goto("/admin/memberships");
    await expect(page.getByRole("heading", { name: "매물·시세 관리" })).toBeVisible();
    await page.getByRole("link", { name: "상품 추가" }).first().click();
    await expect(page).toHaveURL(/\/admin\/memberships\/products\/new$/);

    await page.getByLabel("골프장", { exact: true }).selectOption(SEED_COURSE_ID);
    await page.getByLabel("종류", { exact: true }).fill(kind);
    await page.getByLabel("상품명", { exact: true }).fill(productName);
    await expect(page.getByLabel("판매 중")).toBeChecked();
    await page.getByRole("button", { name: "저장" }).click();

    // 새 상품은 시세를 바로 입력할 수 있게 상품 화면으로 간다
    await expect(page).toHaveURL(/\/admin\/memberships\/products\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "회원권 상품 수정" })).toBeVisible();
    await expect(page.getByLabel("상품명", { exact: true })).toHaveValue(productName);
  });

  await test.step("시세 입력", async () => {
    await expect(page.getByText("아직 입력된 시세가 없습니다.")).toBeVisible();
    // 기준일 기본값은 오늘(KST)
    await expect(page.getByLabel("기준일")).not.toHaveValue("");
    await page.getByLabel("매수 시세").fill("180,000,000");
    await page.getByLabel("매도 시세").fill("175000000");
    await page.getByRole("button", { name: "시세 저장" }).click();
    await expect(page.getByRole("status")).toHaveText("시세를 저장했습니다.");
    const table = page.getByRole("table");
    await expect(table).toContainText("180,000,000원");
    await expect(table).toContainText("175,000,000원");
    // 저장 후 폼은 비워진다
    await expect(page.getByLabel("매수 시세")).toHaveValue("");
  });

  await test.step("같은 골프장·종류는 거부", async () => {
    await page.goto("/admin/memberships/products/new");
    await page.getByLabel("골프장", { exact: true }).selectOption(SEED_COURSE_ID);
    await page.getByLabel("종류", { exact: true }).fill(kind);
    await page.getByLabel("상품명", { exact: true }).fill(`${productName} 중복`);
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("같은 이름이 이미 등록되어 있습니다.");
    // 검증 실패 후에도 입력값이 남아 있다
    await expect(page.getByLabel("종류", { exact: true })).toHaveValue(kind);
    await expect(page).toHaveURL(/\/admin\/memberships\/products\/new$/);
  });

  let listingUrl = "";
  await test.step("매물 등록(비공개로 시작)", async () => {
    await page.goto("/admin/memberships");
    await page.getByRole("link", { name: "매물 등록" }).first().click();
    await expect(page).toHaveURL(/\/admin\/memberships\/listings\/new$/);
    await page.getByLabel("상품", { exact: true }).selectOption({ label: `${SEED_COURSE_NAME} ${kind} — ${productName}` });
    await page.getByLabel("호가", { exact: true }).fill("200,000,000");
    await page.getByLabel("설명", { exact: true }).fill("E2E 매물 설명");
    await page.getByRole("button", { name: "저장" }).click();

    await expect(page).toHaveURL(/\/admin\/memberships\/listings\/[0-9a-f-]{36}$/);
    listingUrl = page.url();
    await expect(page.getByTestId("listing-status")).toHaveText("비공개");
    await expect(page.getByLabel("호가", { exact: true })).toHaveValue("200,000,000");
    await expect(page.getByText("아직 접수된 상담이 없습니다.")).toBeVisible();
  });

  const row = () => page.getByRole("list", { name: "매물 목록" }).getByRole("listitem").filter({ hasText: kind });

  await test.step("목록에서 공개 전환", async () => {
    await page.goto("/admin/memberships");
    await expect(row()).toContainText("호가 200,000,000원");
    await expect(row().getByText("비공개", { exact: true })).toBeVisible();
    await row().getByRole("button", { name: /공개하기/ }).click();
    await expect(row().getByText("공개", { exact: true })).toBeVisible();
    await expect(row().getByRole("button", { name: /비공개로 전환/ })).toBeVisible();
  });

  await test.step("호가 수정", async () => {
    await row().getByRole("link").click();
    await expect(page).toHaveURL(listingUrl);
    await expect(page.getByTestId("listing-status")).toHaveText("공개");
    await page.getByLabel("호가", { exact: true }).fill("190,000,000");
    await page.getByRole("button", { name: "저장" }).click();

    await expect(page).toHaveURL(/\/admin\/memberships$/);
    await expect(row()).toContainText("호가 190,000,000원");
    await expect(row().getByText("공개", { exact: true })).toBeVisible();
  });

  await test.step("상품 탭에 최신 시세", async () => {
    await page.getByRole("link", { name: "상품·시세" }).click();
    await expect(page).toHaveURL(/tab=products$/);
    const productRow = page.getByRole("list", { name: "상품 목록" }).getByRole("link").filter({ hasText: kind });
    await expect(productRow).toContainText("판매 중");
    await expect(productRow).toContainText("매수 180,000,000원");
    await expect(productRow).toContainText("매도 175,000,000원");
  });

  await test.step("없는 매물·상품은 404", async () => {
    expect((await page.goto("/admin/memberships/listings/00000000-0000-4000-8000-000000000000"))?.status()).toBe(404);
    expect((await page.goto("/admin/memberships/products/00000000-0000-4000-8000-000000000000"))?.status()).toBe(404);
  });
});
