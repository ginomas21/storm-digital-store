import login from "../lib/handlers/reseller/login.js";
import logout from "../lib/handlers/reseller/logout.js";
import me from "../lib/handlers/reseller/me.js";
import orders from "../lib/handlers/reseller/orders.js";
import { bad } from "../lib/http.js";

// Satu file = satu Serverless Function di paket Hobby Vercel (maks 12).
// Semua aksi reseller lama (/api/reseller/login, /me, dst.) kini lewat sini:
//   /api/reseller?action=login | logout | me | orders
const ACTIONS = { login, logout, me, orders };
export default async function handler(req, res) {
  const h = ACTIONS[String(req.query.action || "")];
  if (!h) return bad(res, 404, "Aksi reseller tidak dikenal");
  return h(req, res);
}
