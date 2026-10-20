import type { AppError } from "@/lib/domain/errors";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: AppError };

export const ok = <T,>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: AppError): ActionResult<never> => ({ ok: false, error });
