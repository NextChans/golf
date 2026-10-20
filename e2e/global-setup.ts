import { writeFileSync } from "node:fs";
import nextEnv from "@next/env";
import { createE2EUsers } from "./fixtures";

export default async function globalSetup() {
  nextEnv.loadEnvConfig(process.cwd());
  const users = await createE2EUsers();
  writeFileSync("e2e/.users.json", JSON.stringify(users));
}
