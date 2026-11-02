"use strict";

(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const startPanel = document.getElementById("start-panel");
  const startButton = document.getElementById("start-button");
  const nameInput = document.getElementById("player-name");
  const notice = document.getElementById("notice");
  const onlineCount = document.getElementById("online-count");
  const connectionState = document.getElementById("connection-state");
  const hudName = document.getElementById("hud-name");

  const VIEW_W = 960;
  const VIEW_H = 600;
  const TILE = 48;
  const world = { width: 3200, height: 2400 };
  const player = { id: null, name: "冒険者", x: 1600, y: 1370, speed: 190, color: "#f2c078" };
  const others = new Map();
  const keys = new Set();
  const buildings = [
    { x: 1320, y: 1080, w: 190, h: 145, name: "町長の家", color: "#9b7655" },
    { x: 1600, y: 1000, w: 220, h: 170, name: "道具屋", color: "#8b6250" },
    { x: 1900, y: 1110, w: 190, h: 145, name: "宿屋", color: "#a77b4f" },
    { x: 1460, y: 1510, w: 210, h: 155, name: "あなたの家", color: "#876a9c" },
    { x: 1850, y: 1510, w: 190, h: 145, name: "工房", color: "#8c7650" }
  ];
  const socket = typeof io === "function" ? io() : null;
  let started = false;
  let lastTime = 0;
  let lastSent = 0;
  let noticeTimer = null;
  let camera = { x: 0, y: 0 };

  function showNotice(message) {
    notice.textContent = message;
    notice.classList.add("show");
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => notice.classList.remove("show"), 2300);
  }

  function blocked(x, y) {
    const radius = 13;
    if (x < radius || y < radius || x > world.width - radius || y > world.height - radius) return true;
    return buildings.some(b => x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y + 28 && y - radius < b.y + b.h);
  }

  function joinWorld() {
    if (started) return;
    player.name = (nameInput.value || "冒険者").trim().slice(0, 12) || "冒険者";
    hudName.textContent = player.name;
    started = true;
    startPanel.classList.add("hidden");
    if (socket) socket.emit("player:join", { name: player.name });
    showNotice("冒険のはじまり！ 町の中を自由に歩いてみよう。");
  }

  startButton.addEventListener("click", joinWorld);
  nameInput.addEventListener("keydown", e => { if (e.key === "Enter") joinWorld(); });

  if (socket) {
    socket.on("connect", () => {
      connectionState.textContent = "サーバー接続済み";
      onlineCount.textContent = "オンライン";
    });
    socket.on("disconnect", () => {
      connectionState.textContent = "再接続を待っています";
      onlineCount.textContent = "接続が切れました";
    });
    socket.on("world:init", data => {
      if (data && data.world) Object.assign(world, data.world);
      (data.players || []).forEach(p => others.set(p.id, p));
      updateOnline();
    });
    socket.on("player:ready", data => Object.assign(player, data));
    socket.on("player:joined", p => { others.set(p.id, p); updateOnline(); showNotice(p.name + " が冒険に参加したよ！"); });
    socket.on("player:moved", p => { const old = others.get(p.id); if (old) Object.assign(old, p); });
    socket.on("player:left", id => { others.delete(id); updateOnline(); });
  } else {
    connectionState.textContent = "オフライン表示";
    onlineCount.textContent = "サーバー未接続";
  }

  function updateOnline() {
    onlineCount.textContent = "オンライン " + (others.size + (started ? 1 : 0)) + "人";
  }

  window.addEventListener("keydown", e => {
    const key = e.key.toLowerCase();
    if (["arrowup","arrowdown","arrowleft","arrowright"," "].includes(key)) e.preventDefault();
    keys.add(key);
    if (key === "e" && started) interact();
  });
  window.addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());

  document.querySelectorAll("[data-dir]").forEach(button => {
    const dir = button.dataset.dir;
    const keyMap = { up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright" };
    const key = keyMap[dir];
    button.addEventListener("pointerdown", e => { e.preventDefault(); keys.add(key); });
    ["pointerup","pointercancel","pointerleave"].forEach(type => button.addEventListener(type, () => keys.delete(key)));
  });
  document.getElementById("interact-button").addEventListener("click", interact);

  function interact() {
    let nearest = null;
    let best = 92;
    for (const b of buildings) {
      const d = Math.hypot(player.x - (b.x + b.w / 2), player.y - (b.y + b.h / 2));
      if (d < best) { best = d; nearest = b; }
    }
    if (nearest) {
      if (nearest.name === "あなたの家") showNotice("ここがあなたの家だよ！ 家具や設備はこれから追加していくよ。");
      else showNotice(nearest.name + "：この施設は開発中だよ。");
    } else {
      showNotice("周りには草原が広がっている。いろいろな場所を探検してみよう！");
    }
  }

  function rect(x,y,w,h,color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); }
  function hash(x,y) { let n = (x * 374761393 + y * 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; }

  function drawGround() {
    rect(0,0,VIEW_W,VIEW_H,"#5e9b58");
    const startX = Math.floor(camera.x / TILE) - 1;
    const startY = Math.floor(camera.y / TILE) - 1;
    const endX = startX + Math.ceil(VIEW_W / TILE) + 3;
    const endY = startY + Math.ceil(VIEW_H / TILE) + 3;
    for (let ty=startY; ty<endY; ty++) for (let tx=startX; tx<endX; tx++) {
      const wx=tx*TILE, wy=ty*TILE, sx=wx-camera.x, sy=wy-camera.y;
      const h=hash(tx,ty);
      let color = h > .83 ? "#68a85d" : h > .35 ? "#609e57" : "#5b9652";
      if (wx < 600 && wy > 500 && wy < 1900) color = "#57924f";
      rect(sx,sy,TILE,TILE,color);
      if (h > .76) {
        rect(sx+10,sy+12,4,4,"#8cbd68");
        rect(sx+30,sy+32,3,5,"#477d48");
      } else if (h < .08) {
        rect(sx+20,sy+18,5,5,"#d5c77b");
      }
    }
    // Paths through the starting town
    rect(1050-camera.x,1280-camera.y,1150,105,"#c3aa79");
    rect(1510-camera.x,900-camera.y,95,900,"#c3aa79");
    rect(1080-camera.x,1280-camera.y,1080,8,"#d6c18d");
    // Small pond
    rect(450-camera.x,1450-camera.y,300,190,"#397fa0");
    rect(475-camera.x,1475-camera.y,250,140,"#4e9eb5");
    rect(500-camera.x,1490-camera.y,180,12,"#83c9ca");
  }

  function drawTree(x,y) {
    const sx=x-camera.x, sy=y-camera.y;
    rect(sx-5,sy+17,10,18,"#76513a");
    rect(sx-19,sy-4,38,27,"#285b3e");
    rect(sx-14,sy-14,28,22,"#347448");
    rect(sx-8,sy-19,16,12,"#4d8d4f");
    rect(sx-12,sy+2,7,6,"#6ca85c");
  }

  function drawBuilding(b) {
    const x=b.x-camera.x, y=b.y-camera.y;
    rect(x+8,y+18,b.w,b.h,"#314a37");
    rect(x,y+12,b.w,b.h-10,b.color);
    rect(x-8,y+4,b.w+16,35,"#604a3d");
    rect(x+10,y-8,b.w-20,30,"#8f6950");
    rect(x+b.w/2-17,y+b.h-42,34,44,"#49372e");
    rect(x+b.w/2-9,y+b.h-12,18,5,"#b88d57");
    rect(x+23,y+58,32,28,"#a9d0c5");
    rect(x+b.w-55,y+58,32,28,"#a9d0c5");
    rect(x+23,y+58,32,4,"#e1e5b6");
    rect(x+b.w-55,y+58,32,4,"#e1e5b6");
    rect(x+b.w/2-45,y-31,90,20,"#24372b");
    ctx.fillStyle="#f4e9c7"; ctx.font="12px sans-serif"; ctx.textAlign="center";
    ctx.fillText(b.name,x+b.w/2,y-17);
  }

  function drawCharacter(p, isSelf=false) {
    const x=Math.round(p.x-camera.x), y=Math.round(p.y-camera.y);
    // shadow
    rect(x-10,y+8,20,5,"#31533b");
    // hair and head
    rect(x-8,y-20,16,14,"#563b2d");
    rect(x-7,y-17,14,13,"#efc99b");
    rect(x-9,y-22,18,6,"#563b2d");
    // body
    rect(x-10,y-4,20,17,p.color || "#e5bd75");
    rect(x-8,y+12,6,9,"#4a5265");
    rect(x+2,y+12,6,9,"#4a5265");
    rect(x-12,y,4,11,"#efc99b");
    rect(x+8,y,4,11,"#efc99b");
    if (isSelf) { rect(x-2,y-12,2,2,"#29251f"); rect(x+4,y-12,2,2,"#29251f"); }
    ctx.fillStyle="#fff4d6"; ctx.font="11px sans-serif"; ctx.textAlign="center";
    ctx.fillText(p.name || "冒険者",x,y-29);
  }

  function drawWorld() {
    drawGround();
    // trees at fixed positions around the town and along the field
    for (let i=0;i<95;i++) {
      const x=100+(i*173)%3000, y=100+(i*293)%2200;
      if (buildings.some(b=>x>b.x-50&&x<b.x+b.w+50&&y>b.y-60&&y<b.y+b.h+50)) continue;
      drawTree(x,y);
    }
    buildings.forEach(drawBuilding);
    // Town sign
    rect(1190-camera.x,1195-camera.y,12,42,"#765039");
    rect(1170-camera.x,1170-camera.y,52,30,"#c7a36a");
    ctx.fillStyle="#3e3828"; ctx.font="10px sans-serif"; ctx.textAlign="center";
    ctx.fillText("WELCOME",1196-camera.x,1189-camera.y);
    others.forEach(p=>drawCharacter(p,false));
    drawCharacter(player,true);
  }

  function frame(time) {
    const dt = Math.min((time-lastTime)/1000 || 0, .04);
    lastTime=time;
    if (started) {
      let dx=0,dy=0;
      if (keys.has("arrowleft")||keys.has("a")) dx--;
      if (keys.has("arrowright")||keys.has("d")) dx++;
      if (keys.has("arrowup")||keys.has("w")) dy--;
      if (keys.has("arrowdown")||keys.has("s")) dy++;
      if (dx||dy) {
        const length=Math.hypot(dx,dy);
        dx=dx/length*player.speed*dt;
        dy=dy/length*player.speed*dt;
        if (!blocked(player.x+dx,player.y)) player.x+=dx;
        if (!blocked(player.x,player.y+dy)) player.y+=dy;
        if (socket && time-lastSent>90) {
          socket.emit("player:move",{x:player.x,y:player.y});
          lastSent=time;
        }
      }
      camera.x=Math.max(0,Math.min(world.width-VIEW_W,player.x-VIEW_W/2));
      camera.y=Math.max(0,Math.min(world.height-VIEW_H,player.y-VIEW_H/2));
      updateOnline();
    } else {
      camera.x=1120;
      camera.y=950;
    }
    drawWorld();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
