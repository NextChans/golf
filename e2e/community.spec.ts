import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createOnboardedCustomer, loginAsCustomer, type Customer } from "./customer";

// M7 골프 모임 커뮤니티(고객 화면). 다른 테스트·이전 실행이 남긴 모임과 섞이지 않게 이름에 난수를 붙이고,
// 고객은 테스트마다 새로 만든다(모임 개설 3개·가입 10개 제한과 무관하게).

const tag = () => randomBytes(3).toString("hex");

/** KST 기준 n일 뒤 hh:mm의 datetime-local 값 */
function kstLocalPlus(days: number, hhmm: string): string {
  const d = new Date(Date.now() + 9 * 3600_000 + days * 86_400_000);
  return `${d.toISOString().slice(0, 10)}T${hhmm}`;
}

async function pageAs(browser: Browser, c: Customer): Promise<Page> {
  const ctx = await browser.newContext();
  await loginAsCustomer(ctx, c);
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  return page;
}

async function createGroup(page: Page, opts: {
  name: string; type?: string; region?: string; policy?: "바로 가입" | "승인 후 가입"; description?: string;
}): Promise<string> {
  await page.goto("/groups/new");
  await page.getByLabel("모임 이름").fill(opts.name);
  await page.getByText(opts.type ?? "지역 라운딩", { exact: true }).click();
  await page.getByLabel("활동 지역").selectOption(opts.region ?? "seoul_gyeonggi");
  await page.getByLabel("모임 소개").fill(opts.description ?? "주말마다 수도권 골프장에서 함께 라운딩합니다.");
  if (opts.policy) await page.getByText(opts.policy, { exact: true }).click();
  await page.getByRole("button", { name: "모임 만들기" }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: opts.name })).toBeVisible();
  return page.url().split("/").pop()!;
}

test.describe("골프 모임", () => {
  test("승인제 모임: 가입 신청 → 승인 → 정모 정원 마감 → 공지 → 신고 → 강퇴", async ({ browser }) => {
    test.setTimeout(150_000);
    const [a, b, c] = await Promise.all([createOnboardedCustomer(), createOnboardedCustomer(), createOnboardedCustomer()]);
    const [pa, pb, pc] = await Promise.all([pageAs(browser, a), pageAs(browser, b), pageAs(browser, c)]);

    const name = `E2E 주말 라운딩 ${tag()}`;
    const groupId = await createGroup(pa, { name });
    const url = `/groups/${groupId}`;
    await expect(pa.getByText("승인 후 가입", { exact: false }).first()).toBeVisible();
    await expect(pa.getByRole("heading", { name: "게시판" })).toBeVisible();

    // B·C 가입 신청(승인제). 비멤버는 게시판을 보지 못한다
    for (const [p, msg] of [[pb, "안녕하세요 구력 3년입니다"], [pc, "주말 라운딩 희망합니다"]] as const) {
      await p.goto(url);
      await expect(p.getByRole("heading", { name: "게시판" })).toHaveCount(0);
      await p.getByLabel("인사말(선택)").fill(msg);
      await p.getByRole("button", { name: "가입 신청" }).click();
      await expect(p.getByTestId("join-status")).toHaveText("승인 대기 중");
    }

    // A가 두 사람을 승인
    await pa.reload();
    const requests = pa.getByRole("region", { name: "가입 신청" });
    await expect(requests.getByText("안녕하세요 구력 3년입니다")).toBeVisible();
    for (const who of [b, c]) {
      await requests.getByRole("listitem", { name: `가입 신청 ${who.displayName}` }).getByRole("button", { name: "승인" }).click();
      await expect(pa.getByRole("listitem", { name: `멤버 ${who.displayName}` })).toBeVisible();
    }
    await expect(pa.getByRole("heading", { name: "멤버 3명" })).toBeVisible();

    await pb.reload();
    await expect(pb.getByRole("heading", { name: "게시판" })).toBeVisible();
    // 일반 멤버에게는 정모 만들기·공지 체크박스가 없다
    await expect(pb.getByRole("link", { name: "정모 만들기" })).toHaveCount(0);
    await expect(pb.getByLabel("공지로 올리기")).toHaveCount(0);

    // A가 정원 2명 정모를 만든다(만든 사람 자동 참석)
    await pa.getByRole("link", { name: "정모 만들기" }).click();
    await expect(pa).toHaveURL(new RegExp(`/groups/${groupId}/meetings/new$`));
    const meetingTitle = `스크린 번개 ${tag()}`;
    await pa.getByLabel("정모 이름").fill(meetingTitle);
    await pa.getByLabel("일시").fill(kstLocalPlus(3, "19:30"));
    await pa.getByText("직접 입력", { exact: true }).click();
    await pa.getByLabel("장소(스크린·연습장 등)").fill("역삼역 스크린골프");
    await pa.getByLabel("정원").fill("2");
    await pa.getByLabel("1인 회비(선택)").fill("25000");
    await pa.getByRole("button", { name: "정모 만들기" }).click();
    await expect(pa).toHaveURL(new RegExp(`/groups/${groupId}#meetings$`));
    const meetingA = pa.getByRole("listitem", { name: `정모 ${meetingTitle}` });
    await expect(meetingA.getByTestId("meeting-count")).toHaveText("참석 1/2명");
    await expect(meetingA).toContainText("역삼역 스크린골프");
    await expect(meetingA).toContainText("1인 25,000원(현장 정산)");
    await expect(meetingA).toContainText(a.displayName);

    // B 참석 → 마감
    await pb.reload();
    const meetingB = pb.getByRole("listitem", { name: `정모 ${meetingTitle}` });
    await meetingB.getByRole("button", { name: "참석", exact: true }).click();
    await expect(meetingB.getByTestId("meeting-count")).toHaveText("참석 2/2명");
    await expect(meetingB.getByRole("button", { name: "참석 취소" })).toBeVisible();
    await expect(meetingB).toContainText(`참석자: ${a.displayName}, ${b.displayName}`);

    await pc.goto(url);
    const meetingC = pc.getByRole("listitem", { name: `정모 ${meetingTitle}` });
    await expect(meetingC.getByRole("button", { name: "마감" })).toBeDisabled();

    // B가 일반 글, A가 공지 → 공지가 고정되어 맨 위
    const normalTitle = `라운딩 후기 ${tag()}`;
    await pb.getByLabel("제목", { exact: true }).fill(normalTitle);
    await pb.getByLabel("내용", { exact: true }).fill("지난주 라운딩 즐거웠습니다.");
    await pb.getByRole("button", { name: "글 올리기" }).click();
    await expect(pb.getByRole("listitem", { name: `게시글 ${normalTitle}` })).toBeVisible();

    const noticeTitle = `11월 정모 안내 ${tag()}`;
    await pa.reload();
    await pa.getByLabel("제목", { exact: true }).fill(noticeTitle);
    await pa.getByLabel("내용", { exact: true }).fill("11월 정모는 둘째 주 토요일입니다.");
    await pa.getByLabel("공지로 올리기").check();
    await pa.getByRole("button", { name: "글 올리기" }).click();
    const noticeA = pa.getByRole("listitem", { name: `게시글 ${noticeTitle}` });
    await expect(noticeA.getByText("공지", { exact: true })).toBeVisible();
    await expect(noticeA.getByText("고정", { exact: true })).toBeVisible();
    const board = pa.getByRole("region", { name: "게시판" });
    await expect(board.getByRole("listitem").first()).toHaveAccessibleName(`게시글 ${noticeTitle}`);

    // B가 공지를 신고 → 접수, 같은 글을 다시 신고하면 중복 안내
    await pb.reload();
    const reportOnce = async () => {
      const post = pb.getByRole("listitem", { name: `게시글 ${noticeTitle}` });
      await post.getByRole("button", { name: "신고", exact: true }).click();
      const form = post.getByRole("form", { name: "게시글 신고" });
      await form.getByLabel("신고 사유").selectOption("spam");
      await form.getByLabel("내용(선택)").fill("E2E 신고 테스트");
      await form.getByRole("button", { name: "신고하기" }).click();
      return post;
    };
    await expect((await reportOnce()).getByText("신고가 접수되었습니다")).toBeVisible();
    await pb.reload();
    await expect((await reportOnce()).getByText("이미 신고한 대상입니다", { exact: false })).toBeVisible();

    // A가 C를 내보낸다 → C는 다시 가입할 수 없다
    await pa.reload();
    await pa.getByRole("listitem", { name: `멤버 ${c.displayName}` }).getByRole("button", { name: "내보내기" }).click();
    await expect(pa.getByRole("listitem", { name: `멤버 ${c.displayName}` })).toHaveCount(0);
    await expect(pa.getByRole("region", { name: "차단한 멤버" })).toContainText(c.displayName);

    await pc.reload();
    await expect(pc.getByTestId("group-banned")).toContainText("가입할 수 없습니다");
    await expect(pc.getByRole("button", { name: "가입 신청" })).toHaveCount(0);
    await expect(pc.getByRole("heading", { name: "게시판" })).toHaveCount(0);

    await Promise.all([pa.context().close(), pb.context().close(), pc.context().close()]);
  });

  test("금칙어가 있는 모임은 검수 대기로 만들어지고 공개 목록에 나오지 않는다", async ({ browser }) => {
    const owner = await createOnboardedCustomer();
    const page = await pageAs(browser, owner);
    const name = `소개팅 골프 ${tag()}`;
    const groupId = await createGroup(page, { name, type: "스크린골프", region: "gangwon" });
    await expect(page.getByTestId("group-status")).toHaveText("검수 대기");

    // 모임장의 내 모임에는 보인다
    await page.goto("/groups");
    await expect(page.getByRole("region", { name: "내 모임" }).getByRole("link", { name: new RegExp(name) })).toBeVisible();
    await expect(page.getByRole("region", { name: "모임 목록" }).getByText(name)).toHaveCount(0);

    // 비로그인: 목록에 없고 상세는 404 화면
    const anon = await browser.newContext();
    const ap = await anon.newPage();
    await ap.goto("/groups?region=gangwon&type=screen");
    await expect(ap.getByRole("heading", { name: "골프 모임" })).toBeVisible();
    await expect(ap.getByText(name)).toHaveCount(0);
    await ap.goto(`/groups/${groupId}`);
    await expect(ap.getByRole("heading", { name: "모임을 찾을 수 없습니다" })).toBeVisible();
    await Promise.all([anon.close(), page.context().close()]);
  });

  test("비로그인도 활성 모임을 찾을 수 있고, 공개 모임은 바로 가입된다", async ({ browser, page }) => {
    const owner = await createOnboardedCustomer();
    const op = await pageAs(browser, owner);
    const name = `E2E 제주 스크린 ${tag()}`;
    const groupId = await createGroup(op, { name, type: "스크린골프", region: "jeju", policy: "바로 가입" });
    await op.context().close();

    // 비로그인: 내비 → 목록(필터) → 상세 → 로그인 안내
    await page.goto("/");
    await page.getByRole("navigation", { name: "전체 메뉴" }).getByRole("link", { name: "모임" }).click();
    await expect(page).toHaveURL(/\/groups$/);
    await expect(page.getByRole("link", { name: "모임 만들기" }).first()).toHaveAttribute("href", "/login?next=%2Fgroups%2Fnew");
    await page.getByLabel("지역").selectOption("jeju");
    await page.getByLabel("모임 유형").selectOption("screen");
    await page.getByRole("button", { name: "검색" }).click();
    await expect(page).toHaveURL(/\/groups\?region=jeju&type=screen$/);
    const card = page.locator(`a[href="/groups/${groupId}"]`);
    await expect(card).toContainText(name);
    await expect(card).toContainText("스크린골프");
    await expect(card).toContainText("제주 · 멤버 1/100명 · 바로 가입");
    await card.click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByRole("link", { name: "로그인하고 가입하기" })).toHaveAttribute(
      "href", `/login?next=${encodeURIComponent(`/groups/${groupId}`)}`,
    );
    await expect(page.getByRole("heading", { name: "게시판" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "오픈채팅 참여" })).toHaveCount(0);

    // 보호 경로는 로그인으로
    await page.goto("/groups/new");
    await expect(page).toHaveURL(/\/login\?next=%2Fgroups%2Fnew$/);

    // 다른 고객: 바로 가입 → 게시판, 정모 만들기 화면은 운영진 전용(403)
    const member = await createOnboardedCustomer();
    const mp = await pageAs(browser, member);
    await mp.goto(`/groups/${groupId}`);
    await mp.getByRole("button", { name: "가입하기" }).click();
    await expect(mp.getByRole("heading", { name: "게시판" })).toBeVisible();
    await expect(mp.getByText("멤버 2/100명")).toBeVisible();
    const res = await mp.goto(`/groups/${groupId}/meetings/new`);
    expect(res?.status()).toBe(403);
    await mp.context().close();
  });
});
