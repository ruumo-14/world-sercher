"use strict";

const { db, send } = require("../lib/backend");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { ready: false, error: "この操作には対応していません。" });
  }

  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const realtimeKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
  const missing = [];
  if (!url.startsWith("https://")) missing.push("SUPABASE_URL");
  if (!serviceKey) missing.push("SUPABASE_SECRET_KEY（または SUPABASE_SERVICE_ROLE_KEY）");
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) missing.push("SESSION_SECRET（32文字以上）");
  if (!realtimeKey) missing.push("SUPABASE_PUBLISHABLE_KEY（または SUPABASE_ANON_KEY）");
  if (missing.length) return send(res, 503, { ready: false, missing });

  try {
    await db("game_users", { select: "id", limit: "1" });
    return send(res, 200, { ready: true, database: "connected", realtime: "configured" });
  } catch (_) {
    return send(res, 503, {
      ready: false,
      error: "Supabaseデータベースに接続できません。URL・サーバーキー・テーブル設定を確認してね。"
    });
  }
};
