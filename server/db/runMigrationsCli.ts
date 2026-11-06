import { pool, waitForDatabase } from "../db.js";
import { runAllMigrations } from "./migrations/index.js";

const LOCK_NAMESPACE = "mtaa-dao";
const LOCK_NAME = "schema-migrations";

export async function runMigrationsCli(): Promise<never> {
  let lockClient: Awaited<ReturnType<typeof pool.connect>> | undefined;
  let migrationFailed = false;

  try {
    await waitForDatabase();
    lockClient = await pool.connect();
    await lockClient.query(
      "SELECT pg_advisory_lock(hashtext($1), hashtext($2))",
      [LOCK_NAMESPACE, LOCK_NAME]
    );
    console.info("Acquired database migration lock.");

    const result = await runAllMigrations();
    if (!result.success) {
      migrationFailed = true;
      console.error(
        "Migration runner reported errors:",
        result.errors?.join("; ") ?? "unknown error"
      );
    }
  } catch (error) {
    migrationFailed = true;
    console.error("Database migration command failed:", error);
  } finally {
    if (lockClient) {
      try {
        await lockClient.query(
          "SELECT pg_advisory_unlock(hashtext($1), hashtext($2))",
          [LOCK_NAMESPACE, LOCK_NAME]
        );
      } catch (error) {
        migrationFailed = true;
        console.error("Failed to release database migration lock:", error);
      }
      lockClient.release();
    }

    try {
      await pool.end();
    } catch (error) {
      migrationFailed = true;
      console.error("Failed to close the database connection pool:", error);
    }
  }

  process.exit(migrationFailed ? 1 : 0);
}
