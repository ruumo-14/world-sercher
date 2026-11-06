"use strict";

const { db, send, method, bodyOf, getSession, handleError } = require("../lib/backend");

module.exports = async function handler(req, res) {
  try {
    const session = getSession(req);
    if (!session) return send(res, 401, { error: "ログインが必要です。" });

    if (req.method === "GET") {
      const rows = await db("game_saves", {
        select: "game_data",
        user_id: "eq." + session.sub,
        limit: "1",
      });
      return send(res, 200, { gameData: Array.isArray(rows) && rows[0] ? rows[0].game_data || {} : {} });
    }

    if (req.method === "POST") {
      const data = bodyOf(req).gameData;
      if (!data || typeof data !== "object" || Array.isArray(data) || Buffer.byteLength(JSON.stringify(data), "utf8") > 20000) {
        return send(res, 400, { error: "冒険者データの形式が正しくありません。" });
      }
      await db("game_saves", { user_id: "eq." + session.sub }, {
        method: "PATCH",
        body: { game_data: data, updated_at: new Date().toISOString() },
      });
      return send(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "この操作には対応していません。" });
  } catch (error) {
    return handleError(res, error);
  }
};