import type { ServerResponse } from "node:http";

/**
 * Small HTTP helpers so route handlers stay declarative. Everything is
 * hand-rolled on top of node:http — no framework.
 */

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

/** Pretty-print JSON so the raw API is pleasant to read in a terminal. */
export function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2) + "\n";
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    ...SECURITY_HEADERS,
  });
  res.end(payload);
}

/** 302 redirect to an external URL. */
export function redirect(res: ServerResponse, location: string): void {
  res.writeHead(302, {
    Location: location,
    "Content-Type": "text/plain; charset=utf-8",
    ...SECURITY_HEADERS,
  });
  res.end(`Redirecting to ${location}\n`);
}

/**
 * Wrap a JSON body in a minimal styled HTML page for browsers, so a human
 * visiting muxe.org sees something readable instead of a raw dump.
 */
export function html(res: ServerResponse, status: number, body: unknown): void {
  const pretty = JSON.stringify(body, null, 2);
  const page = renderPage(pretty);
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(page),
    ...SECURITY_HEADERS,
  });
  res.end(page);
}

/**
 * Content negotiation: browsers send `Accept: text/html`, curl/httpie and API
 * clients don't. Return true when we should render the HTML viewer.
 */
export function prefersHtml(accept: string | undefined): boolean {
  if (!accept) return false;
  const html = accept.indexOf("text/html");
  if (html === -1) return false;
  const jsonIdx = accept.indexOf("application/json");
  // If the client explicitly lists JSON before HTML, honor JSON.
  return jsonIdx === -1 || html < jsonIdx;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderPage(pretty: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>muxe.org — REST API business card</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0; padding: 2rem 1.25rem;
    background: #0d1117; color: #c9d1d9;
    font: 14px/1.6 ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  }
  .wrap { max-width: 720px; margin: 0 auto; }
  .hint {
    color: #8b949e; margin: 0 0 1rem; font-size: 13px;
  }
  .hint code {
    background: #161b22; border: 1px solid #30363d;
    border-radius: 6px; padding: 2px 6px; color: #58a6ff;
  }
  pre {
    background: #161b22; border: 1px solid #30363d; border-radius: 8px;
    padding: 1rem 1.25rem; overflow-x: auto; margin: 0;
  }
  a { color: #58a6ff; }
</style>
</head>
<body>
  <div class="wrap">
    <p class="hint">This is a REST API. Try <code>curl https://muxe.org</code> — or follow the <code>_links</code> below.</p>
    <pre>${escapeHtml(pretty)}</pre>
  </div>
</body>
</html>
`;
}
