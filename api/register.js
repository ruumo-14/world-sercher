"use strict";

const bcrypt = require("bcryptjs");
const {
  db, send, method, bodyOf, cleanName, validUsername, validPassword,
  setSession, handleError,
} = require("../lib/backend");

module.exports = async function handler(req, res) {
  if (!method(req, res, "POST")) return;
  try {
    const body = bodyOf(req);
    const username = typeof body.username === "string" ? body.username.trim().normalize("NFC") : "";
    const password = body.password;
    const characterName = cleanName(body.characterName || username);

    if (!validUsername(username)) {
      return send(res, 400, { error: "ユーザーIDは3〜16文字で、英字・数字・_・- を使ってね。" });
    }
    if (!validPassword(password)) {
      return send(res, 400, { error: "パスワードは10文字以上、72バイト以内にしてね。" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const created = await db("game_users", { select: "id,username" }, {
      method: "POST",
      returning: true,
      body: { username, username_lower: username.toLocaleLowerCase("en-US"), password_hash: passwordHash },
    });
    const user = Array.isArray(created) ? created[0] : null;
    if (!user) throw new Error("Account insert returned no row");

    try {
      await db("game_saves", {}, {
        method: "POST",
        body: { user_id: user.id, character_name: characterName, x: 1600, y: 1370 },
      });
    } catch (error) {
      await db("game_users", { id: "eq." + user.id }, { method: "DELETE" }).catch(() => {});
      throw error;
    }

    setSession(res, user);
    return send(res, 201, {
      profile: { username: user.username, name: characterName, x: 1600, y: 1370, level: 1, gold: 0 },
    });
  } catch (error) {
    if (error && error.code === "23505") {
      return send(res, 409, { error: "そのユーザーIDはすでに使われています。" });
    }
    return handleError(res, error);
  }
};