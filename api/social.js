"use strict";

const { db, send, bodyOf, getSession, handleError } = require("../lib/backend");

const cleanText = value => typeof value === "string"
  ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 50)
  : "";

async function isBlockedTerm(text) {
  const rows = await db("chat_blocked_terms", { select: "term", active: "eq.true", limit: "200" });
  const normalized = text.toLocaleLowerCase("ja-JP");
  return (rows || []).some(row => row.term && normalized.includes(String(row.term).toLocaleLowerCase("ja-JP")));
}

module.exports = async function handler(req, res) {
  try {
    const session = getSession(req);
    if (!session) return send(res, 401, { error: "ログインが必要です。" });

    if (req.method === "GET") {
      const action = String(req.query?.action || "global");
      if (action === "global") {
        const rows = await db("global_chat_messages", {
          select: "id,sender_user_id,username,body,created_at",
          order: "created_at.desc",
          limit: "100",
        });
        const blocks = await db("player_blocks", { select: "blocked_user_id", blocker_user_id: "eq." + session.sub });
        const hidden = new Set((blocks || []).map(row => row.blocked_user_id));
        return send(res, 200, { messages: (rows || []).filter(row => !hidden.has(row.sender_user_id)).reverse() });
      }
      if (action === "blocks") {
        const rows = await db("player_blocks", {
          select: "blocked_user_id",
          blocker_user_id: "eq." + session.sub,
        });
        return send(res, 200, { blocked: rows || [] });
      }
      return send(res, 400, { error: "指定された情報は取得できません。" });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return send(res, 405, { error: "この操作には対応していません。" });
    }

    const body = bodyOf(req);
    const action = String(body.action || "");

    if (action === "global-message") {
      const message = cleanText(body.message);
      if (!message) return send(res, 400, { error: "メッセージを入力してね。" });
      if (message.length > 50) return send(res, 400, { error: "全体チャットは50文字までです。" });
      if (await isBlockedTerm(message)) {
        return send(res, 400, { error: "不適切な表現が含まれているため送信できません。" });
      }
      const recent = await db("global_chat_messages", {
        select: "created_at",
        sender_user_id: "eq." + session.sub,
        order: "created_at.desc",
        limit: "1",
      });
      if (recent?.[0] && Date.now() - new Date(recent[0].created_at).getTime() < 1500) {
        return send(res, 429, { error: "次のメッセージまで少し待ってね。" });
      }
      const inserted = await db("global_chat_messages", {}, {
        method: "POST",
        returning: true,
        body: { sender_user_id: session.sub, username: session.username, body: message },
      });
      return send(res, 201, { message: Array.isArray(inserted) ? inserted[0] : null });
    }

    if (action === "block") {
      const target = String(body.userId || "");
      if (!target || target === session.sub) return send(res, 400, { error: "このプレイヤーはブロックできません。" });
      await db("player_blocks", {}, {
        method: "POST",
        body: { blocker_user_id: session.sub, blocked_user_id: target },
      });
      return send(res, 200, { ok: true });
    }

    if (action === "unblock") {
      const target = String(body.userId || "");
      await db("player_blocks", {
        blocker_user_id: "eq." + session.sub,
        blocked_user_id: "eq." + target,
      }, { method: "DELETE" });
      return send(res, 200, { ok: true });
    }

    if (action === "report") {
      const target = body.targetUserId ? String(body.targetUserId) : null;
      const category = String(body.category || "other").slice(0, 24);
      const details = typeof body.details === "string" ? body.details.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 1000) : "";
      if (!details) return send(res, 400, { error: "通報内容を入力してね。" });
      await db("player_reports", {}, {
        method: "POST",
        body: { reporter_user_id: session.sub, target_user_id: target, category, details },
      });
      return send(res, 201, { ok: true });
    }

    return send(res, 400, { error: "指定された操作には対応していません。" });
  } catch (error) {
    if (error?.code === "23505") return send(res, 409, { error: "すでに登録されています。" });
    return handleError(res, error);
  }
};
