import { email, profile, projects, socials } from "./data.ts";
import { html, json, prefersHtml, redirect } from "./http.ts";
import { Router } from "./router.ts";

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

  // Root: profile + discoverable links to everything else.
  router.get("/", (ctx) => {
    respond(ctx, 200, {
      ...profile,
      _links: {
        self: { href: "/", method: "GET" },
        github: { href: "/github", method: "GET", description: "302 redirect to GitHub" },
        linkedin: { href: "/linkedin", method: "GET", description: "302 redirect to LinkedIn" },
        projects: { href: "/projects", method: "GET" },
        contact: { href: "/contact", method: "GET" },
        health: { href: "/health", method: "GET" },
      },
    });
  });

  // Redirects to external profiles.
  for (const [key, url] of Object.entries(socials)) {
    router.get(`/${key}`, (ctx) => redirect(ctx.res, url));
  }

  router.get("/projects", (ctx) => {
    respond(ctx, 200, { count: projects.length, projects });
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
        "GET /projects",
        "GET /contact",
        "GET /health",
      ],
    });
  });

  router.setMethodNotAllowed((ctx) => {
    respond(ctx, 405, {
      error: "method_not_allowed",
      message: `${ctx.method} is not allowed on ${ctx.path}. This API is read-only.`,
    });
  });

  return router;
}
