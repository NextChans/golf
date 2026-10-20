/**
 * E2E 운영자 픽스처(테스트 전용, 로컬 DB에만 쓴다).
 * 운영에서 set_staff_role이 하는 일(app_metadata.role + profiles 행)을 Admin API와 DB로 재현한다.
 * profiles 행이 없으면 배정(assignee_id)·메모(author_id) FK가 깨진다.
 */
import { randomBytes } from "node:crypto";
import nextEnv from "@next/env";
import { expect, type Page } from "@playwright/test";
import { generate } from "otplib";
import { adminClient } from "./fixtures";
import { withDb } from "./customer";

export type Staff = { userId: string; email: string; password: string; displayName: string };

export async function createStaff(prefix: string, role: "admin" | "owner" = "admin"): Promise<Staff> {
  nextEnv.loadEnvConfig(process.cwd());
  const stamp = `${Date.now()}-${randomBytes(3).toString("hex")}`;
  const email = `e2e-${prefix}-${stamp}@test.local`;
  const password = `E2e-${prefix}-${randomBytes(4).toString("hex")}-pass`;
  const displayName = `E2E ${prefix} ${stamp.slice(-4)}`;
  const { data, error } = await adminClient().auth.admin.createUser({
    email, password, email_confirm: true, app_metadata: { role },
  });
  if (error) throw error;
  const userId = data.user.id;
  await withDb((db) =>
    db.query(`insert into public.profiles (id, display_name) values ($1, $2) on conflict (id) do nothing`, [userId, displayName]),
  );
  return { userId, email, password, displayName };
}

/** 로그인 → 최초 OTP 등록까지 마치고 운영자 홈에 도착한다. 같은 계정으로 두 번 부르지 않는다 */
export async function signInStaffWithNewTotp(page: Page, staff: Staff) {
  await page.goto("/admin/login");
  await page.getByLabel("이메일").fill(staff.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(staff.password);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/admin\/mfa$/);
  const secret = (await page.getByTestId("totp-secret").textContent())!.trim();
  await page.getByLabel("6자리 코드").fill(await generate({ secret }));
  await page.getByRole("button", { name: "확인" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
