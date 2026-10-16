import { createServer, type IncomingHttpHeaders } from "node:http";
import app from "../../backend/app";

const port = Number(process.env.API_PORT || 8787);
const maxLocalBodyBytes = 100_000;
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "Backend database settings are missing. Read devops/DEPLOYMENT.md, fill .env, and run npm run doctor:cloud. Liveness works; forms and owner data need the test database.",
  );
}

function toWebHeaders(incoming: IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  return headers;
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const method = incoming.method || "GET";
    const chunks: Buffer[] = [];
    let bodySize = 0;
    if (method !== "GET" && method !== "HEAD") {
      for await (const chunk of incoming) {
        const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bodySize += part.byteLength;
        if (bodySize > maxLocalBodyBytes) {
          outgoing.writeHead(413, { "Content-Type": "application/json" });
          outgoing.end('{"error":"request_too_large"}');
          return;
        }
        chunks.push(part);
      }
    }

    // Trust the configured local site origin, never a submitted Origin header.
    const headers = toWebHeaders(incoming.headers);
    const base = process.env.APP_ORIGIN || "http://127.0.0.1:4321";
    const url = new URL(incoming.url || "/", base);
    const body =
      method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks);
    const request = new Request(url, {
      method,
      headers,
      body: body?.byteLength ? body : undefined,
    });
    const context = { ip: incoming.socket.remoteAddress || "local" };
    const response = await app(request, context);
    outgoing.writeHead(
      response.status,
      Object.fromEntries(response.headers.entries()),
    );
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500, { "Content-Type": "application/json" });
    outgoing.end('{"error":"local_api_error"}');
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local API ready at http://127.0.0.1:${port}`);
  if (process.connected) process.send?.({ type: "api-ready", port });
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

// The parent start script requests graceful shutdown over IPC on Windows.
process.on("message", (message) => {
  if (message === "shutdown") server.close(() => process.exit(0));
});
process.on("disconnect", () => server.close(() => process.exit(0)));
