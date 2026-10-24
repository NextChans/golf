export type ShareResult = "shared" | "copied" | "failed" | "aborted";

/** 클립보드에 복사. 권한 거부·미지원이면 false */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** navigator.share가 있으면 공유 시트, 없으면 주소를 클립보드로. 공유창을 닫은 것은 "aborted"(오류 아님) */
export async function shareOrCopy({ title, url }: { title: string; url: string }): Promise<ShareResult> {
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ title, url });
      return "shared";
    }
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "aborted";
    return "failed";
  }
}
