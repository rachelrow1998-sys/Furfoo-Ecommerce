/**
 * A stand-in for the Furfoo POS, for tests.
 *
 * It copies the four behaviours the storefront depends on: session login, the
 * product list with live stock, an online order that deducts stock and
 * deduplicates on externalOrderKey, and serving product photos from
 * /uploads/products/ without a session - which is how the real POS publishes an
 * uploaded photo, and is what lets the website link to it directly.
 */

import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

const imageTypes = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

export function startFakePos({ username = "web", password = "secret", products = [], uploadDir = "" } = {}) {
  const state = {
    products: new Map(products.map((product) => [product.sku, { ...product }])),
    sessions: new Set(),
    externalKeys: new Map(),
    orders: [],
    loginCount: 0
  };

  async function readJson(request) {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString("utf8");
    return text ? JSON.parse(text) : {};
  }

  function send(response, status, payload, headers = {}) {
    const body = JSON.stringify(payload);
    response.writeHead(status, { "content-type": "application/json", ...headers });
    response.end(body);
  }

  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");

    // Product photos are public on the real POS: no session, no CORS dance.
    if (request.method === "GET" && url.pathname.startsWith("/uploads/products/")) {
      const name = basename(decodeURIComponent(url.pathname));
      const file = uploadDir ? join(uploadDir, name) : "";
      const type = imageTypes[extname(name).toLowerCase()];
      if (!file || !type || !existsSync(file)) {
        response.writeHead(404, { "content-type": "text/plain" });
        return response.end("Not found");
      }
      response.writeHead(200, { "content-type": type, "cache-control": "public, max-age=60" });
      return response.end(readFileSync(file));
    }

    const cookie = String(request.headers.cookie || "");
    const token = cookie.match(/furfoo_session=([^;]+)/)?.[1];
    const signedIn = token && state.sessions.has(token);

    if (request.method === "POST" && url.pathname === "/api/auth/login") {
      const body = await readJson(request);
      state.loginCount += 1;
      if (body.username !== username || body.password !== password) {
        return send(response, 401, { ok: false, error: "Invalid credentials" });
      }
      const session = `session-${state.sessions.size + 1}-${Date.now()}`;
      state.sessions.add(session);
      return send(response, 200, { ok: true }, { "set-cookie": `furfoo_session=${session}; Path=/; HttpOnly; SameSite=Lax` });
    }

    if (!signedIn) return send(response, 401, { ok: false, error: "Login required." });

    if (request.method === "GET" && url.pathname === "/api/inventory/products") {
      return send(response, 200, { products: [...state.products.values()] });
    }

    if (request.method === "POST" && url.pathname === "/api/online/whatsapp-orders") {
      const body = await readJson(request);
      const key = String(body.externalOrderKey || "");
      if (key && state.externalKeys.has(key)) {
        return send(response, 200, { ok: true, order: { ...state.externalKeys.get(key), duplicate: true } });
      }
      for (const item of body.items || []) {
        const product = state.products.get(item.sku);
        if (!product) return send(response, 400, { ok: false, error: `SKU ${item.sku} does not exist.` });
        if (product.stockQty < item.qty) {
          return send(response, 400, { ok: false, error: `Insufficient stock for ${item.sku}. Need ${item.qty}, available ${product.stockQty}.` });
        }
      }
      for (const item of body.items || []) {
        const product = state.products.get(item.sku);
        product.stockQty -= item.qty;
      }
      const order = { reference: body.reference || key, orderNo: `POS-${state.orders.length + 1}`, duplicate: false };
      state.orders.push({ ...body, orderNo: order.orderNo });
      if (key) state.externalKeys.set(key, order);
      return send(response, 200, { ok: true, order });
    }

    return send(response, 404, { ok: false, error: "Unknown route" });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        server,
        state,
        baseUrl: `http://127.0.0.1:${server.address().port}`,
        expireSessions: () => state.sessions.clear(),
        close: () => new Promise((done) => server.close(done))
      });
    });
  });
}
