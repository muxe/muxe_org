import http from "node:http";
import { normalizePath, type RequestContext } from "./router.ts";
import { buildRouter } from "./routes.ts";

const PORT = Number(process.env.PORT ?? 3000);
// Bind to localhost by default: the app sits behind Caddy, never exposed directly.
const HOST = process.env.HOST ?? "127.0.0.1";

const router = buildRouter();

const server = http.createServer((req, res) => {
  const method = req.method ?? "GET";
  const path = normalizePath(req.url ?? "/");

  const ctx: RequestContext = {
    req,
    res,
    path,
    method,
    accept: req.headers.accept,
    params: {},
  };

  // Access log: method, path, and resulting status.
  res.on("finish", () => {
    console.log(`${method} ${path} -> ${res.statusCode}`);
  });

  try {
    router.handle(ctx);
  } catch (err) {
    console.error("Unhandled error:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(`${JSON.stringify({ error: "internal_server_error" })}\n`);
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`muxe.org API listening on http://${HOST}:${PORT}`);
});

// Graceful shutdown so systemd restarts/deploys are clean.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down.`);
    server.close(() => process.exit(0));
  });
}
