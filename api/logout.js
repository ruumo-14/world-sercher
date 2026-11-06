"use strict";

const { send, method, clearSession } = require("../lib/backend");

module.exports = async function handler(req, res) {
  if (!method(req, res, "POST")) return;
  clearSession(res);
  return send(res, 200, { ok: true });
};