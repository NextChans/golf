import { expect, test, type Page } from "@playwright/test";
import { generate } from "otplib";
import { users } from "./users";

async function adminLogin(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
}

/** 직전 코드와 겹치지 않도록 다음 30초 구간까지 기다렸다가 TOTP를 만든다 */
async function freshTotp(secret: string, previous?: string) {
  let code = await generate({ secret });
  while (code === previous) {
    await new Promise((r) => setTimeout(r, 1000));
    code = await generate({ secret });
  }
  return code;
}

test.describe("접근 제어", () => {
  test("미인증 사용자의 /admin 접근은 운영자 로그인으로 보낸다", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin$/);
    await expect(page.getByRole("heading", { name: "운영자 로그인" })).toBeVisible();
  });

  test("미인증 사용자의 고객 전용 경로는 로그인으로 보낸다", async ({ page }) => {
    await page.goto("/me");
    await expect(page).toHaveURL(/\/login\?next=%2Fme$/);
    await expect(page.getByRole("button", { name: "카카오로 시작하기" })).toBeVisible();
  });

  test("고객 role은 /admin에 접근할 수 없다(403)", async ({ page }) => {
    const { customer } = users();
    await adminLogin(page, customer.email, customer.password);
    await expect(page.getByRole("heading", { name: "접근 권한이 없습니다" })).toBeVisible();
    const res = await page.goto("/admin/staff");
    expect(res?.status()).toBe(403);
    await expect(page.getByRole("heading", { name: "접근 권한이 없습니다" })).toBeVisible();
  });

  test("잘못된 비밀번호는 같은 메시지로 거부한다", async ({ page }) => {
    await adminLogin(page, "nobody@test.local", "wrong-password-1");
    await expect(page.locator("form").getByRole("alert")).toHaveText("이메일 또는 비밀번호가 올바르지 않습니다.");
  });
});

test.describe.serial("운영자 최초 로그인 → 비밀번호 변경 → OTP 등록", () => {
  let secret = "";
  let lastCode = "";

  test("임시 비밀번호 로그인 후 비밀번호 변경과 OTP 등록을 강제한다", async ({ page }) => {
    const { owner } = users();
    await adminLogin(page, owner.email, owner.password);

    await expect(page).toHaveURL(/\/admin\/password$/);
    // 비밀번호 변경 전에는 다른 운영자 화면으로 갈 수 없다
    await page.goto("/admin/staff");
    await expect(page).toHaveURL(/\/admin\/password$/);

    await page.getByLabel("새 비밀번호", { exact: true }).fill(owner.newPassword);
    await page.getByLabel("새 비밀번호 확인").fill(owner.newPassword);
    await page.getByRole("button", { name: "비밀번호 변경" }).click();

    await expect(page).toHaveURL(/\/admin\/mfa$/);
    // OTP 전에는 콘솔 접근 불가
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/mfa$/);

    secret = (await page.getByTestId("totp-secret").textContent())!.trim();
    lastCode = await freshTotp(secret);
    await page.getByLabel("6자리 코드").fill(lastCode);
    await page.getByRole("button", { name: "확인" }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "운영자 홈" })).toBeVisible();
  });

  test("owner는 운영자 계정을 발급할 수 있다", async ({ page }) => {
    const { owner } = users();
    await adminLogin(page, owner.email, owner.newPassword);
    await expect(page).toHaveURL(/\/admin\/mfa$/);
    lastCode = await freshTotp(secret, lastCode);
    await page.getByLabel("6자리 코드").fill(lastCode);
    await page.getByRole("button", { name: "확인" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.getByRole("link", { name: "운영자 관리" }).click();
    await page.getByLabel("이메일").fill(`e2e-staff-${Date.now()}@test.local`);
    await page.getByRole("button", { name: "계정 발급" }).click();
    await expect(page.getByTestId("temp-password")).toHaveText(/^Gg.{20,}7$/);
    await expect(page.getByText("OTP 미등록").first()).toBeVisible();
  });

  test("다시 로그인하면 OTP 검증만 요구한다(aal1 → aal2)", async ({ page }) => {
    const { owner } = users();
    await adminLogin(page, owner.email, owner.newPassword);
    await expect(page).toHaveURL(/\/admin\/mfa$/);
    await expect(page.getByTestId("totp-secret")).toHaveCount(0);
    await page.getByLabel("6자리 코드").fill("000000");
    await page.getByRole("button", { name: "확인" }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText("코드가 올바르지 않습니다");
  });
});
