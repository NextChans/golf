import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createOnboardedCustomer, withDb } from "./customer";
import { createStaff, signInStaffWithNewTotp } from "./staff";

/** 고객 JWT claim으로 DB 함수를 부른다(운영에서 브라우저 → Server Action → rpc가 하는 일과 같은 권한 경로) */
async function asCustomer<T extends Record<string, unknown>>(userId: string, sql: string, params: unknown[]): Promise<T[]> {
  return withDb(async (db) => {
    await db.query("begin");
    try {
      const claims = JSON.stringify({ sub: userId, role: "authenticated", aal: "aal1", app_metadata: { role: "customer", onboarded: true } });
      await db.query("select set_config('request.jwt.claims', $1, true)", [claims]);
      await db.query("set local role authenticated");
      const { rows } = await db.query<T>(sql, params);
      await db.query("commit");
      return rows;
    } catch (err) {
      await db.query("rollback");
      throw err;
    }
  });
}

const createGroup = async (ownerId: string, name: string) =>
  (await asCustomer<{ id: string; status: string }>(ownerId,
    `select id, status::text as status from public.create_group(gen_random_uuid(), $1, 'round', 'seoul_gyeonggi',
       '주말 아침 수도권 라운딩을 함께 다니는 모임입니다.', 'open', 100, null)`, [name]))[0]!;

const groupRow = (id: string) =>
  withDb(async (db) => (await db.query<{ status: string; status_reason: string | null }>(
    "select status::text as status, status_reason from public.groups where id = $1", [id])).rows[0]!);

const stamp = () => `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;

test("금칙어 모임은 검수 대기 → 운영자 공개 승인 → 비공개(사유) → 복구", async ({ page }) => {
  const [owner, staff] = await Promise.all([createOnboardedCustomer(), createStaff("community")]);
  const name = `E2E 소개팅 골프 ${stamp()}`;
  const group = await createGroup(owner.userId, name);
  expect(group.status).toBe("review");
  page.on("dialog", (d) => d.accept());

  await signInStaffWithNewTotp(page, staff);
  await expect(page.getByRole("link", { name: /커뮤니티 신고 \d+건, 검수 대기 \d+건/ })).toBeVisible();
  await page.getByRole("link", { name: "커뮤니티", exact: true }).click();
  await expect(page.getByRole("heading", { name: "커뮤니티 관리" })).toBeVisible();
  await page.getByRole("navigation", { name: "커뮤니티 탭" }).getByRole("link", { name: /검수 대기/ }).click();

  const reviewRow = page.getByRole("list", { name: "검수 대기 모임 목록" }).getByRole("listitem").filter({ hasText: name });
  await expect(reviewRow).toContainText("금칙어 자동 보류");
  await expect(reviewRow).toContainText(owner.displayName);
  await expect(reviewRow).toContainText("지역 라운딩");
  await reviewRow.getByRole("button", { name: "공개 승인" }).click();
  await expect(reviewRow).toHaveCount(0);
  expect(await groupRow(group.id)).toEqual({ status: "active", status_reason: null });

  await page.getByRole("navigation", { name: "커뮤니티 탭" }).getByRole("link", { name: "모임 전체" }).click();
  const row = page.getByRole("list", { name: "모임 목록" }).getByRole("listitem").filter({ hasText: name });
  await expect(row).toContainText("공개");
  await row.getByRole("button", { name: "비공개", exact: true }).click();
  await row.getByLabel("비공개 사유").fill("골프와 무관한 모임으로 확인");
  await row.getByRole("button", { name: "비공개 처리" }).click();
  await expect(row).toContainText("사유: 골프와 무관한 모임으로 확인");
  expect(await groupRow(group.id)).toEqual({ status: "hidden", status_reason: "골프와 무관한 모임으로 확인" });

  await row.getByRole("button", { name: "복구" }).click();
  await expect(row.getByRole("button", { name: "비공개", exact: true })).toBeVisible();
  expect((await groupRow(group.id)).status).toBe("active");
});

test("게시글 신고 3건이면 자동 숨김 → 운영자 복구 → 신고 처리 완료", async ({ page }) => {
  const [owner, staff, ...reporters] = await Promise.all([
    createOnboardedCustomer(), createStaff("community-post"),
    createOnboardedCustomer(), createOnboardedCustomer(), createOnboardedCustomer(),
  ]);
  const group = await createGroup(owner.userId, `E2E 주말 라운딩 ${stamp()}`);
  expect(group.status).toBe("active");
  const title = `E2E 신고 대상 글 ${stamp()}`;
  const [post] = await asCustomer<{ id: string }>(owner.userId,
    "select id from public.create_post($1, $2, '이번 주 라운딩 후기입니다.', false)", [group.id, title]);
  for (const r of reporters) {
    await asCustomer(r.userId, "select 1 from public.join_group($1, null)", [group.id]);
    await asCustomer(r.userId, "select 1 from public.report_content('post', $1, 'spam', '광고 글입니다')", [post!.id]);
  }
  const postStatus = () =>
    withDb(async (db) => (await db.query<{ status: string }>("select status from public.group_posts where id = $1", [post!.id])).rows[0]!.status);
  expect(await postStatus()).toBe("hidden");
  page.on("dialog", (d) => d.accept());

  await signInStaffWithNewTotp(page, staff);
  await page.goto("/admin/community");
  const rows = page.getByRole("list", { name: "신고 목록" }).getByRole("listitem").filter({ hasText: title });
  await expect(rows).toHaveCount(3);
  const first = rows.first();
  await expect(first).toContainText("광고·도배");
  await expect(first).toContainText("같은 대상 열린 신고 3건");
  await expect(first).toContainText("숨김");
  await expect(first).not.toContainText(/010-/);

  await first.getByRole("button", { name: "게시글 복구" }).click();
  await expect(first.getByRole("button", { name: "게시글 숨기기" })).toBeVisible();
  expect(await postStatus()).toBe("active");

  await first.getByRole("button", { name: "처리 완료" }).click();
  await expect(rows).toHaveCount(0);
  const statuses = await withDb(async (db) => (await db.query<{ status: string }>(
    "select status::text as status from public.community_reports where target_id = $1", [post!.id])).rows.map((r) => r.status));
  expect(statuses).toEqual(["resolved", "resolved", "resolved"]);
});
