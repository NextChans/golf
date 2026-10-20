import { readFileSync } from "node:fs";
import type { E2EUsers } from "./fixtures";

export const users = (): E2EUsers => JSON.parse(readFileSync("e2e/.users.json", "utf8"));
