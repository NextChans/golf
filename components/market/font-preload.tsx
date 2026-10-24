import ReactDOM from "react-dom";
import "@/app/market/pretendard.css";

/**
 * 앱 폰트(D-86)를 불러오는 서버 컴포넌트. 앱 화면 루트(`app/market/layout.tsx`, `/onboarding`)에서만 렌더한다.
 * 라틴·숫자·자주 쓰는 한글이 들어 있는 subset 91만 미리 받아 첫 글자가 늦게 바뀌는 현상(FOUT)을 줄인다.
 * 나머지 한글 조각은 unicode-range에 따라 필요할 때만 내려받는다.
 */
export function AppFontPreload() {
  ReactDOM.preload("/fonts/pretendard/PretendardVariable.subset.91.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return null;
}
