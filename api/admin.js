import login from "../lib/handlers/admin/login.js";
import logout from "../lib/handlers/admin/logout.js";
import me from "../lib/handlers/admin/me.js";
import products from "../lib/handlers/admin/products.js";
import stock from "../lib/handlers/admin/stock.js";
import orders from "../lib/handlers/admin/orders.js";
import resellers from "../lib/handlers/admin/resellers.js";
import settings from "../lib/handlers/admin/settings.js";
import { bad } from "../lib/http.js";

// Satu file = satu Serverless Function di paket Hobby Vercel (maks 12).
// Semua aksi admin lama (/api/admin/login, /products, dst.) kini lewat sini:
//   /api/admin?action=login | logout | me | products | stock | orders | resellers | settings
const ACTIONS = { login, logout, me, products, stock, orders, resellers, settings };
export default async function handler(req, res) {
  const h = ACTIONS[String(req.query.action || "")];
  if (!h) return bad(res, 404, "Aksi admin tidak dikenal");
  return h(req, res);
}
