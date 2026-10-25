import { requireAdmin } from "../../auth.js";
import { getDashboardStats } from "../../db.js";

// GET /api/admin?action=stats — statistik dashboard (admin saja).
export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "GET") { res.status(405).json({ error: "Method tidak diizinkan" }); return; }
  const s = await getDashboardStats();
  res.status(200).json(s);
}
