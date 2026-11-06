"use strict";

const bcrypt = require("bcryptjs");
const { db, send, method, bodyOf, setSession, publicProfile, handleError } = require("../lib/backend");

module.exports = async function handler(req, res) {
  if (!method(req, res, "POST")) return;
  try {
    const body = bodyOf(req);
    const username = typeof body.username === "string" ? body.username.trim().normalize("NFC") : "";
    const password = body.password;
    if (!username || typeof password !== "string") {
      return send(res, 400, { error: "ユーザーIDとパスワードを入力してね。" });
    }

    const users = await db("game_users", {
      select: "id,username,password_hash",
      username_lower: "eq." + username.toLocaleLowerCase("en-US"),
      limit: "1",
    });
    const user = Array.isArray(users) ? users[0] : null;
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return send(res, 401, { error: "ユーザーIDかパスワードが違います。" });
    }

    const saves = await db("game_saves", {
      select: "username:game_users(username),character_name,x,y,level,gold",
      user_id: "eq." + user.id,
      limit: "1",
    });
    const row = Array.isArray(saves) ? saves[0] : null;
    if (!row) return send(res, 401, { error: "冒険者データが見つかりません。新規登録を確認してね。" });

    setSession(res, user);
    return send(res, 200, { profile: publicProfile({ ...row, username: user.username }) });
  } catch (error) {
    return handleError(res, error);
  }
};