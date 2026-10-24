import { REGION_TONE } from "../region-tone";
import type { Region } from "@/lib/domain/course/schema";
import { cn } from "@/lib/utils";

/** 상단 사진 영역(300px). 실제 사진은 오너 제공 전이라 지역 그라디언트 + "사진 준비 중" 배지 */
export function DetailHero({ region }: { region: Region }) {
  return (
    <div aria-hidden className={cn("relative h-[300px] w-full bg-gradient-to-b", REGION_TONE[region])}>
      <span className="absolute right-4 bottom-10 rounded-control bg-scrim px-2.5 py-1 text-tiny font-semibold text-white">사진 준비 중</span>
    </div>
  );
}
