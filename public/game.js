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
  // 32px tile renderer: every map surface is drawn on a square grid.
  const TILE=32;
  function tileRect(wx,wy,color,w=TILE,h=TILE){
    const sx=Math.floor(wx-camera.x),sy=Math.floor(wy-camera.y);
    rect(sx,sy,w,h,color);
  }
  function drawGround(){
    rect(0,0,W,H,"#4d8248");
    const left=Math.floor(camera.x/TILE)*TILE,top=Math.floor(camera.y/TILE)*TILE;
    for(let wy=top;wy<camera.y+H+TILE;wy+=TILE){
      for(let wx=left;wx<camera.x+W+TILE;wx+=TILE){
        const v=hash(wx/TILE,wy/TILE);
        tileRect(wx,wy,v>.82?"#5b914d":v>.35?"#548747":"#4e8044");
        if(v>.91){tileRect(wx+7,wy+8,"#8eaa55",4,4);tileRect(wx+21,wy+22,"#3d713d",3,3);}
        if(v<.08)tileRect(wx+14,wy+6,"#d6c36c",3,5);
      }
    }
    // Winding river: square water tiles with stepped banks.
    const river=[[300,650],[350,800],[420,950],[390,1110],[420,1260],[500,1400],[470,1570],[430,1740],[520,1900],[500,2180]];
    for(let i=0;i<river.length-1;i++){
      const [x1,y1]=river[i],[x2,y2]=river[i+1],steps=Math.max(1,Math.ceil(Math.hypot(x2-x1,y2-y1)/16));
      for(let s=0;s<=steps;s++){const t=s/steps,x=Math.round((x1+(x2-x1)*t)/16)*16,y=Math.round((y1+(y2-y1)*t)/16)*16;
        for(let oy=-64;oy<=64;oy+=16)for(let ox=-64;ox<=64;ox+=16){
          if(ox*ox+oy*oy<=64*64){tileRect(x+ox,y+oy,"#b9a879",16,16);tileRect(x+ox+2,y+oy+2,"#397fa0",12,12);}
        }
      }
    }
    // Main cobblestone roads and smaller dirt lanes, snapped to 32px tiles.
    const road=(x1,y1,x2,y2,width,color)=>{const n=Math.ceil(Math.hypot(x2-x1,y2-y1)/16);for(let i=0;i<=n;i++){const t=i/n,x=Math.round((x1+(x2-x1)*t)/16)*16,y=Math.round((y1+(y2-y1)*t)/16)*16;for(let oy=-width/2;oy<=width/2;oy+=16)for(let ox=-width/2;ox<=width/2;ox+=16)tileRect(x+ox,y+oy,color,16,16);}};
    road(1600,1320,1600,500,64,"#b8a77e");road(1600,1320,2600,1320,64,"#b8a77e");road(1600,1320,1600,2300,64,"#b8a77e");road(1600,1320,650,1320,64,"#b8a77e");
    road(1600,1320,1100,900,32,"#a18a62");road(1600,1320,2050,900,32,"#a18a62");road(1600,1320,2050,1800,32,"#a18a62");
    // Central plaza: square stone tiles and a patterned border.
    for(let y=1192;y<=1448;y+=32)for(let x=1472;x<=1728;x+=32){
      tileRect(x,y,((x+y)/32)%2===0?"#c9bd98":"#b9ad88");
      tileRect(x+2,y+2,"#d6cba9",28,28);
    }
    for(let x=1472;x<=1728;x+=32){tileRect(x,1184,"#8b795b");tileRect(x,1448,"#8b795b");}
    for(let y=1184;y<=1448;y+=32){tileRect(1472,y,"#8b795b");tileRect(1728,y,"#8b795b");}
    // Farm plots, furrows and crops.
    tileRect(1840,2048,"#9b7547",320,192);
    for(let y=2064;y<2224;y+=32){tileRect(1856,y,"#765638",288,5);for(let x=1872;x<2128;x+=32){tileRect(x,y+9,"#5b913f",10,12);tileRect(x+4,y+5,"#c4a64d",4,4);}}
    // Four bridges across the river, each built from square wooden planks.
    drawBridge(390,930,0);drawBridge(430,1260,1);drawBridge(480,1680,0);drawBridge(510,1940,1);
    // Fountain in the plaza, drawn as crisp concentric square basins.
    tileRect(1552,1264,"#75654d",96,96);tileRect(1560,1272,"#d8d0ae",80,80);tileRect(1568,1280,"#347f9d",64,64);tileRect(1584,1296,"#62b4c0",32,32);tileRect(1592,1304,"#e6d89c",16,16);
    // Flowers and shrubs on the green outskirts.
    for(let i=0;i<90;i++){const x=250+Math.floor(hash(i,3)*2500),y=250+Math.floor(hash(i,9)*1900);if(x>1450&&x<1750&&y>1160&&y<1480)continue;tileRect(x,y,["#d8c66c","#e7a2a5","#f0dfb0"][i%3],4,4);tileRect(x+4,y+4,"#39733e",4,4);}
  }
  function drawBridge(x,y,vertical){
    const sx=x-camera.x,sy=y-camera.y;
    if(vertical){for(let i=0;i<5;i++){rect(sx+i*16-32,sy-42,12,84,"#81542f");rect(sx+i*16-32,sy-42,12,5,"#d2a36a");}}
    else{for(let i=0;i<5;i++){rect(sx-42,sy+i*16-32,84,12,"#81542f");rect(sx-42,sy+i*16-32,5,12,"#d2a36a");}}
  }
  function drawTree(wx,wy){
    const x=Math.round(wx-camera.x),y=Math.round(wy-camera.y);
    if(x<-64||y<-64||x>W+64||y>H+64)return;
    rect(x-5,y+8,10,19,"#76502f");rect(x-19,y-12,38,28,"#2f6338");rect(x-15,y-25,30,25,"#397844");rect(x-8,y-31,16,10,"#5a9850");
    rect(x-13,y-9,7,6,"#75a64c");rect(x+6,y-20,6,6,"#75a64c");rect(x-2,y+12,4,8,"#9b7040");
  }
  function drawHouse(b){
    const x=Math.round(b.x-camera.x),y=Math.round(b.y-camera.y),w=b.w,h=b.h;
    if(x<-220||y<-160||x>W+220||y>H+160)return;
    const roof=b.type==="guild"?"#754238":b.type==="inn"?"#9a493b":b.type==="forge"?"#55535a":b.type==="market"?"#a34e3f":b.type==="farm"?"#8b6337":"#98533f";
    // Ground shadow and timber foundation.
    rect(x+8,y+24,w,h-10,"#344d35");rect(x+4,y+18,w-8,h-16,"#6d5039");
    // Roof tiles are square, with a ridge and alternating tile highlights.
    rect(x,y+8,w,Math.max(30,h*.43),"#54352e");
    rect(x+4,y+4,w-8,Math.max(28,h*.43-4),roof);
    for(let yy=y+10;yy<y+h*.43;yy+=12)for(let xx=x+8;xx<x+w-8;xx+=16){rect(xx,yy,12,5,((xx+yy)/4)%2?"#b56b4c":"#87483b");}
    rect(x+w/2-5,y+5,10,h*.39,"#c17a53");
    // Front wall, timber frame, windows, doorway and sign.
    rect(x+12,y+h*.43,w-24,h*.48,"#d9b77d");rect(x+12,y+h*.43,w-24,6,"#f0d69b");
    rect(x+18,y+h*.43,7,h*.48,"#765039");rect(x+w-25,y+h*.43,7,h*.48,"#765039");
    rect(x+30,y+h*.53,22,20,"#654b39");rect(x+33,y+h*.535,16,14,"#8ac0bd");rect(x+40,y+h*.535,3,14,"#e4d5a6");
    rect(x+w-52,y+h*.53,22,20,"#654b39");rect(x+w-49,y+h*.535,16,14,"#8ac0bd");rect(x+w-42,y+h*.535,3,14,"#e4d5a6");
    rect(x+w/2-13,y+h*.64,26,h*.27,"#68452f");rect(x+w/2-8,y+h*.67,16,h*.24,"#a8784b");rect(x+w/2+5,y+h*.77,3,3,"#e5c76b");
    rect(x+w/2-20,y+h*.42,40,8,"#6d4734");rect(x+w/2-16,y+h*.43,32,4,"#e2bd75");
    ctx.fillStyle="#fff2c8";ctx.font="bold 12px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.fillText(b.name,x+w/2,y-7);
  }
  function drawTreePatch(){
    for(let i=0;i<110;i++){const x=160+Math.floor(hash(i,23)*2700),y=180+Math.floor(hash(i,31)*1950);if(Math.hypot(x-1600,y-1320)<420|| (x>280&&x<620&&y>700&&y<2200))continue;drawTree(x,y);}
  }
  function drawPixelPerson(p,isPlayer=false){
    const x=Math.round(p.x-camera.x),y=Math.round(p.y-camera.y);
    if(x<-42||y<-54||x>W+42||y>H+42)return;
    const coat=isPlayer?player.outfit:p.color;
    const skin=isPlayer?({"明るい肌":"#edc59d","色白":"#f3d8bd","褐色肌":"#a96f4e","小麦色":"#bd865e"}[player.skin]||"#edc59d"):"#e8bd91";
    const hair=isPlayer?({"栗色":"#68412e","黒髪":"#332c2b","金髪":"#d4ae4e","黒":"#332c2b","金色":"#d4ae4e","銀色":"#b9b9ae"}[player.hair]||"#68412e"):p.hair;
    const role=p.role||"冒険者",species=isPlayer?player.species:(p.species||"人間");
    const outline="#17131a";
    // Every sprite part receives a dark 1-2px outline for strong separation from the map.
    const pixel=(rx,ry,rw,rh,color,b=2)=>{rect(x+rx-b,y+ry-b,rw+2*b,rh+2*b,outline);rect(x+rx,y+ry,rw,rh,color);};
    // Shadow, boots, legs, tunic and sleeves.
    ellipse(x,y+14,12,4,"#293a2b");
    pixel(-8,2,6,13,"#49352b");pixel(2,2,6,13,"#49352b");
    pixel(-9,-12,18,18,coat);pixel(-13,-8,5,11,coat);pixel(8,-8,5,11,coat);
    pixel(-6,4,5,5,"#d8d0b4",1);pixel(1,4,5,5,"#d8d0b4",1);
    // Face, ears, hair and facial features.
    pixel(-7,-31,14,14,skin);pixel(-10,-27,4,7,skin,1);pixel(6,-27,4,7,skin,1);
    pixel(-8,-36,16,7,hair);pixel(-10,-32,4,9,hair,1);pixel(6,-32,4,9,hair,1);
    pixel(-5,-25,3,4,"#25202a",1);pixel(3,-25,3,4,"#25202a",1);
    pixel(-1,-19,3,2,"#a95e50",1);
    // Hair silhouette and fringe give each adventurer a recognizable head shape.
    pixel(-10,-39,7,5,hair,1);pixel(-3,-42,8,7,hair,1);pixel(4,-38,7,5,hair,1);
    // Species traits remain subtle and readable.
    if(species==="エルフ"||species==="妖精族"){pixel(-14,-27,6,4,"#d8a77d",1);pixel(8,-27,6,4,"#d8a77d",1);}
    if(species==="竜人"){pixel(-8,-43,5,7,"#9a5b45",1);pixel(3,-43,5,7,"#9a5b45",1);}
    if(species==="獣人"){pixel(-13,-29,5,8,hair,1);pixel(8,-29,5,8,hair,1);}
    if(species==="妖精族"){pixel(-17,-8,5,16,"#9bd9df",1);pixel(12,-8,5,16,"#9bd9df",1);}
    // Outfit details: belt, collar, gloves and small emblem.
    pixel(-5,-13,10,4,"#e0bd73",1);pixel(-2,-12,4,3,"#68462e",1);
    pixel(-4,-9,8,3,"#e5d4a8",1);
    // Role-specific silhouettes and props.
    if(role==="衛兵"){pixel(-10,-44,20,5,"#aab7c2");pixel(-5,-49,10,5,"#758a9b");pixel(-2,-47,4,3,"#e7c76d",1);}
    if(role==="鍛冶師"){pixel(-11,-15,22,5,"#8a6a45");pixel(-13,-39,26,5,"#4a403b");pixel(11,-8,4,17,"#9a9a9a",1);}
    if(role==="農家"||role==="牧童"){pixel(-11,-42,22,5,"#c19b55");pixel(-7,-47,14,5,"#8c643d");pixel(12,-8,3,20,"#74502f",1);}
    if(role==="受付"||role==="服飾職人"){pixel(-7,-14,14,4,"#f0d4a0",1);pixel(-2,-44,4,4,"#e4c45c",1);}
    if(role==="宿屋"){pixel(-11,-44,22,5,"#e2d1aa");pixel(-7,-49,14,5,"#8b4938");}
    if(role==="町長"){pixel(-9,-14,18,4,"#d8c9a1",1);pixel(-8,-44,16,5,"#625b72");pixel(-2,-48,4,4,"#d6bd70",1);}
    if(isPlayer){
      pixel(-12,-46,24,4,"#e6c46a",1);
      ctx.fillStyle="#fff5d7";ctx.font="11px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.fillText(player.name,x,y-53);
    } else {
      ctx.fillStyle="#fff4d2";ctx.font="10px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.fillText(p.name,x,y-51);
    }
  }
  function drawDecor(){}
  function render(){
    ctx.clearRect(0,0,W,H);
    if(battle){drawBattle();return;}
    drawGround();
    drawTreePatch();
    buildings.forEach(drawHouse);
    npcs.forEach(n=>drawPixelPerson(n));
    fieldEnemies.filter(e=>e.alive).forEach(e=>{const x=e.x-camera.x,y=e.y-camera.y;ellipse(x,y+7,e.boss?19:13,e.boss?7:5,"#3d4b37");ellipse(x,y-5,e.boss?17:12,e.boss?18:12,e.color);if(e.boss){rect(x-12,y-25,24,8,"#806044");}else{ellipse(x-4,y-8,2,3,"#26313a");ellipse(x+4,y-8,2,3,"#26313a");}ctx.fillStyle="#fff";ctx.font="11px sans-serif";ctx.textAlign="center";ctx.fillText(e.name,x,y-25);});
    for(const p of others.values())drawPixelPerson(p);
    drawPixelPerson(player,true);
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
    camera.x=Math.max(0,Math.min(worldW-W,player.x-W/2));camera.y=Math.max(0,Math.min(worldH-H,player.y-H/2));
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