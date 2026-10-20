import { forbidden } from "next/navigation";

// middleware가 권한 없는 접근을 이 경로로 rewrite한다. forbidden()이 app/forbidden.tsx를 403 상태로 렌더한다.
export const dynamic = "force-dynamic";

export default function ForbiddenRoute() {
  forbidden();
}
