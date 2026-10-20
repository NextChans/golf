import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: ["next-env.d.ts", ".next/**", "node_modules/**", "types/database.ts", "supabase/functions/**", "playwright-report/**", "test-results/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // service_role 클라이언트는 서버 전용 모듈에서만 import한다
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["**/lib/supabase/admin"], message: "admin 클라이언트는 server action/route handler에서만 사용" }],
      }],
    },
  },
  {
    files: ["app/**/actions.ts", "app/**/route.ts", "lib/auth/**", "lib/supabase/**", "scripts/**", "e2e/**"],
    rules: { "no-restricted-imports": "off" },
  },
];

export default config;
