"use strict";

const crypto = require("crypto");

function config() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SECRET_KEY || "";
  if (!url.startsWith("https://") || !key || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    const error = new Error("サーバー設定がまだ完了していません。管理者に確認してね。");
    error.status = 503;
    throw error;
  }
  return { url, key };
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function method(req, res, expected) {
  if (req.method === expected) return true;
  res.setHeader("Allow", expected);
  send(res, 405, { error: "この操作には対応していません。" });
  return false;
}

function bodyOf(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return {};
}

async function db(table, query, options = {}) {
  const { url, key } = config();
  const qs = new URLSearchParams(query || {}).toString();
  const response = await fetch(url + "/rest/v1/" + table + (qs ? "?" + qs : ""), {
    method: options.method || "GET",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      ...(options.returning ? { Prefer: "return=representation" } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch (_) {}
  if (!response.ok) {
    const error = new Error("Supabase database request failed");
    error.status = response.status;
    error.code = data && data.code;
    throw error;
  }
  return data;
}

function cleanName(value) {
  if (typeof value !== "string") return "冒険者";
  return value.replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 12) || "冒険者";
}

function validUsername(value) {
  return typeof value === "string" && /^[\p{L}\p{N}_-]{3,16}$/u.test(value.trim());
}

function validPassword(value) {
  return typeof value === "string" && value.length >= 10 && Buffer.byteLength(value, "utf8") <= 72;
}

function sign(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", process.env.SESSION_SECRET).update(encoded).digest("base64url");
  return encoded + "." + signature;
}

function cookieValue(req, name) {
  const header = req.headers && req.headers.cookie || "";
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return "";
}

function getSession(req) {
  const token = cookieValue(req, "world_session");
  const pieces = token.split(".");
  if (pieces.length !== 2) return null;
  const expected = crypto.createHmac("sha256", process.env.SESSION_SECRET || "invalid").update(pieces[0]).digest();
  let actual;
  try { actual = Buffer.from(pieces[1], "base64url"); } catch (_) { return null; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(pieces[0], "base64url").toString("utf8"));
    if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (_) { return null; }
}

function setSession(res, user) {
  const token = sign({
    sub: user.id,
    username: user.username,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  });
  res.setHeader("Set-Cookie", "world_session=" + encodeURIComponent(token) + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000");
}

function clearSession(res) {
  res.setHeader("Set-Cookie", "world_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
}

function publicProfile(row) {
  return {
    username: row.username,
    name: row.character_name,
    x: Number(row.x),
    y: Number(row.y),
    level: Number(row.level || 1),
    gold: Number(row.gold || 0),
  };
}

function handleError(res, error) {
  if (error && error.status === 503) return send(res, 503, { error: error.message });
  console.error("API error:", error && (error.code || error.message) || error);
  return send(res, 500, { error: "サーバーで問題が発生しました。設定を確認して、もう一度試してね。" });
}

module.exports = {
  db, send, method, bodyOf, cleanName, validUsername, validPassword,
  getSession, setSession, clearSession, publicProfile, handleError,
};