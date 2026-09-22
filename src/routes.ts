import { config } from "./config.ts";
import {
  email,
  experience,
  isReactionKey,
  now,
  profile,
  projects,
  REACTION_KEYS,
  socials,
  yearsOfExperience,
} from "./data.ts";
import { getReactions, incrementReaction } from "./db.ts";
import { clientIp, html, json, prefersHtml, redirect } from "./http.ts";
import { RateLimiter } from "./ratelimit.ts";
import { Router } from "./router.ts";

/** Human-readable list of allowed reaction keys, for error/help messages. */
const REACTION_LABEL = REACTION_KEYS.join(", ");

/**
 * Respond with JSON, or the HTML viewer when a browser asks for it.
 */
function respond(
  ctx: { res: import("node:http").ServerResponse; accept: string | undefined },
  status: number,
  body: unknown,
): void {
  if (prefersHtml(ctx.accept)) {
    html(ctx.res, status, body);
  } else {
    json(ctx.res, status, body);
  }
}

export function buildRouter(): Router {
  const router = new Router();

  // Rate limiter for the public write endpoint: allow a small burst then
  // ~1 request/sec sustained per client IP. Enough for a human tapping
  // reactions, stingy enough to make botting the counter pointless.
  const reactionLimiter = new RateLimiter({
    capacity: config.rateLimit.capacity,
    refillPerSec: config.rateLimit.refillPerSec,
  });

  // Root: profile + discoverable links to everything else.
  router.get("/", (ctx) => {
    respond(ctx, 200, {
      ...profile,
      experienceYears: yearsOfExperience(),
      _links: {
        self: { href: "/", method: "GET" },
        github: { href: "/github", method: "GET", description: "302 redirect to GitHub" },
        linkedin: { href: "/linkedin", method: "GET", description: "302 redirect to LinkedIn" },
        experience: { href: "/experience", method: "GET", description: "Work history" },
        projects: { href: "/projects", method: "GET" },
        now: { href: "/now", method: "GET", description: "What I'm focused on right now" },
        reactions: { href: "/reactions", method: "GET", description: "Public reaction counts" },
        react: {
          href: "/reactions/{key}",
          method: "POST",
          description: "Increment a reaction. key is one of: rocket, whale, coffee, thumbsup",
        },
        contact: { href: "/contact", method: "GET" },
        health: { href: "/health", method: "GET" },
      },
    });
  });

  // Redirects to external profiles.
  for (const [key, url] of Object.entries(socials)) {
    router.get(`/${key}`, (ctx) => redirect(ctx.res, url));
  }

  router.get("/experience", (ctx) => {
    respond(ctx, 200, { count: experience.length, experience });
  });

  router.get("/projects", (ctx) => {
    respond(ctx, 200, { count: projects.length, projects });
  });

  router.get("/now", (ctx) => {
    respond(ctx, 200, now);
  });

  // Public, persisted reaction counters. Read-anytime.
  router.get("/reactions", (ctx) => {
    const reactions = getReactions();
    respond(ctx, 200, {
      reactions: Object.fromEntries(reactions.map((r) => [r.key, r.count])),
      emoji: Object.fromEntries(reactions.map((r) => [r.key, r.emoji])),
      _links: {
        self: { href: "/reactions", method: "GET" },
        react: {
          href: "/reactions/{key}",
          method: "POST",
          description: `key is one of: ${REACTION_LABEL}`,
        },
      },
    });
  });

  // Increment one reaction. The key comes from the path and MUST be in the
  // fixed set — no free text, no request body. Rate-limited per client IP.
  router.post("/reactions/:key", (ctx) => {
    const key = ctx.params.key ?? "";

    if (!isReactionKey(key)) {
      respond(ctx, 400, {
        error: "invalid_reaction",
        message: `Unknown reaction '${key}'. Allowed: ${REACTION_LABEL}`,
      });
      return;
    }

    const limit = reactionLimiter.take(clientIp(ctx.req));
    if (!limit.allowed) {
      ctx.res.setHeader("Retry-After", String(limit.retryAfter));
      respond(ctx, 429, {
        error: "rate_limited",
        message: "Too many reactions. Slow down a little.",
        retryAfter: limit.retryAfter,
      });
      return;
    }

    const updated = incrementReaction(key);
    if (!updated) {
      // Shouldn't happen: key validated above and rows are seeded by migration.
      respond(ctx, 500, { error: "internal_server_error" });
      return;
    }

    respond(ctx, 200, {
      key: updated.key,
      emoji: updated.emoji,
      count: updated.count,
      remaining: limit.remaining,
    });
  });

  router.get("/contact", (ctx) => {
    respond(ctx, 200, {
      // Split to deter naive email harvesters — reassemble as user@domain.
      email: {
        user: email.user,
        domain: email.domain,
        note: "Reassemble as user@domain to email me.",
      },
      links: socials,
    });
  });

  // Plain JSON always — this is for uptime monitors, not humans.
  router.get("/health", (ctx) => {
    json(ctx.res, 200, { status: "ok", uptime: process.uptime() });
  });

  // 404 with discoverable route list.
  router.setNotFound((ctx) => {
    respond(ctx, 404, {
      error: "not_found",
      message: `No route for ${ctx.method} ${ctx.path}`,
      availableRoutes: [
        "GET /",
        ...Object.keys(socials).map((k) => `GET /${k}`),
        "GET /experience",
        "GET /projects",
        "GET /now",
        "GET /reactions",
        "POST /reactions/{key}",
        "GET /contact",
        "GET /health",
      ],
    });
  });

  router.setMethodNotAllowed((ctx) => {
    respond(ctx, 405, {
      error: "method_not_allowed",
      message: `${ctx.method} is not allowed on ${ctx.path}.`,
    });
  });

  return router;
}
