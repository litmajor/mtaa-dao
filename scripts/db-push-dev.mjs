import { spawnSync } from "node:child_process";

if (
  process.env.NODE_ENV === "production" ||
  process.env.DEPLOYMENT_ENV === "production"
) {
  console.error(
    "Refusing to run drizzle-kit push in production. Use the reviewed migration command."
  );
  process.exit(1);
}

if (process.env.ALLOW_DRIZZLE_PUSH !== "true") {
  console.error(
    "Refusing to run drizzle-kit push without explicit opt-in. For a disposable development database, set ALLOW_DRIZZLE_PUSH=true."
  );
  process.exit(1);
}

if (!process.env.npm_execpath) {
  console.error(
    "Run this command through npm so the local Drizzle CLI can be resolved safely."
  );
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [
    process.env.npm_execpath,
    "exec",
    "drizzle-kit",
    "--",
    "push",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", env: process.env }
);

if (result.error) {
  console.error("Failed to start drizzle-kit push:", result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
