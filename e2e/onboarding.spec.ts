import { expect, test } from "@playwright/test";
import { createSignedUpCustomer, loginAsCustomer, withDb } from "./customer";

// D-82: 가입 2단계(정보 입력)와 3단계(환영 화면)는 회원권 앱 스타일. 환영 화면은 같은 페이지의 상태다.
test("가입 2단계에서 정보를 입력하면 환영 화면을 보고 회원권 홈으로 간다", async ({ page, context }) => {
  const kakaoName = `카카오${Date.now() % 10000}`;
  const customer = await createSignedUpCustomer({ kakaoName });
  await loginAsCustomer(context, customer);

  await page.goto("/onboarding?next=%2Fmarket%2Fmypage");
  await expect(page.getByRole("list", { name: "가입 단계 2/3" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /정보를 알려주세요/ })).toBeVisible();

  // 카카오 프로필 이름을 기본값으로 채운다(수정 가능)
  const nameInput = page.getByLabel("이름", { exact: true });
  await expect(nameInput).toHaveValue(kakaoName);
  const name = `E2E가입${Date.now() % 10000}`;
  await nameInput.fill(name);

  const submit = page.getByRole("button", { name: "가입 완료" });
  const contact = page.getByLabel("연락처(휴대폰)");
  await contact.fill("010-123-456");
  await expect(page.getByText("휴대폰 번호 형식을 확인해 주세요.")).toBeVisible();
  await contact.fill("010-3456-7890");
  // 필수 약관 미동의면 비활성
  await expect(submit).toBeDisabled();
  await page.getByRole("checkbox", { name: "전체 동의" }).click();
  await expect(submit).toBeEnabled();
  await page.getByRole("checkbox", { name: "전체 동의" }).click();
  await expect(submit).toBeDisabled();
  await page.getByRole("checkbox", { name: "전체 동의" }).click();
  await submit.click();

  // 3단계: 같은 페이지에서 환영 화면
  await expect(page.getByRole("heading", { name: `${name}님, 환영합니다!` })).toBeVisible();
  await expect(page.getByRole("list", { name: "가입 단계 3/3" })).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByRole("link", { name: /첫 거래 수수료 20% 할인 쿠폰/ })).toBeVisible();

  const saved = await withDb((db) =>
    db.query<{ display_name: string; phone: string; onboarded_at: Date | null }>(
      "select display_name, phone, onboarded_at from public.profiles where id = $1",
      [customer.userId],
    ),
  );
  expect(saved.rows[0]).toMatchObject({ display_name: name, phone: "+821034567890" });
  expect(saved.rows[0]?.onboarded_at).not.toBeNull();

  await page.getByRole("button", { name: "회원권 둘러보기" }).click();
  await expect(page).toHaveURL(/\/market\/mypage$/);

  // 온보딩이 끝난 뒤 /onboarding을 다시 열면 내 정보로 보낸다(환영 화면은 한 번만)
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/me$/);
});

test("다른 곳에서 가입을 시작했으면 회원권 둘러보기는 회원권 홈으로 간다", async ({ page, context }) => {
  await loginAsCustomer(context, await createSignedUpCustomer());
  await page.goto("/onboarding");
  // 카카오 이름이 없으면 비어 있다
  await expect(page.getByLabel("이름", { exact: true })).toHaveValue("");
  await page.getByLabel("이름", { exact: true }).fill("새고객");
  await page.getByLabel("연락처(휴대폰)").fill("01023456789");
  for (const box of await page.getByRole("checkbox", { name: /\[필수\]/ }).all()) await box.click();
  await page.getByRole("button", { name: "가입 완료" }).click();
  await expect(page.getByRole("heading", { name: "새고객님, 환영합니다!" })).toBeVisible();
  await page.getByRole("button", { name: "회원권 둘러보기" }).click();
  // 회원권 앱 홈은 루트(D-87)
  await expect(page).toHaveURL(/^http:\/\/localhost:3000\/$/);
});
