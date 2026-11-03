"use strict";

(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const startPanel = document.getElementById("start-panel");
  const authForm=document.getElementById("auth-form"),accountNameInput=document.getElementById("account-name"),passwordInput=document.getElementById("account-password"),characterNameInput=document.getElementById("character-name"),characterNameWrap=document.getElementById("character-name-wrap"),authMessage=document.getElementById("auth-message"),authSubmit=document.getElementById("auth-submit"),loginTab=document.getElementById("login-tab"),registerTab=document.getElementById("register-tab"),logoutButton=document.getElementById("logout-button");
  const notice=document.getElementById("notice"),onlineCount=document.getElementById("online-count"),connectionState=document.getElementById("connection-state"),hudName=document.getElementById("hud-name");
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
  const socket = typeof io === "function" ? io({ autoConnect: false }) : null;
  let started = false;
  let authMode = "login";
  let saveTimer = 0;
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

  function setAuthMode(mode){
    authMode=mode;const registering=mode==="register";
    loginTab.classList.toggle("active",!registering);registerTab.classList.toggle("active",registering);
    characterNameWrap.classList.toggle("hidden",!registering);passwordInput.autocomplete=registering?"new-password":"current-password";
    passwordInput.minLength=registering?10:1;authSubmit.innerHTML=registering?"アカウントを作成 <span>✦</span>":"ログイン <span>▶</span>";
    authMessage.textContent=registering?"ユーザーIDと10文字以上のパスワードを設定してね。":"登録済みのユーザーIDとパスワードを入力してね。";
  }
  loginTab.addEventListener("click",()=>setAuthMode("login"));registerTab.addEventListener("click",()=>setAuthMode("register"));
  async function enterWorld(profile){
    player.name=profile.name||"冒険者";player.x=Number(profile.x)||1600;player.y=Number(profile.y)||1370;hudName.textContent=player.name;
    started=true;startPanel.classList.add("hidden");window.dispatchEvent(new Event("world:entered"));if(socket)socket.connect();showNotice("おかえりなさい！ 前回の冒険データを読み込んだよ。");
  }
  authForm.addEventListener("submit",async event=>{
    event.preventDefault();authSubmit.disabled=true;authMessage.textContent="確認しています...";
    const payload={username:accountNameInput.value.trim(),password:passwordInput.value,characterName:characterNameInput.value.trim()||accountNameInput.value.trim()};
    try{const response=await fetch(authMode==="register"?"/api/register":"/api/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(payload)});
      const result=await response.json();if(!response.ok)throw new Error(result.error||"処理に失敗しました。");passwordInput.value="";await enterWorld(result.profile);
    }catch(error){authMessage.textContent=error.message||"通信に失敗しました。";}finally{authSubmit.disabled=false;}
  });
  async function saveCurrent(){if(!started)return;try{await fetch("/api/save",{method:"POST",keepalive:true,credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:player.name,x:player.x,y:player.y})});}catch(_error){}}
  logoutButton.addEventListener("click",async()=>{await saveCurrent();if(socket)socket.disconnect();await fetch("/api/logout",{method:"POST",credentials:"same-origin"});location.reload();});
  setInterval(()=>{if(started)saveCurrent();},10000);window.addEventListener("pagehide",saveCurrent);
  async function checkExistingLogin(){try{const response=await fetch("/api/me",{credentials:"same-origin"});const result=await response.json();if(response.ok&&result.loggedIn)await enterWorld(result.profile);else if(!response.ok)authMessage.textContent=result.error||"アカウント機能の準備が必要です。";}catch(_error){authMessage.textContent="サーバーに接続できません。再読み込みしてね。";}}
  checkExistingLogin();
  if (socket) {
    socket.on("connect", () => {
      connectionState.textContent = "サーバー接続済み";
      onlineCount.textContent = "オンライン";
      if (started) socket.emit("player:join");
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
    socket.on("player:ready", data => { player.id=data.id; player.x=data.x; player.y=data.y; player.name=data.name; });
    socket.on("player:joined", p => { others.set(p.id, p); updateOnline(); showNotice(p.name + " が冒険に参加したよ！"); });
    socket.on("player:moved", p => { const old = others.get(p.id); if (old) Object.assign(old, p); });
    socket.on("player:left", id => { others.delete(id); updateOnline(); });
    socket.on("connect_error", error => { connectionState.textContent="ログイン接続エラー"; showNotice(error.message||"接続できませんでした。"); });
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

  function rect(x,y,w,h,color) {
    ctx.fillStyle = color;
    ctx.fillRect(x,y,w,h);
  }
  function roundRect(x,y,w,h,r,fill,stroke) {
    ctx.beginPath();
    ctx.roundRect(x,y,w,h,r);
    if (fill) { ctx.fillStyle=fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle=stroke; ctx.lineWidth=2; ctx.stroke(); }
  }
  function hash(x,y) {
    let n = (x * 374761393 + y * 668265263) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }
  function ellipse(x,y,rx,ry,color) {
    ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);
    ctx.fillStyle=color; ctx.fill();
  }
  function drawGround() {
    const bg = ctx.createLinearGradient(0,0,0,VIEW_H);
    bg.addColorStop(0,"#8dbb72"); bg.addColorStop(.55,"#78aa68"); bg.addColorStop(1,"#63945c");
    rect(0,0,VIEW_W,VIEW_H,bg);
    const step=42;
    for(let ty=Math.floor(camera.y/step)-1;ty<Math.floor((camera.y+VIEW_H)/step)+2;ty++){
      for(let tx=Math.floor(camera.x/step)-1;tx<Math.floor((camera.x+VIEW_W)/step)+2;tx++){
        const h=hash(tx,ty), sx=tx*step-camera.x, sy=ty*step-camera.y;
        if(h>.42){
          ctx.strokeStyle=h>.8?"#a7c982":"#5d9457"; ctx.globalAlpha=.48; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.moveTo(sx+8,sy+24); ctx.quadraticCurveTo(sx+11,sy+15,sx+14,sy+12); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(sx+27,sy+34); ctx.quadraticCurveTo(sx+30,sy+25,sx+33,sy+23); ctx.stroke();
          ctx.globalAlpha=1;
        }
        if(h<.12) ellipse(sx+20,sy+17,2,2,"#e5d69a");
      }
    }
    // Soft-edged paths crossing through the village
    ctx.save();
    ctx.lineCap="round"; ctx.lineJoin="round";
    ctx.strokeStyle="#9b805d"; ctx.lineWidth=122;
    ctx.beginPath(); ctx.moveTo(980-camera.x,1332-camera.y); ctx.lineTo(2200-camera.x,1332-camera.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1557-camera.x,850-camera.y); ctx.lineTo(1557-camera.x,1840-camera.y); ctx.stroke();
    ctx.strokeStyle="#d8c49a"; ctx.lineWidth=112;
    ctx.beginPath(); ctx.moveTo(980-camera.x,1325-camera.y); ctx.lineTo(2200-camera.x,1325-camera.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1550-camera.x,850-camera.y); ctx.lineTo(1550-camera.x,1840-camera.y); ctx.stroke();
    ctx.restore();
    // Pond with a soft shoreline
    const px=450-camera.x, py=1450-camera.y;
    ellipse(px+150,py+100,166,112,"#b6a77b");
    ellipse(px+150,py+92,151,96,"#4d9eae");
    ellipse(px+112,py+62,62,13,"#8bc9c5");
    ellipse(px+205,py+122,35,7,"#76b9bb");
  }
  function drawTree(x,y) {
    const sx=x-camera.x, sy=y-camera.y;
    // soft shadow, trunk and layered foliage
    ellipse(sx,sy+19,24,9,"#426b48");
    const trunk=ctx.createLinearGradient(sx-7,sy,sx+8,sy);
    trunk.addColorStop(0,"#68462f"); trunk.addColorStop(.5,"#a87549"); trunk.addColorStop(1,"#68452e");
    roundRect(sx-7,sy-2,14,34,5,trunk);
    ellipse(sx-13,sy-13,23,21,"#376f4a");
    ellipse(sx+10,sy-18,24,23,"#4b8b52");
    ellipse(sx-2,sy-31,25,23,"#5c9b58");
    ellipse(sx-12,sy-20,10,9,"#78ae63");
    ellipse(sx+15,sy-28,10,8,"#80b66a");
    ellipse(sx+4,sy-5,8,7,"#2e6843");
  }
  function drawBuilding(b) {
    const x=b.x-camera.x, y=b.y-camera.y, w=b.w, h=b.h;
    // cast shadow
    ctx.save();
    ctx.shadowColor="#294a35"; ctx.shadowBlur=18; ctx.shadowOffsetY=12;
    roundRect(x+3,y+26,w,h-8,8,"#4c6346");
    ctx.restore();
    // stone foundation and plaster walls
    roundRect(x,y+18,w,h-18,7,"#d7c69d","#806c52");
    const wall=ctx.createLinearGradient(x,y,x+w,y+h);
    wall.addColorStop(0,b.color); wall.addColorStop(1,"#d4b98a");
    roundRect(x+5,y+22,w-10,h-28,5,wall);
    // timber framing
    ctx.strokeStyle="#76533d"; ctx.lineWidth=7;
    ctx.beginPath(); ctx.moveTo(x+13,y+35); ctx.lineTo(x+13,y+h-12); ctx.moveTo(x+w-13,y+35); ctx.lineTo(x+w-13,y+h-12); ctx.stroke();
    // roof with a pitched silhouette
    ctx.beginPath(); ctx.moveTo(x-16,y+36); ctx.lineTo(x+w*.5,y-23); ctx.lineTo(x+w+16,y+36); ctx.closePath();
    const roof=ctx.createLinearGradient(x,y-20,x,y+42);
    roof.addColorStop(0,"#9b6048"); roof.addColorStop(.55,"#754936"); roof.addColorStop(1,"#593b32");
    ctx.fillStyle=roof; ctx.fill(); ctx.strokeStyle="#4e3a31"; ctx.lineWidth=4; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+12,y+31); ctx.lineTo(x+w*.5,y-12); ctx.lineTo(x+w-12,y+31);
    ctx.strokeStyle="#c18a61"; ctx.lineWidth=3; ctx.stroke();
    // warm windows
    for(const wx of [x+29,x+w-67]){
      roundRect(wx,y+65,38,39,4,"#5c5142","#e2c99a");
      roundRect(wx+5,y+70,28,29,2,"#a9d5d0");
      ctx.strokeStyle="#f0dfb8"; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(wx+19,y+70); ctx.lineTo(wx+19,y+99); ctx.moveTo(wx+5,y+84); ctx.lineTo(wx+33,y+84); ctx.stroke();
    }
    // arched wooden door
    roundRect(x+w/2-20,y+h-63,40,62,18,"#503b31","#d0aa72");
    roundRect(x+w/2-14,y+h-56,28,55,13,"#79513a");
    ellipse(x+w/2+9,y+h-29,3,3,"#e4c47c");
    // name plaque
    roundRect(x+w/2-55,y-42,110,25,7,"#354c39","#d7c18f");
    ctx.fillStyle="#fff3d8"; ctx.font="bold 13px sans-serif"; ctx.textAlign="center";
    ctx.fillText(b.name,x+w/2,y-25);
  }
  function drawCharacter(p, isSelf=false) {
    const x=p.x-camera.x, y=p.y-camera.y;
    const robe=p.color || (isSelf?"#477fc0":"#b85f50");
    // shadow and feet
    ellipse(x,y+13,17,7,"#3d6747");
    roundRect(x-11,y+3,8,13,3,"#493e3b");
    roundRect(x+3,y+3,8,13,3,"#493e3b");
    // cloak/body with subtle outline
    ctx.beginPath(); ctx.moveTo(x-13,y-9); ctx.quadraticCurveTo(x,y-17,x+13,y-9);
    ctx.lineTo(x+15,y+7); ctx.quadraticCurveTo(x,y+14,x-15,y+7); ctx.closePath();
    const cloth=ctx.createLinearGradient(x-12,y-10,x+12,y+9);
    cloth.addColorStop(0,"#f1d8a8"); cloth.addColorStop(.18,robe); cloth.addColorStop(1,"#263f68");
    ctx.fillStyle=cloth; ctx.fill(); ctx.strokeStyle="#263c35"; ctx.lineWidth=1.5; ctx.stroke();
    // head, hair and face
    ellipse(x,y-19,10,12,"#efc99e");
    ctx.beginPath(); ctx.moveTo(x-10,y-20); ctx.quadraticCurveTo(x-8,y-34,x+5,y-31);
    ctx.quadraticCurveTo(x+13,y-28,x+10,y-17); ctx.lineTo(x+4,y-22); ctx.lineTo(x-5,y-18); ctx.closePath();
    ctx.fillStyle=isSelf?"#59402f":"#49352e"; ctx.fill();
    ellipse(x-3,y-19,1.5,2,"#392d29"); ellipse(x+4,y-19,1.5,2,"#392d29");
    // small shoulder cape
    ctx.beginPath(); ctx.moveTo(x-12,y-8); ctx.lineTo(x,y-2); ctx.lineTo(x+12,y-8);
    ctx.strokeStyle="#e7c77e"; ctx.lineWidth=3; ctx.stroke();
    ctx.fillStyle="#fff8e7"; ctx.font="12px sans-serif"; ctx.textAlign="center";
    ctx.shadowColor="#314b36"; ctx.shadowBlur=4; ctx.fillText(p.name||"冒険者",x,y-39); ctx.shadowBlur=0;
  }
  function drawWorld() {
    drawGround();
    // trees placed throughout the fields
    for(let i=0;i<95;i++){
      const x=100+(i*173)%3000, y=100+(i*293)%2200;
      if(buildings.some(b=>x>b.x-55&&x<b.x+b.w+55&&y>b.y-75&&y<b.y+b.h+55)) continue;
      drawTree(x,y);
    }
    // a few flower patches add life to the meadow
    for(let i=0;i<34;i++){
      const x=(i*271+210)%3100-camera.x, y=(i*397+170)%2250-camera.y;
      if(x>-8&&x<VIEW_W+8&&y>-8&&y<VIEW_H+8){
        ellipse(x,y,3,3,i%3===0?"#f1d9a0":i%3===1?"#f4e8d0":"#d9b8ce");
        ellipse(x+4,y+2,2,2,"#fff0c4");
      }
    }
    buildings.forEach(drawBuilding);
    // wooden welcome sign
    const sx=1196-camera.x, sy=1185-camera.y;
    roundRect(sx-5,sy+8,10,52,3,"#805537");
    roundRect(sx-31,sy-13,62,34,7,"#b98c55","#6d4b36");
    ctx.fillStyle="#fff0cf"; ctx.font="bold 10px sans-serif"; ctx.textAlign="center";
    ctx.fillText("WELCOME",sx,sy+8);
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
        if (socket && socket.connected && time-lastSent>90) {
          socket.emit("player:move",{x:player.x,y:player.y});
          lastSent=time;
        }
      }
      camera.x=Math.max(0,Math.min(world.width-VIEW_W,player.x-VIEW_W/2));
      camera.y=Math.max(0,Math.min(world.height-VIEW_H,player.y-VIEW_H/2));
      updateOnline();
      if (time-saveTimer>10000) { saveTimer=time; saveCurrent(); }
    } else {
      camera.x=1120;
      camera.y=950;
    }
    drawWorld();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
