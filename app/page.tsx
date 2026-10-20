import Link from "next/link";
import { GlobalNav } from "@/components/site/global-nav";
import { MoreLink, Section, Tile } from "@/components/site/section";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/guards";

const highlights = [
  { label: "요청은", value: "1분", body: "골프장·날짜·시간대·인원만 고르면 요청이 접수됩니다. 전화 대기는 없습니다." },
  { label: "확인 시작까지", value: "30분", body: "영업시간 기준, 담당자가 요청을 받은 뒤 30분 안에 골프장 확인을 시작합니다." },
  { label: "확정까지", value: "한눈에", body: "접수부터 제안·확정까지 진행 상황을 내 예약에서 바로 확인할 수 있습니다." },
] as const;

export default async function Home() {
  const session = await getSession();
  const bookingHref = session ? "/bookings/new" : "/login?next=/bookings/new";
  return (
    <>
      <GlobalNav />
      <main>
        <Section tone="white" className="py-16 md:py-28" inner="text-center">
          <p className="text-eyebrow font-semibold text-primary">Googolf 부킹</p>
          <h1 className="mt-3 text-hero font-semibold tracking-tight md:text-hero-lg">
            전화 없이,
            <br />
            원하는 티타임.
          </h1>
          <p className="mx-auto mt-5 max-w-[640px] text-eyebrow text-muted-foreground">
            골프장·날짜·인원만 알려주세요. 담당자가 확인해 티타임을 제안합니다.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-5 sm:flex-row sm:gap-8">
            <Button asChild>
              <Link href={bookingHref as never}>부킹 요청하기</Link>
            </Button>
            <MoreLink href="/#membership" className="text-body">회원권 상담 알아보기</MoreLink>
          </div>
        </Section>

        <Section tone="gray" className="py-14 md:py-24" aria-labelledby="how-title">
          <h2 id="how-title" className="text-center text-headline tracking-tight">
            부킹이 이렇게 간단해집니다.
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-4 md:mt-14 md:grid-cols-3 md:gap-5">
            {highlights.map((h) => (
              <Tile key={h.value} className="bg-background">
                <p className="text-small font-semibold text-muted-foreground">{h.label}</p>
                <p className="mt-1 text-headline font-semibold tracking-tight text-primary">{h.value}</p>
                <p className="mt-4 text-body text-muted-foreground">{h.body}</p>
              </Tile>
            ))}
          </div>
        </Section>

        <Section tone="dark" id="membership" className="scroll-mt-12 py-16 md:py-28" inner="text-center" aria-labelledby="membership-title">
          <p className="text-eyebrow font-semibold text-[#86868b]">Googolf 회원권</p>
          <h2 id="membership-title" className="mt-3 text-headline font-semibold tracking-tight md:text-[56px] md:leading-[1.07]">
            회원권, 시세부터
            <br />
            명의개서까지.
          </h2>
          <p className="mx-auto mt-5 max-w-[600px] text-eyebrow text-[#a1a1a6]">
            매수·매도 상담은 온라인으로 접수하고, 계약은 담당자와 오프라인에서 안전하게 진행합니다.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-5 sm:flex-row sm:gap-8">
            <Link
              href="/memberships"
              className="pressable inline-flex items-center gap-0.5 text-body text-[#4cc38a] hover:underline underline-offset-4"
            >
              회원권 매물 보기
              <span aria-hidden className="text-[1.1em] leading-none">›</span>
            </Link>
            <Link
              href={(session ? "/memberships/sell" : "/login?next=/memberships/sell") as never}
              className="pressable inline-flex items-center gap-0.5 text-body text-[#4cc38a] hover:underline underline-offset-4"
            >
              매도 상담 신청
              <span aria-hidden className="text-[1.1em] leading-none">›</span>
            </Link>
          </div>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
