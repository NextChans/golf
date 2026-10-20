"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/auth/guards";
import { appError, toAppError } from "@/lib/domain/errors";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { cancelDealSchema } from "@/lib/domain/membership/schema";

/** 고객 상담 취소(inquiry·negotiating만, DB가 최종 판단). 점유 중 매물은 DB가 같은 트랜잭션에서 복원한다. */
export async function cancelDeal(input: unknown): Promise<ActionResult> {
  await requireCustomer();
  const parsed = cancelDealSchema.safeParse(input);
  if (!parsed.success) return fail(appError("invalid_input"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_deal", {
    p_deal_id: parsed.data.dealId,
    p_expected_version: parsed.data.expectedVersion,
    p_reason: parsed.data.reason as string,
  });
  if (error || !data) return fail(toAppError(error));
  revalidatePath(`/deals/${data.id}`);
  revalidatePath("/deals");
  return ok(undefined);
}
