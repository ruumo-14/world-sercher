"use strict";

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const WORLD = { width: 3200, height: 2400 };
const players = new Map();

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, players: players.size }));

function cleanName(value) {
  if (typeof value !== "string") return "冒険者";
  const name = value.replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 12);
  return name || "冒険者";
}

io.on("connection", (socket) => {
  socket.emit("world:init", {
    world: WORLD,
    players: Array.from(players.values())
  });

  socket.on("player:join", (payload = {}) => {
    const player = {
      id: socket.id,
      name: cleanName(payload.name),
      x: 1560 + Math.random() * 80,
      y: 1320 + Math.random() * 60,
      color: ["#f2c078", "#8ec5ff", "#f49ac2", "#a9df9a"][Math.floor(Math.random() * 4)]
    };
    players.set(socket.id, player);
    socket.emit("player:ready", player);
    socket.broadcast.emit("player:joined", player);
  });

  socket.on("player:move", (position = {}) => {
    const player = players.get(socket.id);
    if (!player) return;
    const x = Number(position.x);
    const y = Number(position.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    player.x = Math.max(12, Math.min(WORLD.width - 12, x));
    player.y = Math.max(12, Math.min(WORLD.height - 12, y));
    socket.broadcast.emit("player:moved", {
      id: socket.id,
      x: player.x,
      y: player.y
    });
  });

  socket.on("disconnect", () => {
    players.delete(socket.id);
    socket.broadcast.emit("player:left", socket.id);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`World Sercher server listening on port ${PORT}`);
});
