import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(12, "12자 이상으로 정해 주세요.")
  .max(72)
  .regex(/[A-Za-z]/, "영문을 포함해 주세요.")
  .regex(/\d/, "숫자를 포함해 주세요.");
