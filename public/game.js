"use strict";
(() => {
  const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");
  const W=960,H=600; canvas.width=W;canvas.height=H;ctx.imageSmoothingEnabled=false;
  const worldTileset=new Image();worldTileset.src="/assets/world-sercher-user-atlas.png";window.WS_WORLD_TILESET=worldTileset;
  // 新しいGBA風タイルセット（建物・芝生・道）
  const townArt=new Image();
  townArt.src="/assets/world-sercher-gba-atlas.png";
  townArt.onerror=()=>console.warn("新しい街素材を読み込めませんでした。");
  let interior=null;
  // Load the approved protagonist walk sheet; field movement logic is intentionally preserved.
  const playerWalkSheet=new Image();
  window.WS_PLAYER_WALK_SHEET=playerWalkSheet;
  fetch("/assets/player-walk-12.b64",{cache:"force-cache"}).then(r=>{if(!r.ok)throw new Error("sprite sheet unavailable");return r.text();})
    .then(data=>{playerWalkSheet.src="data:image/png;base64,"+data.trim();})
    .catch(()=>{console.warn("主人公スプライトを読み込めませんでした。");});
  const $=id=>document.getElementById(id);
  const startPanel=$("start-panel"),authForm=$("auth-form"),accountName=$("account-name"),password=$("account-password"),characterName=$("character-name"),nameWrap=$("character-name-wrap"),authMessage=$("auth-message"),authSubmit=$("auth-submit"),loginTab=$("login-tab"),registerTab=$("register-tab"),notice=$("notice"),hudName=$("hud-name"),onlineCount=$("online-count"),connectionState=$("connection-state");
  const player={id:null,name:"冒険者",x:1600,y:1300,speed:155,dir:"down",species:"人間",hair:"栗色",skin:"明るい肌",eyes:"青",style:"旅人",outfit:"#4f78a5",accessory:"なし"};
  const others=new Map(),keys=new Set(),pixelSpriteCache=new Map();let started=false,authMode="login",gameData={},camera={x:0,y:0},lastMoveSent=0,lastPresenceSent=0,noticeTimer=null,lastFrame=0;
  let realtimeClient=null,realtimeChannel=null,realtimeId=null;
  const town={x:1600,y:1300};
  // リーフェルの街区を道路沿いに整理。中央広場と東西の大通りを空ける。
  const buildings=[
    ["冒険者ギルド",1260,760,250,195,"#d5b47b","guild"],
    ["武器屋",2040,760,155,125,"#bd8860","shop"],
    ["鍛冶屋",1010,1010,160,130,"#8c6b59","forge"],
    ["道具屋",2290,1010,160,130,"#c48e5e","shop"],
    ["宿屋",1010,1640,185,145,"#b77d57","inn"],
    ["酒場",1260,1880,155,125,"#98664e","inn"],
    ["市場",2040,1880,185,130,"#c19a62","market"],
    ["銀行",2290,1640,150,120,"#b5a17a","bank"],
    ["町長の家",790,1430,165,130,"#a78a71","home"],
    ["あなたの家",1360,2110,175,140,"#9a7eaa","home"],
    ["服飾店",2040,1640,150,125,"#b77b8b","shop"],
    ["農家の作業小屋",2290,2110,155,125,"#a18b57","farm"],
    ["理髪店",2290,760,140,115,"#a6a1a0","shop"],
    ["仕立て屋",2290,1880,150,120,"#a87989","shop"],
    ["訓練所",790,1010,160,125,"#8c9a72","guild"],
    ["住民の家",790,560,130,105,"#b48a62","home"],
    ["住民の家",1010,560,130,105,"#a98268","home"],
    ["住民の家",1230,560,130,105,"#b58e67","home"],
    ["住民の家",1820,560,130,105,"#a67f60","home"],
    ["住民の家",2040,560,130,105,"#b18c69","home"],
    ["住民の家",2290,560,130,105,"#a67f60","home"],
    ["住民の家",790,2110,135,105,"#b58e67","home"],
    ["住民の家",1010,2110,135,105,"#ad8967","home"],
    ["住民の家",1820,2110,135,105,"#b18c69","home"]
  ].map(([name,x,y,w,h,color,type])=>({name,x,y,w,h,color,type}));
  const npcDefs=[
    ["エミリア","受付",1460,955,"#c86d83","#8a513b"],["ガルド","鍛冶師",1330,1250,"#7c8790","#51443b"],["ミーナ","道具屋",1850,1230,"#d58d57","#6b4936"],["ノア","農家",1880,1880,"#82a65f","#78543b"],["ロイド","宿屋",2040,1430,"#b88b62","#68472f"],["アルベルト","町長",1300,1570,"#7d8caa","#75604b"],
    ["セラ","武器屋",1130,1245,"#bd6e68","#513b32"],["トーマス","銀行員",1550,1740,"#8b9b9a","#564536"],["リナ","服飾職人",1030,1570,"#c47a9b","#684638"],["バルド","衛兵",900,1190,"#758b6d","#4a392f"],["ユリウス","衛兵",2210,1370,"#758b6d","#4a392f"],["マルタ","市場商人",1780,1690,"#d2a65f","#67452f"],
    ["ピノ","農家",1920,1950,"#8aa75f","#754c37"],["カイ","釣り人",650,1500,"#7399a9","#5a4535"],["メル","花屋",900,1680,"#d58c9b","#654337"],["オスカー","大工",1160,1780,"#b8895e","#60432f"],
    ["ユナ","住民",1240,700,"#d58c9b","#604333"],["レオ","子ども",1530,720,"#d6ae72","#62432f"],["ミオ","子ども",1670,720,"#d58c9b","#62432f"],["ハンナ","住民",2260,900,"#b7a16e","#644a36"],["エド","住民",2310,1760,"#8097a1","#514136"],["フローラ","住民",1130,1900,"#b97c91","#624333"],["ジン","住民",1340,2010,"#b28b60","#513b2d"],["サラ","住民",2160,1900,"#d3a16c","#694835"],
    ["旅人アレン","旅人",720,950,"#7892b4","#4e392d"],["商人ベラ","旅商人",2380,1120,"#bd8b63","#614330"],["旅人ノル","旅人",700,1800,"#829a91","#53402e"],["行商人リック","行商人",2370,1580,"#b88c5e","#60432f"],["衛兵ロウ","衛兵",1600,600,"#718a6c","#48392e"],["衛兵ミラ","衛兵",2470,1430,"#718a6c","#48392e"],["羊飼いテオ","牧童",2030,2040,"#a58c5d","#624630"],["釣り人ネネ","釣り人",520,1580,"#7196a5","#654832"],["薬草師イリス","薬草師",850,1900,"#83a66d","#634735"],["パン屋オットー","パン職人",1700,1900,"#c38a61","#64442f"],["吟遊詩人ルカ","旅芸人",1780,780,"#a68bb8","#563d32"],["見習い冒険者","冒険者",1450,760,"#6e9ca9","#503c32"]
  ];
  const npcDirections=["down","left","up","right","down","right","up","left"];
  const npcHair=["黒髪","金髪","栗色","銀髪","赤髪","茶色","青髪","緑髪"];
  const npcStyles=["短髪","長髪","ポニーテール","旅人","短髪","長髪","ポニーテール","旅人"];
  const npcSkin=["明るい肌","普通の肌","色白","褐色肌"];
  const npcEyes=["青","緑","茶","紫"];
  const npcAccessories=["なし","帽子","マント","眼鏡","スカーフ","エプロン","なし","帽子"];
  const npcs=npcDefs.map((n,i)=>({id:i,isNpc:true,name:n[0],role:n[1],x:n[2],y:n[3],color:n[4],hair:npcHair[i%npcHair.length],skin:npcSkin[i%npcSkin.length],eyes:npcEyes[i%npcEyes.length],style:npcStyles[i%npcStyles.length],accessory:npcAccessories[i%npcAccessories.length],dir:npcDirections[i%npcDirections.length],phase:(i%5)*.7}));
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
  let encounterTimer=0,encounterNext=12+Math.random()*12;
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
    battle={enemies:group,playerX:120,playerY:0,vy:0,hp:100,maxHp:100,mp:30,maxMp:30,attackCooldown:0,enemyCooldown:1.1,defending:false,herbs:1,finished:false};keys.clear();
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
      window.dispatchEvent(new CustomEvent("world:combat-ended",{detail:{result:"win",boss}}));
    } else if(result==="escape"){
      window.dispatchEvent(new CustomEvent("world:combat-ended",{detail:{result:"escape"}}));
      saveCurrent();
    }
    setTimeout(()=>{
      if(!battle)return;
      battle=null;
      $("battle-controls").classList.add("hidden");
      $("mobile-controls").classList.remove("battle-hidden");
      if(result==="win")say("勝利！ 戦闘記録を保存しました。");
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
  function drawInterior(){
    const b=interior?.building;if(!b)return;
    rect(0,0,W,H,"#3d4e43");
    rect(28,24,904,552,"#594437");rect(36,32,888,536,"#d4b77d");
    // warm, flat GBA-style wooden floor with crisp plank seams
    for(let y=52;y<548;y+=32){rect(48,y,864,28,(Math.floor(y/32)%2)?"#bd925b":"#c9a16a");rect(48,y+27,864,3,"#8e6848");for(let x=80+(Math.floor(y/32)%2)*24;x<900;x+=120)rect(x,y,2,27,"#a77d50");}
    rect(48,48,864,18,"#76543c");rect(48,48,864,5,"#e1c58d");
    // windows and door
    rect(110,76,100,92,"#73503a");rect(118,84,84,76,"#6fa8ae");rect(158,84,4,76,"#e6d3a4");rect(118,120,84,4,"#e6d3a4");
    rect(750,76,100,92,"#73503a");rect(758,84,84,76,"#6fa8ae");rect(798,84,4,76,"#e6d3a4");rect(758,120,84,4,"#e6d3a4");
    // facility-specific furniture, all drawn in the same pixel palette
    rect(300,110,360,44,"#755039");rect(306,116,348,32,"#d5bd8c");
    rect(330,210,300,72,"#694733");rect(338,218,284,56,"#b78550");
    rect(350,218,260,12,"#e1bc78");
    if(b.type==="inn"){rect(180,340,150,90,"#75513a");rect(188,348,134,74,"#e7d4a2");rect(690,340,150,90,"#75513a");rect(698,348,134,74,"#e7d4a2");}
    else if(b.type==="forge"){rect(680,320,150,150,"#57483c");rect(696,336,118,118,"#a95d3c");rect(716,356,78,78,"#ef9a48");}
    else if(b.type==="market"||b.type==="shop"){for(let i=0;i<4;i++){rect(110+i*190,360,130,74,"#75513a");rect(118+i*190,368,114,58,"#d5bd8c");}}
    else {rect(160,360,640,66,"#76533a");rect(170,370,620,48,"#d0a66c");}
    rect(410,500,140,48,"#765039");rect(418,508,124,40,"#8b5738");
    ctx.fillStyle="#fff1c9";ctx.font="bold 20px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.fillText(b.name,480,70);
    ctx.font="13px 'Noto Sans JP',sans-serif";ctx.fillText("Eキー / 操作ボタン：外へ出る",480,565);
    camera.x=480;camera.y=320;drawPixelPerson(player,true);
  }
  function drawBattle(){
    // Side-view battle scene redrawn in the same crisp pixel palette as the field.
    rect(0,0,W,H,"#8bc4c0");
    for(let i=0;i<10;i++){const x=i*112;rect(x,70+(i%3)*12,82,3,"#c8e6d4");rect(x+20,95+(i%2)*9,46,2,"#d9eddb");}
    rect(0,270,W,168,"#6b9b58");rect(0,438,W,162,"#a7a06c");
    for(let i=0;i<16;i++){const x=i*66;rect(x,405+(i%3)*7,4,24,"#477c49");rect(x+6,412+(i%2)*6,3,17,"#67944d");}
    rect(0,435,W,7,"#d0bd83");rect(0,443,W,4,"#7b744f");
    // HUD frame.
    rect(16,14,250,148,"#493f35");rect(20,18,242,140,"#f0e4c0");rect(24,22,234,132,"#496b60");
    ctx.fillStyle="#fff5d8";ctx.font="bold 17px 'Noto Sans JP',sans-serif";ctx.textAlign="left";ctx.fillText("冒険者",36,48);
    ctx.font="14px 'Noto Sans JP',sans-serif";ctx.fillText("HP  "+battle.hp+" / "+battle.maxHp,36,76);ctx.fillText("MP  "+battle.mp+" / "+battle.maxMp,36,101);
    rect(36,84,194,7,"#293e3b");rect(36,84,194*battle.hp/battle.maxHp,7,"#e66f66");
    rect(36,109,194,6,"#293e3b");rect(36,109,194*battle.mp/battle.maxMp,6,"#68b8e2");
    // Preserve the protagonist's exact walk sprite in battle too.
    const px=battle.playerX,py=438-battle.playerY;
    ellipse(px,py+8,23,8,"#58634c");
    if(playerWalkSheet.complete&&playerWalkSheet.naturalWidth){
      const row=0,frame=1;ctx.save();ctx.imageSmoothingEnabled=false;
      ctx.drawImage(playerWalkSheet,frame*64,row*64,64,64,Math.round(px-34),Math.round(py-76),68,68);ctx.restore();
    }
    battle.enemies.forEach((e,i)=>{
      if(e.hp<=0)return;
      const ex=650+(i%3)*92,ey=422-Math.floor(i/3)*70;
      ellipse(ex,ey+8,e.boss?47:28,e.boss?15:9,"#59654d");
      const monster=document.createElement("canvas");monster.width=48;monster.height=48;
      const m=monster.getContext("2d");m.imageSmoothingEnabled=false;
      const put=(x,y,w,h,color)=>{m.fillStyle=color;m.fillRect(x,y,w,h);};
      if(e.name.includes("スライム")){put(10,19,28,20,e.color);put(15,13,18,10,e.color);put(14,19,5,7,"#c6eeee");put(29,19,5,7,"#c6eeee");put(16,20,2,4,"#344b57");put(30,20,2,4,"#344b57");put(22,31,5,3,"#5d8991");}
      else if(e.name.includes("ウルフ")){put(8,18,31,18,e.color);put(11,9,12,13,e.color);put(28,8,11,14,e.color);put(15,20,4,4,"#f1d58c");put(30,20,4,4,"#f1d58c");put(19,31,13,5,"#594a43");}
      else {put(9,14,30,25,e.color);put(12,7,8,12,"#52744b");put(28,7,8,12,"#52744b");put(15,19,5,5,"#f4e4a7");put(29,19,5,5,"#f4e4a7");put(18,31,13,4,"#42503c");}
      if(e.boss){put(4,4,40,10,"#8c5140");put(2,1,8,13,"#e0bc79");put(38,1,8,13,"#e0bc79");}
      ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(monster,ex-32,ey-65,64,64);ctx.restore();
      ctx.fillStyle="#fff5d8";ctx.font="bold 13px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.lineWidth=3;ctx.strokeStyle="#493d34";ctx.strokeText(e.name,ex,ey-76);ctx.fillText(e.name,ex,ey-76);
      rect(ex-34,ey-69,68,6,"#3c4641");rect(ex-34,ey-69,68*e.hp/e.maxHp,6,"#e56f65");
    });
    if(battle.defending){ctx.fillStyle="#fff4cf";ctx.font="bold 14px sans-serif";ctx.textAlign="center";ctx.fillText("防御中",px,py-84);}
    if(battleMessageUntil>performance.now()){rect(210,195,540,52,"#493f35");rect(214,199,532,44,"#f0e4c0");ctx.fillStyle="#493f35";ctx.font="bold 20px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.fillText(battleMessage,W/2,228);}
    ctx.fillStyle="#fff5d8";ctx.font="bold 13px 'Noto Sans JP',sans-serif";ctx.textAlign="right";ctx.fillText("右端まで進むと逃走",W-24,30);
  }

  function say(t){notice.textContent=t;notice.classList.add("show");clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.classList.remove("show"),2600)}
  async function responseJson(response){const raw=await response.text();try{return JSON.parse(raw)}catch(_){return{error:"サーバーから正しい応答を受け取れませんでした。Vercelの設定を確認してね。"}}}
  function setAuthMode(mode){authMode=mode;const reg=mode==="register";loginTab.classList.toggle("active",!reg);registerTab.classList.toggle("active",reg);nameWrap.classList.toggle("hidden",!reg);password.autocomplete=reg?"new-password":"current-password";password.minLength=reg?10:1;authSubmit.textContent=reg?"アカウントを作成 ✦":"ログイン ▶";authMessage.textContent=reg?"ユーザーIDと10文字以上のパスワードを設定してね。":"登録済みのユーザーIDとパスワードを入力してね。"}
  loginTab.addEventListener("click",()=>setAuthMode("login"));registerTab.addEventListener("click",()=>setAuthMode("register"));
  async function readGameData(){try{const r=await fetch("/api/game-data",{credentials:"same-origin"});if(r.ok){const j=await r.json();gameData=j.gameData||{};applySavedAdminSettings();}}catch(e){gameData={}}}
  function applySavedAdminSettings(){
    // Bump layout version once so old scattered coordinates do not override the new town plan.
    if(gameData.buildingLayoutVersion!==2){gameData.buildingPositions={};gameData.buildingSizes={};gameData.buildingLayoutVersion=2;saveGameData();}
    const positions=gameData.buildingPositions||{},sizes=gameData.buildingSizes||{};
    buildings.forEach((b,i)=>{const key=b.name+"@"+i,p=positions[key],s=sizes[key];
      if(p){if(Number.isFinite(Number(p.x)))b.x=Number(p.x);if(Number.isFinite(Number(p.y)))b.y=Number(p.y);}
      if(s){if(Number.isFinite(Number(s.w)))b.w=Math.max(80,Math.min(420,Number(s.w)));if(Number.isFinite(Number(s.h)))b.h=Math.max(70,Math.min(320,Number(s.h)));}
    });
  }
  async function saveGameData(){try{const r=await fetch("/api/game-data",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({gameData})});return r.ok}catch(e){return false}}
  function openCreation(){const panel=$("creation-panel");if(panel)panel.classList.remove("hidden")}
  function closeCreation(){const panel=$("creation-panel");if(panel)panel.classList.add("hidden")}
  function initCreation(){
    const form=$("creation-form");if(!form)return;
    form.addEventListener("submit",async e=>{e.preventDefault();player.name=($("create-name").value.trim()||"冒険者").slice(0,12);player.species=$("create-species").value;player.hair=$("create-hair").value;player.skin=$("create-skin").value;player.eyes=$("create-eyes").value;player.style=$("create-style").value;player.outfit=$("create-color").value;player.accessory=$("create-accessory").value;
      gameData.characterCreated=true;gameData.species=player.species;gameData.appearance={hair:player.hair,skin:player.skin,eyes:player.eyes,style:player.style,color:player.outfit,accessory:player.accessory};gameData.customAppearance=false;await saveGameData();await saveCurrent();hudName.textContent=player.name;closeCreation();startPanel.classList.add("hidden");connectRealtime();say("ようこそ、リーフェルへ！");});
  }
  async function enterWorld(profile){player.name=profile.name||"冒険者";player.x=Number(profile.x)||1600;player.y=Number(profile.y)||1300;hudName.textContent=player.name;started=true;await readGameData();if(!gameData.characterCreated){$("create-name").value=player.name;openCreation()}else{const a=gameData.appearance||{};player.species=gameData.species||"人間";player.hair=a.hair||"栗色";player.skin=a.skin||"明るい肌";player.eyes=a.eyes||"青";player.style=a.style||"旅人";player.outfit=a.color||"#4f78a5";player.accessory=a.accessory||"なし";player.customAppearance=!!gameData.customAppearance;startPanel.classList.add("hidden");connectRealtime();}window.dispatchEvent(new Event("world:entered"));}
  initCreation();
  authForm.addEventListener("submit",async e=>{e.preventDefault();authSubmit.disabled=true;authMessage.textContent="確認しています...";const payload={username:accountName.value.trim(),password:password.value,characterName:characterName.value.trim()||accountName.value.trim()};try{const r=await fetch(authMode==="register"?"/api/register":"/api/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(payload)});const j=await responseJson(r);if(!r.ok)throw new Error(j.error||"処理に失敗しました");password.value="";await enterWorld(j.profile)}catch(err){authMessage.textContent=err.message||"通信に失敗しました"}finally{authSubmit.disabled=false}});
  async function saveCurrent(){if(!started)return;try{await fetch("/api/save",{method:"POST",keepalive:true,credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:player.name,x:interior?interior.outside.x:player.x,y:interior?interior.outside.y:player.y})})}catch(e){}}
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
      realtimeChannel.on("system",{event:"*"},message=>{if(message?.status==="error"){console.error("Realtime system error:",message);connectionState.textContent="オンライン接続エラー";say("通信サーバー: "+String(message.message||"接続エラー").slice(0,100));}});
      realtimeChannel.on("broadcast",{event:"player-move"},({payload})=>{
        if(!payload||payload.id===realtimeId||!Number.isFinite(Number(payload.x))||!Number.isFinite(Number(payload.y)))return;
        others.set(payload.id,{...payload,_broadcastAt:Date.now()});updateOnline();
      });
      realtimeChannel.subscribe(async (status,error)=>{
        if(status==="SUBSCRIBED"){
          connectionState.textContent="オンライン接続済み";
          await realtimeChannel.track(currentPlayerState());
          refreshPresence();
          say("リーフェルのオンラインワールドに接続しました！");
        }else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED"){
          const detail=error?.message||error?.reason||error?.toString?.()||"詳細なし";
          connectionState.textContent="オンライン接続エラー ("+status+")";
          console.error("Realtime channel status:",status,error);
          say("オンライン通信が切断されました: "+status+" / "+String(detail).slice(0,100));
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
  }
  function updateOnline(){onlineCount.textContent="村にいる冒険者 "+(others.size+(started?1:0))+"人"}
  function blocked(x,y){if(interior)return x<92||y<92||x>868||y>508;if(x<70||y<70||x>worldW-70||y>worldH-70)return true;if(Math.hypot(x-(water.x+water.w/2),y-(water.y+water.h/2))<220)return true;return buildings.some(b=>x+12>b.x&&x-12<b.x+b.w&&y+8>b.y+32&&y-8<b.y+b.h)}
  const worldW=3000,worldH=2300;
  window.addEventListener("keydown",e=>{
    if(e.ctrlKey&&e.shiftKey&&(e.code==="Digit5"||e.key==="%")){e.preventDefault();e.stopPropagation();keys.clear();if(started)openAdminGate();return;}
    const k=e.key.toLowerCase();
    if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k))e.preventDefault();
    if($("admin-gate")&&!$("admin-gate").classList.contains("hidden")&&e.key==="Escape"){closeAdminGate();return;}
    keys.add(k);if(k==="e"&&started&&!battle){if(interior)leaveBuilding();else interact();}
    if(k==="z"&&battle)battleAttack();if(k==="1"&&battle)battleMagic();if(k==="2"&&battle)battleItem();
  });window.addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));window.addEventListener("blur",()=>keys.clear());
  const keyMap={up:"arrowup",down:"arrowdown",left:"arrowleft",right:"arrowright"};document.querySelectorAll("[data-dir]").forEach(b=>{const k=keyMap[b.dataset.dir];b.addEventListener("pointerdown",e=>{e.preventDefault();keys.add(k)});["pointerup","pointercancel","pointerleave"].forEach(t=>b.addEventListener(t,()=>keys.delete(k)))});
  $("interact-button").addEventListener("click",()=>{if(interior)leaveBuilding();else interact()});
  function enterBuilding(b){
    interior={building:b,outside:{x:player.x,y:player.y}};
    player.x=480;player.y=320;player.moving=false;camera.x=480;camera.y=320;keys.clear();
    window.dispatchEvent(new CustomEvent("world:building-enter",{detail:{name:b.name,type:b.type}}));
    window.dispatchEvent(new CustomEvent("world:interact",{detail:{name:b.name,role:"施設"}}));
    say(b.name+"に入った。Eキーで外へ出られるよ。");
  }
  function leaveBuilding(){
    if(!interior)return;
    const previous=interior.outside;interior=null;player.x=previous.x;player.y=previous.y+24;player.moving=false;camera.x=player.x;camera.y=player.y;keys.clear();
    window.dispatchEvent(new Event("world:building-exit"));say("建物の外へ出た。");
  }
  function interact(){
    if(interior){leaveBuilding();return;}
    let best=105,target=null,isBuilding=false;
    for(const b of buildings){const d=Math.hypot(player.x-(b.x+b.w/2),player.y-(b.y+b.h+20));if(d<best){best=d;target=b;isBuilding=true;}}
    for(const n of npcs){const d=Math.hypot(player.x-n.x,player.y-n.y);if(d<best){best=d;target=n;isBuilding=false;}}
    if(target?.name){if(isBuilding){enterBuilding(target);return;}window.dispatchEvent(new CustomEvent("world:interact",{detail:{name:target.name,role:target.role||""}}));say(target.name+"「こんにちは！ "+(target.role||"村の住民")+"をしているよ。」");}
    else say("建物の入口か村人の近くで操作してね。");
  }
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
    // Rebuilt original GBA-era pixel landscape. Player sprite and movement code remain untouched.
    rect(0,0,W,H,"#6da84e");
    const gx0=Math.floor((camera.x-W/2-16)/16)*16,gx1=camera.x+W/2+16;
    const gy0=Math.floor((camera.y-H/2-16)/16)*16,gy1=camera.y+H/2+16;
    for(let wy=gy0;wy<=gy1;wy+=16)for(let wx=gx0;wx<=gx1;wx+=16){
      const p=project(wx,wy),v=hash(wx/16,wy/16);
      const base=v>.82?"#78b45a":v>.53?"#70aa50":v>.2?"#689f49":"#609344";
      rect(p.x-8,p.y-8,16,16,base);
      // Hand-authored pixel clusters: quiet grass variation, not noisy random speckles.
      const pattern=Math.floor(hash(wx/16+17,wy/16+9)*4);
      if(pattern===0){rect(p.x-6,p.y-4,3,2,"#82bd60");rect(p.x+2,p.y+3,2,2,"#4f843e");}
      else if(pattern===1){rect(p.x-4,p.y+2,4,2,"#83b95a");rect(p.x+3,p.y-5,2,3,"#568b40");}
      else if(pattern===2){rect(p.x-6,p.y-2,2,3,"#4f843e");rect(p.x+1,p.y+4,4,2,"#83bd61");}
      else{rect(p.x-3,p.y-5,3,2,"#86c365");rect(p.x+4,p.y+1,2,3,"#54883e");}
      if(v>.94){rect(p.x-1,p.y-1,2,2,"#e7d58c");}
    }
    // River with sandbanks, bright ripples and a gently winding course.
    for(let wy=560;wy<2250;wy+=16){
      const bend=390+Math.sin(wy/155)*65;
      for(let wx=bend-72;wx<=bend+72;wx+=16){
        const p=project(wx,wy),v=hash(wx/16,wy/16);
        rect(p.x-8,p.y-8,16,16,v>.5?"#4a9fbd":"#398caf");
        if(v>.28){rect(p.x-5,p.y-4,6,2,"#a4e0dc");rect(p.x+2,p.y+3,4,1,"#75c7d1");}
      }
      for(const wx of [bend-88,bend+88]){const p=project(wx,wy);rect(p.x-8,p.y-8,16,16,"#c3ad70");rect(p.x-6,p.y-5,9,2,"#dfc987");rect(p.x+2,p.y+3,3,2,"#a28b59");}
    }
    const road=(x1,y1,x2,y2,width)=>{
      const n=Math.ceil(Math.hypot(x2-x1,y2-y1)/8);
      for(let i=0;i<=n;i++){const t=i/n,cx=x1+(x2-x1)*t,cy=y1+(y2-y1)*t;
        for(let o=-width/2;o<=width/2;o+=16){const p=project(cx+(x2===x1?o:0),cy+(y2===y1?o:0)),v=hash(Math.floor(cx/16)+o,Math.floor(cy/16));
          rect(p.x-8,p.y-8,16,16,v>.5?"#cfb782":"#c4aa76");
          // Soft stepped edges and small packed-earth flecks.
          rect(p.x-8,p.y-8,16,2,"#ddc995");rect(p.x-8,p.y+6,16,2,"#a58c5e");
          rect(p.x-7,p.y-6,14,1,"#e6d3a1");
          const grain=Math.floor(hash(Math.floor(cx/16)+o+41,Math.floor(cy/16)+7)*5);
          if(grain===0){rect(p.x-4,p.y-2,3,2,"#b39a69");rect(p.x+3,p.y+3,2,2,"#dfc894");}
          else if(grain===1){rect(p.x+1,p.y-4,3,2,"#b49a68");rect(p.x-5,p.y+3,2,2,"#e0ca94");}
          else if(grain===2){rect(p.x-1,p.y+1,2,2,"#a98f60");}
          if(v>.92){rect(p.x-2,p.y-2,3,3,"#9c8a68");}
        }
      }
    };
    road(1600,500,1600,2300,112);road(650,1320,2600,1320,112);
    road(1600,1320,1100,900,48);road(1600,1320,2050,900,48);road(1600,1320,2050,1800,48);
    // Central stone plaza, bordered by darker cut-stone tiles.
    for(let wy=1144;wy<1496;wy+=16)for(let wx=1424;wx<1776;wx+=16){
      const p=project(wx,wy),v=hash(wx/16,wy/16);
      rect(p.x-8,p.y-8,16,16,v>.52?"#dfd0a8":"#d2c29a");
      rect(p.x-7,p.y-7,14,1,"#f0e3c1");rect(p.x-8,p.y+7,16,1,"#a99570");
      if(v>.88){rect(p.x-2,p.y-2,4,4,"#b7a77e");}
    }
    // Market square paving.
    for(let wy=2048;wy<2240;wy+=16)for(let wx=1840;wx<2160;wx+=16){const p=project(wx,wy);rect(p.x-8,p.y-8,16,16,"#b9905c");rect(p.x-7,p.y-7,14,2,"#d6b47a");rect(p.x-7,p.y+6,14,2,"#89683f");}
    drawBridge(390,930);drawBridge(430,1260);drawBridge(480,1680);drawBridge(510,1940);
    drawFountain(1600,1320);
  }

  // Town details make the streets feel lived-in without blocking player movement.
  const townDecor=[
    ["lamp",1180,1120],["lamp",2020,1120],["lamp",1180,1540],["lamp",2020,1540],
    ["bench",1390,1150],["bench",1810,1510],["bench",1450,1780],
    ["flower",1160,980],["flower",1910,980],["flower",1210,1830],["flower",2200,1780],["flower",1740,1090],["flower",1760,1570],
    ["barrel",930,1170],["barrel",2230,1170],["barrel",1940,1850],["barrel",2220,2020],
    ["sign",1480,900],["sign",1700,1760],["sign",880,1510],
    ["crate",1080,1190],["crate",2170,1190],["crate",1900,2010],["crate",2110,2010],
    ["stall",1950,1990],["stall",2160,1990],
    ["flower",920,1780],["flower",1060,1870],["flower",2320,1680],["flower",2350,930]
  ];
  function drawTownDecor(item){
    const [type,wx,wy]=item,p=project(wx,wy),x=p.x,y=p.y;
    if(x<-60||y<-70||x>W+60||y>H+60)return;
    ellipse(x,y+7,15,5,"#557d42");
    if(type==="lamp"){
      rect(x-3,y-30,6,35,"#65482f");rect(x-8,y-36,16,12,"#4b4438");rect(x-6,y-34,12,8,"#f0d48a");rect(x-2,y-31,4,3,"#fff0b8");rect(x-10,y-38,20,3,"#8e7147");
    }else if(type==="bench"){
      rect(x-19,y-9,38,7,"#765035");rect(x-17,y-2,34,5,"#b9854c");rect(x-15,y+3,4,8,"#65452f");rect(x+11,y+3,4,8,"#65452f");rect(x-20,y-12,40,3,"#d5ae70");
    }else if(type==="flower"){
      rect(x-2,y-1,4,8,"#477a3e");rect(x-8,y-7,5,5,"#f1c3d2");rect(x-3,y-10,5,5,"#f5e7a4");rect(x+3,y-7,5,5,"#e97863");rect(x-2,y-5,5,5,"#f5e9ca");rect(x+7,y+1,3,3,"#6b9d4b");
    }else if(type==="barrel"){
      rect(x-9,y-12,18,20,"#8b5b36");rect(x-7,y-10,14,16,"#b77c45");rect(x-10,y-8,20,3,"#61452f");rect(x-10,y+2,20,3,"#61452f");rect(x-3,y-9,2,14,"#d3a16a");
    }else if(type==="sign"){
      rect(x-2,y-22,4,28,"#755033");rect(x-13,y-22,26,13,"#77553b");rect(x-10,y-19,20,7,"#e3cf9e");rect(x-7,y-17,14,2,"#a26c43");
    }else if(type==="crate"){
      rect(x-11,y-11,22,18,"#8b5b36");rect(x-8,y-8,16,12,"#c08a4d");rect(x-8,y-8,3,12,"#765034");rect(x+5,y-8,3,12,"#765034");rect(x-8,y-2,16,2,"#765034");
    }else if(type==="stall"){
      rect(x-22,y-1,44,9,"#765137");rect(x-19,y-15,4,16,"#755035");rect(x+15,y-15,4,16,"#755035");rect(x-23,y-18,46,8,"#d6ad62");for(let k=-2;k<=2;k++)rect(x+k*9-3,y-18,6,8,k%2?"#f0e5c8":"#b85d4b");rect(x-18,y+1,36,5,"#b9854d");
    }
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
    const tp=project(wx,wy);
    const p=project(wx,wy),x=p.x,y=p.y;if(x<-70||y<-90||x>W+70||y>H+70)return;
    const palettes=[["#285b38","#397b43","#63a34c","#9bc75b"],["#24583f","#347b4d","#5b9b50","#a0c969"],["#365f34","#4c8740","#78ad4e","#b2ce67"],["#28584b","#367c60","#5d9f67","#a2c979"]];
    const a=palettes[index%palettes.length];
    ellipse(x,y+8,18,7,"#527d43");
    rect(x-4,y-2,8,18,"#76502f");rect(x-2,y+1,4,12,"#a16e3e");
    rect(x-15,y-17,30,24,a[0]);rect(x-20,y-11,40,17,a[1]);
    rect(x-15,y-25,30,17,a[1]);rect(x-10,y-31,20,12,a[2]);
    rect(x-6,y-35,12,6,a[3]);rect(x-17,y-18,9,8,a[2]);rect(x+7,y-13,9,8,a[0]);
    rect(x-12,y-8,6,4,a[3]);rect(x+5,y-23,5,4,a[3]);rect(x+11,y-5,4,4,a[2]);
  }

  function drawHouse(b,index=0){
    const p=project(b.x+b.w/2,b.y+b.h/2),x=p.x,y=p.y;
    if(x<-190||y<-190||x>W+190||y>H+190)return;
    const w=Math.max(72,Math.round(b.w*.82)),h=Math.max(62,Math.round(b.h*.72)),type=b.type;
    const palettes={
      guild:["#526b86","#7896ad","#dfc99a","#8e493b"],
      forge:["#55545a","#77716b","#b8a080","#a34f36"],
      inn:["#8d493f","#bb7050","#e5c995","#6d4937"],
      market:["#a45a42","#d18a4d","#edd29b","#6d4937"],
      farm:["#7b633c","#a98a50","#e0c28a","#6d4937"],
      bank:["#536c72","#819796","#d8cba7","#8b704b"],
      home:["#865044","#b86e53","#e7c995","#70503a"],
      shop:["#87505a","#bd7d69","#e8c99b","#70503a"]
    };
    const a=palettes[type]||palettes.home;
    // Ground shadow, raised stone foundation and visible side wall.
    ellipse(x,y+h*.39,w*.62,9,"#4e7742");
    poly([{x:x-w*.49,y:y-h*.08},{x:x+w*.39,y:y-h*.08},{x:x+w*.49,y:y+h*.30},{x:x-w*.39,y:y+h*.30}], "#75604a","#493c32",2);
    poly([{x:x+w*.34,y:y-h*.10},{x:x+w*.49,y:y-h*.22},{x:x+w*.49,y:y+h*.24},{x:x+w*.34,y:y+h*.34}], "#9a7956","#594333",2);
    rect(x-w*.42,y-h*.05,w*.76,h*.37,a[2]);
    rect(x-w*.39,y-h*.01,w*.70,3,"#f1dfb8");
    // Timber framing, stone courses and front facade details.
    rect(x-w*.42,y+h*.20,w*.76,5,"#76513a");
    for(let i=0;i<5;i++)rect(x-w*.38+i*w*.17,y+h*.23,Math.max(2,w*.025),h*.10,"#b18b62");
    rect(x-w*.10,y+h*.02,w*.20,h*.29,"#513a2d");
    rect(x-w*.075,y+h*.04,w*.15,h*.25,"#a66d43");
    rect(x+w*.035,y+h*.15,3,3,"#f2d28a");
    // Windows with wooden frames and crossbars.
    for(const wx of [x-w*.30,x+w*.15]){
      rect(wx-9,y+h*.015,19,22,"#604333");rect(wx-6,y+h*.045,13,16,"#5c94a0");
      rect(wx-1,y+h*.045,2,16,"#e4d1a5");rect(wx-6,y+h*.11,13,2,"#e4d1a5");
      rect(wx-8,y+h*.005,17,3,"#d5b77f");
    }
    // Large pitched tiled roof with layered eaves and visible tile rows.
    poly([{x:x-w*.53,y:y-h*.12},{x:x-w*.06,y:y-h*.66},{x:x+w*.53,y:y-h*.12},{x:x+w*.39,y:y+h*.04},{x:x-w*.06,y:y-h*.43},{x:x-w*.39,y:y+h*.04}],a[0],"#453a36",3);
    poly([{x:x-w*.06,y:y-h*.66},{x:x+w*.53,y:y-h*.12},{x:x+w*.39,y:y+h*.04},{x:x-w*.06,y:y-h*.43}],a[1],"#554039",2);
    for(let row=0;row<5;row++){
      const yy=y-h*.53+row*h*.105;
      const left=x-w*.43+row*w*.055,right=x+w*.42-row*w*.04;
      rect(left,yy,Math.max(12,right-left),3,row%2?"#d28c65":"#c47a58");
      for(let xx=left+7+(row%2)*5;xx<right-4;xx+=14){
        rect(xx,yy+4,9,3,row%2?"#70443d":"#8c5144");
        rect(xx+1,yy+4,5,1,"#e0a078");
      }
    }
    rect(x-w*.54,y-h*.13,w*1.08,5,"#493b34");
    rect(x-w*.50,y-h*.09,w,3,"#d39a69");
    // Ridge cap and roof-end details.
    rect(x-w*.075,y-h*.65,w*.15,5,"#e1b27a");
    rect(x-w*.055,y-h*.69,w*.11,4,"#f0d29a");
    // Distinctive pixel sign/emblem for each business.
    const emblem=b.name==="冒険者ギルド"?"shield":b.name==="鍛冶屋"?"hammer":
      b.name==="武器屋"?"sword":b.name==="道具屋"?"potion":
      b.name==="銀行"?"coin":b.name==="宿屋"?"bed":
      b.name==="酒場"?"mug":b.name==="市場"?"stall":
      b.name==="理髪店"?"comb":b.name==="仕立て屋"||b.name==="服飾店"?"needle":
      b.name==="農家の作業小屋"?"wheat":"home";
    if(b.name!=="住民の家"&&b.name!=="あなたの家"&&b.name!=="町長の家"){
      const sx=x,sy=y-h*.19;
      rect(sx-17,sy-11,34,22,"#493a30");rect(sx-14,sy-8,28,16,"#e6d4a7");
      if(emblem==="shield"){poly([{x:sx-7,y:sy-6},{x:sx+7,y:sy-6},{x:sx+6,y:sy+3},{x:sx,y:sy+8},{x:sx-6,y:sy+3}],"#6685a2","#33465a",1);rect(sx-1,sy-5,2,11,"#e8d39a");rect(sx-5,sy-1,10,2,"#e8d39a");}
      else if(emblem==="hammer"){rect(sx-2,sy-5,4,14,"#80543a");rect(sx-8,sy-7,16,5,"#66717a");rect(sx+4,sy-7,4,5,"#9ca4a2");}
      else if(emblem==="sword"){rect(sx-1,sy-7,3,13,"#b8d0d0");rect(sx-5,sy+3,11,2,"#8c5b38");rect(sx-2,sy+5,5,3,"#67432f");}
      else if(emblem==="coin"){ellipse(sx,sy,7,7,"#d5a846");ellipse(sx,sy,4,4,"#f4d985");rect(sx-1,sy-4,2,8,"#9b7134");}
      else if(emblem==="potion"){rect(sx-3,sy-6,6,3,"#6b5039");rect(sx-5,sy-3,10,11,"#7c9eb2");rect(sx-3,sy+1,6,5,"#c45c68");}
      else if(emblem==="bed"){rect(sx-9,sy+1,18,5,"#8d6043");rect(sx-8,sy-4,7,5,"#eee0bd");rect(sx-1,sy-2,10,4,"#9e6d54");}
      else if(emblem==="mug"){rect(sx-5,sy-5,10,11,"#a66b43");rect(sx+5,sy-3,4,6,"#a66b43");rect(sx-4,sy-3,8,2,"#f1d9a5");}
      else if(emblem==="stall"){rect(sx-9,sy-3,18,3,"#b95e4c");rect(sx-7,sy,14,7,"#c99a5b");}
      else if(emblem==="comb"){rect(sx-7,sy-5,14,3,"#8d5b43");for(let k=-5;k<=5;k+=3)rect(sx+k,sy-1,1,8,"#8d5b43");}
      else if(emblem==="needle"){rect(sx-1,sy-7,2,15,"#87969b");rect(sx-4,sy-6,8,2,"#87969b");}
      else if(emblem==="wheat"){rect(sx-1,sy-7,2,15,"#8c9a4d");for(let k=-1;k<=1;k++)rect(sx+k*4,sy-5+Math.abs(k)*2,3,3,"#d6b45c");}
      else{rect(sx-6,sy-5,12,11,"#a96f4b");rect(sx-2,sy-1,4,7,"#51392e");}
    }
    if(b.name!=="住民の家"){
      ctx.save();ctx.font="bold 11px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.lineJoin="round";ctx.lineWidth=3;ctx.strokeStyle="#493a30";ctx.strokeText(b.name,x,y-h*.73);ctx.fillStyle="#fff2c8";ctx.fillText(b.name,x,y-h*.73);ctx.restore();
    }
  }

  function drawNpcPixelPerson(p){
    const q=project(p.x,p.y),x=q.x-20,y=q.y-42;
    if(x<-55||y<-70||x>W+55||y>H+55)return;
    const moving=!!p.moving,frame=moving?Math.floor((p.walkClock||0)*8)%4:0;
    const dir=String(p.dir||"down");
    const key=["npc",p.id,p.color,p.hair,p.skin,p.eyes,p.style,p.accessory,p.role,dir,frame].join(":");
    let sprite=pixelSpriteCache.get(key);
    if(!sprite){
      const c=document.createElement("canvas");c.width=32;c.height=40;
      const g=c.getContext("2d");g.imageSmoothingEnabled=false;
      const put=(xx,yy,w,h,col)=>{g.fillStyle=col;g.fillRect(xx,yy,w,h);};
      const hairMap={"栗色":"#794b32","金髪":"#e7bd55","黒髪":"#30272b","銀髪":"#b7c1c9","茶色":"#8a5938","赤髪":"#b64d38","青髪":"#426eaa","緑髪":"#52784a"};
      const skinMap={"明るい肌":"#f0c49a","普通の肌":"#dba77e","褐色肌":"#b97850","色白":"#f4d8bd"};
      const hair=hairMap[p.hair]||"#754a34",skin=skinMap[p.skin]||"#f0c49a",cloth=p.color||"#527caa";
      const dark="#332d32",trim="#e8d2a2",eye=p.eyes==="緑"?"#477a4d":p.eyes==="茶"?"#805238":p.eyes==="紫"?"#76518d":"#426b9a";
      const step=frame===1?2:frame===3?-2:0;
      // Boots and legs with a four-frame walking cycle.
      put(8+step,32,6,5,"#49352b");put(19-step,32,6,5,"#49352b");
      put(8+step,30,6,3,"#d8bd8b");put(19-step,30,6,3,"#d8bd8b");
      // Tunic, sleeves, belt, collar and small stitched highlights.
      put(7,19,18,12,cloth);put(5,20,4,9,dark);put(23,20,4,9,dark);
      put(6,27,3,4,skin);put(25,27,3,4,skin);
      put(9,19,14,3,trim);put(14,22,4,7,"#8c6547");put(10,29,12,2,dark);
      put(12,20,8,2,"#f2e5c5");put(15,23,2,5,"#d8bd8b");
      // Hair silhouette differs by style and direction.
      const back=dir==="up"||dir==="up-left"||dir==="up-right";
      const left=dir==="left"||dir==="up-left",right=dir==="right"||dir==="up-right";
      if(back){
        put(8,5,16,12,hair);put(6,9,4,12,hair);put(22,9,4,12,hair);
        if(p.style==="長髪"){put(7,15,5,10,hair);put(20,15,5,10,hair);}
        if(p.style==="ポニーテール"){put(23,8,5,10,hair);put(25,16,3,5,hair);}
      }else{
        put(8,5,16,8,hair);put(7,8,3,8,hair);put(22,8,3,8,hair);
        if(p.style==="長髪"){put(6,12,5,12,hair);put(21,12,5,12,hair);}
        if(p.style==="ポニーテール"){put(23,8,5,9,hair);put(25,15,3,6,hair);}
        put(9,11,14,10,skin);
        if(left){put(10,14,2,2,eye);put(12,14,2,2,"#fff4d9");}
        else if(right){put(20,14,2,2,eye);put(18,14,2,2,"#fff4d9");}
        else{put(11,14,2,2,"#fff4d9");put(19,14,2,2,"#fff4d9");put(12,14,1,2,eye);put(20,14,1,2,eye);}
        put(15,18,2,1,"#a94e50");
      }
      // Role-specific silhouettes and equipment, not recolored copies of the player.
      if(p.role==="衛兵"){put(7,4,18,4,"#647d55");put(10,1,12,5,"#d7c69b");put(8,21,16,9,"#708b68");put(24,20,3,13,"#b6b6a4");}
      else if(p.role==="鍛冶師"){put(7,5,18,5,"#51463e");put(9,7,14,3,"#9b876d");put(8,21,16,10,"#56514d");put(25,23,3,8,"#a6a6a0");}
      else if(p.role==="商人"||p.role==="旅商人"||p.role==="行商人"){put(5,3,22,5,"#9c6844");put(8,1,16,3,"#e1bd72");put(7,21,18,3,"#f0d9a4");}
      else if(p.role==="冒険者"||p.role==="旅人"){put(6,3,20,4,"#6d5947");put(8,1,16,3,"#c49a62");put(6,20,20,10,"#6b7f88");put(23,22,4,9,"#9a9d9b");}
      else if(p.role==="受付"||p.role==="町長"){put(9,4,14,3,"#d3b56e");put(10,21,12,8,"#e7d9bd");}
      else if(p.accessory==="帽子"){put(5,5,22,4,"#80543b");put(9,2,14,4,"#c18b4d");}
      else if(p.accessory==="マント"){put(4,20,24,12,"#76517c");put(7,21,18,8,cloth);}
      else if(p.accessory==="眼鏡"){put(8,14,6,2,"#d7d7cf");put(18,14,6,2,"#d7d7cf");put(14,14,4,1,"#6b6256");}
      else if(p.accessory==="スカーフ"){put(9,19,14,3,"#e0b45d");put(21,21,3,7,"#c17c45");}
      else if(p.accessory==="エプロン"){put(9,20,14,10,"#e8d8b2");put(12,22,8,2,"#b78a5b");}
      // Dark pixel outline and tiny highlights keep the sprite crisp at native resolution.
      put(7,5,2,8,dark);put(23,5,2,8,dark);put(8,4,16,2,dark);
      put(9,18,14,1,dark);put(8,30,6,2,dark);put(19,30,6,2,dark);
      sprite=c;pixelSpriteCache.set(key,sprite);if(pixelSpriteCache.size>420)pixelSpriteCache.delete(pixelSpriteCache.keys().next().value);
    }
    ellipse(q.x,q.y-3,13,4,"#3d5138");
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(sprite,Math.round(x),Math.round(y),40,50);ctx.restore();
  }

  function drawPixelPerson(p,isPlayer=false){
    if(p.isNpc){drawNpcPixelPerson(p);return;}
    const q=project(p.x,p.y);
    if(!p.isNpc&&!(isPlayer&&p.customAppearance)&&playerWalkSheet.complete&&playerWalkSheet.naturalWidth){
      // Rows: front/down=0, left=1, right=2, back/up=3. Columns are the 3 walking poses.
      const dir=String(p.dir||"down");
      const row=dir.includes("left")?1:dir.includes("right")?2:(dir==="up"||dir==="up-left"||dir==="up-right")?3:0;
      const frame=p.moving?Math.floor((p.walkClock||0)*7)%3:1;
      const sx=frame*64,sy=row*64;
      ctx.save();ctx.imageSmoothingEnabled=false;
      // NPCs share the protagonist's sprite style and proportions, with a subtle palette variation.
      if(!isPlayer&&!p.id){const label=String(p.name||p.role||"住民");const tint=Array.from(label).reduce((sum,ch)=>sum+ch.charCodeAt(0),0)%7;ctx.filter="hue-rotate("+((tint-3)*9)+"deg)";}
      ellipse(q.x,q.y-5,11,3,"#3d5138");
      ctx.drawImage(playerWalkSheet,sx,sy,64,64,Math.round(q.x-28),Math.round(q.y-62),56,56);
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
      if(p.style==="短髪"){put(6,5,12,7,hair);put(5,8,2,4,hair);put(17,8,2,4,hair);}else{put(6,5,12,10,hair);put(5,8,2,7,hair);put(17,8,2,7,hair);if(p.style==="長髪"){put(5,13,3,8,hair);put(16,13,3,8,hair);}if(p.style==="ポニーテール"){put(17,7,4,8,hair);put(19,13,3,5,hair);}}
      put(7,7,10,9,skin);put(8,10,2,2,"#fff4d9");put(14,10,2,2,"#fff4d9");
      put(9,10,1,2,p.eyes==="緑"?"#477a4d":p.eyes==="茶"?"#805238":"#426b9a");
      put(15,10,1,2,p.eyes==="緑"?"#477a4d":p.eyes==="茶"?"#805238":"#426b9a");put(11,13,2,1,"#a94e50");if(p.accessory==="帽子"){put(4,3,16,3,"#80543b");put(7,1,10,3,"#c18b4d");}
      else if(p.accessory==="マント"){put(3,17,18,10,"#7a4b83");put(5,18,14,7,cloth);}
      else if(p.accessory==="眼鏡"){put(7,10,4,2,"#d7d7cf");put(14,10,4,2,"#d7d7cf");put(11,10,3,1,"#6b6256");}
      else if(p.accessory==="スカーフ"){put(7,15,10,3,"#e0b45d");put(15,17,3,5,"#c17c45");}
      else if(p.accessory==="エプロン"){put(7,17,10,8,"#e8d8b2");put(9,18,6,2,"#b78a5b");}
      if(p.role==="衛兵"){put(5,4,14,3,"#5e8052");put(8,2,8,3,"#d8c69a");put(6,17,12,7,"#738b64");}
      else if(p.role==="鍛冶師"){put(5,4,14,3,"#5d5048");put(8,6,8,1,"#a68a69");put(7,17,10,8,"#5b5550");}
      else if(p.role==="受付"||p.role==="町長"){put(6,4,12,3,"#d3b56e");}
      else if(p.accessory==="なし")put(6,4,12,3,hair);
      put(7,7,3,1,"#ffffff");put(8,17,3,1,"#ffffff");
      sprite=c;pixelSpriteCache.set(key,sprite);if(pixelSpriteCache.size>260)pixelSpriteCache.delete(pixelSpriteCache.keys().next().value);
    }
    ctx.save();ctx.imageSmoothingEnabled=false;
    const bob=moving&&phase%2===1?-1:0;
    ctx.drawImage(sprite,x-4,y-5+bob,40,48);ctx.restore();
    rect(x+3,y+39,22,4,"#42623b");
  }
  function drawPlayerName(p){
    const q=project(p.x,p.y);
    const label=(p.name||"冒険者").slice(0,12);
    ctx.save();ctx.font="11px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.lineJoin="round";ctx.lineWidth=3;ctx.strokeStyle="rgba(24,30,39,.88)";ctx.strokeText(label,q.x,q.y-78);
    ctx.fillStyle="#fff8df";ctx.fillText(label,q.x,q.y-78);ctx.restore();
  }
  function render(){
    ctx.clearRect(0,0,W,H);if(battle){drawBattle();return;}if(interior){drawInterior();return;}drawGround();
    const objects=[];
    for(const b of buildings)objects.push({depth:b.y+b.h,draw:()=>drawHouse(b,buildings.indexOf(b))});
    for(let i=0;i<110;i++){const x=160+Math.floor(hash(i,23)*2700),y=180+Math.floor(hash(i,31)*1950);if(Math.hypot(x-1600,y-1320)<420||(x>280&&x<620&&y>700&&y<2200)||buildings.some(b=>x>b.x-80&&x<b.x+b.w+80&&y>b.y-80&&y<b.y+b.h+80))continue;objects.push({depth:y,draw:()=>drawTree(x,y,i)});}
    for(const item of townDecor)objects.push({depth:item[2],draw:()=>drawTownDecor(item)});
    for(const n of npcs)objects.push({depth:n.y,draw:()=>drawPixelPerson(n)});
    for(const p of others.values())objects.push({depth:p.y,draw:()=>{drawPixelPerson(p);drawPlayerName(p)}});
    objects.push({depth:player.y,draw:()=>{drawPixelPerson(player,true);drawPlayerName(player)}});
    objects.sort((a,b)=>a.depth-b.depth).forEach(o=>o.draw());
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
        finishBattle("escape");
      }
      return;
    }
    const wasMoving=!!player.moving;
    player.moving=false;
    let dx=0,dy=0;if(keys.has("w")||keys.has("arrowup"))dy--;if(keys.has("s")||keys.has("arrowdown"))dy++;if(keys.has("a")||keys.has("arrowleft"))dx--;if(keys.has("d")||keys.has("arrowright"))dx++;
    if(dx||dy){player.moving=true;player.walkClock=(player.walkClock||0)+dt;const len=Math.hypot(dx,dy);dx/=len;dy/=len;const nx=player.x+dx*player.speed*dt,ny=player.y+dy*player.speed*dt;if(!blocked(nx,player.y))player.x=nx;if(!blocked(player.x,ny))player.y=ny;player.dir=dx<-.3?(dy<-.3?"up-left":dy>.3?"down-left":"left"):dx>.3?(dy<-.3?"up-right":dy>.3?"down-right":"right"):dy<0?"up":"down";}
    if(realtimeChannel&&!interior&&(player.moving||wasMoving))publishPlayerState(!player.moving);
    camera.x=player.x;camera.y=player.y;
    const outsideTown=!interior&&Math.hypot(player.x-town.x,player.y-town.y)>520;
    if(player.moving&&outsideTown){
      encounterTimer+=dt;
      if(encounterTimer>=encounterNext){
        encounterTimer=0;encounterNext=12+Math.random()*16;
        const pool=[["スライム",28,28,"#8bd7d0"],["森のウルフ",42,42,"#a7aeb8"],["ゴブリン",48,48,"#9ac078"]];
        const pick=pool[Math.floor(Math.random()*pool.length)];
        beginBattle({name:pick[0],hp:pick[1],maxHp:pick[2],color:pick[3],boss:false});
      }
    }else if(!player.moving)encounterTimer=Math.max(0,encounterTimer-dt*.35);
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

  const ADMIN_PASSWORD="O0p-@^";
  function openAdminGate(){$("admin-gate").classList.remove("hidden");$("admin-panel").classList.add("hidden");$("admin-password").value="";$("admin-gate-message").textContent="";$("admin-password").focus();}
  function closeAdminGate(){$("admin-gate").classList.add("hidden");$("admin-password").value="";keys.clear();}
  $("admin-gate-form").addEventListener("submit",e=>{e.preventDefault();if($("admin-password").value!==ADMIN_PASSWORD){$("admin-gate-message").textContent="パスワードが違います。";return;}$("admin-gate").classList.add("hidden");openAdminPanel();});
  $("admin-gate-cancel").addEventListener("click",closeAdminGate);
  function openAdminPanel(){const select=$("admin-building");select.innerHTML="";buildings.forEach((b,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=b.name+" ("+(i+1)+")";select.appendChild(o);});$("admin-gold").value=String(Math.max(0,Number(gameData.gold)||0));$("admin-hair").value=player.hair;$("admin-skin").value=player.skin;$("admin-eyes").value=player.eyes;$("admin-style").value=player.style;$("admin-color").value=player.outfit;$("admin-accessory").value=player.accessory;loadAdminBuildingFields();$("admin-status").textContent="";$("admin-panel").classList.remove("hidden");}
  function loadAdminBuildingFields(){const b=buildings[Number($("admin-building").value)||0];if(b){$("admin-building-x").value=String(Math.round(b.x));$("admin-building-y").value=String(Math.round(b.y));$("admin-building-w").value=String(Math.round(b.w));$("admin-building-h").value=String(Math.round(b.h));}}
  $("admin-building").addEventListener("change",loadAdminBuildingFields);
  $("admin-gold-save").addEventListener("click",async()=>{const gold=Math.max(0,Math.min(2000000000,Math.floor(Number($("admin-gold").value)||0)));gameData.gold=gold;const ok=await saveGameData();$("admin-gold").value=String(gold);$("admin-status").textContent=ok?"GOLDを保存しました。":"保存に失敗しました。通信を確認してね。";});
  $("admin-building-save").addEventListener("click",async()=>{const i=Number($("admin-building").value),b=buildings[i],x=Number($("admin-building-x").value),y=Number($("admin-building-y").value),w=Number($("admin-building-w").value),h=Number($("admin-building-h").value);if(!b||![x,y,w,h].every(Number.isFinite)){$("admin-status").textContent="X・Y・幅・高さを正しく入力してね。";return;}b.x=Math.max(80,Math.min(worldW-160,x));b.y=Math.max(80,Math.min(worldH-160,y));b.w=Math.max(80,Math.min(420,w));b.h=Math.max(70,Math.min(320,h));const key=b.name+"@"+i;gameData.buildingPositions=gameData.buildingPositions||{};gameData.buildingSizes=gameData.buildingSizes||{};gameData.buildingPositions[key]={x:b.x,y:b.y};gameData.buildingSizes[key]={w:b.w,h:b.h};const ok=await saveGameData();$("admin-status").textContent=ok?b.name+"の位置・大きさを保存しました。":"保存に失敗しました。通信を確認してね。";});
  $("admin-appearance-save").addEventListener("click",async()=>{player.hair=$("admin-hair").value;player.skin=$("admin-skin").value;player.eyes=$("admin-eyes").value;player.style=$("admin-style").value;player.outfit=$("admin-color").value;player.accessory=$("admin-accessory").value;player.customAppearance=true;gameData.appearance={hair:player.hair,skin:player.skin,eyes:player.eyes,style:player.style,color:player.outfit,accessory:player.accessory};gameData.customAppearance=true;const ok=await saveGameData();$("admin-status").textContent=ok?"キャラクターの見た目を保存しました。":"保存に失敗しました。通信を確認してね。";});
  $("admin-close").addEventListener("click",()=>$("admin-panel").classList.add("hidden"));
  $("admin-password").addEventListener("keydown",e=>{if(e.key==="Escape")closeAdminGate();});

  requestAnimationFrame(loop);
})();