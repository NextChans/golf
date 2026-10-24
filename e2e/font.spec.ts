import { expect, test, type Page } from "@playwright/test";
import { createSignedUpCustomer, loginAsCustomer } from "./customer";

// D-86: 회원권 앱(/market/**, 앱 홈인 루트 / — D-87)과 가입 화면은 서버에 담은 Pretendard Variable, 기존 apple 스타일 화면은 그대로.
const APP_FONT = /^"?Pretendard Variable"?/;

const fontFamily = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => getComputedStyle(el).fontFamily);

/** 페이지가 요청한 Pretendard 파일과 폰트 외 외부 요청을 모은다 */
function trackFonts(page: Page) {
  const fonts: { url: string; status: number; bytes: number }[] = [];
  const external: string[] = [];
  page.on("response", async (res) => {
    const url = res.url();
    if (!url.startsWith("http://localhost:3000")) external.push(url);
    if (url.includes("/fonts/pretendard/")) {
      const body = await res.body().catch(() => Buffer.alloc(0));
      fonts.push({ url, status: res.status(), bytes: body.length });
    }
  });
  page.on("request", (req) => {
    if (!req.url().startsWith("http://localhost:3000") && !req.url().startsWith("data:")) external.push(req.url());
  });
  return { fonts, external };
}

async function fontsReady(page: Page) {
  await page.evaluate(() => document.fonts.ready);
}

test.describe("앱 폰트(Pretendard 셀프호스팅)", () => {
  test("/(앱 홈): 앱 루트·탭 바·팝업이 Pretendard이고, 파일은 같은 서버에서 200으로 필요한 조각만 온다", async ({ page }) => {
    const { fonts, external } = trackFonts(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByRole("dialog", { name: "거래 수수료 기준이 바뀝니다" })).toBeVisible();
    await fontsReady(page);

    expect(await fontFamily(page, "main, h1")).toMatch(APP_FONT);
    // 고정 오버레이(팝업)와 탭 바도 같은 폰트
    expect(await fontFamily(page, '[role="dialog"]')).toMatch(APP_FONT);
    expect(await fontFamily(page, 'nav[aria-label="앱 메뉴"]')).toMatch(APP_FONT);
    expect(await fontFamily(page, 'nav[aria-label="앱 메뉴"] a')).toMatch(APP_FONT);
    // 버튼·입력도 상속(Tailwind preflight)
    expect(await fontFamily(page, '[role="dialog"] button')).toMatch(APP_FONT);

    expect(await page.evaluate(() => document.fonts.check('16px "Pretendard Variable"'))).toBe(true);

    expect(fonts.length).toBeGreaterThan(0);
    for (const f of fonts) {
      expect(f.status, f.url).toBe(200);
      expect(f.url).toMatch(/\/fonts\/pretendard\/PretendardVariable\.subset\.\d+\.woff2$/);
    }
    // 92개 조각 중 첫 화면에 필요한 것만
    const total = fonts.reduce((s, f) => s + f.bytes, 0);
    console.log(`[font] / woff2 요청 ${fonts.length}개, 합계 ${total} bytes`);
    expect(fonts.length).toBeLessThanOrEqual(15);
    expect(external, "외부 요청 없음").toEqual([]);
  });

  test("기존 apple 스타일 화면(/memberships)은 기존 폰트를 유지하고 Pretendard를 받지 않는다", async ({ page }) => {
    const { fonts } = trackFonts(page);
    await page.goto("/memberships", { waitUntil: "networkidle" });
    await fontsReady(page);
    expect(await fontFamily(page, "body")).not.toMatch(APP_FONT); // 기존 스택에는 시스템 폰트용 이름이 뒤쪽에 있을 뿐 파일은 받지 않는다
    expect(await fontFamily(page, "h1")).not.toMatch(APP_FONT);
    expect(fonts).toEqual([]);
  });

  test("상세 화면: 하단 CTA·떠 있는 버튼·계산기도 Pretendard", async ({ page }) => {
    await page.goto("/market/items/m01", { waitUntil: "networkidle" });
    await fontsReady(page);
    expect(await fontFamily(page, "h1")).toMatch(APP_FONT);
    expect(await fontFamily(page, "a[href='/memberships']")).toMatch(APP_FONT);
    expect(await fontFamily(page, "a[href='/market/mypage/support']")).toMatch(APP_FONT);
    expect(await fontFamily(page, "#calc input")).toMatch(APP_FONT);
  });

  test("로그인 화면과 환영 화면(/market/welcome)", async ({ page }) => {
    await page.goto("/market/login", { waitUntil: "networkidle" });
    expect(await fontFamily(page, "h1")).toMatch(APP_FONT);
    await page.goto("/market/welcome", { waitUntil: "networkidle" });
    expect(await fontFamily(page, "h1")).toMatch(APP_FONT);
  });

  test("가입 2단계(/onboarding): 로그인 고객 화면도 Pretendard, 글자 조각은 같은 서버에서", async ({ page, context }) => {
    const customer = await createSignedUpCustomer({ kakaoName: "폰트확인" });
    await loginAsCustomer(context, customer);
    const { fonts } = trackFonts(page);
    await page.goto("/onboarding", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /정보를 알려주세요/ })).toBeVisible();
    await fontsReady(page);
    expect(await fontFamily(page, "h2")).toMatch(APP_FONT);
    expect(await fontFamily(page, "input")).toMatch(APP_FONT);
    expect(await page.evaluate(() => document.fonts.check('16px "Pretendard Variable"'))).toBe(true);
    expect(fonts.length).toBeGreaterThan(0);
    expect(fonts.every((f) => f.status === 200)).toBe(true);
  });
});
