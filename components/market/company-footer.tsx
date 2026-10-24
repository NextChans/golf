import { COMPANY_INFO } from "@/lib/company";

/** 구매 탭 하단 회사 정보. 값은 lib/company.ts, 고지문은 법률 검토 전 초안(D-83) */
export function CompanyFooter() {
  return (
    <footer className="mt-0 bg-fill px-6 pt-8 pb-8 text-ink-mute">
      <div className="flex items-center gap-2 text-subhead font-extrabold text-ink-sub">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/googolf-mark.svg" alt="" className="size-6" />
        Googolf
      </div>
      <p className="mt-4 text-caption leading-relaxed">
        Googolf는 골프 회원권 거래 상담을 돕는 중개 서비스입니다. 회원권 계약은 담당자와 오프라인에서 체결되며, 회원권의 실제 권리·의무는 양도인·양수인에게 귀속됩니다. Googolf는 거래 당사자가 아니며 거래에 관한 책임은 각 거래 당사자에게 귀속됩니다. (초안: 법률 검토 전)
      </p>
      <div className="mt-5 border-t border-line pt-5 text-caption leading-relaxed">
        <p className="font-bold text-ink-sub">{COMPANY_INFO.name}</p>
        <p>{COMPANY_INFO.address}</p>
        <p>대표: {COMPANY_INFO.representative} | 사업자등록번호: {COMPANY_INFO.bizNumber}</p>
        <p>통신판매업 신고번호: {COMPANY_INFO.mailOrderNumber}</p>
      </div>
      <p className="mt-5 text-caption font-bold text-ink-faint">Googolf</p>
    </footer>
  );
}
