import type { Region } from "@/lib/domain/course/schema";

/** 지역 그라디언트(사진 대신 지역 인상을 담은 색). 실제 사진은 오너 제공 시 교체 */
export const REGION_TONE: Record<Region, string> = {
  seoul_gyeonggi: "from-[#7aa8d8] via-[#6fae5a] to-[#3f8a3a]",
  gangwon: "from-[#8cc6f0] via-[#79b85a] to-[#2f7d4a]",
  chungcheong: "from-[#a9c9e8] via-[#5ea65b] to-[#2c6f3b]",
  gyeongsang: "from-[#c4d8c0] via-[#5c9c4f] to-[#2b6a35]",
  jeolla: "from-[#b7d3e6] via-[#6aae62] to-[#30733e]",
  jeju: "from-[#6fa6d6] via-[#8fb5a3] to-[#4f8d4b]",
};
