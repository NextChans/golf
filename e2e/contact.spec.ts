import { expect, test } from "@playwright/test";
import { createOnboardedCustomer, loginAsCustomer } from "./customer";

// D-48: 휴대폰 인증을 생략하는 동안 연락처는 직접 입력받는다. 연락처 없이는 부킹 요청 불가.
test("연락처가 없으면 요청 전에 입력을 안내하고, 입력 후 요청 폼이 열린다", async ({ page, context }) => {
  await loginAsCustomer(context, await createOnboardedCustomer({ withContact: false }));

  await page.goto("/bookings/new");
  await expect(page.getByTestId("contact-required")).toBeVisible();
  await expect(page.getByRole("button", { name: "부킹 요청하기" })).toHaveCount(0);

  await page.getByRole("link", { name: "연락처 입력하기" }).click();
  await expect(page).toHaveURL(/\/me#contact$/);
  const input = page.getByLabel("연락처(휴대폰)");
  await input.fill("010-12");
  await expect(page.getByRole("button", { name: "저장" })).toBeDisabled();
  await input.fill("010-2345-6789");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByTestId("contact-phone")).toHaveText("010-2345-6789");

  await page.goto("/bookings/new");
  await expect(page.getByRole("button", { name: "부킹 요청하기" })).toBeVisible();
});

test("연락처는 내 정보에서 바꿀 수 있다", async ({ page, context }) => {
  await loginAsCustomer(context, await createOnboardedCustomer());
  await page.goto("/me");
  await page.getByRole("button", { name: "변경" }).click();
  await page.getByLabel("연락처(휴대폰)").fill("01098765432");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByTestId("contact-phone")).toHaveText("010-9876-5432");
});
