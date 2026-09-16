import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Minimal exact-match router for a handful of GET routes. No path params
 * needed for a business card, so this stays intentionally tiny.
 */

export interface RequestContext {
  req: IncomingMessage;
  res: ServerResponse;
  /** Normalized path: lowercased, trailing slash stripped. */
  path: string;
  method: string;
  accept: string | undefined;
}

export type Handler = (ctx: RequestContext) => void;

interface Route {
  method: string;
  path: string;
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];
  private notFoundHandler: Handler = ({ res }) => {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found\n");
  };
  private methodNotAllowedHandler: Handler = ({ res }) => {
    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method Not Allowed\n");
  };

  get(path: string, handler: Handler): this {
    this.routes.push({ method: "GET", path, handler });
    return this;
  }

  setNotFound(handler: Handler): this {
    this.notFoundHandler = handler;
    return this;
  }

  setMethodNotAllowed(handler: Handler): this {
    this.methodNotAllowedHandler = handler;
    return this;
  }

  handle(ctx: RequestContext): void {
    const pathMatches = this.routes.filter((r) => r.path === ctx.path);

    if (pathMatches.length === 0) {
      this.notFoundHandler(ctx);
      return;
    }

    // HEAD is handled by the matching GET route; node:http automatically
    // suppresses the response body for HEAD requests.
    const lookupMethod = ctx.method === "HEAD" ? "GET" : ctx.method;

    const route = pathMatches.find((r) => r.method === lookupMethod);
    if (!route) {
      // Path exists but not for this method (e.g. POST to a GET route).
      this.methodNotAllowedHandler(ctx);
      return;
    }

    route.handler(ctx);
  }
}

/** Lowercase and strip a single trailing slash (but keep root "/"). */
export function normalizePath(rawUrl: string): string {
  // Parse against a dummy base to strip query string safely.
  const { pathname } = new URL(rawUrl, "http://localhost");
  let p = decodeURIComponent(pathname).toLowerCase();
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}
