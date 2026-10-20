import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createStaff, signInStaffWithNewTotp } from "./staff";

const stamp = `${Date.now()}-${randomBytes(3).toString("hex")}`;

test("운영자는 골프장을 추가·수정하고 중복 이름은 거부된다", async ({ page }) => {
  const name = `E2E 골프장 ${stamp}`;
  // 이 테스트 전용 운영자(admin) 계정. 다른 spec과 상태를 공유하지 않는다.
  const staff = await createStaff("courses");
  await signInStaffWithNewTotp(page, staff);

  await test.step("골프장 추가", async () => {
    await page.goto("/admin/courses");
    await expect(page.getByRole("heading", { name: "골프장 관리" })).toBeVisible();
    await page.getByRole("link", { name: "골프장 추가" }).first().click();
    await expect(page).toHaveURL(/\/admin\/courses\/new$/);

    await page.getByLabel("이름").fill(name);
    await page.getByLabel("지역").selectOption("jeju");
    await page.getByLabel("주소").fill("제주특별자치도 서귀포시");
    await page.getByLabel("주중 그린피").fill("180,000");
    await page.getByLabel("주말 그린피").fill("230000");
    await page.getByLabel("연락처").fill("064-000-0000");
    await page.getByLabel("취소 규정").fill("라운딩 3일 전까지 무료 취소");
    await expect(page.getByLabel("운영 중")).toBeChecked();
    await page.getByRole("button", { name: "저장" }).click();

    await expect(page).toHaveURL(/\/admin\/courses$/);
    const row = page.getByRole("link", { name: new RegExp(name) });
    await expect(row).toContainText("제주");
    await expect(row).toContainText("주중 180,000원");
    await expect(row).toContainText("주말 230,000원");
    await expect(row).toContainText("운영");
  });

  await test.step("주중 그린피 수정", async () => {
    await page.getByRole("link", { name: new RegExp(name) }).click();
    await expect(page.getByRole("heading", { name: "골프장 수정" })).toBeVisible();
    await expect(page.getByLabel("이름")).toHaveValue(name);
    await expect(page.getByLabel("주중 그린피")).toHaveValue("180,000");
    await page.getByLabel("주중 그린피").fill("150,000");
    await page.getByRole("button", { name: "저장" }).click();

    await expect(page).toHaveURL(/\/admin\/courses$/);
    await expect(page.getByRole("link", { name: new RegExp(name) })).toContainText("주중 150,000원");
  });

  await test.step("같은 이름은 거부", async () => {
    await page.goto("/admin/courses/new");
    await page.getByLabel("이름").fill(name);
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("같은 이름이 이미 등록되어 있습니다.");
    // 검증 실패 후에도 입력값이 남아 있다
    await expect(page.getByLabel("이름")).toHaveValue(name);
    await expect(page).toHaveURL(/\/admin\/courses\/new$/);
  });

  await test.step("없는 골프장은 404", async () => {
    const res = await page.goto("/admin/courses/00000000-0000-4000-8000-000000000000");
    expect(res?.status()).toBe(404);
  });
});
