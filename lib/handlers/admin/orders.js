import { requireAdmin } from "../../auth.js";
import { listOrders, demoMode } from "../../db.js";

// GET /api/admin/orders — 100 transaksi terakhir + ringkasan omzet (status sukses*)
export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const orders = await listOrders(100);
  const omzet = orders.filter(o => String(o.status).startsWith("sukses")).reduce((a, o) => a + Number(o.total || 0), 0);
  res.status(200).json({ orders, omzet_recent: omzet, demo: demoMode });
}
