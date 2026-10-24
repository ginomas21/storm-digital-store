import { requireReseller } from "../../lib/auth.js";
import { listResellerOrders } from "../../lib/db.js";

// GET /api/reseller/orders — riwayat pesanan reseller yang login (miliknya sendiri)
export default async function handler(req, res) {
  const s = requireReseller(req, res);
  if (!s) return;
  return res.status(200).json({ orders: await listResellerOrders(s.rid) });
}
