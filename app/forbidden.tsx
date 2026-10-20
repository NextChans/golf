import { ForbiddenView } from "@/components/forbidden-view";

// forbidden() 호출 시(서버 가드) 렌더된다. 응답 코드는 403.
export default function Forbidden() {
  return <ForbiddenView />;
}
