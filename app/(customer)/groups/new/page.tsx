import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { GlobalNav } from "@/components/site/global-nav";
import { LocalNav } from "@/components/site/local-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { requireCustomer } from "@/lib/auth/guards";
import { GroupForm } from "../group-form";

export const metadata: Metadata = { title: "모임 만들기" };

export default async function NewGroupPage() {
  await requireCustomer();
  return (
    <>
      <GlobalNav />
      <LocalNav title="모임 만들기" />
      <main className="mx-auto max-w-[560px] px-4 pt-12 pb-16 md:pt-20 md:pb-24">
        <div className="mb-10 text-center md:mb-14">
          <h1 className="text-title font-semibold tracking-tight md:text-headline">골프 모임 만들기</h1>
          <p className="mt-3 text-eyebrow text-muted-foreground">
            함께 라운딩하고 연습할 멤버를 모아 보세요. 1인당 모임은 3개까지 만들 수 있습니다.
          </p>
        </div>
        {/* 멱등키는 렌더마다 새로 발급(D-10) */}
        <GroupForm mode="create" idempotencyKey={randomUUID()} />
      </main>
      <SiteFooter />
    </>
  );
}
