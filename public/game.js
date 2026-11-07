"use strict";
(() => {
  const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");
  const W=960,H=600; canvas.width=W;canvas.height=H;ctx.imageSmoothingEnabled=false;
  // Simple shape-only graphics: no external image assets are loaded.
  const atlasReady=false;
  const $=id=>document.getElementById(id);
  const startPanel=$("start-panel"),authForm=$("auth-form"),accountName=$("account-name"),password=$("account-password"),characterName=$("character-name"),nameWrap=$("character-name-wrap"),authMessage=$("auth-message"),authSubmit=$("auth-submit"),loginTab=$("login-tab"),registerTab=$("register-tab"),notice=$("notice"),hudName=$("hud-name"),onlineCount=$("online-count"),connectionState=$("connection-state");
  const player={id:null,name:"冒険者",x:1600,y:1300,speed:155,dir:"down",species:"人間",hair:"栗色",skin:"明るい肌",eyes:"青",style:"旅人",outfit:"#4f78a5",accessory:"なし"};
  const others=new Map(),keys=new Set();let started=false,authMode="login",gameData={},camera={x:0,y:0},lastMoveSent=0,lastPresenceSent=0,noticeTimer=null,lastFrame=0;
  let realtimeClient=null,realtimeChannel=null,realtimeId=null;
  const town={x:1600,y:1300};
  const buildings=[
    ["冒険者ギルド",1900,850,190,145,"#d5b47b","guild"],["武器屋",980,1080,150,120,"#bd8860","shop"],["鍛冶屋",1120,1660,150,125,"#8c6b59","forge"],["道具屋",2180,1080,155,125,"#c48e5e","shop"],["宿屋",1050,1740,180,140,"#b77d57","inn"],["酒場",1260,1900,150,120,"#98664e","inn"],["市場",1980,1800,180,120,"#c19a62","market"],["銀行",2160,1980,140,115,"#b5a17a","bank"],["町長の家",980,1500,165,130,"#a78a71","home"],["あなたの家",1480,2050,175,140,"#9a7eaa","home"],["服飾店",2060,1660,145,120,"#b77b8b","shop"],["農家の作業小屋",2300,2120,150,120,"#a18b57","farm"],["理髪店",2360,900,130,110,"#a6a1a0","shop"],["仕立て屋",2280,1840,145,115,"#a87989","shop"],["訓練所",880,850,155,120,"#8c9a72","guild"],["住民の家",700,570,125,100,"#b48a62","home"],["住民の家",930,570,130,105,"#a98268","home"],["住民の家",2110,570,130,105,"#b58e67","home"],["住民の家",2350,620,125,100,"#a67f60","home"],["住民の家",2500,1050,125,105,"#b18c69","home"],["住民の家",2510,1900,135,105,"#a67f60","home"],["住民の家",2050,2160,135,105,"#b58e67","home"],["住民の家",1000,2130,130,105,"#ad8967","home"],["住民の家",700,1840,130,105,"#b18c69","home"]  ].map(([name,x,y,w,h,color,type])=>({name,x,y,w,h,color,type}));
  const npcDefs=[
    ["エミリア","受付",1460,955,"#c86d83","#8a513b"],["ガルド","鍛冶師",1330,1250,"#7c8790","#51443b"],["ミーナ","道具屋",1850,1230,"#d58d57","#6b4936"],["ノア","農家",1880,1880,"#82a65f","#78543b"],["ロイド","宿屋",2040,1430,"#b88b62","#68472f"],["アルベルト","町長",1300,1570,"#7d8caa","#75604b"],
    ["セラ","武器屋",1130,1245,"#bd6e68","#513b32"],["トーマス","銀行員",1550,1740,"#8b9b9a","#564536"],["リナ","服飾職人",1030,1570,"#c47a9b","#684638"],["バルド","衛兵",900,1190,"#758b6d","#4a392f"],["ユリウス","衛兵",2210,1370,"#758b6d","#4a392f"],["マルタ","市場商人",1780,1690,"#d2a65f","#67452f"],
    ["ピノ","農家",1920,1950,"#8aa75f","#754c37"],["カイ","釣り人",650,1500,"#7399a9","#5a4535"],["メル","花屋",900,1680,"#d58c9b","#654337"],["オスカー","大工",1160,1780,"#b8895e","#60432f"],
    ["ユナ","住民",1240,700,"#d58c9b","#604333"],["レオ","子ども",1530,720,"#d6ae72","#62432f"],["ミオ","子ども",1670,720,"#d58c9b","#62432f"],["ハンナ","住民",2260,900,"#b7a16e","#644a36"],["エド","住民",2310,1760,"#8097a1","#514136"],["フローラ","住民",1130,1900,"#b97c91","#624333"],["ジン","住民",1340,2010,"#b28b60","#513b2d"],["サラ","住民",2160,1900,"#d3a16c","#694835"],
    ["旅人アレン","旅人",720,950,"#7892b4","#4e392d"],["商人ベラ","旅商人",2380,1120,"#bd8b63","#614330"],["旅人ノル","旅人",700,1800,"#829a91","#53402e"],["行商人リック","行商人",2370,1580,"#b88c5e","#60432f"],["衛兵ロウ","衛兵",1600,600,"#718a6c","#48392e"],["衛兵ミラ","衛兵",2470,1430,"#718a6c","#48392e"],["羊飼いテオ","牧童",2030,2040,"#a58c5d","#624630"],["釣り人ネネ","釣り人",520,1580,"#7196a5","#654832"],["薬草師イリス","薬草師",850,1900,"#83a66d","#634735"],["パン屋オットー","パン職人",1700,1900,"#c38a61","#64442f"],["吟遊詩人ルカ","旅芸人",1780,780,"#a68bb8","#563d32"],["見習い冒険者","冒険者",1450,760,"#6e9ca9","#503c32"]
  ];
  const npcDirections=["down","left","up","right","down","right","up","left"];
  const npcs=npcDefs.map((n,i)=>({id:i,name:n[0],role:n[1],x:n[2],y:n[3],color:n[4],hair:n[5],dir:npcDirections[i%npcDirections.length],phase:(i%5)*.7}));
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
  async function responseJson(response){const raw=await response.text();try{return JSON.parse(raw)}catch(_){return{error:"サーバーから正しい応答を受け取れませんでした。Vercelの設定を確認してね。"}}}
  function setAuthMode(mode){authMode=mode;const reg=mode==="register";loginTab.classList.toggle("active",!reg);registerTab.classList.toggle("active",reg);nameWrap.classList.toggle("hidden",!reg);password.autocomplete=reg?"new-password":"current-password";password.minLength=reg?10:1;authSubmit.textContent=reg?"アカウントを作成 ✦":"ログイン ▶";authMessage.textContent=reg?"ユーザーIDと10文字以上のパスワードを設定してね。":"登録済みのユーザーIDとパスワードを入力してね。"}
  loginTab.addEventListener("click",()=>setAuthMode("login"));registerTab.addEventListener("click",()=>setAuthMode("register"));
  async function readGameData(){try{const r=await fetch("/api/game-data",{credentials:"same-origin"});if(r.ok){const j=await r.json();gameData=j.gameData||{}}}catch(e){gameData={}}}
  async function saveGameData(){try{await fetch("/api/game-data",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({gameData})})}catch(e){}}
  function openCreation(){const panel=$("creation-panel");if(panel)panel.classList.remove("hidden")}
  function closeCreation(){const panel=$("creation-panel");if(panel)panel.classList.add("hidden")}
  function initCreation(){
    const form=$("creation-form");if(!form)return;
    form.addEventListener("submit",async e=>{e.preventDefault();player.name=($("create-name").value.trim()||"冒険者").slice(0,12);player.species=$("create-species").value;player.hair=$("create-hair").value;player.skin=$("create-skin").value;player.eyes=$("create-eyes").value;player.style=$("create-style").value;player.outfit=$("create-color").value;player.accessory=$("create-accessory").value;
      gameData.characterCreated=true;gameData.species=player.species;gameData.appearance={hair:player.hair,skin:player.skin,eyes:player.eyes,style:player.style,color:player.outfit,accessory:player.accessory};await saveGameData();await saveCurrent();hudName.textContent=player.name;closeCreation();startPanel.classList.add("hidden");connectRealtime();say("ようこそ、リーフェルへ！");});
  }
  async function enterWorld(profile){player.name=profile.name||"冒険者";player.x=Number(profile.x)||1600;player.y=Number(profile.y)||1300;hudName.textContent=player.name;started=true;await readGameData();if(!gameData.characterCreated){$("create-name").value=player.name;openCreation()}else{const a=gameData.appearance||{};player.species=gameData.species||"人間";player.hair=a.hair||"栗色";player.skin=a.skin||"明るい肌";player.eyes=a.eyes||"青";player.style=a.style||"旅人";player.outfit=a.color||"#4f78a5";player.accessory=a.accessory||"なし";startPanel.classList.add("hidden");connectRealtime();}window.dispatchEvent(new Event("world:entered"));}
  initCreation();
  authForm.addEventListener("submit",async e=>{e.preventDefault();authSubmit.disabled=true;authMessage.textContent="確認しています...";const payload={username:accountName.value.trim(),password:password.value,characterName:characterName.value.trim()||accountName.value.trim()};try{const r=await fetch(authMode==="register"?"/api/register":"/api/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(payload)});const j=await responseJson(r);if(!r.ok)throw new Error(j.error||"処理に失敗しました");password.value="";await enterWorld(j.profile)}catch(err){authMessage.textContent=err.message||"通信に失敗しました"}finally{authSubmit.disabled=false}});
  async function saveCurrent(){if(!started)return;try{await fetch("/api/save",{method:"POST",keepalive:true,credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:player.name,x:player.x,y:player.y})})}catch(e){}}
  $("logout-button").addEventListener("click",async()=>{await saveCurrent();if(realtimeClient&&realtimeChannel)await realtimeClient.removeChannel(realtimeChannel);realtimeChannel=null;await fetch("/api/logout",{method:"POST",credentials:"same-origin"});location.reload()});
  setInterval(()=>{if(started)saveCurrent()},10000);window.addEventListener("pagehide",saveCurrent);
  async function checkLogin(){try{const r=await fetch("/api/me",{credentials:"same-origin"}),j=await responseJson(r);if(r.ok&&j.loggedIn)await enterWorld(j.profile);else if(!r.ok)authMessage.textContent=j.error||"アカウント機能を確認してね"}catch(e){authMessage.textContent="サーバーに接続できません。再読み込みしてね。"}}
  checkLogin();
  function currentPlayerState(){
    return {id:realtimeId,name:player.name,x:player.x,y:player.y,dir:player.dir,moving:!!player.moving,walkClock:player.walkClock||0,color:player.outfit,hair:player.hair,skin:player.skin,eyes:player.eyes,style:player.style,accessory:player.accessory};
  }
  function refreshPresence(){
    if(!realtimeChannel)return;
    const state=realtimeChannel.presenceState(),next=new Map();
    for(const [key,entries] of Object.entries(state)){
      for(const entry of entries||[]){
        const id=entry.id||key;
        if(id!==realtimeId&&Number.isFinite(Number(entry.x))&&Number.isFinite(Number(entry.y)))next.set(id,{...entry,id});
      }
    }
    for(const [id,p] of others)if(next.has(id)&&p._broadcastAt&&Date.now()-p._broadcastAt<7000)next.set(id,p);
    others.clear();for(const [id,p] of next)others.set(id,p);
    updateOnline();
  }
  async function connectRealtime(){
    if(realtimeChannel||!started)return;
    connectionState.textContent="オンライン接続中...";
    try{
      const response=await fetch("/api/realtime-config",{credentials:"same-origin"});
      const config=await responseJson(response);
      if(!response.ok)throw new Error(config.error||"オンライン設定を取得できません");
      if(!window.supabase||typeof window.supabase.createClient!=="function")throw new Error("オンライン通信ライブラリを読み込めません");
      realtimeClient=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
      realtimeId=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():"p-"+Math.random().toString(36).slice(2)+Date.now().toString(36);
      realtimeChannel=realtimeClient.channel("asteria-world-leafell",{config:{broadcast:{self:false},presence:{key:realtimeId}}});
      realtimeChannel.on("presence",{event:"sync"},refreshPresence);
      realtimeChannel.on("broadcast",{event:"player-move"},({payload})=>{
        if(!payload||payload.id===realtimeId||!Number.isFinite(Number(payload.x))||!Number.isFinite(Number(payload.y)))return;
        others.set(payload.id,{...payload,_broadcastAt:Date.now()});updateOnline();
      });
      realtimeChannel.subscribe(async status=>{
        if(status==="SUBSCRIBED"){
          connectionState.textContent="オンライン接続済み";
          await realtimeChannel.track(currentPlayerState());
          refreshPresence();
          say("リーフェルのオンラインワールドに接続しました！");
        }else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED"){
          connectionState.textContent="オンライン接続エラー";
        }
      });
    }catch(error){
      realtimeChannel=null;connectionState.textContent="オンライン接続失敗";
      onlineCount.textContent="オンライン未接続";
      console.error("Realtime connection error:",error);
      say("オンライン通信に接続できません。設定を確認してね。");
    }
  }
  function publishPlayerState(force=false){
    if(!realtimeChannel)return;
    const now=performance.now();
    if(!force&&player.moving&&now-lastMoveSent<100)return;
    if(!force&&!player.moving&&now-lastMoveSent<100&&lastMoveSent!==0)return;
    lastMoveSent=now;
    const payload=currentPlayerState();
    realtimeChannel.send({type:"broadcast",event:"player-move",payload}).catch(error=>console.warn("Player update failed:",error));
    if(force||now-lastPresenceSent>5000){lastPresenceSent=now;realtimeChannel.track(payload).catch(error=>console.warn("Presence update failed:",error));}
  }
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
  // GBA-era top-down tile projection inspired by early handheld RPGs.
  // World coordinates now map directly to a classic overhead view.
  const TILE=16, DEPTH=1;
  function project(wx,wy){return{x:Math.round(W/2+(wx-camera.x)),y:Math.round(H/2+(wy-camera.y))};}
  function poly(points,fill,stroke="#344b35",line=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}}
  function tile(wx,wy,fill){const p=project(wx,wy);rect(p.x,p.y,16,16,fill);}
  function specks(){}
  function drawGround(){
    rect(0,0,W,H,"#69a94f");
    const gx0=Math.floor((camera.x-W/2-16)/TILE)*TILE,gx1=camera.x+W/2+16;
    const gy0=Math.floor((camera.y-H/2-16)/TILE)*TILE,gy1=camera.y+H/2+16;
    for(let wy=gy0;wy<=gy1;wy+=TILE)for(let wx=gx0;wx<=gx1;wx+=TILE){
      const p=project(wx,wy),v=hash(Math.floor(wx/TILE),Math.floor(wy/TILE));
      rect(p.x-8,p.y-8,16,16,v>.78?"#73b454":v>.35?"#69a94f":"#639f49");
      if(v>.70){rect(p.x-4,p.y+1,2,3,"#4f8c42");rect(p.x+3,p.y-4,2,3,"#8bc45d");}
      else if(v<.12){rect(p.x+2,p.y+3,2,2,"#8ac45c");}
    }
    // A narrow winding stream and grassy banks on the western side of town.
    for(let wy=650;wy<2200;wy+=16){
      const bend=390+Math.sin(wy/150)*65;
      for(let wx=bend-64;wx<=bend+64;wx+=16){
        const p=project(wx,wy);rect(p.x-8,p.y-8,16,16,hash(wx,wy)>.5?"#4a9fc0":"#4395b8");
        rect(p.x-5,p.y-5,4,2,"#75c6d5");
      }
      for(const wx of [bend-80,bend+80]){const p=project(wx,wy);rect(p.x-8,p.y-8,16,16,"#b4a06a");rect(p.x-5,p.y-4,5,2,"#d0b879");}
    }
    const road=(x1,y1,x2,y2,width)=>{
      const n=Math.ceil(Math.hypot(x2-x1,y2-y1)/8);
      for(let i=0;i<=n;i++){const t=i/n,cx=x1+(x2-x1)*t,cy=y1+(y2-y1)*t;
        for(let o=-width/2;o<=width/2;o+=16){const p=project(cx+(x2===x1?o:0),cy+(y2===y1?o:0));
          rect(p.x-8,p.y-8,16,16,hash(Math.floor(cx/16)+o,Math.floor(cy/16))>.5?"#c7ad78":"#bda36e");
          rect(p.x-5,p.y-5,2,2,"#d9c18b");
        }
      }
    };
    road(1600,500,1600,2300,112);road(650,1320,2600,1320,112);
    road(1600,1320,1100,900,48);road(1600,1320,2050,900,48);road(1600,1320,2050,1800,48);
    // Town square: compact square paving, like a handheld RPG plaza.
    for(let wy=1160;wy<1480;wy+=16)for(let wx=1440;wx<1760;wx+=16){
      const p=project(wx,wy),v=hash(wx/16,wy/16);
      rect(p.x-8,p.y-8,16,16,v>.5?"#d7c69a":"#cdbb8d");
      rect(p.x-7,p.y-7,14,1,"#e8d9b5");
      rect(p.x-8,p.y+7,16,1,"#a99770");
    }
    for(let wy=2048;wy<2240;wy+=16)for(let wx=1840;wx<2160;wx+=16){const p=project(wx,wy);rect(p.x-8,p.y-8,16,16,"#a78350");rect(p.x-5,p.y-4,5,2,"#c39a5e");}
    drawBridge(390,930);drawBridge(430,1260);drawBridge(480,1680);drawBridge(510,1940);
    drawFountain(1600,1320);
  }
  function drawFountain(wx,wy){
    const p=project(wx,wy),x=p.x,y=p.y;
    // Small square-edged stone fountain viewed from directly above.
    rect(x-34,y-23,68,46,"#786b57");
    rect(x-31,y-20,62,40,"#c6b99a");
    rect(x-27,y-16,54,32,"#4b9fbd");
    rect(x-22,y-12,44,24,"#58b1ca");
    rect(x-15,y-8,30,16,"#75c6d5");
    rect(x-5,y-5,10,10,"#d7e6d2");
    rect(x-2,y-2,4,4,"#ffffff");
    rect(x-30,y-18,10,2,"#eee0bd");rect(x+18,y+14,10,2,"#eee0bd");
    rect(x-34,y-23,68,3,"#e0d2b1");rect(x-34,y+20,68,3,"#9a896a");
  }

  function drawBridge(wx,wy){
    const p=project(wx,wy),x=p.x,y=p.y;
    rect(x-48,y-13,96,26,"#805632");rect(x-44,y-10,88,20,"#c99a5c");
    for(let i=-3;i<=3;i++){rect(x+i*12-4,y-9,8,18,i%2?"#a97543":"#d2a66b");}
    rect(x-49,y-15,98,4,"#e0bd7d");rect(x-49,y+11,98,4,"#e0bd7d");
  }
  function drawTree(wx,wy,index=0){
    const p=project(wx,wy),x=p.x,y=p.y;if(x<-50||y<-60||x>W+50||y>H+60)return;
    const palettes=[["#34753c","#4b9847","#80b94e"],["#286c42","#3f8b4b","#73ae50"],["#3b7a3e","#55994b","#9bc45b"],["#397044","#57964b","#83b85a"]];
    const a=palettes[index%palettes.length];
    // Flat overhead canopy with stepped pixel edges and a compact trunk.
    rect(x-13,y-9,26,22,"#285b37");
    rect(x-10,y-14,20,28,a[0]);rect(x-15,y-8,30,16,a[1]);
    rect(x-9,y-17,18,7,a[1]);rect(x-6,y-20,12,4,a[2]);
    rect(x-12,y-4,7,5,a[2]);rect(x+5,y+1,7,5,a[0]);
    rect(x-2,y+8,4,7,"#79512e");
    rect(x-7,y-10,5,3,a[2]);rect(x+3,y-6,5,3,a[2]);
  }
  function drawHouse(b,index=0){
    const p=project(b.x+b.w/2,b.y+b.h/2),x=p.x,y=p.y;
    if(x<-150||y<-130||x>W+150||y>H+130)return;
    const w=Math.max(64,Math.round(b.w*.78)),h=Math.max(52,Math.round(b.h*.68)),type=b.type;
    const roofColors=type==="guild"?["#8e493d","#b9664b"]:type==="forge"?["#555b62","#7a7770"]:type==="inn"?["#9b493c","#c46c4b"]:type==="market"?["#bd6746","#d98b50"]:type==="farm"?["#8b6c3c","#b28b4b"]:type==="bank"?["#69777a","#9ba39a"]:["#8e493e","#b75f48"];
    const roof=roofColors[0],light=roofColors[1];
    // Soft shadow and visible timber foundation.
    rect(x-w/2-5,y-h/2+8,w+10,h+10,"#477343");
    rect(x-w/2,y-h/2,w,h,"#9c754c");
    rect(x-w/2+5,y-h/2+5,w-10,h-10,type==="forge"?"#8c8170":"#e2bd82");
    // Broad tiled roof, drawn as a flat top-down footprint.
    rect(x-w/2+1,y-h/2+1,w-2,h-2,roof);
    for(let yy=y-h/2+5;yy<y+h/2-3;yy+=10){
      rect(x-w/2+4,yy,w-8,2,light);
      for(let xx=x-w/2+7;xx<x+w/2-5;xx+=16)rect(xx,yy+3,9,2,index%2?"#6f3d37":"#a95b45");
    }
    // Roof ridge and eaves make the structure readable at small GBA-like scale.
    rect(x-2,y-h/2+4,4,h-8,"#e0a765");
    rect(x-w/2+3,y-h/2+3,3,h-6,"#633d34");
    rect(x+w/2-6,y-h/2+3,3,h-6,"#633d34");
    // Small front-facing doorway and two bright windows.
    rect(x-9,y+h/2-13,18,13,"#50372b");rect(x-6,y+h/2-11,12,10,"#b77b4b");
    rect(x-w/2+9,y+h/2-23,10,8,"#73b8c6");rect(x+w/2-19,y+h/2-23,10,8,"#73b8c6");
    rect(x-w/2+10,y+h/2-24,8,2,"#e5d19a");rect(x+w/2-18,y+h/2-24,8,2,"#e5d19a");
    // Distinct silhouettes for important facilities.
    if(type==="forge"){rect(x+w/2-17,y-h/2+5,12,12,"#5a4b43");rect(x+w/2-14,y-h/2+7,6,8,"#e5a34c");}
    if(type==="inn"){rect(x-9,y-h/2+5,18,6,"#f0d58a");}
    if(type==="market"){rect(x-w/2+3,y-h/2+4,w-6,9,"#e7d08e");}
    if(type==="farm"){rect(x-w/2+5,y-h/2+5,12,10,"#789b4e");}
    if(b.name!=="住民の家"){
      ctx.save();ctx.font="bold 11px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.lineJoin="round";
      ctx.lineWidth=3;ctx.strokeStyle="#34402e";ctx.strokeText(b.name,x,y-h/2-5);
      ctx.fillStyle="#fff7d7";ctx.fillText(b.name,x,y-h/2-5);ctx.restore();
    }
  }

  const spriteCache=new Map();
  const pixelSpriteCache=new Map();
  // Generated player sprite, cropped from the approved white-background artwork.
  const playerGbaSprite=new Image();
  fetch("/assets/player-gba.b64").then(r=>r.text()).then(data=>{
    playerGbaSprite.src="data:image/png;base64,"+data.trim();
  }).catch(()=>{});
  // Compact original overhead sprites for NPCs; player uses the generated GBA sprite.
  function drawPixelPerson(p,isPlayer=false){
    const q=project(p.x,p.y);
    if(isPlayer&&playerGbaSprite.complete&&playerGbaSprite.naturalWidth){
      ctx.save();ctx.imageSmoothingEnabled=false;
      const bob=p.moving&&Math.floor((p.walkClock||0)*9)%2===1?-1:0;
      ctx.drawImage(playerGbaSprite,Math.round(q.x-20),Math.round(q.y-45+bob),40,48);
      ctx.restore();
      return;
    }
    const x=q.x-16,y=q.y-27;
    if(x<-50||y<-60||x>W+50||y>H+50)return;
    const moving=!!p.moving,phase=moving?Math.floor((p.walkClock||0)*9)%4:0;
    const key=[p.id,p.color,p.hair,p.skin,p.eyes,p.style,p.accessory,phase].join(":");
    let sprite=pixelSpriteCache.get(key);
    if(!sprite){
      const c=document.createElement("canvas");c.width=24;c.height=32;
      const g=c.getContext("2d"),put=(xx,yy,w,h,col)=>{g.fillStyle=col;g.fillRect(xx,yy,w,h);};
      const hairMap={"栗色":"#794b32","金髪":"#e7bd55","黒髪":"#30272b","銀髪":"#b7c1c9","茶色":"#8a5938","赤髪":"#b64d38","青髪":"#426eaa","緑髪":"#52784a"};
      const skinMap={"明るい肌":"#f0c49a","普通の肌":"#dba77e","褐色肌":"#b97850","色白":"#f4d8bd"};
      const hair=hairMap[p.hair]||"#754a34",skin=skinMap[p.skin]||"#f0c49a",cloth=p.color||"#527caa",dark="#344b58";
      const leg=phase===1?1:phase===3?-1:0;
      put(5,25,5,4,"#49352b");put(14,25,5,4,"#49352b");
      put(6+leg,24,4,3,"#d8bd8b");put(14-leg,24,4,3,"#d8bd8b");
      put(6,16,12,9,cloth);put(4,17,4,7,dark);put(16,17,4,7,dark);
      put(4,22,3,3,skin);put(17,22,3,3,skin);put(8,16,8,2,"#e7d4a4");
      put(10,19,4,4,"#d7c18d");put(9,14,6,4,skin);
      put(6,5,12,10,hair);put(5,8,2,7,hair);put(17,8,2,7,hair);
      put(7,7,10,9,skin);put(8,10,2,2,"#fff4d9");put(14,10,2,2,"#fff4d9");
      put(9,10,1,2,p.eyes==="緑"?"#477a4d":p.eyes==="茶"?"#805238":"#426b9a");
      put(15,10,1,2,p.eyes==="緑"?"#477a4d":p.eyes==="茶"?"#805238":"#426b9a");put(11,13,2,1,"#a94e50");
      if(p.role==="衛兵"){put(5,4,14,3,"#5e8052");put(8,2,8,3,"#d8c69a");}
      else if(p.role==="鍛冶師"){put(5,4,14,3,"#5d5048");put(8,6,8,1,"#a68a69");}
      else put(6,4,12,3,hair);
      put(7,7,3,1,"#ffffff");put(8,17,3,1,"#ffffff");
      sprite=c;pixelSpriteCache.set(key,sprite);if(pixelSpriteCache.size>260)pixelSpriteCache.delete(pixelSpriteCache.keys().next().value);
    }
    ctx.save();ctx.imageSmoothingEnabled=false;
    const bob=moving&&phase%2===1?-1:0;
    ctx.drawImage(sprite,x,y+bob,32,40);ctx.restore();
    rect(x+8,y+37,16,3,"#42623b");
  }
  function drawPlayerName(p){
    const q=project(p.x,p.y);
    const label=(p.name||"冒険者").slice(0,12);
    ctx.save();ctx.font="11px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.lineJoin="round";ctx.lineWidth=3;ctx.strokeStyle="rgba(24,30,39,.88)";ctx.strokeText(label,q.x,q.y-78);
    ctx.fillStyle="#fff8df";ctx.fillText(label,q.x,q.y-78);ctx.restore();
  }
  function render(){
    ctx.clearRect(0,0,W,H);if(battle){drawBattle();return;}drawGround();
    const objects=[];
    for(const b of buildings)objects.push({depth:b.y+b.h,draw:()=>drawHouse(b,buildings.indexOf(b))});
    for(let i=0;i<110;i++){const x=160+Math.floor(hash(i,23)*2700),y=180+Math.floor(hash(i,31)*1950);if(Math.hypot(x-1600,y-1320)<420||(x>280&&x<620&&y>700&&y<2200))continue;objects.push({depth:y,draw:()=>drawTree(x,y,i)});}
    for(const n of npcs)objects.push({depth:n.y,draw:()=>drawPixelPerson(n)});
    for(const p of others.values())objects.push({depth:p.y,draw:()=>{drawPixelPerson(p);drawPlayerName(p)}});
    objects.push({depth:player.y,draw:()=>{drawPixelPerson(player,true);drawPlayerName(player)}});
    objects.sort((a,b)=>a.depth-b.depth).forEach(o=>o.draw());
    fieldEnemies.filter(e=>e.alive).forEach(e=>{const p=project(e.x,e.y);ellipse(p.x,p.y+5,13,5,"#25372a");ellipse(p.x,p.y-10,12,12,e.color);ellipse(p.x-4,p.y-13,2,3,"#20252b");ellipse(p.x+4,p.y-13,2,3,"#20252b");ctx.fillStyle="#fff";ctx.font="11px 'Noto Sans JP',sans-serif";ctx.textAlign="center";});
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
    const wasMoving=!!player.moving;
    player.moving=false;
    let dx=0,dy=0;if(keys.has("w")||keys.has("arrowup"))dy--;if(keys.has("s")||keys.has("arrowdown"))dy++;if(keys.has("a")||keys.has("arrowleft"))dx--;if(keys.has("d")||keys.has("arrowright"))dx++;
    if(dx||dy){player.moving=true;player.walkClock=(player.walkClock||0)+dt;const len=Math.hypot(dx,dy);dx/=len;dy/=len;const nx=player.x+dx*player.speed*dt,ny=player.y+dy*player.speed*dt;if(!blocked(nx,player.y))player.x=nx;if(!blocked(player.x,ny))player.y=ny;player.dir=dx<-.3?(dy<-.3?"up-left":dy>.3?"down-left":"left"):dx>.3?(dy<-.3?"up-right":dy>.3?"down-right":"right"):dy<0?"up":"down";}
    if(realtimeChannel&&(player.moving||wasMoving))publishPlayerState(!player.moving);
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