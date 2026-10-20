import { expect, test } from "@playwright/test";
import { createOnboardedCustomer, loginAsCustomer } from "./customer";
test("nav width", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  const anon = await page.evaluate(() => [document.documentElement.scrollWidth, document.querySelector('nav[aria-label="전체 메뉴"]')!.scrollWidth]);
  await loginAsCustomer(context, await createOnboardedCustomer());
  await page.goto("/groups");
  const inn = await page.evaluate(() => [document.documentElement.scrollWidth, document.querySelector('nav[aria-label="전체 메뉴"]')!.scrollWidth]);
  await page.screenshot({ path: process.env.SHOT!, clip: { x: 0, y: 0, width: 390, height: 120 } });
  console.log("WIDTHS", JSON.stringify({ anon, inn }));
  expect(inn[0]).toBeLessThanOrEqual(390);
});
