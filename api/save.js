"use strict";

const { db, send, method, bodyOf, cleanName, getSession, handleError } = require("../lib/backend");

module.exports = async function handler(req, res) {
  if (!method(req, res, "POST")) return;
  try {
    const session = getSession(req);
    if (!session) return send(res, 401, { error: "ログインが必要です。" });

    const body = bodyOf(req);
    const x = Number(body.x), y = Number(body.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return send(res, 400, { error: "位置データが正しくありません。" });
    }

    await db("game_saves", { user_id: "eq." + session.sub }, {
      method: "PATCH",
      body: {
        character_name: cleanName(body.name),
        x: Math.max(12, Math.min(3200 - 12, x)),
        y: Math.max(12, Math.min(2400 - 12, y)),
        updated_at: new Date().toISOString(),
      },
    });
    return send(res, 200, { ok: true });
  } catch (error) {
    return handleError(res, error);
  }
};