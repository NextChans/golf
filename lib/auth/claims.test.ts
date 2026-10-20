import { describe, expect, it } from "vitest";
import { toSession } from "./claims";

const base = { sub: "u1", aal: "aal1", app_metadata: {} };

describe("toSession", () => {
  it("claims가 없거나 형식이 틀리면 null", () => {
    expect(toSession(null)).toBeNull();
    expect(toSession({ aal: "aal1" })).toBeNull();
  });

  it("역할이 없으면 customer", () => {
    expect(toSession(base)?.role).toBe("customer");
  });

  it("app_metadata.role만 신뢰하고 user_metadata.role은 무시한다", () => {
    const s = toSession({ ...base, user_metadata: { role: "owner" } });
    expect(s?.role).toBe("customer");
  });

  it("알 수 없는 역할은 customer", () => {
    expect(toSession({ ...base, app_metadata: { role: "superuser" } })?.role).toBe("customer");
  });

  it("카카오 identity가 있으면 role=admin이어도 customer", () => {
    const s = toSession({ ...base, app_metadata: { role: "admin", providers: ["kakao"] } });
    expect(s?.role).toBe("customer");
    expect(s?.isKakao).toBe(true);
  });

  it("이메일 운영자는 역할·aal·플래그를 읽는다", () => {
    const s = toSession({ sub: "u2", aal: "aal2", app_metadata: { role: "owner", providers: ["email"], password_change_required: true } });
    expect(s).toMatchObject({ role: "owner", aal: "aal2", passwordChangeRequired: true });
  });

  it("aal 값이 이상하면 aal1로 본다", () => {
    expect(toSession({ ...base, aal: "aal9" })?.aal).toBe("aal1");
  });
});
