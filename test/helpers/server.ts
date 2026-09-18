import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Integration-test harness. Each instance is a REAL running server:
 *   - a fresh temp SQLite database,
 *   - the REAL dbmate migrations applied to it,
 *   - the REAL built server (dist/server.js) spawned as a child process,
 *     bound to an OS-assigned port (PORT=0).
 *
 * Nothing is mocked — tests exercise the app exactly as it runs in production,
 * over HTTP. Call `startServer()` in a setup hook and `stop()` in teardown.
 */

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SERVER_ENTRY = join(REPO_ROOT, "dist", "server.js");
const MIGRATIONS_DIR = join(REPO_ROOT, "db", "migrations");

/** Resolve the dbmate binary: DBMATE env override, else `dbmate` on PATH. */
const DBMATE = process.env.DBMATE ?? "dbmate";

export interface TestServer {
  /** Base URL, e.g. "http://127.0.0.1:54321" (no trailing slash). */
  baseUrl: string;
  /** Absolute path to this server's SQLite database. */
  dbPath: string;
  /** The temp dir holding the DB (for direct inspection if needed). */
  dir: string;
  /** Stop the server and remove its temp dir. */
  stop: () => Promise<void>;
  /** Restart the server process against the SAME db (for persistence tests). */
  restart: () => Promise<void>;
}

/** Apply migrations to a database file using the real dbmate binary. */
export function migrate(dbPath: string): void {
  const result = spawnSync(
    DBMATE,
    [
      "--migrations-dir",
      MIGRATIONS_DIR,
      "--no-dump-schema",
      "--url",
      `sqlite:${dbPath}`,
      "up",
    ],
    { encoding: "utf8" },
  );
  if (result.error) {
    throw new Error(
      `Failed to run dbmate (${DBMATE}): ${result.error.message}. ` +
        `Install it or set the DBMATE env var to its path.`,
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `dbmate up failed (exit ${result.status}):\n${result.stdout}\n${result.stderr}`,
    );
  }
}

/** Roll the last migration back (dbmate down) against a database file. */
export function rollback(dbPath: string): { stdout: string; status: number } {
  const result = spawnSync(
    DBMATE,
    [
      "--migrations-dir",
      MIGRATIONS_DIR,
      "--no-dump-schema",
      "--url",
      `sqlite:${dbPath}`,
      "down",
    ],
    { encoding: "utf8" },
  );
  if (result.error) throw result.error;
  return { stdout: result.stdout, status: result.status ?? -1 };
}

/**
 * Spawn dist/server.js and resolve once it logs the line it prints after a
 * successful listen(). We parse the actual bound port out of that line — the
 * server is started with PORT=0 so the OS picks a free port, which is what
 * makes concurrent test files collision-free.
 */
function spawnServer(
  dbPath: string,
  extraEnv: Record<string, string>,
): Promise<{ child: ChildProcess; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER_ENTRY], {
      env: {
        ...process.env,
        PORT: "0",
        HOST: "127.0.0.1",
        DB_PATH: dbPath,
        ...extraEnv,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        new Error(
          `Server did not start within 10s.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        ),
      );
    }, 10_000);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      // Match: "muxe.org API listening on http://127.0.0.1:54321"
      const match = stdout.match(/listening on (http:\/\/[\d.]+:(\d+))/);
      if (match) {
        clearTimeout(timeout);
        resolve({ child, baseUrl: match[1] as string });
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(
        new Error(
          `Server exited early (code ${code}).\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        ),
      );
    });
  });
}

/** Kill a child process and wait for it to actually exit. */
function stopChild(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
    // Safety net: force-kill if it doesn't shut down promptly.
    setTimeout(() => child.kill("SIGKILL"), 3_000).unref();
  });
}

export interface StartOptions {
  /** Skip running migrations (to test the un-migrated fail-fast path). */
  skipMigrate?: boolean;
  /** Extra environment variables for the server process. */
  env?: Record<string, string>;
}

/** Start a fully-migrated, running test server. */
export async function startServer(
  options: StartOptions = {},
): Promise<TestServer> {
  const dir = mkdtempSync(join(tmpdir(), "muxe-test-"));
  const dbPath = join(dir, "muxe.db");
  const extraEnv = options.env ?? {};

  if (!options.skipMigrate) migrate(dbPath);

  let { child, baseUrl } = await spawnServer(dbPath, extraEnv);

  return {
    baseUrl,
    dbPath,
    dir,
    async stop() {
      await stopChild(child);
      rmSync(dir, { recursive: true, force: true });
    },
    async restart() {
      await stopChild(child);
      const started = await spawnServer(dbPath, extraEnv);
      child = started.child;
      baseUrl = started.baseUrl;
      // Callers read this.baseUrl, so update the live reference.
      this.baseUrl = baseUrl;
    },
  };
}
