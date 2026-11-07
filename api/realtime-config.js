"use strict";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "この操作には対応していません。" }));
  }

  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  // Supabase Publishable keys are intended for browser clients. Keep the
  // Secret key server-side only. Retain the legacy anon variable as fallback.
  const publicKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";

  if (!url.startsWith("https://") || !publicKey) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({
      error: "オンライン通信の設定がありません。",
      missing: [
        ...(!url.startsWith("https://") ? ["SUPABASE_URL"] : []),
        ...(!publicKey ? ["SUPABASE_PUBLISHABLE_KEY"] : [])
      ]
    }));
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify({ url, anonKey: publicKey }));
};
