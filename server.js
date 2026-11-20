// DN Digital Store — server Node mandiri (pengganti Vercel serverless).
// Menjalankan handler di folder api/ apa adanya (gaya Vercel: export default
// handler(req,res) dengan res.status().json()), plus menyajikan file statis
// dan rewrite yang dulu diatur vercel.json.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
};

// Rewrite dari vercel.json (urutan penting: host temp-mail dulu).
const REWRITES = [
  { host: "temp.pengagumku.id", source: "/", destination: "/temp-mail.html" },
  { source: "/temp-mail", destination: "/temp-mail.html" },
  { source: "/admin", destination: "/admin.html" },
  { source: "/reseller", destination: "/reseller.html" },
  { source: "/mini", destination: "/mini.html" },
  { source: "/produk", destination: "/produk.html" },
  { source: "/cek-pesanan", destination: "/cek-pesanan.html" },
  { source: "/cara-beli", destination: "/cara-beli.html" },
  { source: "/faq", destination: "/faq.html" },
  { source: "/kontak", destination: "/kontak.html" },
  { source: "/", destination: "/index.html" },
];

// Path yang tidak boleh disajikan sebagai file statis.
const BLOCKED_PREFIXES = ["/api/", "/lib/", "/node_modules/", "/.git/"];
const BLOCKED_FILES = new Set([
  "/server.js",
  "/package.json",
  "/package-lock.json",
  "/vercel.json",
  "/.env",
  "/README.md",
]);

const handlerCache = new Map();
async function loadHandler(name) {
  if (handlerCache.has(name)) return handlerCache.get(name);
  const file = join(ROOT, "api", `${name}.js`);
  if (!existsSync(file)) return null;
  const mod = await import(`file://${file}`);
  const entry = { handler: mod.default, config: mod.config || null };
  handlerCache.set(name, entry);
  return entry;
}

function decorateRes(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    if (!res.hasHeader("Content-Type"))
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = (body) => {
    if (body && typeof body === "object" && !Buffer.isBuffer(body))
      return res.json(body);
    if (!res.hasHeader("Content-Type"))
      res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(body);
    return res;
  };
  res.redirect = (a, b) => {
    const code = typeof a === "number" ? a : 307;
    const url = typeof a === "number" ? b : a;
    res.statusCode = code;
    res.setHeader("Location", url);
    res.end();
    return res;
  };
  return res;
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

function parseQuery(searchParams) {
  const q = {};
  for (const [k, v] of searchParams) {
    if (k in q) q[k] = Array.isArray(q[k]) ? [...q[k], v] : [q[k], v];
    else q[k] = v;
  }
  return q;
}

async function serveStatic(req, res, pathname) {
  let target = pathname;
  const host = String(req.headers.host || "").split(":")[0];
  for (const rw of REWRITES) {
    if (rw.host && rw.host !== host) continue;
    if (rw.source === target) {
      target = rw.destination;
      break;
    }
  }
  if (BLOCKED_FILES.has(target) || BLOCKED_PREFIXES.some((p) => target.startsWith(p)))
    return false;
  const ext = extname(target);
  if (!MIME[ext]) return false;
  const filePath = normalize(join(ROOT, target));
  if (!filePath.startsWith(ROOT) || !existsSync(filePath)) return false;
  const data = await readFile(filePath);
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME[ext]);
  if (ext === ".html") res.setHeader("Cache-Control", "no-cache");
  else res.setHeader("Cache-Control", "public, max-age=86400");
  res.end(req.method === "HEAD" ? undefined : data);
  return true;
}

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  decorateRes(res);
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname.startsWith("/api/")) {
      const name = pathname.slice(5).replace(/\/+$/, "");
      if (!name || name.includes("/") || name.includes("..")) {
        return res.status(404).json({ error: "Not found" });
      }
      const entry = await loadHandler(name);
      if (!entry || typeof entry.handler !== "function") {
        return res.status(404).json({ error: "Not found" });
      }
      req.query = parseQuery(url.searchParams);
      const skipParser =
        entry.config && entry.config.api && entry.config.api.bodyParser === false;
      if (!skipParser) {
        const raw = await readBody(req);
        const ct = String(req.headers["content-type"] || "");
        if (raw.length === 0) req.body = {};
        else if (ct.includes("application/json")) {
          try {
            req.body = JSON.parse(raw.toString("utf8"));
          } catch {
            return res.status(400).json({ error: "Body bukan JSON valid" });
          }
        } else if (ct.includes("application/x-www-form-urlencoded")) {
          req.body = parseQuery(new URLSearchParams(raw.toString("utf8")));
        } else {
          req.body = raw.toString("utf8");
        }
      }
      await entry.handler(req, res);
      if (!res.writableEnded) res.end();
    } else if (req.method === "GET" || req.method === "HEAD") {
      const served = await serveStatic(req, res, pathname);
      if (!served) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end("Not found");
      }
    } else {
      res.statusCode = 405;
      res.end("Method not allowed");
    }
  } catch (err) {
    console.error("ERROR", req.method, req.url, err);
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  } finally {
    console.log(
      `${req.method} ${req.url} -> ${res.statusCode} (${Date.now() - started}ms)`
    );
  }
});

server.listen(PORT, HOST, () => {
  console.log(`DN Store server listening on ${HOST}:${PORT}`);
});
