import type { Region } from "@/lib/domain/course/schema";
import { currentPrice, weeklyChangeRate, type MarketFilter, type MarketItem } from "./schema";

/**
 * 골프장 단위 묶음(D-89). 검색 결과 카드·골프장 상세가 쓰는 순수 함수 모음.
 * 정렬 기준값은 골프장마다 유형이 여러 개라 "대표값" 규칙으로 정한다(아래 SORT_OPTIONS).
 */

export type CourseGroup = {
  courseId: string;
  courseName: string;
  region: Region;
  holes: MarketItem["holes"];
  /** 유형 행: 이번 주 시세 높은 순(같으면 id 순) */
  items: MarketItem[];
};

/** 첫 등장 순서를 지키며 courseId로 묶는다. 유형 행은 시세 높은 순 */
export function groupByCourse(items: readonly MarketItem[]): CourseGroup[] {
  const map = new Map<string, CourseGroup>();
  for (const item of items) {
    const g = map.get(item.courseId);
    if (g) g.items.push(item);
    else map.set(item.courseId, { courseId: item.courseId, courseName: item.courseName, region: item.region, holes: item.holes, items: [item] });
  }
  const groups = [...map.values()];
  for (const g of groups) g.items.sort((a, b) => currentPrice(b) - currentPrice(a) || a.id.localeCompare(b.id));
  return groups;
}

/** courseId로 그 골프장의 모든 유형을 찾는다. 없으면 null */
export function findCourseGroup(items: readonly MarketItem[], courseId: string): CourseGroup | null {
  return groupByCourse(items.filter((i) => i.courseId === courseId))[0] ?? null;
}

export const SORT_OPTIONS = [
  { id: "popular", label: "인기순" },
  { id: "price_asc", label: "가격 낮은순" },
  { id: "price_desc", label: "가격 높은순" },
  { id: "rise", label: "시세 상승률순" },
  { id: "fall", label: "시세 하락률순" },
] as const;
export type SortKey = (typeof SORT_OPTIONS)[number]["id"];
export const DEFAULT_SORT: SortKey = "popular";

/** ?sort= 값 해석. 모르는 값·배열·빈 값은 기본(인기순) */
export function parseSort(v: string | string[] | undefined): SortKey {
  const s = Array.isArray(v) ? v[0] : v;
  return SORT_OPTIONS.find((o) => o.id === s)?.id ?? DEFAULT_SORT;
}

const minOf = (xs: number[]) => Math.min(...xs);
const maxOf = (xs: number[]) => Math.max(...xs);

/**
 * 골프장의 정렬 대표값(작을수록 앞):
 * - popular: 유형 관심 수 합계(많을수록 앞)
 * - price_asc / price_desc: 유형 중 최저 시세(낮은순은 오름차순, 높은순은 내림차순)
 * - rise: 유형 중 최대 변화율(클수록 앞) / fall: 유형 중 최소 변화율(작을수록 앞)
 */
export function sortKeyValue(g: CourseGroup, sort: SortKey): number {
  const prices = g.items.map(currentPrice);
  const rates = g.items.map((i) => weeklyChangeRate(i.weekly));
  switch (sort) {
    case "popular": return -g.items.reduce((a, i) => a + i.likes, 0);
    case "price_asc": return minOf(prices);
    case "price_desc": return -minOf(prices);
    case "rise": return -maxOf(rates);
    case "fall": return minOf(rates);
  }
}

/** 대표값 순, 같으면 관심 수 많은 순 → 이름 순(항상 같은 결과) */
export function sortGroups(groups: readonly CourseGroup[], sort: SortKey): CourseGroup[] {
  const likes = (g: CourseGroup) => g.items.reduce((a, i) => a + i.likes, 0);
  return [...groups].sort(
    (a, b) => sortKeyValue(a, sort) - sortKeyValue(b, sort) || likes(b) - likes(a) || a.courseName.localeCompare(b.courseName, "ko"),
  );
}

/** 적용된 조건 개수: 지역 수 + 가격대 수 + 검색어(있으면 1) */
export function countAppliedFilters(f: MarketFilter): number {
  return f.regions.length + f.bands.length + (f.q.trim() ? 1 : 0);
}

/** 필터 버튼 문구: 0이면 "필터", 아니면 "필터 · N개 적용됨" */
export function filterButtonLabel(f: MarketFilter): string {
  const n = countAppliedFilters(f);
  return n ? `필터 · ${n}개 적용됨` : "필터";
}
