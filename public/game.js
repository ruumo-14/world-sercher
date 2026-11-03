"use strict";
(() => {
  const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");
  const W=960,H=600; canvas.width=W;canvas.height=H;ctx.imageSmoothingEnabled=false;
  // Simple shape-only graphics: no external image assets are loaded.
  const atlasReady=false;
  const $=id=>document.getElementById(id);
  const startPanel=$("start-panel"),authForm=$("auth-form"),accountName=$("account-name"),password=$("account-password"),characterName=$("character-name"),nameWrap=$("character-name-wrap"),authMessage=$("auth-message"),authSubmit=$("auth-submit"),loginTab=$("login-tab"),registerTab=$("register-tab"),notice=$("notice"),hudName=$("hud-name"),onlineCount=$("online-count"),connectionState=$("connection-state");
  const player={id:null,name:"冒険者",x:1600,y:1300,speed:155,dir:"down",species:"人間",hair:"栗色",skin:"明るい肌",eyes:"青",style:"旅人",outfit:"#4f78a5",accessory:"なし"};
  const others=new Map(),keys=new Set();let started=false,authMode="login",gameData={},camera={x:0,y:0},lastMoveSent=0,noticeTimer=null,lastFrame=0;
  const socket=typeof io==="function"?io({autoConnect:false}):null;
  const town={x:1600,y:1300};
  const buildings=[
    ["冒険者ギルド",1350,830,190,145,"#d5b47b","guild"],["武器屋",1080,1120,150,120,"#bd8860","shop"],["鍛冶屋",1260,1110,150,125,"#8c6b59","forge"],["道具屋",1790,1100,155,125,"#c48e5e","shop"],["宿屋",1990,1300,180,140,"#b77d57","inn"],["酒場",1970,1510,150,120,"#98664e","inn"],["市場",1740,1570,180,120,"#c19a62","market"],["銀行",1510,1640,140,115,"#b5a17a","bank"],["町長の家",1220,1450,165,130,"#a78a71","home"],["あなたの家",1450,1840,175,140,"#9a7eaa","home"],["服飾店",990,1450,145,120,"#b77b8b","shop"],["農家の作業小屋",1810,1810,150,120,"#a18b57","farm"],["理髪店",2080,1080,130,110,"#a6a1a0","shop"],["仕立て屋",2110,1640,145,115,"#a87989","shop"],["訓練所",930,900,155,120,"#8c9a72","guild"],["住民の家",1030,650,125,100,"#b48a62","home"],["住民の家",1190,610,130,105,"#a98268","home"],["住民の家",1840,650,130,105,"#b58e67","home"],["住民の家",2020,720,125,100,"#a67f60","home"],["住民の家",2280,980,125,105,"#b18c69","home"],["住民の家",2320,1830,135,105,"#a67f60","home"],["住民の家",2070,2030,135,105,"#b58e67","home"],["住民の家",1200,1970,130,105,"#ad8967","home"],["住民の家",980,1810,130,105,"#b18c69","home"]
  ].map(([name,x,y,w,h,color,type])=>({name,x,y,w,h,color,type}));
  const npcDefs=[
    ["エミリア","受付",1460,955,"#c86d83","#8a513b"],["ガルド","鍛冶師",1330,1250,"#7c8790","#51443b"],["ミーナ","道具屋",1850,1230,"#d58d57","#6b4936"],["ノア","農家",1880,1880,"#82a65f","#78543b"],["ロイド","宿屋",2040,1430,"#b88b62","#68472f"],["アルベルト","町長",1300,1570,"#7d8caa","#75604b"],
    ["セラ","武器屋",1130,1245,"#bd6e68","#513b32"],["トーマス","銀行員",1550,1740,"#8b9b9a","#564536"],["リナ","服飾職人",1030,1570,"#c47a9b","#684638"],["バルド","衛兵",900,1190,"#758b6d","#4a392f"],["ユリウス","衛兵",2210,1370,"#758b6d","#4a392f"],["マルタ","市場商人",1780,1690,"#d2a65f","#67452f"],
    ["ピノ","農家",1920,1950,"#8aa75f","#754c37"],["カイ","釣り人",650,1500,"#7399a9","#5a4535"],["メル","花屋",900,1680,"#d58c9b","#654337"],["オスカー","大工",1160,1780,"#b8895e","#60432f"],
    ["ユナ","住民",1240,700,"#d58c9b","#604333"],["レオ","子ども",1530,720,"#d6ae72","#62432f"],["ミオ","子ども",1670,720,"#d58c9b","#62432f"],["ハンナ","住民",2260,900,"#b7a16e","#644a36"],["エド","住民",2310,1760,"#8097a1","#514136"],["フローラ","住民",1130,1900,"#b97c91","#624333"],["ジン","住民",1340,2010,"#b28b60","#513b2d"],["サラ","住民",2160,1900,"#d3a16c","#694835"],
    ["旅人アレン","旅人",720,950,"#7892b4","#4e392d"],["商人ベラ","旅商人",2380,1120,"#bd8b63","#614330"],["旅人ノル","旅人",700,1800,"#829a91","#53402e"],["行商人リック","行商人",2370,1580,"#b88c5e","#60432f"],["衛兵ロウ","衛兵",1600,600,"#718a6c","#48392e"],["衛兵ミラ","衛兵",2470,1430,"#718a6c","#48392e"],["羊飼いテオ","牧童",2030,2040,"#a58c5d","#624630"],["釣り人ネネ","釣り人",520,1580,"#7196a5","#654832"],["薬草師イリス","薬草師",850,1900,"#83a66d","#634735"],["パン屋オットー","パン職人",1700,1900,"#c38a61","#64442f"],["吟遊詩人ルカ","旅芸人",1780,780,"#a68bb8","#563d32"],["見習い冒険者","冒険者",1450,760,"#6e9ca9","#503c32"]
  ];
  const npcs=npcDefs.map((n,i)=>({id:i,name:n[0],role:n[1],x:n[2],y:n[3],color:n[4],hair:n[5],phase:(i%5)*.7}));
  const water={x:460,y:1350,w:470,h:850};
  const pathPoints=[[-150,1300],[2800,1300],[1600,360],[1600,2360],[460,1350],[2700,1350]];
  function say(t){notice.textContent=t;notice.classList.add("show");clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.classList.remove("show"),2600)}
  function setAuthMode(mode){authMode=mode;const reg=mode==="register";loginTab.classList.toggle("active",!reg);registerTab.classList.toggle("active",reg);nameWrap.classList.toggle("hidden",!reg);password.autocomplete=reg?"new-password":"current-password";password.minLength=reg?10:1;authSubmit.textContent=reg?"アカウントを作成 ✦":"ログイン ▶";authMessage.textContent=reg?"ユーザーIDと10文字以上のパスワードを設定してね。":"登録済みのユーザーIDとパスワードを入力してね。"}
  loginTab.addEventListener("click",()=>setAuthMode("login"));registerTab.addEventListener("click",()=>setAuthMode("register"));
  async function readGameData(){try{const r=await fetch("/api/game-data",{credentials:"same-origin"});if(r.ok){const j=await r.json();gameData=j.gameData||{}}}catch(e){gameData={}}}
  async function saveGameData(){try{await fetch("/api/game-data",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({gameData})})}catch(e){}}
  function openCreation(){const panel=$("creation-panel");if(panel)panel.classList.remove("hidden")}
  function closeCreation(){const panel=$("creation-panel");if(panel)panel.classList.add("hidden")}
  function initCreation(){
    const form=$("creation-form");if(!form)return;
    form.addEventListener("submit",async e=>{e.preventDefault();player.name=($("create-name").value.trim()||"冒険者").slice(0,12);player.species=$("create-species").value;player.hair=$("create-hair").value;player.skin=$("create-skin").value;player.eyes=$("create-eyes").value;player.style=$("create-style").value;player.outfit=$("create-color").value;player.accessory=$("create-accessory").value;
      gameData.characterCreated=true;gameData.species=player.species;gameData.appearance={hair:player.hair,skin:player.skin,eyes:player.eyes,style:player.style,color:player.outfit,accessory:player.accessory};await saveGameData();await saveCurrent();hudName.textContent=player.name;closeCreation();startPanel.classList.add("hidden");if(socket)socket.connect();say("ようこそ、リーフェルへ！");});
  }
  async function enterWorld(profile){player.name=profile.name||"冒険者";player.x=Number(profile.x)||1600;player.y=Number(profile.y)||1300;hudName.textContent=player.name;started=true;await readGameData();if(!gameData.characterCreated){$("create-name").value=player.name;openCreation()}else{const a=gameData.appearance||{};player.species=gameData.species||"人間";player.hair=a.hair||"栗色";player.skin=a.skin||"明るい肌";player.eyes=a.eyes||"青";player.style=a.style||"旅人";player.outfit=a.color||"#4f78a5";player.accessory=a.accessory||"なし";startPanel.classList.add("hidden");if(socket)socket.connect();}window.dispatchEvent(new Event("world:entered"));}
  initCreation();
  authForm.addEventListener("submit",async e=>{e.preventDefault();authSubmit.disabled=true;authMessage.textContent="確認しています...";const payload={username:accountName.value.trim(),password:password.value,characterName:characterName.value.trim()||accountName.value.trim()};try{const r=await fetch(authMode==="register"?"/api/register":"/api/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(payload)});const j=await r.json();if(!r.ok)throw new Error(j.error||"処理に失敗しました");password.value="";await enterWorld(j.profile)}catch(err){authMessage.textContent=err.message||"通信に失敗しました"}finally{authSubmit.disabled=false}});
  async function saveCurrent(){if(!started)return;try{await fetch("/api/save",{method:"POST",keepalive:true,credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:player.name,x:player.x,y:player.y})})}catch(e){}}
  $("logout-button").addEventListener("click",async()=>{await saveCurrent();if(socket)socket.disconnect();await fetch("/api/logout",{method:"POST",credentials:"same-origin"});location.reload()});
  setInterval(()=>{if(started)saveCurrent()},10000);window.addEventListener("pagehide",saveCurrent);
  async function checkLogin(){try{const r=await fetch("/api/me",{credentials:"same-origin"}),j=await r.json();if(r.ok&&j.loggedIn)await enterWorld(j.profile);else if(!r.ok)authMessage.textContent=j.error||"アカウント機能を確認してね"}catch(e){authMessage.textContent="サーバーに接続できません。再読み込みしてね。"}}
  checkLogin();
  if(socket){socket.on("connect",()=>{connectionState.textContent="サーバー接続済み";if(started&&!$("creation-panel")?.classList.contains("hidden"))return;socket.emit("player:join")});socket.on("disconnect",()=>{connectionState.textContent="再接続を待っています"});socket.on("world:init",d=>{if(d?.world){};(d.players||[]).forEach(p=>others.set(p.id,p));updateOnline()});socket.on("player:ready",p=>{player.id=p.id;player.x=p.x;player.y=p.y;player.name=p.name});socket.on("player:joined",p=>{others.set(p.id,p);updateOnline();say(p.name+" が村にやってきた！")});socket.on("player:moved",p=>{const o=others.get(p.id);if(o)Object.assign(o,p)});socket.on("player:left",id=>{others.delete(id);updateOnline()});socket.on("connect_error",e=>{connectionState.textContent="接続エラー";say(e.message||"接続できません")})}else connectionState.textContent="オフライン表示";
  function updateOnline(){onlineCount.textContent="村にいる冒険者 "+(others.size+(started?1:0))+"人"}
  function blocked(x,y){if(x<70||y<70||x>worldW-70||y>worldH-70)return true;if(Math.hypot(x-(water.x+water.w/2),y-(water.y+water.h/2))<220)return true;return buildings.some(b=>x+12>b.x&&x-12<b.x+b.w&&y+8>b.y+32&&y-8<b.y+b.h)}
  const worldW=3000,worldH=2300;
  window.addEventListener("keydown",e=>{const k=e.key.toLowerCase();if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k))e.preventDefault();keys.add(k);if(k==="e"&&started)interact()});window.addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));window.addEventListener("blur",()=>keys.clear());
  const keyMap={up:"arrowup",down:"arrowdown",left:"arrowleft",right:"arrowright"};document.querySelectorAll("[data-dir]").forEach(b=>{const k=keyMap[b.dataset.dir];b.addEventListener("pointerdown",e=>{e.preventDefault();keys.add(k)});["pointerup","pointercancel","pointerleave"].forEach(t=>b.addEventListener(t,()=>keys.delete(k)))});
  $("interact-button").addEventListener("click",interact);
  function interact(){let best=95,target=null;for(const b of buildings){const d=Math.hypot(player.x-(b.x+b.w/2),player.y-(b.y+b.h/2));if(d<best){best=d;target=b}}for(const n of npcs){const d=Math.hypot(player.x-n.x,player.y-n.y);if(d<best){best=d;target=n}}if(target?.name){if(target.role)say(target.name+"「こんにちは！ "+target.role+"をしているよ。」");else say(target.name+"：施設の準備を進めているよ。")}else say("草花が風に揺れている。リーフェルを探検しよう！")}
  function hash(x,y){let n=(x*374761393+y*668265263)|0;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295}
  function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}
  function ellipse(x,y,rx,ry,c){ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(Math.round(x),Math.round(y),rx,ry,0,0,Math.PI*2);ctx.fill()}
  function path(points,color,width){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0]-camera.x,p[1]-camera.y):ctx.moveTo(p[0]-camera.x,p[1]-camera.y));ctx.stroke()}
  function drawGround(){rect(0,0,W,H,"#6e9b57");for(let y=Math.floor(camera.y/32)*32-32;y<camera.y+H+32;y+=32)for(let x=Math.floor(camera.x/32)*32-32;x<camera.x+W+32;x+=32){const h=hash(x/32,y/32),sx=x-camera.x,sy=y-camera.y;if(h>.2){rect(sx+5,sy+8,2,5,h>.8?"#b5c77b":"#547f49");rect(sx+12,sy+17,2,4,"#88a95f")}if(h<.035){rect(sx+20,sy+20,4,3,"#e9d9a0");rect(sx+23,sy+18,3,3,"#d18b9a")}}
    // Winding river, banks and bridge crossings
    ctx.save();path([[300,700],[400,930],[370,1200],[500,1420],[430,1690],[560,1900],[500,2200]],"#c5b27c",112);path([[300,700],[400,930],[370,1200],[500,1420],[430,1690],[560,1900],[500,2200]],"#438fa0",88);path([[310,730],[405,940],[380,1200],[505,1420],[440,1690],[565,1900]],"#76c0bd",5);ctx.restore();
    // central plaza and natural cobblestone roads
    ellipse(1600-camera.x,1320-camera.y,250,205,"#a78e68");ellipse(1600-camera.x,1320-camera.y,230,185,"#c5b58b");
    path([[1600,1320],[1600,500]],"#8c795e",112);path([[1600,1320],[1600,500]],"#d0bd91",96);path([[1600,1320],[2600,1320]],"#8c795e",112);path([[1600,1320],[2600,1320]],"#d0bd91",96);path([[1600,1320],[1600,2350]],"#8c795e",112);path([[1600,1320],[1600,2350]],"#d0bd91",96);path([[1600,1320],[650,1320]],"#8c795e",112);path([[1600,1320],[650,1320]],"#d0bd91",96);
    // plaza fountain
    if(atlasReady){ctx.drawImage(spriteAtlas,352,0,64,64,1550-camera.x,1260-camera.y,100,100)}else{ellipse(1600-camera.x,1320-camera.y,66,48,"#857b62");ellipse(1600-camera.x,1314-camera.y,58,40,"#5d9da5");ellipse(1600-camera.x,1307-camera.y,34,21,"#8ac9c2");rect(1591-camera.x,1265-camera.y,18,42,"#d4c49a");ellipse(1600-camera.x,1265-camera.y,12,7,"#e6d6ad");}
    // farm plots
    for(let i=0;i<5;i++){rect(1900-camera.x+i*48,2110-camera.y,40,100,"#8d7048");for(let j=0;j<4;j++){rect(1905-camera.x+i*48,2120-camera.y+j*22,30,4,"#557a3e");rect(1915-camera.x+i*48,2116-camera.y+j*22,5,8,"#80a954")}}
  }
  function drawTree(x,y,seed=0){const sx=Math.round(x-camera.x),sy=Math.round(y-camera.y);if(sx<-70||sy<-90||sx>W+70||sy>H+90)return;if(atlasReady){ctx.drawImage(spriteAtlas,128,0,48,64,sx-30,sy-62,60,80);return;}ellipse(sx,sy+17,22,8,"#476b3d");rect(sx-6,sy-12,12,35,"#795137");ellipse(sx,sy-28,28,24,"#356b43");}
  function drawHouse(b){const x=Math.round(b.x-camera.x),y=Math.round(b.y-camera.y),w=b.w,h=b.h;if(x<-250||y<-220||x>W+250||y>H+220)return;
    if(atlasReady){let sx=176,sy=0,sw=80,sh=80;
      if(b.type==="guild"){sx=256;sy=0;sw=96;sh=80}
      else if(b.type==="forge"){sx=240;sy=80;sw=64;sh=64}
      else if(b.type==="market"){sx=160;sy=80;sw=64;sh=64}
      else if(b.type==="inn"){sx=320;sy=80;sw=64;sh=64}
      else if(b.type==="bank"){sx=176;sy=160;sw=50;sh=52}
      else if(b.type==="farm"){sx=176;sy=0;sw=80;sh=80}
      ctx.drawImage(spriteAtlas,sx,sy,sw,sh,x-10,y-12,w+20,h+30);
      ctx.fillStyle="#fff1cf";ctx.font="bold 11px sans-serif";ctx.textAlign="center";ctx.strokeStyle="#493a2b";ctx.lineWidth=3;ctx.strokeText(b.name,x+w/2,y-8);ctx.fillText(b.name,x+w/2,y-8);return;
    }
    ellipse(x+w/2,y+h+8,w*.62,13,"#476b43");rect(x+8,y+36,w-16,h-36,"#69503d");rect(x+12,y+33,w-24,h-38,b.color);rect(x+20,y+44,w-40,h-55,"#d5bd91");
    rect(x+8,y+h-16,w-16,13,"#87745a");ctx.beginPath();ctx.moveTo(x-13,y+48);ctx.lineTo(x+w/2,y-20);ctx.lineTo(x+w+13,y+48);ctx.closePath();ctx.fillStyle="#9b5b45";ctx.fill();
    for(const wx of [x+24,x+w-52]){rect(wx,y+76,28,32,"#654535");rect(wx+4,y+80,20,24,"#8db9b2")}
    rect(x+w/2-15,y+h-58,30,43,"#604231");ctx.fillStyle="#fff0ce";ctx.font="bold 11px sans-serif";ctx.textAlign="center";ctx.fillText(b.name,x+w/2,y-21);
  }
  function drawTreePatch(){for(let i=0;i<70;i++){const x=250+(i*173)%2550,y=260+(i*293)%2050;if(x>1050&&x<2250&&y>700&&y<2050)continue;if(Math.hypot(x-water.x,y-water.y)<350)continue;drawTree(x,y,i)}}
  function drawPixelPerson(p,isPlayer=false){const x=Math.round(p.x-camera.x),y=Math.round(p.y-camera.y);if(x<-40||y<-65||x>W+40||y>H+45)return;
    if(atlasReady){ctx.save();if(!isPlayer)ctx.filter="hue-rotate("+(p.id*31%360)+"deg)";const sx=isPlayer?416:448;ctx.drawImage(spriteAtlas,sx,0,32,48,x-18,y-47,36,54);ctx.restore();
      if(isPlayer){ctx.fillStyle="#fff3d5";ctx.font="11px sans-serif";ctx.textAlign="center";ctx.fillText(player.name,x,y-53)}return;}
    const coat=isPlayer?player.outfit:p.color,hair=isPlayer?(player.hair==="金髪"?"#d6b65e":player.hair==="黒髪"?"#302b2b":"#704a35"):p.hair;
    ellipse(x,y+12,13,5,"#3d603d");rect(x-9,y-8,18,14,coat);rect(x-7,y-23,14,14,"#dfb58e");rect(x-8,y-25,16,6,hair);
    if(isPlayer){ctx.fillStyle="#fff3d5";ctx.font="11px sans-serif";ctx.textAlign="center";ctx.fillText(player.name,x,y-34)}
  }
  function drawDecor(){for(let i=0;i<20;i++){const x=900+(i*97)%1100,y=800+(i*139)%1000;ellipse(x-camera.x,y-camera.y,5,3,["#d9c17a","#e2a0a3","#c8d49a"][i%3])}for(let i=0;i<8;i++){const x=1460+i*40-camera.x,y=1280-camera.y;rect(x,y,2,10,"#e5d29c");ellipse(x,y-2,5,4,"#f0d88c")}}
  function render(){ctx.clearRect(0,0,W,H);drawGround();drawTreePatch();drawDecor();buildings.forEach(drawHouse);npcs.forEach(n=>drawPixelPerson(n));for(const p of others.values())drawPixelPerson(p);drawPixelPerson(player,true);
  }
  function update(dt){if(!started||!$("creation-panel").classList.contains("hidden"))return;let dx=0,dy=0;if(keys.has("w")||keys.has("arrowup"))dy--;if(keys.has("s")||keys.has("arrowdown"))dy++;if(keys.has("a")||keys.has("arrowleft"))dx--;if(keys.has("d")||keys.has("arrowright"))dx++;if(dx||dy){const len=Math.hypot(dx,dy);dx/=len;dy/=len;const nx=player.x+dx*player.speed*dt,ny=player.y+dy*player.speed*dt;if(!blocked(nx,player.y))player.x=nx;if(!blocked(player.x,ny))player.y=ny;player.dir=dx<-.3?(dy<-.3?"up-left":dy>.3?"down-left":"left"):dx>.3?(dy<-.3?"up-right":dy>.3?"down-right":"right"):dy<0?"up":"down";const now=performance.now();if(socket&&socket.connected&&now-lastMoveSent>80){lastMoveSent=now;socket.emit("player:move",{x:player.x,y:player.y,dir:player.dir})}}camera.x=Math.max(0,Math.min(worldW-W,player.x-W/2));camera.y=Math.max(0,Math.min(worldH-H,player.y-H/2))}
  function loop(t){const dt=Math.min(.04,(t-lastFrame)/1000||0);lastFrame=t;update(dt);render();requestAnimationFrame(loop)}
  document.querySelectorAll(".panel-tab").forEach(b=>b.addEventListener("click",()=>{}));
  $("open-adventurer").addEventListener("click",()=>{$("adventurer-panel").classList.remove("hidden")});$("close-adventurer").addEventListener("click",()=>$("adventurer-panel").classList.add("hidden"));
  requestAnimationFrame(loop);
})();