/** apple.com 푸터: 연회색 바탕, 작은 글씨, 고지 문구. */
export function SiteFooter() {
  return (
    <footer className="bg-section pb-safe text-micro text-muted-foreground">
      <div className="mx-auto max-w-[1024px] space-y-3 px-4 py-8">
        <p>
          Googolf는 골프장 예약과 회원권 거래 상담을 돕는 중개 서비스입니다. 회원권 계약은 오프라인에서 체결되며,
          주민등록번호·신분증·인감 등 고유식별정보는 온라인으로 수집하지 않습니다.
        </p>
        <div className="h-px bg-border" />
        <p>Copyright © 2026 Googolf. All rights reserved.</p>
      </div>
    </footer>
  );
}
