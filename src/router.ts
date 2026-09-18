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
  /** Path parameters captured from the matched route (e.g. { key: "rocket" }). */
  params: Record<string, string>;
}

export type Handler = (ctx: RequestContext) => void;

interface Route {
  method: string;
  /** Path pattern; segments beginning with ":" are parameters. */
  path: string;
  /** Precomputed segments for matching. */
  segments: string[];
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
    return this.add("GET", path, handler);
  }

  post(path: string, handler: Handler): this {
    return this.add("POST", path, handler);
  }

  private add(method: string, path: string, handler: Handler): this {
    this.routes.push({
      method,
      path,
      segments: splitSegments(path),
      handler,
    });
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
    const reqSegments = splitSegments(ctx.path);
    const pathMatches = this.routes.filter((r) => segmentsMatch(r.segments, reqSegments));

    if (pathMatches.length === 0) {
      this.notFoundHandler(ctx);
      return;
    }

    // HEAD is handled by the matching GET route; node:http automatically
    // suppresses the response body for HEAD requests.
    const lookupMethod = ctx.method === "HEAD" ? "GET" : ctx.method;

    const route = pathMatches.find((r) => r.method === lookupMethod);
    if (!route) {
      // Path exists but not for this method (e.g. GET on a POST-only route).
      this.methodNotAllowedHandler(ctx);
      return;
    }

    ctx.params = extractParams(route.segments, reqSegments);
    route.handler(ctx);
  }
}

/** Split a normalized path into non-empty segments ("/" -> []). */
function splitSegments(path: string): string[] {
  return path.split("/").filter((s) => s.length > 0);
}

/** True if a route's segments match the request's, treating ":x" as a wildcard. */
function segmentsMatch(route: string[], req: string[]): boolean {
  if (route.length !== req.length) return false;
  for (let i = 0; i < route.length; i++) {
    const seg = route[i];
    if (seg === undefined) return false;
    if (seg.startsWith(":")) continue; // parameter matches any single segment
    if (seg !== req[i]) return false;
  }
  return true;
}

/** Pull ":param" values out of the request segments for a matched route. */
function extractParams(route: string[], req: string[]): Record<string, string> {
  const params: Record<string, string> = {};
  for (let i = 0; i < route.length; i++) {
    const seg = route[i];
    const value = req[i];
    if (seg?.startsWith(":") && value !== undefined) {
      params[seg.slice(1)] = value;
    }
  }
  return params;
}

/** Lowercase and strip a single trailing slash (but keep root "/"). */
export function normalizePath(rawUrl: string): string {
  // Parse against a dummy base to strip query string safely.
  const { pathname } = new URL(rawUrl, "http://localhost");
  let p = decodeURIComponent(pathname).toLowerCase();
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}
