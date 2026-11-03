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

  const fieldEnemies=[
    {id:"slime-a",name:"スライム",x:720,y:760,hp:28,maxHp:28,color:"#8bd7d0",boss:false,alive:true},
    {id:"slime-b",name:"スライム",x:2450,y:780,hp:28,maxHp:28,color:"#8bd7d0",boss:false,alive:true},
    {id:"wolf-a",name:"森のウルフ",x:520,y:1900,hp:42,maxHp:42,color:"#a7aeb8",boss:false,alive:true},
    {id:"goblin-a",name:"ゴブリン",x:2550,y:1900,hp:48,maxHp:48,color:"#9ac078",boss:false,alive:true},
    {id:"guardian",name:"古代の守護者",x:2700,y:430,hp:150,maxHp:150,color:"#d0a66a",boss:true,alive:true}
  ];
  let battle=null;
  let battleMessage="";
  let battleMessageUntil=0;
  function beginBattle(touched){
    const group=[{name:touched.name,hp:touched.hp,maxHp:touched.maxHp,color:touched.color,boss:touched.boss}];
    if(!touched.boss){
      const extras=1+Math.floor(Math.random()*3);
      for(let i=0;i<extras;i++){
        const options=[["スライム",24,24,"#8bd7d0"],["森のウルフ",34,34,"#a7aeb8"],["ゴブリン",40,40,"#9ac078"]];
        const e=options[Math.floor(Math.random()*options.length)];
        group.push({name:e[0],hp:e[1],maxHp:e[2],color:e[3],boss:false});
      }
    }
    battle={enemies:group,playerX:120,playerY:0,vy:0,hp:100,maxHp:100,mp:30,maxMp:30,attackCooldown:0,enemyCooldown:1.1,defending:false,herbs:1,finished:false};
    $("mobile-controls").classList.add("battle-hidden");
    $("battle-controls").classList.remove("hidden");
    say(touched.boss?"強敵が現れた！ ボス戦からは逃げられない。":"敵と接触した！ 戦闘開始！");
  }
  function finishBattle(result){
    if(!battle)return;
    battle.finished=true;
    const boss=battle.enemies.some(e=>e.boss);
    battleMessage=result==="win"?(boss?"守護者を倒した！":"勝利！ 敵をすべて倒した！"):"戦闘から逃げた。";
    battleMessageUntil=performance.now()+1500;
    if(result==="win"){
      const source=fieldEnemies.find(e=>e.boss===boss && e.alive && (boss?e.name==="古代の守護者":e.name===battle.enemies[0].name));
      if(source)source.alive=false;
    } else if(result==="escape"){
      const source=fieldEnemies.find(e=>e.alive&&!e.boss&&e.name===battle.enemies[0].name);
      if(source){player.x=Math.min(worldW-80,source.x+70);if(Math.hypot(player.x-source.x,player.y-source.y)<40)player.x=source.x-70;saveCurrent();}
    }
    setTimeout(()=>{
      if(!battle)return;
      battle=null;
      $("battle-controls").classList.add("hidden");
      $("mobile-controls").classList.remove("battle-hidden");
      if(result==="win")say("戦闘に勝利した！（経験値・報酬システムは今後実装）");
      else say("戦闘から離脱した。報酬は獲得しません。");
    },1500);
  }
  function battleAttack(){
    if(!battle||battle.finished||battle.attackCooldown>0)return;
    const target=battle.enemies.find(e=>e.hp>0);
    if(!target)return;
    target.hp=Math.max(0,target.hp-14);
    battle.attackCooldown=.38;
    if(battle.enemies.every(e=>e.hp<=0))finishBattle("win");
  }
  function battleMagic(){
    if(!battle||battle.finished)return;
    if(battle.mp<8){say("MPが足りない！");return;}
    battle.mp-=8;
    const target=battle.enemies.find(e=>e.hp>0);
    if(!target)return;
    target.hp=Math.max(0,target.hp-26);
    say("火花の魔法！ "+target.name+"にダメージ！");
    if(battle.enemies.every(e=>e.hp<=0))finishBattle("win");
  }
  function battleItem(){
    if(!battle||battle.finished)return;
    if(battle.herbs<=0){say("この戦闘で使える薬草はもうない。");return;}
    battle.herbs--;battle.hp=Math.min(battle.maxHp,battle.hp+28);say("薬草を使った。HPが回復！");
  }
  function drawBattle(){
    rect(0,0,W,H,"#263d45");
    for(let i=0;i<8;i++){rect(i*140,0,140,300,i%2?"#34545a":"#3d6060");rect(i*140,300,140,300,i%2?"#65744e":"#718256");}
    rect(0,438,W,162,"#8a805d");rect(0,438,W,8,"#b7a77a");
    for(let i=0;i<18;i++){const x=i*59;rect(x,420+(i%3)*5,3,18,"#596d42");}
    ctx.fillStyle="#f4f0df";ctx.font="bold 22px sans-serif";ctx.textAlign="left";ctx.fillText("BATTLE",28,38);
    ctx.font="16px sans-serif";ctx.fillText("HP "+battle.hp+" / "+battle.maxHp,28,72);ctx.fillText("MP "+battle.mp+" / "+battle.maxMp,28,98);
    rect(28,108,190,10,"#29313a");rect(28,108,190*battle.hp/battle.maxHp,10,"#d96d68");
    rect(28,126,190,8,"#29313a");rect(28,126,190*battle.mp/battle.maxMp,8,"#6da9df");
    const px=battle.playerX,py=438-battle.playerY;
    ellipse(px,py+7,18,7,"#394239");rect(px-10,py-35,20,30,player.outfit);rect(px-8,py-51,16,16,"#e1bd98");rect(px-8,py-55,16,6,"#60452f");rect(px+8,py-31,20,4,"#d9dce3");
    battle.enemies.forEach((e,i)=>{
      if(e.hp<=0)return;
      const ex=650+(i%3)*92,ey=430-Math.floor(i/3)*55;
      ellipse(ex,ey+8,e.boss?42:24,e.boss?13:8,"#394239");
      if(e.boss){rect(ex-34,ey-65,68,64,e.color);rect(ex-28,ey-80,56,22,"#8b6547");rect(ex-25,ey-50,10,8,"#f6df9b");rect(ex+15,ey-50,10,8,"#f6df9b");}
      else{ellipse(ex,ey-14,24,22,e.color);ellipse(ex-9,ey-18,4,5,"#26323a");ellipse(ex+9,ey-18,4,5,"#26323a");}
      ctx.fillStyle="#fff";ctx.font="13px sans-serif";ctx.textAlign="center";ctx.fillText(e.name,ex,ey-92);
      rect(ex-32,ey-85,64,5,"#29313a");rect(ex-32,ey-85,64*e.hp/e.maxHp,5,"#d96d68");
    });
    if(battle.defending){ctx.fillStyle="#d9e8ff";ctx.font="14px sans-serif";ctx.fillText("防御中",px,py-68);}
    if(battleMessageUntil>performance.now()){ctx.fillStyle="#fff";ctx.font="bold 24px sans-serif";ctx.textAlign="center";ctx.fillText(battleMessage,W/2,220);}
    ctx.fillStyle="#f7f0dd";ctx.font="14px sans-serif";ctx.textAlign="left";ctx.fillText(battle.enemies.some(e=>e.boss)?"BOSS BATTLE":"FIELD BATTLE",28,165);
    ctx.textAlign="right";ctx.fillText(battle.enemies.some(e=>e.boss)?"ボス戦では逃走できません":"右端まで進むと逃走",W-24,38);
  }

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
  window.addEventListener("keydown",e=>{const k=e.key.toLowerCase();if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k))e.preventDefault();keys.add(k);if(k==="e"&&started&&!battle)interact();if(k==="z"&&battle)battleAttack();if(k==="1"&&battle)battleMagic();if(k==="2"&&battle)battleItem()});window.addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));window.addEventListener("blur",()=>keys.clear());
  const keyMap={up:"arrowup",down:"arrowdown",left:"arrowleft",right:"arrowright"};document.querySelectorAll("[data-dir]").forEach(b=>{const k=keyMap[b.dataset.dir];b.addEventListener("pointerdown",e=>{e.preventDefault();keys.add(k)});["pointerup","pointercancel","pointerleave"].forEach(t=>b.addEventListener(t,()=>keys.delete(k)))});
  $("interact-button").addEventListener("click",interact);
  function interact(){let best=95,target=null;for(const b of buildings){const d=Math.hypot(player.x-(b.x+b.w/2),player.y-(b.y+b.h/2));if(d<best){best=d;target=b}}for(const n of npcs){const d=Math.hypot(player.x-n.x,player.y-n.y);if(d<best){best=d;target=n}}if(target?.name){if(target.role)say(target.name+"「こんにちは！ "+target.role+"をしているよ。」");else say(target.name+"：施設の準備を進めているよ。")}else say("草花が風に揺れている。リーフェルを探検しよう！")}
  function hash(x,y){let n=(x*374761393+y*668265263)|0;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295}
  function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}
  function ellipse(x,y,rx,ry,c){ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(Math.round(x),Math.round(y),rx,ry,0,0,Math.PI*2);ctx.fill()}
  function path(points,color,width){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0]-camera.x,p[1]-camera.y):ctx.moveTo(p[0]-camera.x,p[1]-camera.y));ctx.stroke()}
  // Gentle front-facing quarter view: north stays at the top, with a modest
  // camera elevation. Character sprite proportions and screen-facing shapes stay unchanged.
  const TILE=32, DEPTH=.68;
  function project(wx,wy){return{x:Math.round(W/2+(wx-camera.x)),y:Math.round(H/2+(wy-camera.y)*DEPTH)};}
  function poly(points,fill,stroke="#29202a",line=2){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}}
  // Smooth world-anchored grass without tile seams or random speckles.
  function tile(wx,wy,fill){const p=project(wx,wy);ellipse(p.x,p.y,19,13,fill);}
  function specks(){}
  function drawGround(){
    rect(0,0,W,H,"#477b46");
    const gx0=Math.floor((camera.x-W/2-64)/TILE)*TILE,gx1=camera.x+W/2+64;
    const gy0=Math.floor((camera.y-H/(2*DEPTH)-64)/TILE)*TILE,gy1=camera.y+H/(2*DEPTH)+64;
    for(let wy=gy0;wy<=gy1;wy+=TILE)for(let wx=gx0;wx<=gx1;wx+=TILE){
      const p=project(wx,wy),v=hash(Math.floor(wx/TILE),Math.floor(wy/TILE));
      ellipse(p.x,p.y,22,15,v>.72?"#56864b":v>.35?"#4e8047":"#477842");
      if(v>.91){ellipse(p.x-6,p.y+1,5,3,"#679451");ellipse(p.x+7,p.y-3,4,3,"#679451");}
    }
    for(let y=650;y<2200;y+=24){const bend=390+Math.sin(y/150)*65;for(let x=bend-80;x<=bend+80;x+=32){const p=project(x,y);ellipse(p.x,p.y,19,14,"#347c9e");}}
    for(let y=650;y<2200;y+=32){const bend=390+Math.sin(y/150)*65;for(const x of [bend-100,bend+100]){const p=project(x,y);ellipse(p.x,p.y,19,14,"#b69b6b");}}
    const road=(x1,y1,x2,y2,width,color)=>{const n=Math.ceil(Math.hypot(x2-x1,y2-y1)/24);for(let i=0;i<=n;i++){const t=i/n,cx=x1+(x2-x1)*t,cy=y1+(y2-y1)*t;for(let o=-width/2;o<=width/2;o+=32){const p=project(cx+(x2===x1?o:0),cy+(y2===y1?o:0));ellipse(p.x,p.y,19,14,color);}}};
    road(1600,500,1600,2300,96,"#a99b7c");road(650,1320,2600,1320,96,"#a99b7c");
    road(1600,1320,1100,900,48,"#927c5b");road(1600,1320,2050,900,48,"#927c5b");road(1600,1320,2050,1800,48,"#927c5b");
    for(let y=1192;y<=1448;y+=32)for(let x=1472;x<=1728;x+=32){const p=project(x,y);ellipse(p.x,p.y,19,14,((x/32+y/32)%2===0)?"#c9bd9b":"#b4a787");}
    for(let y=2048;y<2240;y+=32)for(let x=1840;x<2160;x+=32){const p=project(x,y);ellipse(p.x,p.y,19,14,"#82613d");}
    drawBridge(390,930);drawBridge(430,1260);drawBridge(480,1680);drawBridge(510,1940);
    const f=project(1600,1320);ellipse(f.x,f.y+12,48,13,"#786c58");rect(f.x-37,f.y-25,74,39,"#bcb39a");rect(f.x-31,f.y-20,62,28,"#d1c7a9");rect(f.x-24,f.y-15,48,18,"#347e9d");rect(f.x-4,f.y-35,8,22,"#d7cfb4");rect(f.x-2,f.y-41,4,7,"#f1dc9a");
  }
  function drawBridge(wx,wy){const p=project(wx,wy);rect(p.x-42,p.y-13,84,26,"#62432d");for(let i=-3;i<=3;i++){rect(p.x+i*12-5,p.y-12,9,23,i%2?"#bd8750":"#9d693d");rect(p.x+i*12-4,p.y-9,2,17,"#d2a36b");}rect(p.x-46,p.y-17,92,4,"#d3a66b");rect(p.x-46,p.y+14,92,4,"#d3a66b");}
  function drawTree(wx,wy,index=0){
    const p=project(wx,wy),x=p.x,y=p.y;if(x<-80||y<-120||x>W+80||y>H+100)return;
    const palettes=[["#285a36","#397a42","#65954c"],["#315d3d","#4c8549","#83a35a"],["#315a42","#54834c","#a0a15a"],["#3d6539","#6a8e48","#b5a45c"]],leaf=palettes[index%4];
    ellipse(x+2,y+14,23,8,"#263b2b");rect(x-5,y-16,10,30,"#79502f");rect(x-14,y-5,9,5,"#79502f");rect(x+5,y-20,9,5,"#79502f");
    // Layered canopy with irregular pixel clusters, black-green ink edge.
    ellipse(x,y-43,31,29,"#1d3928");ellipse(x-13,y-49,19,20,leaf[0]);ellipse(x+13,y-51,20,21,leaf[1]);ellipse(x,y-68,21,22,leaf[1]);ellipse(x-3,y-74,13,13,leaf[2]);
    ellipse(x-11,y-58,10,6,leaf[2]);ellipse(x+12,y-65,9,5,leaf[2]);
    ellipse(x-20,y-42,7,5,leaf[1]);ellipse(x+19,y-47,7,5,leaf[1]);
  }
  function drawHouse(b,index=0){
    const p=project(b.x+b.w/2,b.y+b.h/2),x=p.x,y=p.y;if(x<-220||y<-200||x>W+220||y>H+180)return;
    const w=Math.max(76,b.w*.72),h=Math.max(50,b.h*.48),type=b.type;
    const palettes=type==="guild"?["#d7b783","#a17a55","#8a4338","#bd7250"]:type==="forge"?["#a18b70","#786b5c","#4b4b52","#77747a"]:type==="inn"?["#e0bc83","#b28b60","#79423a","#c27451"]:type==="market"?["#e0c08d","#b48a61","#9b4d3e","#d17b51"]:type==="farm"?["#c7a16d","#9b7650","#6f5836","#a17a48"]:type==="bank"?["#c9c0a4","#918b7b","#59616b","#92959a"]:[index%2?"#d6bd91":"#c59b70","#987653",index%3===0?"#78433a":index%3===1?"#586b56":"#785b43",index%3===0?"#bf7250":index%3===1?"#8ca16c":"#b28a58"];
    const [front,side,roof,lit]=palettes;
    ellipse(x,y+h+8,w*.58,13,"#26392a");
    // Back roof silhouette and side wall.
    poly([{x:x-w/2,y:y-24},{x:x,y:y-55},{x:x+w/2,y:y-24},{x:x+w/2,y:y+h-7},{x:x,y:y+h+8},{x:x-w/2,y:y+h-7}],side,"#342923",3);
    // Straight, clearly visible front wall and facade.
    rect(x-w/2,y-20,w,h+30,front);rect(x-w/2,y-20,w,5,"#ead2a4");
    for(let row=0;row<5;row++)for(let col=0;col<Math.floor(w/13);col++){const xx=x-w/2+5+col*13+(row%2?6:0),yy=y+row*10;rect(xx,yy,8,2,row%2?"#a77e58":"#ead0a0");}
    // Timber framing.
    rect(x-w/2+8,y-16,6,h+18,"#68462f");rect(x+w/2-14,y-16,6,h+18,"#68462f");rect(x-3,y-16,6,h+18,"#68462f");
    // Raised pitched roof: broad visible roof plane, dark eaves and a side plane
    // create depth while keeping the facade and door straight-on.
    const ridgeY=y-82-(index%3)*4, eaveY=y-19, roofFront=y-7;
    poly([{x:x-w/2-13,y:eaveY},{x:x-3,y:ridgeY},{x:x+w/2+13,y:eaveY},{x:x+w/2+8,y:roofFront},{x:x,y:roofFront+18},{x:x-w/2-8,y:roofFront}], "#392827","#251d20",4);
    poly([{x:x-w/2-9,y:eaveY-2},{x:x-3,y:ridgeY+5},{x:x-1,y:roofFront+5},{x:x-w/2+3,y:roofFront+3}],lit,"#50302a",2);
    poly([{x:x-1,y:ridgeY+5},{x:x+w/2+9,y:eaveY-2},{x:x+w/2+5,y:roofFront+2},{x:x,y:roofFront+18}],roof,"#392725",2);
    // Solid clean roof planes; remove broken shingle strokes.
    poly([{x:x-w/2-9,y:eaveY-2},{x:x-3,y:ridgeY+5},{x:x-1,y:roofFront+5},{x:x-w/2+3,y:roofFront+3}],lit,"#50302a",2);
    poly([{x:x-1,y:ridgeY+5},{x:x+w/2+9,y:eaveY-2},{x:x+w/2+5,y:roofFront+2},{x:x,y:roofFront+18}],roof,"#392725",2);
    rect(x-w/2-12,roofFront-1,w+24,5,"#4a3029");
    rect(x-w/2-12,roofFront+3,w+24,2,"#b8784f");
    // Warm windows, shutters and centered wooden door.
    const wy=y+Math.round(h*.38);for(const s of [-1,1]){const wx=x+s*w*.29;rect(wx-10,wy-11,20,25,"#493329");rect(wx-7,wy-8,14,19,"#e6ad58");rect(wx-5,wy-6,10,15,"#ffe2a0");rect(wx-1,wy-8,2,18,"#754b30");rect(wx-12,wy-12,4,26,"#805234");rect(wx+8,wy-12,4,26,"#805234");}
    rect(x-12,y+h-18,24,35,"#493126");rect(x-8,y+h-14,16,31,"#95643d");rect(x+4,y+h-5,2,2,"#f0ce72");rect(x-18,y+h+17,36,5,"#b4a58a");
    if(type==="forge"||type==="inn"){rect(x+w*.23,y-70,13,29,"#6e4a3b");rect(x+w*.23-2,y-74,17,5,"#44332f");}
    rect(x-11,y-82,22,10,type==="guild"?"#d6b56e":"#70452f");rect(x-8,y-79,16,3,"#e7d7a5");
    ctx.fillStyle="#fff0ca";ctx.font="bold 11px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.fillText(b.name,x,y-91);
  }
  function drawPixelPerson(p,isPlayer=false){
    const q=project(p.x,p.y),x=q.x,y=q.y;
    if(x<-50||y<-110||x>W+50||y>H+45)return;
    const ink="#211923",female=!isPlayer&&[0,2,8,14,16,18,19,21,23,26,31,32].includes(p.id);
    const skin=isPlayer?"#f0c9a2":"#edc39b",hair=isPlayer?"#493126":(female?"#e5bd58":(p.hair||"#60412f"));
    const coat=isPlayer?"#713aa0":(female?"#3267a5":p.color);
    const px=(rx,ry,rw,rh,color)=>{rect(x+rx-2,y+ry-2,rw+4,rh+4,ink);rect(x+rx,y+ry,rw,rh,color);};
    ellipse(x,y+7,14,5,"#30452f");
    px(-9,-1,6,10,"#49352f");px(3,-1,6,10,"#49352f");
    rect(x-9,y+6,7,3,"#d1a66c");rect(x+3,y+6,7,3,"#d1a66c");
    px(-13,-27,26,23,isPlayer?"#552c82":coat);
    if(female){px(-11,-25,22,24,"#3267a5");px(-13,-22,4,12,"#274f88");px(9,-22,4,12,"#274f88");}
    else{px(-11,-25,22,22,coat);px(-14,-21,5,13,coat);px(9,-21,5,13,coat);}
    if(isPlayer){rect(x-9,y-19,18,2,"#e8c56d");rect(x-2,y-15,4,9,"#e8c56d");rect(x-9,y-7,18,2,"#d8b45d");}
    else if(female){rect(x-2,y-18,4,16,"#d9c27c");rect(x-8,y-7,16,2,"#e4c77c");}
    else{rect(x-8,y-8,16,3,"#c5a35e");rect(x-2,y-8,4,4,"#f0d48a");}
    px(-4,-32,8,6,skin);px(-10,-50,20,20,skin);px(-12,-43,3,7,skin);px(9,-43,3,7,skin);
    if(p.dir==="up"&&!isPlayer){rect(x-9,y-49,18,12,hair);}
    else{rect(x-6,y-42,3,4,"#fff0d2");rect(x+4,y-42,3,4,"#fff0d2");rect(x-5,y-41,2,3,"#38527a");rect(x+5,y-41,2,3,"#38527a");rect(x-1,y-33,3,2,"#a95e54");}
    if(isPlayer){
      // Original young adventurer: blue wrapped turban, purple cloak and tunic.
      px(-12,-56,24,8,"#244f9c");px(-10,-61,20,7,"#326ac0");
      rect(x-9,y-55,18,2,"#79a6e4");rect(x-5,y-60,13,2,"#8bb5ed");
      px(7,-59,7,8,"#244f9c");rect(x+8,y-54,4,2,"#e6c46d");
      rect(x-8,y-27,4,19,"#8e5ac0");rect(x+5,y-27,4,19,"#8e5ac0");
      rect(x-11,y-65,22,3,"#1c3e7e");rect(x-3,y-63,7,2,"#e9c56b");
    }else if(female){
      // Blonde twin braids and a blue fantasy dress.
      px(-12,-55,24,8,"#e5bd58");px(-14,-48,5,15,"#d9a844");px(9,-48,5,15,"#d9a844");
      for(let i=0;i<3;i++){rect(x-15,y-39+i*5,5,4,i%2?"#f0d16d":"#c99438");rect(x+10,y-39+i*5,5,4,i%2?"#f0d16d":"#c99438");}
      rect(x-13,y-24,3,3,"#f4dc87");rect(x+10,y-24,3,3,"#f4dc87");
    }else{px(-12,-56,24,8,hair);px(-14,-49,5,12,hair);px(9,-49,5,11,hair);rect(x-8,y-57,7,3,"#9b704b");rect(x+2,y-58,7,3,"#9b704b");}
  }
  function render(){
    ctx.clearRect(0,0,W,H);if(battle){drawBattle();return;}drawGround();
    const objects=[];
    for(const b of buildings)objects.push({depth:b.y+b.h,draw:()=>drawHouse(b,buildings.indexOf(b))});
    for(let i=0;i<110;i++){const x=160+Math.floor(hash(i,23)*2700),y=180+Math.floor(hash(i,31)*1950);if(Math.hypot(x-1600,y-1320)<420||(x>280&&x<620&&y>700&&y<2200))continue;objects.push({depth:y,draw:()=>drawTree(x,y,i)});}
    for(const n of npcs)objects.push({depth:n.y,draw:()=>drawPixelPerson(n)});
    for(const p of others.values())objects.push({depth:p.y,draw:()=>drawPixelPerson(p)});
    objects.push({depth:player.y,draw:()=>drawPixelPerson(player,true)});
    objects.sort((a,b)=>a.depth-b.depth).forEach(o=>o.draw());
    fieldEnemies.filter(e=>e.alive).forEach(e=>{const p=project(e.x,e.y);ellipse(p.x,p.y+5,13,5,"#25372a");ellipse(p.x,p.y-10,12,12,e.color);ellipse(p.x-4,p.y-13,2,3,"#20252b");ellipse(p.x+4,p.y-13,2,3,"#20252b");ctx.fillStyle="#fff";ctx.font="11px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.fillText(e.name,p.x,p.y-29);});
  }
  function update(dt){
    if(!started||!$("creation-panel").classList.contains("hidden"))return;
    if(battle){
      if(battle.finished)return;
      let dx=0;if(keys.has("a")||keys.has("arrowleft"))dx--;if(keys.has("d")||keys.has("arrowright"))dx++;
      battle.playerX=Math.max(35,Math.min(W-35,battle.playerX+dx*260*dt));
      if((keys.has(" ")||keys.has("w")||keys.has("arrowup"))&&battle.playerY<=0)battle.vy=390;
      battle.playerY=Math.max(0,battle.playerY+battle.vy*dt);battle.vy-=980*dt;
      battle.attackCooldown=Math.max(0,battle.attackCooldown-dt);
      battle.defending=keys.has("x");
      battle.enemyCooldown-=dt;
      if(battle.enemyCooldown<=0){
        const alive=battle.enemies.filter(e=>e.hp>0);
        if(alive.length){const damage=alive.some(e=>e.boss)?14:alive.length*5;battle.hp=Math.max(0,battle.hp-(battle.defending?Math.ceil(damage*.35):damage));battle.enemyCooldown=1.25;if(battle.hp<=0){battle.finished=true;battleMessage="力尽きてしまった…";battleMessageUntil=performance.now()+1500;setTimeout(()=>{battle=null;player.x=1600;player.y=1300;saveCurrent();$("battle-controls").classList.add("hidden");$("mobile-controls").classList.remove("battle-hidden");say("町へ戻りました。戦闘の続きは今後実装します。");},1500);return;}}
      }
      if(battle.playerX>=W-38){
        if(battle.enemies.some(e=>e.boss)){battle.playerX=W-40;say("ボス戦からは逃げられない！");}
        else finishBattle("escape");
      }
      return;
    }
    let dx=0,dy=0;if(keys.has("w")||keys.has("arrowup"))dy--;if(keys.has("s")||keys.has("arrowdown"))dy++;if(keys.has("a")||keys.has("arrowleft"))dx--;if(keys.has("d")||keys.has("arrowright"))dx++;
    if(dx||dy){const len=Math.hypot(dx,dy);dx/=len;dy/=len;const nx=player.x+dx*player.speed*dt,ny=player.y+dy*player.speed*dt;if(!blocked(nx,player.y))player.x=nx;if(!blocked(player.x,ny))player.y=ny;player.dir=dx<-.3?(dy<-.3?"up-left":dy>.3?"down-left":"left"):dx>.3?(dy<-.3?"up-right":dy>.3?"down-right":"right"):dy<0?"up":"down";const now=performance.now();if(socket&&socket.connected&&now-lastMoveSent>80){lastMoveSent=now;socket.emit("player:move",{x:player.x,y:player.y,dir:player.dir})}}
    camera.x=player.x;camera.y=player.y;
    const touched=fieldEnemies.find(e=>e.alive&&Math.hypot(player.x-e.x,player.y-e.y)<32);if(touched)beginBattle(touched);
  }
  function loop(t){const dt=Math.min(.04,(t-lastFrame)/1000||0);lastFrame=t;update(dt);render();requestAnimationFrame(loop)}
  document.querySelectorAll(".panel-tab").forEach(b=>b.addEventListener("click",()=>{}));
  $("open-adventurer").addEventListener("click",()=>{$("adventurer-panel").classList.remove("hidden")});$("close-adventurer").addEventListener("click",()=>$("adventurer-panel").classList.add("hidden"));

  $("battle-attack").addEventListener("click",battleAttack);
  $("battle-magic").addEventListener("click",battleMagic);
  $("battle-item").addEventListener("click",battleItem);
  const defendButton=$("battle-defend");
  defendButton.addEventListener("pointerdown",e=>{e.preventDefault();keys.add("x")});
  ["pointerup","pointercancel","pointerleave"].forEach(t=>defendButton.addEventListener(t,()=>keys.delete("x")));
  document.querySelectorAll("[data-battle-key]").forEach(button=>{
    const key=button.dataset.battleKey;
    button.addEventListener("pointerdown",e=>{e.preventDefault();keys.add(key)});
    ["pointerup","pointercancel","pointerleave"].forEach(t=>button.addEventListener(t,()=>keys.delete(key)));
  });
  requestAnimationFrame(loop);
})();