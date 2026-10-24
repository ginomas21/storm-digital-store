import crypto from "node:crypto";

// Verifikasi tanda tangan webhook Svix (dipakai Resend untuk semua webhook).
// Secret format: "whsec_<base64>"; konten yang ditandatangani: "<id>.<timestamp>.<rawBody>".
// Header bisa bernama svix-* (Svix asli) — keduanya dicek.
export function verifySvix(rawBody, headers, secret, toleranceSec = 300) {
  const id = headers["svix-id"] || headers["webhook-id"];
  const timestamp = headers["svix-timestamp"] || headers["webhook-timestamp"];
  const signature = headers["svix-signature"] || headers["webhook-signature"];
  if (!id || !timestamp || !signature || !secret) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > toleranceSec) return false;
  const key = Buffer.from(String(secret).replace(/^whsec_/, ""), "base64");
  const expected = crypto
    .createHmac("sha256", key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");
  const expectedBuf = Buffer.from(expected);
  return String(signature)
    .split(" ")
    .some((part) => {
      const sig = part.includes(",") ? part.split(",")[1] : part;
      const sigBuf = Buffer.from(sig || "");
      return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
    });
}
