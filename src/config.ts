import { resolve } from "node:path";

/**
 * Single source of truth for runtime configuration. Everything reads the
 * environment here, once, at startup — 12-factor style — so the rest of the
 * code depends on a typed, validated, frozen object instead of poking at
 * process.env. Invalid values fail fast with a clear message rather than
 * silently coercing to NaN/0 and misbehaving later.
 */

export interface Config {
  /** Port to listen on. 0 means "let the OS pick a free port" (used in tests). */
  port: number;
  host: string;
  /** Absolute path to the SQLite database file. */
  dbPath: string;
  rateLimit: {
    /** Token-bucket capacity = max burst per client. */
    capacity: number;
    /** Sustained refill rate, tokens per second. */
    refillPerSec: number;
  };
}

/** Parse an integer env var, or return the default when unset/empty. */
function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`Invalid ${name}=${raw}: expected an integer.`);
  }
  return value;
}

/** Parse a finite number env var, or return the default when unset/empty. */
function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid ${name}=${raw}: expected a number.`);
  }
  return value;
}

function loadConfig(): Config {
  const port = intFromEnv("PORT", 3000);
  // 0 is valid (OS-assigned port); otherwise must be a usable TCP port.
  if (port !== 0 && (port < 1 || port > 65535)) {
    throw new Error(`Invalid PORT=${port}: must be 0 or 1-65535.`);
  }

  const capacity = intFromEnv("RATE_LIMIT_CAPACITY", 10);
  if (capacity < 1) {
    throw new Error(`Invalid RATE_LIMIT_CAPACITY=${capacity}: must be >= 1.`);
  }

  const refillPerSec = numberFromEnv("RATE_LIMIT_REFILL_PER_SEC", 1);
  if (refillPerSec <= 0) {
    throw new Error(`Invalid RATE_LIMIT_REFILL_PER_SEC=${refillPerSec}: must be > 0.`);
  }

  return Object.freeze({
    port,
    host: process.env.HOST ?? "127.0.0.1",
    dbPath: resolve(process.env.DB_PATH ?? "./data/muxe.db"),
    rateLimit: Object.freeze({ capacity, refillPerSec }),
  });
}

export const config: Config = loadConfig();
