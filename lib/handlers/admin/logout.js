import { sessionCookie } from "../../auth.js";
export default async function handler(req, res) {
  res.setHeader("Set-Cookie", sessionCookie("", 0));
  res.status(200).json({ ok: true });
}
