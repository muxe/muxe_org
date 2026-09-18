import http from "node:http";
import { config } from "./config.ts";
import { normalizePath, type RequestContext } from "./router.ts";
import { buildRouter } from "./routes.ts";

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

server.listen(config.port, config.host, () => {
  // Log the ACTUAL bound port: with PORT=0 the OS assigns one, and tests parse
  // this line to discover it. With a fixed port it just echoes that port.
  const addr = server.address();
  const boundPort = typeof addr === "object" && addr ? addr.port : config.port;
  console.log(`muxe.org API listening on http://${config.host}:${boundPort}`);
});

// Graceful shutdown so systemd restarts/deploys are clean.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down.`);
    server.close(() => process.exit(0));
  });
}
