import { defineConfig, devices } from "@playwright/test";

// 로컬 Supabase(pnpm db:start)와 프로덕션 빌드(pnpm build)를 전제로 한다.
// 클라우드 컨테이너처럼 브라우저가 미리 설치된 환경은 PW_CHROMIUM_PATH로 실행 파일을 지정한다.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  // Server Action 후 router.replace는 다음 페이지 RSC를 받은 뒤 URL이 바뀐다. CI 부하를 감안해 10초.
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions: { executablePath } } },
  ],
  webServer: {
    command: "pnpm start --port 3000",
    url: "http://localhost:3000",
    // 예전 빌드로 뜬 서버를 재사용하면 페이지·청크가 어긋나므로 항상 새로 띄운다
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
