"use strict";

const { db, send, method, getSession, publicProfile, handleError } = require("../lib/backend");

module.exports = async function handler(req, res) {
  if (!method(req, res, "GET")) return;
  try {
    const session = getSession(req);
    if (!session) return send(res, 200, { loggedIn: false });

    const rows = await db("game_saves", {
      select: "character_name,x,y,level,gold",
      user_id: "eq." + session.sub,
      limit: "1",
    });
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return send(res, 200, { loggedIn: false });
    return send(res, 200, {
      loggedIn: true,
      profile: publicProfile({ ...row, username: session.username }),
    });
  } catch (error) {
    return handleError(res, error);
  }
};