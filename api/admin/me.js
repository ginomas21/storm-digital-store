import { readSession } from "../../lib/auth.js";
export default async function handler(req, res) {
  const s = readSession(req);
  res.status(200).json({ logged_in: !!s, username: s?.u || null });
}
