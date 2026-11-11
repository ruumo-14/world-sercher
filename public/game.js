"use strict";
(() => {
  const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");
  const W=960,H=600;
  // 120×75の仮想画面を960×600へ拡大し、1ドットを8×8画面ピクセルにする。
  const pixelView=document.createElement("canvas");pixelView.width=120;pixelView.height=75;
  const pixelViewCtx=pixelView.getContext("2d"); canvas.width=W;canvas.height=H;ctx.imageSmoothingEnabled=true;
  const worldTileset=new Image();worldTileset.src="/assets/world-sercher-user-atlas.png";window.WS_WORLD_TILESET=worldTileset;
  const storybookTexture=new Image();storybookTexture.src="/assets/storybook-paper.svg";
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
  // === World Sercher: unified high-detail 16-bit JRPG renderer ===
  const PAL={
    ink:"#342d32",ink2:"#55433a",cream:"#f2dfb5",highlight:"#fff0c8",
    grass:["#5d984c","#68a653","#78b45c","#4d8745"],
    dirt:["#b98a54","#c99a60","#d7ad70","#a97848"],
    stone:["#9c9a82","#b8b39a","#d2c7a5","#777c70"],
    water:["#397e9a","#4e9db0","#76c0c3","#b0ded0"],
    wood:["#70472f","#98613b","#bd8650","#d6a76a"],
    roof:["#8b3e39","#b45143","#d16a50","#e18b65"],
    leaf:["#285e3d","#397a43","#52964a","#75ad55","#9ac36a"]
  };
  function drawInterior(){
    const b=interior?.building;if(!b)return;
    rect(0,0,W,H,"#263c35");
    rect(18,16,924,568,"#3b302b");rect(26,24,908,552,"#d7b987");
    rect(38,36,884,148,"#896044");rect(44,42,872,136,"#b77e53");
    for(let x=52;x<910;x+=32){rect(x,45,3,128,"#9d6b49");}
    rect(38,190,884,360,"#b58a5b");
    for(let y=202;y<548;y+=32)for(let x=48+(Math.floor(y/32)%2)*16;x<910;x+=64){
      rect(x,y,60,28,"#c99c68");rect(x+2,y+2,56,24,"#bd8e5b");
    }
    rect(100,66,116,108,"#5b4032");rect(108,74,100,92,"#7eafb0");
    rect(744,66,116,108,"#5b4032");rect(752,74,100,92,"#7eafb0");
    rect(156,78,5,84,"#e7d4a8");rect(792,78,5,84,"#e7d4a8");
    rect(280,222,400,56,"#67442f");rect(288,226,384,46,"#98613b");rect(298,231,364,7,"#d7aa6d");
    if(b.type==="forge"){
      rect(700,292,150,164,"#625147");rect(716,310,118,132,"#43352f");
      rect(732,345,88,72,"#a84d35");rect(746,350,60,56,"#ed9a45");rect(764,356,25,44,"#ffe39a");
      rect(690,440,170,18,"#493a32");
    }else if(b.type==="inn"){
      for(const x of [100,650]){rect(x,340,210,92,"#70472f");rect(x+10,330,190,78,"#cba16b");rect(x+18,340,174,16,"#e8d1a1");rect(x+35,366,140,34,"#a95e54");}
    }else if(b.type==="shop"||b.type==="market"){
      for(let i=0;i<4;i++){const x=70+i*207;rect(x,350,150,80,"#70472f");rect(x+4,354,142,70,i%2?"#bd8752":"#d0a36a");rect(x-3,330,156,20,"#9c5147");rect(x+8,333,138,6,"#e3ad70");}
    }else{
      rect(140,360,680,72,"#70472f");rect(148,350,664,60,"#bd8752");
      for(let i=0;i<5;i++){rect(190+i*125,374,24,24,"#e6c27f");}
    }
    rect(330,54,300,34,"#604331");rect(336,58,288,25,"#f0d6a1");
    ctx.fillStyle="#44332c";ctx.font="bold 22px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.fillText(b.name,480,78);
    ctx.font="14px 'Noto Sans JP',sans-serif";ctx.fillText("Eキー / 操作ボタン：外へ出る",480,535);
    drawStorybookPersonAt(480,466,player,true,1.15);
  }
  function drawBattle(){
    rect(0,0,W,H,"#8bb7c0");
    for(let i=0;i<9;i++){const x=i*122-20,y=70+(i%3)*24;rect(x,y,72,12,"#d8e6d2");rect(x+15,y-8,48,12,"#edf0d8");}
    // distant hills, forest line, and layered pixel grass
    ctx.fillStyle="#719b70";ctx.beginPath();ctx.moveTo(0,300);for(let x=0;x<=W;x+=24)ctx.lineTo(x,270+Math.sin(x/92)*20);ctx.lineTo(W,430);ctx.lineTo(0,430);ctx.fill();
    for(let i=0;i<15;i++){const x=i*70-12,y=306+(i%3)*13;rect(x+12,y-28,12,35,"#765038");rect(x,y-48,38,28,"#356f46");rect(x+8,y-62,30,24,"#4c914d");rect(x+16,y-70,16,14,"#78ae57");}
    rect(0,420,W,180,"#b58b59");for(let y=432;y<600;y+=24)for(let x=(y%48)*.5;x<W;x+=48){rect(x,y,44,20,"#c99d68");rect(x+5,y+4,4,3,"#e0bd7d");}
    // battle HUD frame
    rect(12,12,264,150,"#47382f");rect(17,17,254,140,"#ead7ad");rect(22,22,244,130,"#f5e8c9");
    ctx.fillStyle="#49372e";ctx.textAlign="left";ctx.font="bold 17px 'Noto Sans JP',sans-serif";ctx.fillText("冒険者",34,48);
    ctx.font="14px 'Noto Sans JP',sans-serif";ctx.fillText("HP  "+battle.hp+" / "+battle.maxHp,34,76);ctx.fillText("MP  "+battle.mp+" / "+battle.maxMp,34,103);
    const bar=(x,y,w,v,max,color)=>{rect(x,y,w,10,"#69584a");rect(x+2,y+2,w-4,6,"#9a8a70");rect(x+2,y+2,(w-4)*Math.max(0,v/max),6,color);};
    bar(34,84,200,battle.hp,battle.maxHp,"#bd554b");bar(34,111,200,battle.mp,battle.maxMp,"#428eae");
    // Battle avatar is drawn in screen coordinates.
    drawStorybookPersonAt(battle.playerX,438-battle.playerY,player,true,1.25);
    battle.enemies.forEach((e,i)=>{if(e.hp<=0)return;const ex=650+(i%3)*92,ey=422-Math.floor(i/3)*70;
      ellipse(ex,ey+8,e.boss?46:32,9,"#77654a");
      if(e.name.includes("スライム")){
        rect(ex-28,ey-25,56,27,"#377c80");rect(ex-22,ey-35,44,14,"#4ca4a0");rect(ex-12,ey-40,24,8,"#9dd8c8");
        rect(ex-13,ey-23,7,9,"#fff0d0");rect(ex+7,ey-23,7,9,"#fff0d0");rect(ex-11,ey-21,3,5,"#314d50");rect(ex+9,ey-21,3,5,"#314d50");
      }else{
        rect(ex-25,ey-48,50,49,e.color);rect(ex-18,ey-60,36,18,e.color);rect(ex-19,ey-31,8,9,"#fff0d0");rect(ex+11,ey-31,8,9,"#fff0d0");
        rect(ex-17,ey-29,4,5,"#403735");rect(ex+13,ey-29,4,5,"#403735");
        if(e.boss){rect(ex-34,ey-58,15,16,"#b18b58");rect(ex+19,ey-58,15,16,"#b18b58");}
      }
      ctx.fillStyle="#44352e";ctx.font="bold 13px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.fillText(e.name,ex,ey-67);bar(ex-34,ey-55,68,e.hp,e.maxHp,"#bd554b");
    });
    if(battle.defending){ctx.strokeStyle="#d6eff0";ctx.lineWidth=5;ctx.strokeRect(battle.playerX-23,390-battle.playerY,46,58);}
    if(battleMessage&&performance.now()<battleMessageUntil){rect(250,210,460,58,"#47382f");rect(255,215,450,48,"#f2dfb5");ctx.fillStyle="#49372e";ctx.textAlign="center";ctx.font="bold 18px 'Noto Sans JP',sans-serif";ctx.fillText(battleMessage,480,245);}
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
  const TILE=32, DEPTH=1;
  function project(wx,wy){return{x:Math.round(W/2+(wx-camera.x)),y:Math.round(H/2+(wy-camera.y))};}
  function poly(points,fill,stroke=PAL.ink,line=2){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}}
  function storyWorldPath(points,color,width){ctx.beginPath();points.forEach((p,i)=>{const q=project(p[0],p[1]);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap="square";ctx.lineJoin="round";ctx.stroke();}
  function tile(wx,wy,fill){const p=project(wx,wy);rect(p.x,p.y,TILE,TILE,fill);}
  function drawGround(){
    rect(0,0,W,H,PAL.grass[1]);
    const left=Math.floor((camera.x-W/2)/TILE)-1,top=Math.floor((camera.y-H/2)/TILE)-1;
    for(let ty=0;ty<Math.ceil(H/TILE)+3;ty++)for(let tx=0;tx<Math.ceil(W/TILE)+3;tx++){
      const gx=left+tx,gy=top+ty,q=project(gx*TILE,gy*TILE),v=hash(gx,gy);
      rect(q.x,q.y,TILE,TILE,PAL.grass[Math.floor(v*4)]);
      if(v>.16){rect(q.x+4+(v*17|0)%18,q.y+5+(v*23|0)%18,3,3,v>.78?"#a7ca68":"#4b8745");}
      if(v>.89){rect(q.x+18,q.y+9,4,2,"#d7d58a");}
    }
    // River is built from broad stepped banks and water tiles.
    const riverPts=[];for(let y=420;y<=2520;y+=64)riverPts.push([390+Math.sin(y/155)*65+Math.sin(y/83)*13,y]);
    storyWorldPath(riverPts,"#765d43",218);storyWorldPath(riverPts,"#c2aa7b",202);storyWorldPath(riverPts,"#397f9b",174);storyWorldPath(riverPts,"#5ba8b4",150);
    for(let i=0;i<48;i++){const wy=480+i*42,bend=390+Math.sin(wy/155)*65+Math.sin(wy/83)*13,q=project(bend,wy);rect(q.x-25,q.y-3,20+(i%4)*5,3,"#b3dcd0");}
    // Main roads use tiled paving, dark edges, and a pale center seam.
    storyWorldPath([[1600,430],[1600,2370]],"#795d42",142);storyWorldPath([[1600,430],[1600,2370]],"#b98b57",126);
    storyWorldPath([[650,1320],[2660,1320]],"#795d42",142);storyWorldPath([[650,1320],[2660,1320]],"#c79a63",126);
    storyWorldPath([[1600,1320],[1100,900]],"#b98b57",68);storyWorldPath([[1600,1320],[2050,900]],"#b98b57",68);storyWorldPath([[1600,1320],[2050,1800]],"#b98b57",68);
    // Paving seams and scattered stones
    for(let i=0;i<80;i++){const x=700+(i*73)%1900,y=1260+((i*31)%110)-55,q=project(x,y);rect(q.x,q.y,18,3,i%2?"#d8b57b":"#a97e50");}
    // central plaza with concentric stone ring
    const q=project(1600,1320);ellipse(q.x,q.y+12,192,190,"#806b50");ellipse(q.x,q.y,184,184,"#c1ae8b");ellipse(q.x,q.y-3,170,170,"#ded0ad");
    ctx.strokeStyle="#a68c66";ctx.lineWidth=8;ctx.beginPath();ctx.ellipse(q.x,q.y-3,158,158,0,0,Math.PI*2);ctx.stroke();
    for(let i=0;i<32;i++){const a=i*Math.PI/16,x=q.x+Math.cos(a)*147,y=q.y+Math.sin(a)*147;rect(x-5,y-4,10,8,i%2?"#b5a07a":"#efe1be");}
    drawFountain(1600,1320);
    const m=project(2000,2140);ellipse(m.x,m.y+8,164,94,"#8a6b4a");ellipse(m.x,m.y,156,88,"#c4a477");
    // Lively storybook details scattered through grassy clearings.
    for(let i=0;i<190;i++){
      const wx=90+Math.floor(hash(i,71)*2860),wy=100+Math.floor(hash(i,83)*2480);
      if(Math.hypot(wx-1600,wy-1320)<470||buildings.some(b=>wx>b.x-90&&wx<b.x+b.w+90&&wy>b.y-90&&wy<b.y+b.h+90))continue;
      const p=project(wx,wy),kind=i%5;
      if(kind===0){ellipse(p.x,p.y+3,7,3,"#477849");for(let k=0;k<5;k++){const a=k*Math.PI*2/5;ellipse(p.x+Math.cos(a)*4,p.y-4+Math.sin(a)*3,3,2,["#f3d77e","#e9a1a0","#f5e9c8"][i%3]);}ellipse(p.x,p.y-4,2,2,"#d8a84d");}
      else if(kind===1){ellipse(p.x,p.y,5,3,"#8c8b7d");ellipse(p.x-2,p.y-2,3,2,"#bcb9a7");}
      else if(kind===2){ctx.strokeStyle="#477b47";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y+4);ctx.lineTo(p.x-2,p.y-5);ctx.moveTo(p.x,p.y+4);ctx.lineTo(p.x+4,p.y-3);ctx.stroke();}
    }

  }
  const townDecor=[
    ["lamp",1180,1120],["lamp",2020,1120],["lamp",1180,1540],["lamp",2020,1540],
    ["bench",1390,1150],["bench",1810,1510],["bench",1450,1780],
    ["flower",1160,980],["flower",1910,980],["flower",1210,1830],["flower",2200,1780],["flower",1740,1090],["flower",1760,1570],
    ["barrel",930,1170],["barrel",2230,1170],["barrel",1940,1850],["barrel",2220,2020],
    ["sign",1480,900],["sign",1700,1760],["sign",880,1510],
    ["crate",1080,1190],["crate",2170,1190],["crate",1900,2010],["crate",2110,2010],
    ["stall",1950,1990],["stall",2160,1990],["flower",920,1780],["flower",1060,1870],["flower",2320,1680],["flower",2350,930]
  ];
  function drawTownDecor(item){
    const [type,wx,wy]=item,p=project(wx,wy),x=p.x,y=p.y;if(x<-70||y<-80||x>W+70||y>H+80)return;
    ellipse(x,y+7,18,5,"#56734a");
    if(type==="flower"){
      rect(x-2,y-12,3,15,"#477b48");rect(x-8,y-5,6,3,"#5c994c");rect(x+2,y-8,6,3,"#5c994c");
      const c=["#e78d8a","#f1d274","#d9a0bd","#f4e6bc"];for(let k=0;k<5;k++){const a=k*Math.PI*2/5;rect(x+Math.round(Math.cos(a)*5)-2,y-17+Math.round(Math.sin(a)*3)-2,5,5,c[(k+Math.floor(wx/100))%4]);}rect(x-1,y-18,4,4,"#d9ad50");
    }else if(type==="lamp"){
      rect(x-3,y-26,6,32,"#68452f");rect(x-10,y-42,20,18,"#4a3a30");rect(x-7,y-39,14,12,"#f4d98d");rect(x-13,y-45,26,4,"#b98b55");
    }else if(type==="bench"){
      rect(x-25,y-13,50,9,"#70472f");rect(x-27,y-19,54,8,"#bd8650");rect(x-19,y-7,5,18,"#67432e");rect(x+14,y-7,5,18,"#67432e");
    }else if(type==="barrel"||type==="crate"){
      rect(x-12,y-16,24,24,type==="barrel"?"#9b633c":"#bd8953");rect(x-12,y-13,24,4,"#e0b978");rect(x-12,y+1,24,4,"#70472f");rect(x-2,y-16,3,24,"#765037");
    }else if(type==="sign"){
      rect(x-2,y-26,4,34,"#70472f");rect(x-19,y-39,38,18,"#765039");rect(x-16,y-36,32,12,"#e7ca8e");rect(x-3,y-33,6,6,"#b07848");
    }else if(type==="stall"){
      rect(x-25,y-3,50,14,"#70472f");rect(x-28,y-19,56,17,"#e1c18a");for(let k=0;k<4;k++)rect(x-27+k*14,y-18,7,15,k%2?"#bd6252":"#e2b46d");
    }
  }
  function drawFountain(wx,wy){
    const p=project(wx,wy),x=p.x,y=p.y;ellipse(x,y+22,52,15,"#79664d");ellipse(x,y,52,34,"#7c7060");ellipse(x,y-5,45,28,"#ded0ad");ellipse(x,y-8,36,21,"#4c9aac");
    rect(x-24,y-11,18,3,"#a9d7cf");rect(x+7,y-2,22,3,"#a9d7cf");rect(x-4,y-30,8,18,"#c5b28b");rect(x-8,y-35,16,7,"#e7d6ae");rect(x-2,y-43,4,10,"#7dc5c2");
  }
  function drawTree(wx,wy,index=0){
    const p=project(wx,wy),x=p.x,y=p.y;if(x<-100||y<-140||x>W+100||y>H+100)return;
    ellipse(x+4,y+8,35,10,"#55794a");
    rect(x-6,y-31,12,40,"#765039");rect(x-3,y-29,4,35,"#a8794d");
    const shades=["#397447","#4c8b4b","#65a45a","#80b76a"];
    const blobs=[[-20,-43,24],[-3,-59,28],[19,-42,25],[-18,-25,22],[5,-29,27],[1,-78,17]];
    blobs.forEach(([ox,oy,r],i)=>{ellipse(x+ox,y+oy,r+3,r*.78, "#2f633c");ellipse(x+ox,y+oy-2,r,r*.78,shades[(i+index)%shades.length]);});
    for(let i=0;i<5;i++){ellipse(x-18+(i*13)%38,y-50+(i%3)*14,3,2,"#b5d37a");}
  }
  function drawHouse(b,index=0){
    const p=project(b.x+b.w/2,b.y+b.h/2),x=p.x,y=p.y;if(x<-220||y<-240||x>W+220||y>H+240)return;
    const w=Math.max(86,b.w*.86),h=Math.max(72,b.h*.7);
    ctx.save();
    ctx.globalAlpha=1;
    ctx.globalCompositeOperation="source-over";
    const palette={guild:["#a64c43","#d6a76a","#ead6a9"],forge:["#574a43","#9b7455","#d2b18a"],inn:["#9a5147","#d49a68","#f0d8ac"],market:["#a45c42","#d6aa6d","#f0dfb8"],farm:["#74834b","#b9a36a","#e8d8ad"],bank:["#557d81","#b3c4b2","#e5d8b5"],home:["#8e5948","#c99168","#ead5aa"],shop:["#6c718e","#b58d70","#ead9b8"]}[b.type]||["#8e5948","#c99168","#ead5aa"];
    const top=y-h*.45,front=y-h*.05,base=y+h*.38;
    // Opaque backing silhouette: closes gaps between decorative roof/wall shapes.
    // This prevents the ground or characters behind the building from showing through.
    poly([
      {x:x-w*.55,y:front+2},{x:x-w*.08,y:top-28},
      {x:x+w*.55,y:front-2},{x:x+w*.48,y:base},
      {x:x-w*.43,y:base+4}
    ],b.type==="forge"?"#75685b":"#8c684d","#4a3a32",4);
    poly([
      {x:x-w*.43,y:front},{x:x+w*.32,y:front-8},
      {x:x+w*.32,y:base-8},{x:x-w*.43,y:base}
    ],palette[2],"#4a3a32",3);
    ellipse(x+8,base+6,w*.58,13,"#5d6845");
    poly([{x:x-w*.43,y:front},{x:x+w*.32,y:front-8},{x:x+w*.48,y:base},{x:x-w*.35,y:base+4}],b.type==="forge"?"#75685b":"#8c684d","#4a3a32",3);
    poly([{x:x-w*.43,y:front},{x:x+w*.32,y:front-8},{x:x+w*.32,y:base-8},{x:x-w*.43,y:base}],palette[2],PAL.ink,3);
    poly([{x:x-w*.55,y:front+2},{x:x-w*.08,y:top-28},{x:x+w*.55,y:front-2},{x:x+w*.34,y:front+16},{x:x-w*.08,y:top+2},{x:x-w*.38,y:front+18}], "#54382f",PAL.ink,3);
    poly([{x:x-w*.51,y:front},{x:x-w*.08,y:top-22},{x:x+w*.51,y:front-4},{x:x+w*.32,y:front+8},{x:x-w*.08,y:top+10},{x:x-w*.37,y:front+14}],palette[0],palette[1],2);
    for(let r=0;r<5;r++){const yy=top+7+r*8;ctx.strokeStyle=r%2?"#e18a62":"#783d38";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-w*.35+r*1.5,yy+17);ctx.lineTo(x+w*.34-r*1.5,yy+17);ctx.stroke();}
    rect(x-w*.38,front+8,5,h*.35,b.type==="forge"?"#66574a":"#8b5e3e");rect(x+w*.27,front+5,5,h*.35,"#8b5e3e");rect(x-w*.38,base-12,w*.66,5,"#8b5e3e");
    for(let k=0;k<13;k++){const xx=x-w*.33+(k*29)%(w*.58),yy=front+12+(k*17)%(h*.25);rect(xx,yy,4+(k%3)*2,3,k%2?"#f3e3bf":"#c8ac80");}
    for(const wx of [x-w*.25,x+w*.12]){rect(wx-10,front+14,23,29,"#54392f");rect(wx-7,front+17,17,23,"#d9c58f");rect(wx,front+17,3,23,"#e5d1a8");rect(wx-7,front+27,17,3,"#e5d1a8");}
    rect(x-13,front+15,27,base-front-15,"#54382f");rect(x-9,front+19,19,base-front-19,"#a66d46");rect(x+4,base-26,3,3,"#f1d18a");
    rect(x-4,top-23,8,20,palette[1]);rect(x-3,top-21,3,16,"#e6bc83");
    // Large, unmistakable shop emblems and signature props.
    const plaque=(yy=top-4)=>{rect(x-29,yy,58,36,"#5a4032");rect(x-25,yy+4,50,28,"#f2dcae");};
    if(b.type==="guild"){
      plaque();ctx.strokeStyle="#8e332d";ctx.lineWidth=5;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(x,top+2);ctx.lineTo(x,top+25);ctx.moveTo(x-12,top+11);ctx.lineTo(x+12,top+11);ctx.moveTo(x,top+25);ctx.lineTo(x-7,top+31);ctx.stroke();
      ctx.fillStyle="#8e332d";ctx.beginPath();ctx.moveTo(x,top-1);ctx.lineTo(x-5,top+8);ctx.lineTo(x+5,top+8);ctx.fill();
    }else if(b.type==="forge"){
      // Stone furnace, glowing fire and anvil beside the entrance.
      rect(x+w*.25,front-8,24,h*.33,"#665c52");rect(x+w*.25-5,front-13,34,9,"#8a8174");
      ellipse(x+w*.38,front+20,15,11,"#e77d3d");ellipse(x+w*.38,front+17,8,8,"#ffd36f");
      poly([{x:x-w*.39,y:y+7},{x:x-w*.18,y:y+7},{x:x-w*.14,y:y+16},{x:x-w*.23,y:y+22},{x:x-w*.33,y:y+22}], "#4b4644","#282628",2);
    }else if(b.type==="inn"){
      plaque();ctx.fillStyle="#9b4e43";ctx.font="bold 20px serif";ctx.textAlign="center";ctx.fillText("✦",x,top+23);
      rect(x+w*.28,front+20,25,7,"#8b5a3d");rect(x+w*.3,front+12,20,8,"#e4d2ad");
    }else if(b.type==="market"||b.type==="shop"){
      for(let k=0;k<4;k++){ctx.fillStyle=k%2?"#d9bd7e":"#b85d50";ctx.fillRect(x-w*.4+k*w*.2,front-2,w*.19,18);}
      rect(x-w*.4,front+16,w*.8,6,"#67472f");
      if(b.type==="shop"){ctx.fillStyle="#f3dba8";ctx.font="bold 18px serif";ctx.textAlign="center";ctx.fillText("⚒",x,top+18);}
    }else if(b.type==="bank"){
      for(let k=0;k<3;k++){rect(x-w*.27+k*w*.24,front+3,8,h*.29,"#e7e0c8");}
      poly([{x:x-w*.38,y:front+5},{x,y:top-17},{x:x+w*.38,y:front+5}],"#e8e0c9","#6d8580",2);
    }else if(b.type==="farm"){
      for(let k=0;k<5;k++){ctx.strokeStyle="#a18a43";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-w*.3+k*10,front+30);ctx.lineTo(x-w*.3+k*10-4,front+15);ctx.moveTo(x-w*.3+k*10,front+23);ctx.lineTo(x-w*.3+k*10+5,front+12);ctx.stroke();}
    }
    if(b.name!=="住民の家"&&b.name!=="あなたの家"&&b.name!=="町長の家"){ctx.font="bold 11px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.lineWidth=3;ctx.strokeStyle="#4b3930";ctx.strokeText(b.name,x,top-34);ctx.fillStyle="#fff0c8";ctx.fillText(b.name,x,top-34);}
    ctx.restore();
  }
  function drawStorybookPersonAt(x,y,p,isPlayer=false,scale=1){
    ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(scale,scale);
    const dir=p.dir||"down",move=!!p.moving,phase=move?Math.sin((p.walkClock||0)*11):0;
    const step=phase*4, bob=move?Math.abs(phase)*1.5:0;
    const species=String(p.species||"人間"),ink="#242326";
    const side=dir==="left"||dir==="right",face=dir==="left"?-1:dir==="right"?1:0;
    // A simple black stick-person silhouette; small accessories distinguish roles.
    ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle=ink;ctx.fillStyle=ink;
    ellipse(0,3,14,4,"rgba(54,75,48,.35)");
    const headY=-49+bob;
    // Species traits are deliberately bold and readable at small sizes.
    if(species.includes("竜")||species.includes("ドラゴン")){
      ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-5,headY-10);ctx.lineTo(-12,headY-19);ctx.lineTo(-2,headY-15);ctx.moveTo(5,headY-10);ctx.lineTo(12,headY-19);ctx.lineTo(2,headY-15);ctx.stroke();
      ctx.beginPath();ctx.moveTo(7,-25+bob);ctx.quadraticCurveTo(24,-18+bob,22,-5+bob);ctx.quadraticCurveTo(20,3+bob,29,-1+bob);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-11,-34+bob);ctx.lineTo(-22,-24+bob);ctx.lineTo(-12,-20+bob);ctx.stroke();
    }else if(species.includes("エルフ")){
      ctx.beginPath();ctx.moveTo(-7,headY-1);ctx.lineTo(-22,headY-9);ctx.lineTo(-13,headY+5);ctx.moveTo(7,headY-1);ctx.lineTo(22,headY-9);ctx.lineTo(13,headY+5);ctx.fill();
    }else if(species.includes("獣")||species.includes("猫")||species.includes("狼")){
      ctx.beginPath();ctx.moveTo(-10,headY-3);ctx.lineTo(-12,headY-18);ctx.lineTo(-1,headY-10);ctx.moveTo(10,headY-3);ctx.lineTo(12,headY-18);ctx.lineTo(1,headY-10);ctx.fill();
      ctx.beginPath();ctx.moveTo(8,-25+bob);ctx.quadraticCurveTo(24,-28+bob,23,-14+bob);ctx.stroke();
    }else if(species.includes("鳥")||species.includes("天使")){
      ctx.beginPath();ctx.moveTo(-10,-32+bob);ctx.quadraticCurveTo(-28,-48+bob,-26,-23+bob);ctx.quadraticCurveTo(-18,-19+bob,-10,-26+bob);ctx.moveTo(10,-32+bob);ctx.quadraticCurveTo(28,-48+bob,26,-23+bob);ctx.quadraticCurveTo(18,-19+bob,10,-26+bob);ctx.fill();
    }else if(species.includes("ドワーフ")){
      ctx.beginPath();ctx.moveTo(-8,headY+4);ctx.lineTo(0,headY+22);ctx.lineTo(8,headY+4);ctx.fill();
    }
    ctx.beginPath();ctx.arc(0,headY,9,0,Math.PI*2);ctx.fill();
    // Upright torso, arms and legs. Only limbs swing while walking.
    ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,-39+bob);ctx.lineTo(0,-17+bob);ctx.stroke();
    ctx.lineWidth=4;
    ctx.beginPath();ctx.moveTo(0,-34+bob);ctx.lineTo(-12-step*.45,-23+bob);ctx.moveTo(0,-34+bob);ctx.lineTo(12+step*.45,-23+bob);
    ctx.moveTo(0,-17+bob);ctx.lineTo(-8+step,-2+bob);ctx.moveTo(0,-17+bob);ctx.lineTo(8-step,-2+bob);ctx.stroke();
    if(p.role==="鍛冶師"||p.role==="職人"){ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-13,-24+bob);ctx.lineTo(-17,-17+bob);ctx.stroke();}
    if(p.accessory==="マント"||p.role==="冒険者"){
      ctx.fillStyle="#5a4b58";ctx.beginPath();ctx.moveTo(-7,-37+bob);ctx.lineTo(8,-37+bob);ctx.lineTo(12,-20+bob);ctx.lineTo(-10,-20+bob);ctx.closePath();ctx.fill();
      ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.stroke();
    }
    if(isPlayer){ctx.fillStyle="#e7c76e";ctx.beginPath();ctx.moveTo(0,-72+bob);ctx.lineTo(-6,-62+bob);ctx.lineTo(6,-62+bob);ctx.fill();}
    ctx.restore();
  }
  function drawNpcPixelPerson(p){const q=project(p.x,p.y);drawStorybookPersonAt(q.x,q.y,p,false,1.12);}
  function drawPixelPerson(p,isPlayer=false){const q=project(p.x,p.y);drawStorybookPersonAt(q.x,q.y,p,isPlayer,1.18);}
  function drawPlayerName(p){const q=project(p.x,p.y);const label=(p.name||"冒険者").slice(0,12);ctx.save();ctx.font="11px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.lineJoin="round";ctx.lineWidth=3;ctx.strokeStyle="#3a302b";ctx.strokeText(label,q.x,q.y-79);ctx.fillStyle="#fff3d1";ctx.fillText(label,q.x,q.y-79);ctx.restore();}
  function applyStorybookTexture(){
    // Restrained pixel-art finish: no blur, gradients, or watercolor overlay.
    ctx.save();ctx.globalAlpha=.08;for(let i=0;i<180;i++){const x=(i*97)%W,y=(i*53)%H;rect(x,y,2,2,i%2?"#f4e5bf":"#3b4e38");}ctx.restore();
  }

  // 3D anime fantasy renderer: the world coordinates and gameplay remain unchanged.
  function isoProject(wx,wy,z=0){
    const dx=wx-camera.x,dy=wy-camera.y;
    return {x:Math.round(W/2+(dx-dy)*.34),y:Math.round(H/2+(dx+dy)*.17-z)};
  }
  function isoPoly(points,fill,stroke=null,line=1){
    ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
    ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}
  }
  function isoDiamond(x,y,rx,ry,fill,stroke=null){
    isoPoly([{x:x,y:y-ry},{x:x+rx,y:y},{x:x,y:y+ry},{x:x-rx,y:y}],fill,stroke,1);
  }
  function drawAnimeGround(){
    const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,"#a9d9ef");sky.addColorStop(.58,"#d7eddf");sky.addColorStop(1,"#a6cf8d");ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    // distant soft hills
    for(let i=0;i<5;i++){const y=175+i*34;ctx.beginPath();ctx.moveTo(0,y+80);for(let x=0;x<=W;x+=24)ctx.lineTo(x,y+Math.sin((x+i*113)/105)*18+Math.cos(x/190)*13);ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fillStyle=["#9fc78e","#8fbd7e","#82b275","#78a96c","#6e9f62"][i];ctx.fill();}
    const left=Math.floor((camera.x-1700)/64),right=Math.ceil((camera.x+1700)/64);
    const top=Math.floor((camera.y-1700)/64),bottom=Math.ceil((camera.y+1700)/64);
    for(let gy=top;gy<=bottom;gy++)for(let gx=left;gx<=right;gx++){
      const p=isoProject(gx*64,gy*64),v=hash(gx,gy);
      isoDiamond(p.x,p.y,22,11,["#7eb96c","#86c276","#91c77e","#78b365"][Math.floor(v*4)]);
      if(v>.77){ctx.fillStyle="#b5d78c";ctx.beginPath();ctx.ellipse(p.x-5,p.y-2,3,1.5,-.3,0,Math.PI*2);ctx.fill();}
      if(v>.94){ctx.fillStyle="#f5e5a2";ctx.beginPath();ctx.arc(p.x+5,p.y-3,2,0,Math.PI*2);ctx.fill();}
    }
    // river and its sandy banks, projected into the isometric world
    const river=[];for(let y=420;y<=2520;y+=48)river.push(isoProject(390+Math.sin(y/155)*65+Math.sin(y/83)*13,y));
    const strokePath=(pts,color,width)=>{ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke();};
    strokePath(river,"#9b8a62",94);strokePath(river,"#d2bd88",82);strokePath(river,"#3b9db8",68);strokePath(river,"#70c7d2",55);
    river.forEach((p,i)=>{ctx.strokeStyle="rgba(225,250,245,.55)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x-14+(i%3)*4,p.y-4);ctx.lineTo(p.x+10,p.y-7);ctx.stroke();});
    const road=(pts,w)=>{strokePath(pts,"#9c754c",w+10);strokePath(pts,"#d7b77d",w);strokePath(pts,"#ecd5a1",Math.max(3,w*.12));};
    road([isoProject(1600,430),isoProject(1600,2370)],46);
    road([isoProject(650,1320),isoProject(2660,1320)],46);
    road([isoProject(1600,1320),isoProject(1100,900)],25);
    road([isoProject(1600,1320),isoProject(2050,900)],25);
    road([isoProject(1600,1320),isoProject(2050,1800)],25);
    const plaza=isoProject(1600,1320);
    isoDiamond(plaza.x,plaza.y+3,105,53,"#9e8b6d");
    isoDiamond(plaza.x,plaza.y,99,49,"#d9c69a");
    isoDiamond(plaza.x,plaza.y-2,87,43,"#eadbb8","#b59b70",2);
    for(let i=0;i<24;i++){const a=i*Math.PI/12;const x=plaza.x+Math.cos(a)*77,y=plaza.y+Math.sin(a)*37;isoDiamond(x,y,4,2,i%2?"#f4e9cb":"#b8a17a");}
    // fountain
    isoDiamond(plaza.x,plaza.y-8,27,14,"#8c9a9b");
    isoDiamond(plaza.x,plaza.y-13,23,12,"#d5e2d9");
    isoDiamond(plaza.x,plaza.y-17,18,9,"#52b6c7");
    ctx.fillStyle="#e9fbf3";ctx.beginPath();ctx.arc(plaza.x-5,plaza.y-21,3,0,Math.PI*2);ctx.fill();
  }
  function drawAnimeHouse(b,index=0){
    const x=b.x+b.w/2,y=b.y+b.h/2,w=b.w,h=b.h;
    const c1=isoProject(x-w/2,y-h/2),c2=isoProject(x+w/2,y-h/2),c3=isoProject(x+w/2,y+h/2),c4=isoProject(x-w/2,y+h/2);
    if(c1.x<-250&&c2.x<-250&&c3.x<-250&&c4.x<-250)return;
    const height=48+Math.min(30,h*.12),top=[{x:c1.x,y:c1.y-height},{x:c2.x,y:c2.y-height},{x:c3.x,y:c3.y-height},{x:c4.x,y:c4.y-height}];
    isoDiamond((c1.x+c2.x+c3.x+c4.x)/4,(c1.y+c2.y+c3.y+c4.y)/4+5,(w+h)*.17,(w+h)*.085,"rgba(48,72,49,.25)");
    // walls with warm, shaded sides
    isoPoly([c2,c3,{x:c3.x,y:c3.y-height},{x:c2.x,y:c2.y-height}],"#a86e4b","#76503c",2);
    isoPoly([c4,c3,{x:c3.x,y:c3.y-height},{x:c4.x,y:c4.y-height}],"#e7c99b","#9a704e",2);
    // roof silhouette and two lit roof planes
    const ridgeA={x:(c1.x+c2.x)/2,y:(c1.y+c2.y)/2-height-42},ridgeB={x:(c3.x+c4.x)/2,y:(c3.y+c4.y)/2-height-42};
    isoPoly([ridgeA,{x:c1.x-9,y:c1.y-height-8},{x:c4.x-9,y:c4.y-height-8},ridgeB],"#75483f","#593b37",2);
    isoPoly([ridgeA,{x:c2.x+9,y:c2.y-height-8},{x:c3.x+9,y:c3.y-height-8},ridgeB],"#bd6250","#82463e",2);
    isoPoly([{x:c1.x-9,y:c1.y-height-8},ridgeA,ridgeB,{x:c4.x-9,y:c4.y-height-8}],"#e18b68","#a75a49",1);
    // roof tiles
    for(let k=0;k<4;k++){const t=(k+1)/5;ctx.strokeStyle="rgba(255,211,165,.55)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(ridgeA.x+(ridgeB.x-ridgeA.x)*t-12,ridgeA.y+(ridgeB.y-ridgeA.y)*t+9);ctx.lineTo(ridgeA.x+(ridgeB.x-ridgeA.x)*t+12,ridgeA.y+(ridgeB.y-ridgeA.y)*t+9);ctx.stroke();}
    // entrance, windows, trim
    const mid={x:(c3.x+c4.x)/2,y:(c3.y+c4.y)/2-height*.55};
    ctx.fillStyle="#543a32";ctx.beginPath();ctx.ellipse(mid.x,mid.y+18,9,17,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#986343";ctx.fillRect(mid.x-6,mid.y+7,12,26);
    const win={x:(c2.x+c3.x)/2-13,y:(c2.y+c3.y)/2-height*.64};
    ctx.fillStyle="#68483a";ctx.fillRect(win.x-2,win.y-2,19,22);ctx.fillStyle="#83c6d0";ctx.fillRect(win.x,win.y,15,18);ctx.fillStyle="#fff0c4";ctx.fillRect(win.x+6,win.y,3,18);ctx.fillRect(win.x,win.y+8,15,3);
    ctx.fillStyle="#f8e5b9";ctx.font="bold 12px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.lineWidth=3;ctx.strokeStyle="#65463a";ctx.strokeText(b.name,mid.x,Math.min(c1.y,c2.y)-height-52);ctx.fillText(b.name,mid.x,Math.min(c1.y,c2.y)-height-52);
  }
  function drawAnimeTree(wx,wy,index=0){
    const p=isoProject(wx,wy);if(p.x<-100||p.x>W+100||p.y<-180||p.y>H+100)return;
    const r=18+(index%3)*3;
    isoDiamond(p.x,p.y+2,r+8,(r+8)*.48,"rgba(44,74,43,.28)");
    ctx.fillStyle="#79533a";ctx.beginPath();ctx.moveTo(p.x-7,p.y);ctx.lineTo(p.x-4,p.y-44);ctx.lineTo(p.x+5,p.y-44);ctx.lineTo(p.x+8,p.y);ctx.closePath();ctx.fill();
    const colors=["#367d50","#47965a","#5baa65","#79bd72"];
    [[-13,-51,22], [8,-61,24],[-3,-78,25],[-23,-70,19],[20,-43,18]].forEach((v,i)=>{ctx.fillStyle=colors[(i+index)%4];ctx.beginPath();ctx.ellipse(p.x+v[0],p.y+v[1],v[2],v[2]*.83,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgba(203,239,151,.25)";ctx.beginPath();ctx.ellipse(p.x+v[0]-v[2]*.28,p.y+v[1]-v[2]*.3,v[2]*.35,v[2]*.2,-.5,0,Math.PI*2);ctx.fill();});
  }
  function drawAnimePerson(p,isPlayer=false,screenSpace=false){
    const q=screenSpace?{x:p.x,y:p.y}:isoProject(p.x,p.y);if(q.x<-80||q.x>W+80||q.y<-100||q.y>H+100)return;
    const moving=!!p.moving,phase=moving?Math.sin((p.walkClock||0)*10):0,step=phase*4;
    const skin={"明るい肌":"#f2c9a5","普通の肌":"#dca77f","褐色肌":"#b97858","色白":"#f5d9c2"}[p.skin]||"#f0c6a0";
    const hair={"栗色":"#70442f","金髪":"#e2b85c","黒髪":"#302a35","銀髪":"#c4cbd0","茶色":"#89543a","赤髪":"#a84e42","青髪":"#4e79a4","緑髪":"#58804c"}[p.hair]||"#70442f";
    const cloth=p.outfit||p.color||"#507fb3";
    ctx.save();ctx.translate(q.x,q.y);
    isoDiamond(0,3,16,8,"rgba(45,70,47,.35)");
    // boots and legs, animated without rotating the upright body
    ctx.fillStyle="#5a4036";ctx.beginPath();ctx.ellipse(-5+step*.35,-9,5,11,.1,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(5-step*.35,-9,5,11,-.1,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#7d533c";ctx.beginPath();ctx.ellipse(-6+step*.35,-1,6,3,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(5-step*.35,-1,6,3,0,0,Math.PI*2);ctx.fill();
    // tunic and sleeves
    ctx.fillStyle="#493a3b";ctx.beginPath();ctx.moveTo(-13,-35);ctx.quadraticCurveTo(-17,-18,-11,-12);ctx.lineTo(11,-12);ctx.quadraticCurveTo(17,-20,13,-35);ctx.closePath();ctx.fill();
    ctx.fillStyle=cloth;ctx.beginPath();ctx.moveTo(-11,-35);ctx.quadraticCurveTo(-14,-20,-9,-14);ctx.lineTo(9,-14);ctx.quadraticCurveTo(14,-20,11,-35);ctx.closePath();ctx.fill();
    ctx.fillStyle="rgba(255,255,255,.3)";ctx.beginPath();ctx.moveTo(-8,-32);ctx.lineTo(-2,-32);ctx.lineTo(-2,-16);ctx.lineTo(-8,-17);ctx.closePath();ctx.fill();
    ctx.fillStyle=skin;ctx.beginPath();ctx.ellipse(-13+step*.2,-24,4,8,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(13-step*.2,-24,4,8,0,0,Math.PI*2);ctx.fill();
    // neck and oversized anime head
    ctx.fillStyle=skin;ctx.fillRect(-4,-43,8,9);
    ctx.fillStyle="rgba(49,40,42,.25)";ctx.beginPath();ctx.ellipse(0,-51,15,17,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=skin;ctx.beginPath();ctx.ellipse(0,-55,14,16,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=hair;ctx.beginPath();ctx.moveTo(-14,-57);ctx.quadraticCurveTo(-17,-78,0,-76);ctx.quadraticCurveTo(17,-77,14,-54);ctx.lineTo(8,-62);ctx.lineTo(3,-55);ctx.lineTo(-3,-64);ctx.lineTo(-9,-54);ctx.closePath();ctx.fill();
    const side=p.dir==="left"||p.dir==="right",back=p.dir==="up";
    if(!back){const ex=side?(p.dir==="left"?-5:5):5;ctx.fillStyle="#fff9e9";ctx.beginPath();ctx.ellipse(ex,-55,3.3,4.5,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#43536a";ctx.beginPath();ctx.arc(ex,-54,2,0,Math.PI*2);ctx.fill();ctx.fillStyle="#493a37";ctx.beginPath();ctx.arc(side?ex: -5,-54,1.2,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#9a6250";ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(side?ex:0,-48,3,.2,1.7);ctx.stroke();}
    if(p.accessory==="帽子"){ctx.fillStyle="#8c5946";ctx.beginPath();ctx.ellipse(0,-70,17,5,0,0,Math.PI*2);ctx.fill();ctx.fillRect(-10,-80,20,11);}
    if(p.accessory==="マント"){ctx.fillStyle="#78639a";ctx.beginPath();ctx.moveTo(-11,-35);ctx.lineTo(-17,-9);ctx.lineTo(17,-9);ctx.lineTo(11,-35);ctx.closePath();ctx.fill();}
    if(isPlayer){ctx.fillStyle="#f5d17b";ctx.beginPath();ctx.arc(11,-29,3,0,Math.PI*2);ctx.fill();}
    ctx.restore();
    if(p.name){ctx.font="bold 11px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.lineWidth=3;ctx.strokeStyle="#355044";ctx.strokeText(p.name,q.x,q.y-91);ctx.fillStyle="#fff8df";ctx.fillText(p.name,q.x,q.y-91);}
  }
  function drawAnimeDecor(item){
    const [type,wx,wy]=item,p=isoProject(wx,wy);if(p.x<-50||p.x>W+50||p.y<-70||p.y>H+70)return;
    if(type==="flower"){isoDiamond(p.x,p.y+2,7,3,"#4b9650");ctx.fillStyle="#f4b4c1";ctx.beginPath();ctx.arc(p.x,p.y-7,4,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f4dc8d";ctx.beginPath();ctx.arc(p.x,p.y-7,1.5,0,Math.PI*2);ctx.fill();}
    else if(type==="lamp"){ctx.fillStyle="#6b4936";ctx.fillRect(p.x-2,p.y-35,4,36);ctx.fillStyle="#e8b75e";ctx.beginPath();ctx.arc(p.x,p.y-39,8,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff0ad";ctx.beginPath();ctx.arc(p.x,p.y-39,4,0,Math.PI*2);ctx.fill();}
    else if(type==="bench"){ctx.fillStyle="#714b35";ctx.fillRect(p.x-17,p.y-13,34,6);ctx.fillRect(p.x-14,p.y-7,4,10);ctx.fillRect(p.x+10,p.y-7,4,10);}
    else if(type==="crate"||type==="barrel"){ctx.fillStyle="#a97848";ctx.fillRect(p.x-9,p.y-17,18,18);ctx.strokeStyle="#e0b879";ctx.strokeRect(p.x-9,p.y-17,18,18);}
    else if(type==="stall"){ctx.fillStyle="#85523d";ctx.fillRect(p.x-19,p.y-15,38,16);ctx.fillStyle="#e9b66c";ctx.beginPath();ctx.moveTo(p.x-23,p.y-15);ctx.lineTo(p.x,p.y-28);ctx.lineTo(p.x+23,p.y-15);ctx.closePath();ctx.fill();}
    else if(type==="sign"){ctx.fillStyle="#76503b";ctx.fillRect(p.x-2,p.y-29,4,30);ctx.fillStyle="#d9b77c";ctx.fillRect(p.x-14,p.y-31,28,13);}
  }
  function drawAnimeInterior(){
    const b=interior?.building;if(!b)return;
    const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#8ab9c2");bg.addColorStop(1,"#d7bd8d");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    // warm timber room with a deep perspective floor
    isoPoly([{x:80,y:85},{x:880,y:85},{x:820,y:380},{x:140,y:380}],"#d8bd91","#79533b",5);
    isoPoly([{x:80,y:85},{x:480,y:25},{x:880,y:85},{x:820,y:380},{x:140,y:380}],"#e9d3aa","#936d4c",3);
    ctx.fillStyle="#9b6b49";ctx.fillRect(90,100,780,260);
    for(let x=110;x<860;x+=74){ctx.fillStyle="#bd8b5d";ctx.fillRect(x,100,10,260);ctx.fillStyle="rgba(255,232,186,.35)";ctx.fillRect(x+2,100,3,260);}
    isoPoly([{x:60,y:355},{x:900,y:355},{x:960,y:600},{x:0,y:600}],"#a9774d","#71482f",4);
    for(let y=390;y<590;y+=38){ctx.strokeStyle="rgba(238,198,137,.5)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(20,y);ctx.lineTo(940,y);ctx.stroke();}
    ctx.fillStyle="#684631";ctx.fillRect(120,145,150,105);ctx.fillStyle="#8ac6d0";ctx.fillRect(130,155,130,85);ctx.fillStyle="#f5dfae";ctx.fillRect(192,155,6,85);ctx.fillRect(130,194,130,6);
    ctx.fillStyle="#69452f";ctx.fillRect(350,290,260,22);ctx.fillStyle="#c08a52";ctx.fillRect(360,274,240,20);
    if(b.type==="forge"){ctx.fillStyle="#51423b";ctx.fillRect(690,225,150,180);ctx.fillStyle="#d96e3c";ctx.beginPath();ctx.ellipse(765,360,55,35,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#ffd27a";ctx.beginPath();ctx.ellipse(765,352,30,21,0,0,Math.PI*2);ctx.fill();}
    else if(b.type==="inn"){ctx.fillStyle="#69462f";ctx.fillRect(650,285,210,75);ctx.fillStyle="#d2a66c";ctx.fillRect(660,275,190,35);}
    else if(b.type==="shop"||b.type==="market"){for(let i=0;i<4;i++){ctx.fillStyle="#84543a";ctx.fillRect(90+i*200,300,140,60);ctx.fillStyle=i%2?"#d98c58":"#e2b56f";ctx.fillRect(94+i*200,286,132,16);}}
    else {ctx.fillStyle="#795238";ctx.fillRect(180,300,600,54);ctx.fillStyle="#c28c55";ctx.fillRect(190,285,580,24);}
    ctx.fillStyle="#fff3d4";ctx.font="bold 22px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.fillText(b.name,480,66);
    ctx.fillStyle="#64452f";ctx.font="14px 'Noto Sans JP',sans-serif";ctx.fillText("Eキー / 操作ボタン：外へ出る",480,550);
    drawAnimePerson(player,true);
  }
  function drawAnimeBattle(){
    const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#8ac9e5");bg.addColorStop(.55,"#d4e9ce");bg.addColorStop(1,"#9dc47c");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    // layered hills and distant fantasy forest
    for(let i=0;i<4;i++){ctx.fillStyle=["#a6ce9a","#8fbd80","#7eae70","#6d9e63"][i];ctx.beginPath();ctx.moveTo(0,280+i*38);for(let x=0;x<=W;x+=20)ctx.lineTo(x,250+i*38+Math.sin(x/110+i)*18);ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fill();}
    for(let i=0;i<12;i++){const x=i*88+20,y=350+(i%3)*15;ctx.fillStyle="#79513a";ctx.fillRect(x-5,y-42,10,48);ctx.fillStyle="#438c56";ctx.beginPath();ctx.arc(x,y-53,24,0,Math.PI*2);ctx.fill();ctx.fillStyle="#72b96c";ctx.beginPath();ctx.arc(x-8,y-63,13,0,Math.PI*2);ctx.fill();}
    isoPoly([{x:0,y:425},{x:960,y:425},{x:960,y:600},{x:0,y:600}],"#bd9862");
    for(let i=0;i<32;i++){const x=(i*97)%960,y=440+(i*43)%155;ctx.fillStyle=i%2?"#d9b67c":"#a77e50";ctx.beginPath();ctx.ellipse(x,y,22,6,0,0,Math.PI*2);ctx.fill();}
    // raised rounded player status panel
    ctx.fillStyle="rgba(47,65,59,.35)";ctx.beginPath();ctx.roundRect(18,18,270,144,18);ctx.fill();ctx.fillStyle="#fff4df";ctx.beginPath();ctx.roundRect(12,12,270,144,18);ctx.fill();ctx.strokeStyle="#b88b58";ctx.lineWidth=4;ctx.stroke();
    ctx.fillStyle="#584333";ctx.textAlign="left";ctx.font="bold 17px 'Noto Sans JP',sans-serif";ctx.fillText("冒険者",32,43);
    ctx.font="14px 'Noto Sans JP',sans-serif";ctx.fillText("HP  "+battle.hp+" / "+battle.maxHp,32,73);ctx.fillText("MP  "+battle.mp+" / "+battle.maxMp,32,101);
    const bar=(x,y,w,v,max,color)=>{ctx.fillStyle="#77634d";ctx.beginPath();ctx.roundRect(x,y,w,10,5);ctx.fill();ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x+2,y+2,(w-4)*Math.max(0,v/max),6,3);ctx.fill();};
    bar(32,80,210,battle.hp,battle.maxHp,"#d75c58");bar(32,108,210,battle.mp,battle.maxMp,"#4b9fca");
    drawAnimePerson({...player,x:battle.playerX,y:438-battle.playerY,moving:false},true,true);
    battle.enemies.forEach((e,i)=>{if(e.hp<=0)return;const ex=650+(i%3)*92,ey=420-Math.floor(i/3)*72;
      ctx.fillStyle="rgba(48,60,45,.25)";ctx.beginPath();ctx.ellipse(ex,ey+9,e.boss?43:31,10,0,0,Math.PI*2);ctx.fill();
      if(e.name.includes("スライム")){ctx.fillStyle="#328d9c";ctx.beginPath();ctx.ellipse(ex,ey-14,30,26,0,Math.PI,Math.PI*2);ctx.quadraticCurveTo(ex+30,ey+12,ex,ey+13);ctx.quadraticCurveTo(ex-30,ey+12,ex-30,ey-14);ctx.fill();ctx.fillStyle="#a7e3d9";ctx.beginPath();ctx.ellipse(ex-8,ey-29,12,6,-.3,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(ex-9,ey-13,5,0,Math.PI*2);ctx.arc(ex+9,ey-13,5,0,Math.PI*2);ctx.fill();ctx.fillStyle="#35545c";ctx.beginPath();ctx.arc(ex-8,ey-12,2,0,Math.PI*2);ctx.arc(ex+10,ey-12,2,0,Math.PI*2);ctx.fill();}
      else{ctx.fillStyle=e.color;ctx.beginPath();ctx.ellipse(ex,ey-23,25,32,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff3d9";ctx.beginPath();ctx.arc(ex-9,ey-29,5,0,Math.PI*2);ctx.arc(ex+9,ey-29,5,0,Math.PI*2);ctx.fill();ctx.fillStyle="#463a36";ctx.beginPath();ctx.arc(ex-8,ey-28,2,0,Math.PI*2);ctx.arc(ex+10,ey-28,2,0,Math.PI*2);ctx.fill();if(e.boss){ctx.fillStyle="#d2a45f";ctx.beginPath();ctx.moveTo(ex-18,ey-49);ctx.lineTo(ex-30,ey-73);ctx.lineTo(ex-5,ey-55);ctx.moveTo(ex+18,ey-49);ctx.lineTo(ex+30,ey-73);ctx.lineTo(ex+5,ey-55);ctx.fill();}}
      ctx.fillStyle="#514035";ctx.font="bold 12px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.fillText(e.name,ex,ey-76);bar(ex-32,ey-65,64,e.hp,e.maxHp,"#d75c58");
    });
    if(battle.defending){ctx.strokeStyle="#a8e9ee";ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(battle.playerX,416-battle.playerY,34,53,0,0,Math.PI*2);ctx.stroke();}
    if(battleMessage&&performance.now()<battleMessageUntil){ctx.fillStyle="rgba(40,52,48,.5)";ctx.beginPath();ctx.roundRect(250,210,460,58,15);ctx.fill();ctx.fillStyle="#fff3db";ctx.beginPath();ctx.roundRect(255,205,450,48,12);ctx.fill();ctx.fillStyle="#514035";ctx.textAlign="center";ctx.font="bold 18px 'Noto Sans JP',sans-serif";ctx.fillText(battleMessage,480,235);}
  }


  // Candidate 5: clean, flat 2D top-down fantasy world.
  function flatHouse(b,index){
    const p=project(b.x+b.w/2,b.y+b.h/2),x=p.x,y=p.y;
    const w=Math.max(66,b.w*.72),h=Math.max(54,b.h*.62);
    if(x<-w-40||x>W+w+40||y<-h-50||y>H+h+50)return;
    const palettes={guild:["#b96c56","#e8c99b"],forge:["#77716b","#c7b5a0"],inn:["#c87962","#f0d5a9"],market:["#d2a65e","#f3dfb7"],farm:["#879b62","#e4d5a8"],bank:["#6e9a9c","#e4e0c8"],home:["#c58b69","#f0d8b5"],shop:["#8191b2","#eee0c5"]};
    const [roof,wall]=palettes[b.type]||palettes.home;
    ellipse(x,y+h*.42,w*.55,10,"#66835b");
    // A simple roof footprint, with a small front-facing entrance.
    ctx.fillStyle="#6f5142";ctx.fillRect(x-w/2,y-h/2,w,h);
    ctx.fillStyle=wall;ctx.fillRect(x-w/2+5,y-h/2+5,w-10,h-10);
    ctx.fillStyle=roof;ctx.fillRect(x-w/2-4,y-h/2-5,w+8,h*.67);
    ctx.fillStyle="rgba(255,255,255,.18)";ctx.fillRect(x-w/2+3,y-h/2-2,w-6,5);
    ctx.fillStyle="#684b3c";ctx.fillRect(x-9,y+h*.13,18,h*.25);
    ctx.fillStyle="#a9d6d2";ctx.fillRect(x-w*.29,y-h*.23,13,13);ctx.fillRect(x+w*.18,y-h*.23,13,13);
    ctx.fillStyle="#fff4d9";ctx.font="bold 10px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.fillText(b.name,x,y+h*.48);
  }
  function flatTree(wx,wy,index){
    const p=project(wx,wy),x=p.x,y=p.y;if(x<-50||x>W+50||y<-55||y>H+55)return;
    ellipse(x,y+5,19,7,"#5f8754");
    ctx.fillStyle="#80583e";ctx.fillRect(x-4,y-7,8,15);
    const colors=["#4f9862","#65a96a","#78b879"];const r=18+(index%3)*2;
    ellipse(x,y-17,r,r*.82,colors[index%3]);
    ellipse(x-r*.35,y-19,r*.55,r*.5,colors[(index+1)%3]);
    ellipse(x+r*.32,y-20,r*.58,r*.52,colors[(index+2)%3]);
    ellipse(x-5,y-27,5,3,"#a4d18a");
  }
  function flatPerson(p,isPlayer=false){
    const q=project(p.x,p.y),x=q.x,y=q.y;if(x<-30||x>W+30||y<-45||y>H+35)return;
    const moving=!!p.moving,step=moving?Math.sin((p.walkClock||0)*12)*3:0;
    ellipse(x,y+7,11,4,"rgba(40,65,45,.24)");
    ctx.fillStyle="#57483d";
    ctx.fillRect(x-5+step,y-1,4,9);ctx.fillRect(x+2-step,y-1,4,9);
    ctx.fillStyle=isPlayer?(p.outfit||"#527fa4"):(p.color||"#b77b68");
    ctx.beginPath();ctx.roundRect(x-9,y-17,18,19,5);ctx.fill();
    ctx.fillStyle=p.skinColor||"#f0c59d";ellipse(x,y-20,7,7,"#f0c59d");
    ctx.fillStyle=p.hairColor||"#76533f";ctx.beginPath();ctx.arc(x,y-22,7,Math.PI,Math.PI*2);ctx.fill();
    // Direction marker keeps the facing direction readable without rotating the whole body.
    const dir=p.dir||"down";ctx.fillStyle="#fff0ca";
    if(dir==="up")ctx.fillRect(x-2,y-28,4,3);
    else if(dir==="left")ctx.fillRect(x-8,y-21,3,4);
    else if(dir==="right")ctx.fillRect(x+5,y-21,3,4);
    else {ctx.fillStyle="#443b35";ctx.fillRect(x-3,y-20,2,2);ctx.fillRect(x+2,y-20,2,2);}
    if(isPlayer){ctx.fillStyle="#f5df83";ctx.beginPath();ctx.moveTo(x,y-35);ctx.lineTo(x-5,y-29);ctx.lineTo(x+5,y-29);ctx.fill();}
  }
  function flatInterior(){
    ctx.fillStyle="#d9c7a6";ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#b58d68";ctx.fillRect(34,34,892,532);
    ctx.fillStyle="#ead9b8";ctx.fillRect(48,48,864,500);
    ctx.fillStyle="#c6a078";ctx.fillRect(75,85,810,105);
    ctx.fillStyle="#8a6045";ctx.fillRect(345,245,270,95);
    ctx.fillStyle="#d5b17b";ctx.fillRect(355,255,250,75);
    ctx.fillStyle="#73513d";ctx.fillRect(440,360,80,125);
    ctx.fillStyle="#f0d9ae";ctx.font="bold 22px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.fillText(interior?.building?.name||"室内",480,115);
    flatPerson({...player,x:1600,y:1300,dir:"down"},true);
    ctx.fillStyle="#5b4939";ctx.font="14px 'Noto Sans JP',sans-serif";ctx.fillText("操作ボタンで外へ出る",480,530);
  }
  function flatBattle(){
    ctx.fillStyle="#b8d9d0";ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#8fc18a";ctx.fillRect(0,300,W,300);
    for(let i=0;i<8;i++){ctx.fillStyle=i%2?"#7bb579":"#9bc98e";ellipse(70+i*125,350+(i%3)*35,65,20,"#7bb579");}
    flatPerson({...player,x:0,y:0,dir:"right"},true);
    // Battle actors remain in the established side-view battle coordinates.
    drawBattle();
  }
  function render(){
    ctx.clearRect(0,0,W,H);
    if(battle){drawBattle();return;}
    if(interior){drawInterior();return;}
    drawGround();
    const objects=[];
    // Hand-painted picture-book scenery: leafy trees, flower patches and stones.
    for(let i=0;i<78;i++){
      const x=70+Math.floor(hash(i,23)*2860),y=90+Math.floor(hash(i,31)*2540);
      if(Math.hypot(x-1600,y-1320)<490||buildings.some(b=>x>b.x-110&&x<b.x+b.w+110&&y>b.y-110&&y<b.y+b.h+110))continue;
      objects.push({depth:y,draw:()=>drawTree(x,y,i)});
    }
    buildings.forEach((b,i)=>objects.push({depth:b.y+b.h,draw:()=>drawHouse(b,i)}));
    townDecor.forEach(item=>objects.push({depth:item[2]+4,draw:()=>drawTownDecor(item)}));
    objects.push({depth:1325,draw:()=>drawFountain(1600,1320)});
    npcs.forEach(n=>objects.push({depth:n.y,draw:()=>drawStorybookPersonAt(project(n.x,n.y).x,project(n.x,n.y).y,n,false,1.0)}));
    for(const p of others.values()){const q=project(p.x,p.y);objects.push({depth:p.y,draw:()=>drawStorybookPersonAt(q.x,q.y,p,false,1.0)});}
    const pq=project(player.x,player.y);
    objects.push({depth:player.y,draw:()=>drawStorybookPersonAt(pq.x,pq.y,player,true,1.12)});
    fieldEnemies.filter(e=>e.alive&&e.hp>0).forEach(e=>objects.push({depth:e.y,draw:()=>{
      const q=project(e.x,e.y);ellipse(q.x,q.y+7,19,6,"#587b4b");
      if(e.name.includes("スライム")){ellipse(q.x,q.y-8,18,15,"#72bcb0");ellipse(q.x-6,q.y-11,4,5,"#fff0cf");ellipse(q.x+6,q.y-11,4,5,"#fff0cf");}
      else if(e.name.includes("ウルフ")){ellipse(q.x,q.y-12,17,12,"#777b83");}
      else{ellipse(q.x,q.y-12,15,17,e.boss?"#98704b":"#7b9a62");}
    }}));
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

  // Candidate 2: hand-painted 2D side-view fantasy illustration.
  function sideProject(wx,wy){return {x:Math.round(W/2+(wx-camera.x)*.56),y:Math.round(430+(wy-camera.y)*.105)};}
  function sidePath(points,fill,stroke=null,line=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}}
  function sideEllipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
  function drawPaintedLandscape(){
    const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,"#91c6df");sky.addColorStop(.55,"#d7e5d0");sky.addColorStop(1,"#e9d5ad");ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    // Soft, layered distant hills
    for(let layer=0;layer<4;layer++){ctx.beginPath();ctx.moveTo(0,220+layer*38);for(let x=0;x<=W;x+=18){const y=210+layer*37+Math.sin(x/(105+layer*23)+layer)*22+Math.cos(x/180+layer)*12;ctx.lineTo(x,y);}ctx.lineTo(W,430);ctx.lineTo(0,430);ctx.closePath();ctx.fillStyle=["#a8c9a5","#91b98c","#7da778","#70996b"][layer];ctx.fill();}
    // distant village silhouettes and clouds
    for(let i=0;i<8;i++){const x=((i*157-camera.x*.08)%1120+1120)%1120-80,y=260+(i%3)*23;ctx.fillStyle="#8a9e83";ctx.fillRect(x,y-32,62,65);sidePath([{x:x-8,y:y-32},{x:x+31,y:y-62},{x:x+70,y:y-32}],"#9b7565");}
    for(let i=0;i<5;i++){const x=((i*241-camera.x*.035)%1100+1100)%1100-40,y=72+(i%3)*33;sideEllipse(x,y,34,10,"rgba(255,255,245,.55)");sideEllipse(x+23,y-5,25,13,"rgba(255,255,245,.55)");}
    // foreground grassland with painterly strokes
    const ground=ctx.createLinearGradient(0,380,0,H);ground.addColorStop(0,"#8ab477");ground.addColorStop(.45,"#719b60");ground.addColorStop(1,"#527b4c");ctx.fillStyle=ground;ctx.fillRect(0,390,W,210);
    for(let i=0;i<90;i++){const x=(i*83+((camera.x*.12)%83))%1000,y=407+(i*47)%180;ctx.strokeStyle=i%2?"rgba(205,220,143,.55)":"rgba(45,92,57,.38)";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-3+(i%7),y-5-(i%5));ctx.stroke();}
    // winding river visible as a painted horizontal ribbon
    ctx.beginPath();ctx.moveTo(0,330);for(let x=0;x<=W;x+=20)ctx.lineTo(x,327+Math.sin((x+camera.x*.08)/115)*12);ctx.lineTo(W,376);for(let x=W;x>=0;x-=20)ctx.lineTo(x,373+Math.sin((x+camera.x*.08)/115)*12);ctx.closePath();ctx.fillStyle="#4e9fb2";ctx.fill();
    ctx.strokeStyle="rgba(226,245,225,.55)";ctx.lineWidth=3;for(let i=0;i<18;i++){const x=i*61;ctx.beginPath();ctx.moveTo(x,347+Math.sin((x+camera.x*.08)/115)*12);ctx.quadraticCurveTo(x+15,340,x+31,347);ctx.stroke();}
    // broad foreground path
    ctx.beginPath();ctx.moveTo(0,475);ctx.quadraticCurveTo(470,430,960,482);ctx.lineTo(960,535);ctx.quadraticCurveTo(470,482,0,535);ctx.closePath();ctx.fillStyle="#c9ad7d";ctx.fill();
    ctx.strokeStyle="rgba(255,232,184,.55)";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,481);ctx.quadraticCurveTo(470,437,960,488);ctx.stroke();
  }
  function drawPaintedHouse(b,index=0){
    const p=sideProject(b.x+b.w/2,b.y+b.h),w=Math.max(92,b.w*.55),h=90+Math.min(65,b.h*.28),x=p.x-w/2,y=p.y-h;
    if(x>W+200||x+w<-200||y>H+100||y<-260)return;
    // 建物を足元中央基準で縮小し、低解像度画面でも家が大きく見えすぎないようにする。
    ctx.save();ctx.translate(p.x*.45,p.y*.45);ctx.scale(.55,.55);
    sideEllipse(p.x,p.y+8,w*.58,13,"rgba(43,61,44,.24)");
    // stone foundation and plaster walls
    ctx.fillStyle="#796451";ctx.fillRect(x+5,y+48,w-10,h-48);
    ctx.fillStyle=index%3===0?"#e6cda5":index%3===1?"#d7b99a":"#e9d8b8";ctx.fillRect(x+10,y+28,w-20,h-32);
    ctx.fillStyle="rgba(255,250,222,.4)";ctx.fillRect(x+13,y+33,7,h-43);
    // timber beams and side shadow
    ctx.fillStyle="#78513b";ctx.fillRect(x+10,y+33,8,h-37);ctx.fillRect(x+w-18,y+33,8,h-37);ctx.fillRect(x+10,y+64,w-20,6);
    ctx.fillStyle="#b18a63";ctx.fillRect(x+20,y+h-19,w-40,9);
    // steep, illustrated roof
    sidePath([{x:x-13,y:y+37},{x:x+w*.5,y:y-35},{x:x+w+13,y:y+37},{x:x+w-5,y:y+45},{x:x+w*.5,y:y-17},{x:x+5,y:y+45}],"#744d49","#523b38",3);
    sidePath([{x:x-6,y:y+32},{x:x+w*.5,y:y-30},{x:x+w*.5,y:y-18},{x:x+6,y:y+40}],"#b86f60");
    sidePath([{x:x+w*.5,y:y-30},{x:x+w+6,y:y+32},{x:x+w-6,y:y+40},{x:x+w*.5,y:y-18}],"#965750");
    ctx.strokeStyle="rgba(241,185,144,.48)";ctx.lineWidth=2;for(let k=1;k<5;k++){const xx=x+w*.5+(w*.5)*(k/5);ctx.beginPath();ctx.moveTo(xx,y-20+(k*2));ctx.lineTo(xx,y+28);ctx.stroke();}
    // door, warm windows and flower boxes
    ctx.fillStyle="#583d32";ctx.fillRect(p.x-13,p.y-54,26,54);ctx.fillStyle="#9d704b";ctx.fillRect(p.x-9,p.y-50,18,50);sideEllipse(p.x+5,p.y-27,2,2,"#f2d18b");
    for(const wx of [x+w*.22,x+w*.72]){ctx.fillStyle="#62463a";ctx.fillRect(wx-12,y+60,25,30);ctx.fillStyle="#8bc3c5";ctx.fillRect(wx-9,y+63,19,23);ctx.fillStyle="#f8e3ad";ctx.fillRect(wx,y+63,3,23);ctx.fillRect(wx-9,y+73,19,3);ctx.fillStyle="#80563d";ctx.fillRect(wx-15,y+91,31,5);sideEllipse(wx-5,y+88,3,3,"#e8a5a0");sideEllipse(wx+5,y+87,3,3,"#f0d28b");}
    // chimney and smoke
    if(index%2===0){ctx.fillStyle="#98644d";ctx.fillRect(x+w*.72,y-42,14,38);for(let k=0;k<3;k++)sideEllipse(x+w*.77+k*7,y-53-k*9,7-k,5-k*.5,"rgba(247,244,222,.28)");}
    ctx.fillStyle="#fff4df";ctx.font="bold 12px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.lineWidth=3;ctx.strokeStyle="#654b3a";ctx.strokeText(b.name,p.x,y-48);ctx.fillText(b.name,p.x,y-48);
    ctx.restore();
  }
  function drawPaintedTree(wx,wy,index=0){
    const p=sideProject(wx,wy);if(p.x<-100||p.x>W+100||p.y<-160||p.y>H+100)return;
    const size=34+(index%4)*5;sideEllipse(p.x,p.y+3,size*.75,9,"rgba(40,65,43,.25)");
    ctx.fillStyle="#75523b";ctx.beginPath();ctx.moveTo(p.x-7,p.y);ctx.quadraticCurveTo(p.x-4,p.y-48,p.x-9,p.y-64);ctx.lineTo(p.x+9,p.y-64);ctx.quadraticCurveTo(p.x+6,p.y-28,p.x+8,p.y);ctx.closePath();ctx.fill();
    const leaves=["#477e50","#5b9257","#6d9e60","#82aa68"][index%4];
    [[-18,-69,25], [12,-79,27],[-2,-101,29],[-28,-94,20],[27,-54,20]].forEach((v,i)=>{sideEllipse(p.x+v[0],p.y+v[1],v[2],v[2]*.75,leaves);sideEllipse(p.x+v[0]-v[2]*.22,p.y+v[1]-v[2]*.28,v[2]*.35,v[2]*.18,"rgba(209,226,151,.3)");});
  }
  function drawPaintedPerson(p,isPlayer=false,screenSpace=false){
    const q=screenSpace?{x:p.x,y:p.y}:sideProject(p.x,p.y);if(q.x<-90||q.x>W+90||q.y<-140||q.y>H+120)return;
    const moving=!!p.moving,phase=moving?Math.sin((p.walkClock||0)*11):0,step=phase*7;
    const skin={"明るい肌":"#f0c6a3","普通の肌":"#d9a17c","褐色肌":"#ad7056","色白":"#f5d9c5"}[p.skin]||"#edc3a0";
    const hair={"栗色":"#70432f","金髪":"#d8ad5e","黒髪":"#342d32","銀髪":"#c6c9c6","茶色":"#8b563c","赤髪":"#a44e43","青髪":"#4d7091","緑髪":"#5b7d4c"}[p.hair]||"#70432f";
    const cloth=p.outfit||p.color||"#507fb3",side=p.dir==="left"||p.dir==="right",back=p.dir==="up";
    ctx.save();ctx.translate(q.x,q.y);ctx.scale(.55,.55);sideEllipse(0,3,17,6,"rgba(43,57,43,.3)");
    // legs, angled boots, and coat tails
    ctx.fillStyle="#584238";ctx.beginPath();ctx.moveTo(-7,-28);ctx.lineTo(-3+step,-5);ctx.lineTo(-12+step,-3);ctx.lineTo(-15,-25);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(5,-28);ctx.lineTo(9-step,-5);ctx.lineTo(1-step,-3);ctx.lineTo(-1,-25);ctx.closePath();ctx.fill();
    ctx.fillStyle="#8b5b40";ctx.beginPath();ctx.ellipse(-8+step,-3,8,4,-.1,0,Math.PI*2);ctx.ellipse(5-step,-3,8,4,.1,0,Math.PI*2);ctx.fill();
    sidePath([{x:-12,y:-63},{x:10,y:-61},{x:17,y:-28},{x:9,y:-24},{x:0,y:-37},{x:-8,y:-24},{x:-16,y:-29}],"#694b51");
    // torso, tunic and belt
    sidePath([{x:-12,y:-66},{x:9,y:-67},{x:15,y:-32},{x:9,y:-27},{x:-10,y:-27},{x:-16,y:-34}],cloth,"#68483d",2);
    ctx.fillStyle="rgba(255,241,210,.35)";ctx.beginPath();ctx.moveTo(-8,-63);ctx.lineTo(-2,-63);ctx.lineTo(-1,-31);ctx.lineTo(-9,-31);ctx.closePath();ctx.fill();
    ctx.fillStyle="#765039";ctx.fillRect(-12,-38,25,5);ctx.fillStyle="#e5bd72";ctx.fillRect(0,-39,5,7);
    // arms and hands swing with the stride
    ctx.strokeStyle=cloth;ctx.lineWidth=8;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-11,-60);ctx.lineTo(-15-step*.25,-42);ctx.moveTo(9,-60);ctx.lineTo(14+step*.25,-43);ctx.stroke();
    sideEllipse(-15-step*.25,-40,4,5,skin);sideEllipse(14+step*.25,-41,4,5,skin);
    // neck and head; face turns with travel direction
    ctx.fillStyle=skin;ctx.fillRect(-4,-76,9,13);sideEllipse(0,-88,14,17,skin);
    ctx.fillStyle=hair;ctx.beginPath();ctx.moveTo(-14,-91);ctx.quadraticCurveTo(-18,-113,0,-112);ctx.quadraticCurveTo(17,-112,14,-89);ctx.lineTo(7,-98);ctx.lineTo(1,-91);ctx.lineTo(-5,-100);ctx.lineTo(-10,-89);ctx.closePath();ctx.fill();
    if(!back){const eyeX=side?(p.dir==="left"?-7:7):5;sideEllipse(eyeX,-88,2.3,3.5,"#fff8e8");sideEllipse(eyeX,-87,1.2,2.2,"#46566b");ctx.strokeStyle="#a96854";ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(side?eyeX-2:-3,-79);ctx.quadraticCurveTo(0,-76,side?eyeX+3:3,-79);ctx.stroke();}
    if(p.accessory==="帽子"){ctx.fillStyle="#8a5945";ctx.beginPath();ctx.ellipse(0,-105,18,5,0,0,Math.PI*2);ctx.fill();ctx.fillRect(-11,-116,22,12);}
    if(p.accessory==="マント"){sidePath([{x:-10,y:-65},{x:-19,y:-29},{x:-9,y:-22},{x:1,y:-43}],"#75628d");}
    if(isPlayer){sideEllipse(12,-57,3,3,"#f3d17a");}
    ctx.restore();
    if(p.name){ctx.font="bold 7px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.lineWidth=2;ctx.strokeStyle="#425347";ctx.strokeText(p.name,q.x,q.y-68);ctx.fillStyle="#fff7e5";ctx.fillText(p.name,q.x,q.y-68);}
  }
  function drawPaintedDecor(item){
    const [type,wx,wy]=item,p=sideProject(wx,wy);if(p.x<-70||p.x>W+70||p.y<-100||p.y>H+100)return;
    if(type==="flower"){sideEllipse(p.x,p.y,6,2,"#477b4b");for(let i=0;i<5;i++){const a=i*Math.PI*2/5;sideEllipse(p.x+Math.cos(a)*4,p.y-8+Math.sin(a)*4,3,4,"#e6a6ae");}sideEllipse(p.x,p.y-8,2,2,"#f3d27e");}
    else if(type==="lamp"){ctx.fillStyle="#76513a";ctx.fillRect(p.x-2,p.y-54,4,55);sidePath([{x:p.x-12,y:p.y-51},{x:p.x,y:p.y-66},{x:p.x+12,y:p.y-51}],"#6d503c");sideEllipse(p.x,p.y-54,7,9,"#f5d28a");}
    else if(type==="bench"){ctx.fillStyle="#704a34";ctx.fillRect(p.x-21,p.y-19,42,7);ctx.fillRect(p.x-17,p.y-12,5,13);ctx.fillRect(p.x+12,p.y-12,5,13);}
    else if(type==="crate"||type==="barrel"){ctx.fillStyle="#a4774b";ctx.fillRect(p.x-12,p.y-25,24,25);ctx.strokeStyle="#e2bc7d";ctx.strokeRect(p.x-12,p.y-25,24,25);}
    else if(type==="stall"){ctx.fillStyle="#78503b";ctx.fillRect(p.x-24,p.y-33,48,33);sidePath([{x:p.x-29,y:p.y-33},{x:p.x,y:p.y-52},{x:p.x+29,y:p.y-33}],"#e4bd82");}
    else if(type==="sign"){ctx.fillStyle="#76513a";ctx.fillRect(p.x-2,p.y-44,4,44);ctx.fillStyle="#d8b77d";ctx.fillRect(p.x-18,p.y-46,36,18);}
  }
  function drawPaintedInterior(){
    const b=interior?.building;if(!b)return;
    const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#b8d3d3");bg.addColorStop(1,"#e8d4ad");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#c9a47a";ctx.fillRect(0,0,W,390);ctx.fillStyle="#876044";for(let x=0;x<W;x+=76)ctx.fillRect(x,0,9,390);
    ctx.fillStyle="#e8cfa5";ctx.fillRect(0,390,W,210);for(let y=410;y<600;y+=35){ctx.strokeStyle="rgba(120,80,48,.3)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    ctx.fillStyle="#5c4033";ctx.fillRect(90,105,160,120);ctx.fillStyle="#8bc3ca";ctx.fillRect(100,115,140,100);ctx.fillStyle="#f7e5bd";ctx.fillRect(168,115,5,100);ctx.fillRect(100,166,140,5);
    ctx.fillStyle="#7b5238";ctx.fillRect(310,315,340,22);ctx.fillStyle="#c28a55";ctx.fillRect(325,292,310,24);
    if(b.type==="forge"){ctx.fillStyle="#55443c";ctx.fillRect(700,170,125,240);sideEllipse(760,355,60,39,"#d56f3f");sideEllipse(760,350,32,25,"#ffd27c");}
    else if(b.type==="inn"){ctx.fillStyle="#754a31";ctx.fillRect(650,260,210,115);ctx.fillStyle="#d4aa70";ctx.fillRect(660,250,190,25);}
    else if(b.type==="shop"||b.type==="market"){for(let i=0;i<4;i++){ctx.fillStyle="#87563a";ctx.fillRect(70+i*205,290,150,85);ctx.fillStyle=i%2?"#d78c5c":"#e1b76f";ctx.fillRect(74+i*205,275,142,18);}}
    else {ctx.fillStyle="#795238";ctx.fillRect(170,305,620,65);ctx.fillStyle="#c18a53";ctx.fillRect(180,290,600,24);}
    ctx.fillStyle="#fff4df";ctx.font="bold 23px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.fillText(b.name,480,66);
    ctx.fillStyle="#64452f";ctx.font="14px 'Noto Sans JP',sans-serif";ctx.fillText("Eキー / 操作ボタン：外へ出る",480,550);
    drawPaintedPerson(player,true,true);
  }
  function drawPaintedBattle(){
    const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#9bc8dc");bg.addColorStop(.52,"#dce4c5");bg.addColorStop(1,"#789c61");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(0,270+i*28);for(let x=0;x<=W;x+=18)ctx.lineTo(x,245+i*28+Math.sin(x/110+i)*16);ctx.lineTo(W,450);ctx.lineTo(0,450);ctx.closePath();ctx.fillStyle=["#b6cba2","#a0bd8e","#8aaa78","#799c69","#6a8d5c"][i];ctx.fill();}
    ctx.fillStyle="#75945c";ctx.fillRect(0,420,W,180);
    for(let i=0;i<16;i++){const x=i*68+20,y=425+(i%3)*15;ctx.fillStyle="#74523b";ctx.fillRect(x-5,y-46,10,50);sideEllipse(x,y-61,25,33,i%2?"#4f8753":"#63965a");}
    ctx.fillStyle="#c7a77b";ctx.beginPath();ctx.moveTo(0,495);ctx.quadraticCurveTo(480,450,960,495);ctx.lineTo(960,600);ctx.lineTo(0,600);ctx.closePath();ctx.fill();
    // status parchment
    ctx.fillStyle="#6e503b";ctx.beginPath();ctx.roundRect(14,14,270,145,15);ctx.fill();ctx.fillStyle="#f3e4c5";ctx.beginPath();ctx.roundRect(19,19,260,135,12);ctx.fill();
    ctx.fillStyle="#584333";ctx.textAlign="left";ctx.font="bold 17px 'Noto Sans JP',sans-serif";ctx.fillText("冒険者",34,47);ctx.font="14px 'Noto Sans JP',sans-serif";ctx.fillText("HP  "+battle.hp+" / "+battle.maxHp,34,76);ctx.fillText("MP  "+battle.mp+" / "+battle.maxMp,34,103);
    const bar=(x,y,w,v,max,color)=>{ctx.fillStyle="#80664e";ctx.fillRect(x,y,w,10);ctx.fillStyle=color;ctx.fillRect(x+2,y+2,(w-4)*Math.max(0,v/max),6);};bar(34,84,205,battle.hp,battle.maxHp,"#c95e55");bar(34,111,205,battle.mp,battle.maxMp,"#4c9eb8");
    drawPaintedPerson({...player,x:battle.playerX,y:438-battle.playerY,moving:false},true,true);
    battle.enemies.forEach((e,i)=>{if(e.hp<=0)return;const ex=660+(i%3)*88,ey=430-Math.floor(i/3)*70;sideEllipse(ex,ey+5,e.boss?40:30,8,"rgba(40,54,39,.3)");
      if(e.name.includes("スライム")){sidePath([{x:ex-29,y:ey-3},{x:ex-25,y:ey-28},{x:ex-10,y:ey-40},{x:ex+10,y:ey-40},{x:ex+27,y:ey-23},{x:ex+30,y:ey-3}],"#4a9da0","#337b7c",2);sideEllipse(ex-9,ey-24,4,6,"#fff5df");sideEllipse(ex+9,ey-24,4,6,"#fff5df");sideEllipse(ex-8,ey-23,2,3,"#3b5660");sideEllipse(ex+10,ey-23,2,3,"#3b5660");}
      else{sideEllipse(ex,ey-28,25,31,e.color||"#8b806b");sideEllipse(ex-8,ey-35,5,6,"#fff5df");sideEllipse(ex+9,ey-35,5,6,"#fff5df");if(e.boss){sidePath([{x:ex-15,y:ey-52},{x:ex-30,y:ey-78},{x:ex-4,y:ey-57}],"#c29a5d");sidePath([{x:ex+15,y:ey-52},{x:ex+30,y:ey-78},{x:ex+4,y:ey-57}],"#c29a5d");}}
      ctx.fillStyle="#514035";ctx.font="bold 12px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.fillText(e.name,ex,ey-82);bar(ex-32,ey-66,64,e.hp,e.maxHp,"#c95e55");
    });
    if(battle.defending){ctx.strokeStyle="#d9f0df";ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(battle.playerX,416-battle.playerY,34,53,0,0,Math.PI*2);ctx.stroke();}
    if(battleMessage&&performance.now()<battleMessageUntil){ctx.fillStyle="#654b39";ctx.beginPath();ctx.roundRect(250,210,460,58,12);ctx.fill();ctx.fillStyle="#fff1d5";ctx.beginPath();ctx.roundRect(255,215,450,48,10);ctx.fill();ctx.fillStyle="#514035";ctx.textAlign="center";ctx.font="bold 18px 'Noto Sans JP',sans-serif";ctx.fillText(battleMessage,480,245);}
  }

  // Current full-art experiment: 3D anime fantasy. Next candidates will replace this renderer entirely.
  document.body.dataset.graphicStyle="storybook-stick";
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