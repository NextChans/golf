import { describe, expect, it } from "vitest";
import {
  MAX_QUOTE_ROWS,
  bulkQuoteIssueMessage,
  bulkQuoteRowsSchemaAt,
  normalizeDate,
  parseCsv,
  parsePrice,
  previewQuoteCsv,
  quoteCsvTemplate,
  toBulkQuoteRows,
} from "./quote-csv";

// 2026-10-20 12:00 KST
const NOW = new Date("2026-10-20T03:00:00Z");
const P1 = "00000000-0000-4000-a000-000000000101";
const P2 = "00000000-0000-4000-a000-000000000102";
const PRODUCTS = [
  { id: P1, courseName: "구골프 레이크CC", kind: "정회원" },
  { id: P2, courseName: "구골프 레이크CC", kind: "주중회원" },
];
const HEADER = "골프장,종류,기준일,매수시세,매도시세";
const preview = (body: string) => previewQuoteCsv(`${HEADER}\n${body}`, PRODUCTS, NOW);

describe("parseCsv", () => {
  it("따옴표 안의 쉼표·줄바꿈·이스케이프된 따옴표", () => {
    const r = parseCsv('a,"1,000","say ""hi""","x\ny"\r\nb,2,,\n');
    expect(r.error).toBeUndefined();
    expect(r.records).toEqual([
      ["a", "1,000", 'say "hi"', "x\ny"],
      ["b", "2", "", ""],
    ]);
  });

  it("CRLF와 마지막 줄바꿈 없음, BOM 제거", () => {
    expect(parseCsv("﻿a,b\r\nc,d").records).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("첫 줄에 탭이 있으면 탭 구분(Excel 붙여넣기)", () => {
    expect(parseCsv("a\tb\n1,000\t2").records).toEqual([["a", "b"], ["1,000", "2"]]);
  });

  it("닫히지 않은 따옴표는 오류", () => {
    expect(parseCsv('a,"b\nc').error).toBeDefined();
  });
});

describe("값 정리", () => {
  it("금액: 쉼표·원·공백 제거, 빈 값 null, 음수·문자는 NaN", () => {
    expect(parsePrice(" 325,000,000원 ")).toBe(325_000_000);
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("-1")).toBeNaN();
    expect(parsePrice("12a")).toBeNaN();
    expect(parsePrice("1.5")).toBeNaN();
  });

  it("날짜: 구분자 -./ 허용, 없는 날짜는 null", () => {
    expect(normalizeDate("2026-10-20")).toBe("2026-10-20");
    expect(normalizeDate("2026/1/5")).toBe("2026-01-05");
    expect(normalizeDate("2026.10.20.")).toBe("2026-10-20");
    expect(normalizeDate("2026-02-30")).toBeNull();
    expect(normalizeDate("20261020")).toBeNull();
  });
});

describe("previewQuoteCsv", () => {
  it("정상 행을 상품에 매핑한다(따옴표 금액, 공백·대소문자 무시)", () => {
    const r = preview('구골프 레이크CC,정회원,2026-10-20,"325,000,000",315000000원\r\n 구골프  레이크cc ,주중회원,2026-10-19,,90000000\r\n');
    expect(r.fileError).toBeUndefined();
    expect(r.errorCount).toBe(0);
    expect(r.rows).toEqual([
      { line: 2, courseName: "구골프 레이크CC", kind: "정회원", quotedOn: "2026-10-20", buyPrice: 325_000_000, sellPrice: 315_000_000, productId: P1, error: null },
      { line: 3, courseName: "구골프 레이크cc", kind: "주중회원", quotedOn: "2026-10-19", buyPrice: null, sellPrice: 90_000_000, productId: P2, error: null },
    ]);
    expect(toBulkQuoteRows(r)).toEqual([
      { product_id: P1, quoted_on: "2026-10-20", buy_price: 325_000_000, sell_price: 315_000_000 },
      { product_id: P2, quoted_on: "2026-10-19", buy_price: null, sell_price: 90_000_000 },
    ]);
  });

  it("탭으로 붙여넣은 내용과 머리글 열 순서가 달라도 읽는다", () => {
    const r = previewQuoteCsv("기준일\t매도 시세\t매수 시세\t종류\t골프장\n2026-10-01\t1\t2\t정회원\t구골프 레이크CC", PRODUCTS, NOW);
    expect(r.errorCount).toBe(0);
    expect(r.rows[0]).toMatchObject({ quotedOn: "2026-10-01", buyPrice: 2, sellPrice: 1, productId: P1 });
  });

  it("행별 오류: 날짜 형식, 미래 날짜, 음수·문자 금액, 시세 둘 다 없음, 상품 없음", () => {
    const r = preview([
      "구골프 레이크CC,정회원,2026-13-01,1,1",
      "구골프 레이크CC,정회원,2026-10-21,1,1",
      "구골프 레이크CC,정회원,2026-10-01,-5,1",
      "구골프 레이크CC,정회원,2026-10-02,1,abc",
      "구골프 레이크CC,정회원,2026-10-03,,",
      "없는CC,정회원,2026-10-04,1,1",
      "구골프 레이크CC,VIP,2026-10-04,1,1",
      ",정회원,2026-10-04,1,1",
    ].join("\n"));
    expect(r.errorCount).toBe(8);
    expect(r.rows.map((x) => [x.line, x.error])).toEqual([
      [2, "기준일은 YYYY-MM-DD 형식으로 입력해 주세요."],
      [3, "오늘 이후 날짜는 입력할 수 없습니다."],
      [4, "매수시세는 0 이상 숫자로 입력해 주세요."],
      [5, "매도시세는 0 이상 숫자로 입력해 주세요."],
      [6, "매수 또는 매도 시세를 입력해 주세요."],
      [7, "상품을 찾을 수 없습니다(골프장·종류 확인)"],
      [8, "상품을 찾을 수 없습니다(골프장·종류 확인)"],
      [9, "골프장을 입력해 주세요."],
    ]);
    expect(toBulkQuoteRows(r)).toBeNull();
  });

  it("상한을 넘는 금액은 오류", () => {
    expect(preview("구골프 레이크CC,정회원,2026-10-01,100000000001,").rows[0]?.error).toBe("매수시세 금액을 확인해 주세요.");
  });

  it("같은 상품·기준일 중복은 뒤 행이 오류(날짜 표기가 달라도 같은 날)", () => {
    const r = preview("구골프 레이크CC,정회원,2026-10-01,1,1\n\n구골프 레이크CC,정회원,2026/10/1,2,2\n구골프 레이크CC,주중회원,2026-10-01,3,3");
    expect(r.rows.map((x) => [x.line, x.error])).toEqual([
      [2, null],
      [4, "같은 상품·기준일이 2행에 이미 있습니다."],
      [5, null],
    ]);
    expect(r.errorCount).toBe(1);
  });

  it("머리글 없음·빈 내용·행 없음·깨진 글자는 파일 오류", () => {
    expect(previewQuoteCsv("구골프 레이크CC,정회원,2026-10-01,1,1", PRODUCTS, NOW).fileError).toContain("머리글");
    expect(previewQuoteCsv("  \n", PRODUCTS, NOW).fileError).toContain("내용이 없습니다");
    expect(previewQuoteCsv(`${HEADER}\n`, PRODUCTS, NOW).fileError).toContain("시세 행이 없습니다");
    expect(previewQuoteCsv(`${HEADER}\n�,정회원,2026-10-01,1,1`, PRODUCTS, NOW).fileError).toContain("UTF-8");
  });

  it(`${MAX_QUOTE_ROWS}행을 넘으면 파일 오류(반영 불가)`, () => {
    const body = Array.from({ length: MAX_QUOTE_ROWS + 1 }, (_, i) => {
      const d = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10);
      return `구골프 레이크CC,정회원,${d},1,1`;
    }).join("\n");
    const r = preview(body);
    expect(r.rows).toHaveLength(MAX_QUOTE_ROWS + 1);
    expect(r.errorCount).toBe(0);
    expect(r.fileError).toContain("500행까지");
    expect(toBulkQuoteRows(r)).toBeNull();
  });

  it("양식은 BOM + 머리글 + 예시 1행이고 그대로 미리보기가 통과한다", () => {
    const t = quoteCsvTemplate("2026-10-20");
    expect(t.startsWith("﻿골프장,종류,기준일,매수시세,매도시세\r\n")).toBe(true);
    const r = previewQuoteCsv(t, PRODUCTS, NOW);
    expect(r.errorCount).toBe(0);
    expect(r.rows).toHaveLength(1);
  });
});

describe("bulkQuoteRowsSchemaAt", () => {
  const schema = bulkQuoteRowsSchemaAt(NOW);
  const row = { product_id: P1, quoted_on: "2026-10-20", buy_price: 1, sell_price: null };

  it("정상 행 통과", () => {
    expect(schema.safeParse([row, { ...row, product_id: P2 }]).success).toBe(true);
  });

  it("빈 배열·501행·잘못된 id·미래 날짜·음수·시세 없음·중복·추가 필드는 거부", () => {
    const bad = (rows: unknown) => schema.safeParse(rows);
    expect(bad([]).success).toBe(false);
    expect(bad(Array.from({ length: MAX_QUOTE_ROWS + 1 }, () => row)).success).toBe(false);
    expect(bad([{ ...row, product_id: "x" }]).success).toBe(false);
    expect(bad([{ ...row, quoted_on: "2026-10-21" }]).success).toBe(false);
    expect(bad([{ ...row, buy_price: -1 }]).success).toBe(false);
    expect(bad([{ ...row, buy_price: null }]).success).toBe(false);
    expect(bad([row, row]).success).toBe(false);
    expect(bad([{ ...row, source: "admin" }]).success).toBe(false);
    expect(bad("nope").success).toBe(false);
  });

  it("오류 메시지는 몇 번째 행인지 알려 준다", () => {
    const r = schema.safeParse([row, { ...row, product_id: P2, sell_price: -1 }]);
    expect(bulkQuoteIssueMessage(r.error!.issues)).toBe("2번째 행의 값을 확인해 주세요. 미리보기를 다시 실행해 주세요.");
    expect(bulkQuoteIssueMessage(schema.safeParse([]).error!.issues)).toBe("한 번에 1~500행을 반영할 수 있습니다.");
  });
});
