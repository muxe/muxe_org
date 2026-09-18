/**
 * Tiny in-memory per-key token-bucket rate limiter. No dependency, no shared
 * store — fine because the app runs as a single process behind Caddy. Buckets
 * live in a Map keyed by client IP; stale buckets are swept periodically so
 * the Map can't grow unbounded from one-off visitors.
 *
 * Token bucket: each key starts full with `capacity` tokens that refill at
 * `refillPerSec`. Every allowed request costs one token. When empty, requests
 * are denied until enough time passes to refill a token — this permits short
 * bursts (up to `capacity`) while capping the sustained rate.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Tokens left after this request (floored). */
  remaining: number;
  /** Seconds until at least one token is available (0 when allowed). */
  retryAfter: number;
}

interface Bucket {
  tokens: number;
  /** Last refill timestamp, ms. */
  updatedAt: number;
}

export interface RateLimiterOptions {
  /** Max burst size and starting tokens. */
  capacity: number;
  /** Sustained refill rate, tokens per second. */
  refillPerSec: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly capacity: number;
  private readonly refillPerSec: number;
  private readonly sweeper: NodeJS.Timeout;

  constructor(opts: RateLimiterOptions) {
    this.capacity = opts.capacity;
    this.refillPerSec = opts.refillPerSec;

    // Periodically drop buckets that have fully refilled — they're
    // indistinguishable from a fresh key, so we can forget them.
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    // Don't keep the event loop alive just for cleanup.
    this.sweeper.unref();
  }

  /** Attempt to consume one token for `key`. */
  take(key: string): RateLimitResult {
    const now = Date.now();
    const bucket = this.buckets.get(key) ?? {
      tokens: this.capacity,
      updatedAt: now,
    };

    // Refill based on elapsed time since last update, capped at capacity.
    const elapsedSec = (now - bucket.updatedAt) / 1000;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsedSec * this.refillPerSec);
    bucket.updatedAt = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      this.buckets.set(key, bucket);
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        retryAfter: 0,
      };
    }

    // Not enough tokens: compute how long until one refills.
    this.buckets.set(key, bucket);
    const needed = 1 - bucket.tokens;
    const retryAfter = Math.ceil(needed / this.refillPerSec);
    return { allowed: false, remaining: 0, retryAfter };
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      const elapsedSec = (now - bucket.updatedAt) / 1000;
      const refilled = bucket.tokens + elapsedSec * this.refillPerSec;
      if (refilled >= this.capacity) this.buckets.delete(key);
    }
  }
}
