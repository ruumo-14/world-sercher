"use strict";

const { db, send, bodyOf, getSession, handleError } = require("../lib/backend");

module.exports = async function handler(req, res) {
  try {
    const session = getSession(req);
    if (!session) return send(res, 401, { error: "ログインが必要です。" });

    if (req.method === "GET") {
      const rows = await db("game_saves", {
        select: "game_data,level,gold",
        user_id: "eq." + session.sub,
        limit: "1",
      });
      const row = Array.isArray(rows) ? rows[0] : null;
      const gameData = row && row.game_data && typeof row.game_data === "object" ? row.game_data : {};
      return send(res, 200, {
        gameData: {
          ...gameData,
          level: Math.max(1, Math.min(200, Number(gameData.level ?? row?.level ?? 1) || 1)),
          gold: Math.max(0, Number(gameData.gold ?? row?.gold ?? 0) || 0),
        },
      });
    }

    if (req.method === "POST") {
      const data = bodyOf(req).gameData;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return send(res, 400, { error: "冒険者データの形式が正しくありません。" });
      }
      let serialized;
      try { serialized = JSON.stringify(data); } catch (_) {
        return send(res, 400, { error: "保存データを読み取れません。" });
      }
      if (Buffer.byteLength(serialized, "utf8") > 1000000) {
        return send(res, 413, { error: "保存データが大きすぎます。" });
      }
      const level = Math.max(1, Math.min(200, Math.floor(Number(data.level) || 1)));
      const gold = Math.max(0, Math.min(2000000000, Math.floor(Number(data.gold) || 0)));
      await db("game_saves", { user_id: "eq." + session.sub }, {
        method: "PATCH",
        body: {
          game_data: { ...data, level, gold },
          level,
          gold,
          updated_at: new Date().toISOString(),
        },
      });
      return send(res, 200, { ok: true, level, gold });
    }

    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "この操作には対応していません。" });
  } catch (error) {
    return handleError(res, error);
  }
};
