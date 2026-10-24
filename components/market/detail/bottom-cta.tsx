import Link from "next/link";

/** 하단 고정 CTA(56px). 구매하기 → 기존 실제 매물 상담, 판매하기 → 판매 희망가 등록(연결 유지, 신청 화면은 캡처 대기) */
export function BottomCta({ itemId }: { itemId: string }) {
  const base = "pressable inline-flex h-14 items-center justify-center rounded-control px-6 text-subhead font-bold text-white";
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-safe">
      <div className="mx-auto grid max-w-[480px] grid-cols-2 gap-3 px-6 py-3">
        <Link href="/memberships" className={`${base} bg-up`}>구매하기</Link>
        <Link href={`/market/mypage/asks/new?item=${itemId}` as never} className={`${base} bg-down`}>판매하기</Link>
      </div>
    </div>
  );
}
