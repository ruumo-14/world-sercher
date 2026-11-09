"use strict";

const express = require("express");
const path = require("path");
const app = express();
const port = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

const routes = {
  register: require("./api/register"),
  login: require("./api/login"),
  logout: require("./api/logout"),
  me: require("./api/me"),
  save: require("./api/save"),
  "game-data": require("./api/game-data"),
  "realtime-config": require("./api/realtime-config")
};

app.all("/api/:name", (req, res) => {
  const handler = routes[req.params.name];
  if (!handler) return res.status(404).json({ error: "APIが見つかりません。" });
  return handler(req, res);
});

app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"],
  etag: true,
  maxAge: process.env.NODE_ENV === "production" ? "1h" : 0
}));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(port, "0.0.0.0", () => console.log("World Sercher server listening on " + port));
