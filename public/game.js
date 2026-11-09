"use strict";
(() => {
  const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");
  const W=960,H=600; canvas.width=W;canvas.height=H;ctx.imageSmoothingEnabled=true;
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
  function drawInterior(){
    const b=interior?.building;if(!b)return;
    const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#f2dfb8");bg.addColorStop(1,"#c99d6b");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#76513c";ctx.beginPath();ctx.roundRect(22,18,916,564,24);ctx.fill();
    const floor=ctx.createLinearGradient(0,42,0,568);floor.addColorStop(0,"#e7c991");floor.addColorStop(1,"#bd8756");ctx.fillStyle=floor;ctx.beginPath();ctx.roundRect(34,30,892,540,16);ctx.fill();
    for(let y=58;y<548;y+=44){ctx.strokeStyle="rgba(112,72,43,.25)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(52,y);ctx.lineTo(908,y);ctx.stroke();for(let x=80+(Math.floor(y/44)%2)*48;x<900;x+=144){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+40);ctx.stroke();}}
    const wall=ctx.createLinearGradient(0,38,0,178);wall.addColorStop(0,"#a86e4c");wall.addColorStop(1,"#e7c28b");ctx.fillStyle=wall;ctx.beginPath();ctx.roundRect(54,48,852,126,12);ctx.fill();ctx.strokeStyle="#87583e";ctx.lineWidth=5;ctx.stroke();
    for(const x of [112,748]){ctx.fillStyle="#81553d";ctx.beginPath();ctx.roundRect(x-8,70,112,100,8);ctx.fill();ctx.fillStyle="#8fc2c3";ctx.beginPath();ctx.roundRect(x,78,96,82,4);ctx.fill();ctx.strokeStyle="#f1d7a2";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x+48,78);ctx.lineTo(x+48,160);ctx.moveTo(x,119);ctx.lineTo(x+96,119);ctx.stroke();}
    const furniture=(x,y,w,h,color)=>{ctx.fillStyle="rgba(73,49,34,.2)";ctx.beginPath();ctx.ellipse(x+w/2,y+h+7,w*.55,9,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,12);ctx.fill();ctx.strokeStyle="#815337";ctx.lineWidth=4;ctx.stroke();ctx.fillStyle="rgba(255,235,190,.35)";ctx.beginPath();ctx.roundRect(x+7,y+6,w-14,Math.max(8,h*.22),6);ctx.fill();};
    furniture(300,205,360,58,"#8d5c3e");furniture(330,290,300,82,"#b87949");
    if(b.type==="forge"){furniture(700,300,150,150,"#66534a");const fire=ctx.createRadialGradient(775,375,8,775,375,66);fire.addColorStop(0,"#fff0a6");fire.addColorStop(.45,"#ee9850");fire.addColorStop(1,"#8b4634");ctx.fillStyle=fire;ctx.beginPath();ctx.arc(775,375,54,0,Math.PI*2);ctx.fill();}
    else if(b.type==="inn"){furniture(120,355,190,94,"#9c684a");furniture(650,355,190,94,"#9c684a");}
    else if(b.type==="shop"||b.type==="market"){for(let i=0;i<4;i++)furniture(90+i*195,360,140,78,i%2?"#a96d49":"#bd8755");}
    else furniture(160,370,640,72,"#a36e49");
    ctx.fillStyle="#fff1d1";ctx.strokeStyle="#714a36";ctx.lineWidth=5;ctx.font="bold 24px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.strokeText(b.name,480,82);ctx.fillText(b.name,480,82);
    ctx.font="14px 'Noto Sans JP',sans-serif";ctx.lineWidth=3;ctx.strokeText("Eキー / 操作ボタン：外へ出る",480,548);ctx.fillText("Eキー / 操作ボタン：外へ出る",480,548);
    drawStorybookPersonAt(480,460,player,true,1.18);
  }
    function drawBattle(){
    const sky=ctx.createLinearGradient(0,0,0,440);sky.addColorStop(0,"#b9dce0");sky.addColorStop(.65,"#dce8c5");sky.addColorStop(1,"#f3dfb4");ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    for(let i=0;i<7;i++){const x=i*165-30;ctx.fillStyle="rgba(255,255,255,.36)";ctx.beginPath();ctx.ellipse(x+45,110+(i%3)*25,68,18,0,0,Math.PI*2);ctx.ellipse(x+90,105+(i%3)*25,50,14,0,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle="#8eae70";ctx.beginPath();ctx.moveTo(0,300);for(let x=0;x<=W;x+=40)ctx.lineTo(x,285+Math.sin(x/95)*20);ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.fill();
    const earth=ctx.createLinearGradient(0,420,0,H);earth.addColorStop(0,"#d7b77c");earth.addColorStop(1,"#b98c5c");ctx.fillStyle=earth;ctx.fillRect(0,430,W,170);
    ctx.strokeStyle="rgba(110,139,83,.5)";ctx.lineWidth=4;for(let i=0;i<18;i++){const x=i*59+12,y=422+(i%4)*5;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x-7,y-18,x-4,y-24);ctx.moveTo(x,y);ctx.quadraticCurveTo(x+8,y-15,x+12,y-20);ctx.stroke();}
    ctx.fillStyle="rgba(89,61,43,.22)";ctx.beginPath();ctx.roundRect(14,14,260,144,18);ctx.fill();ctx.fillStyle="#f6e8c9";ctx.beginPath();ctx.roundRect(18,18,252,136,15);ctx.fill();ctx.strokeStyle="#9b704b";ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle="#65452f";ctx.font="bold 17px 'Noto Sans JP',sans-serif";ctx.textAlign="left";ctx.fillText("冒険者",34,47);ctx.font="14px 'Noto Sans JP',sans-serif";ctx.fillText("HP  "+battle.hp+" / "+battle.maxHp,34,76);ctx.fillText("MP  "+battle.mp+" / "+battle.maxMp,34,103);
    const bar=(x,y,w,v,max,color)=>{ctx.fillStyle="#b9a58a";ctx.beginPath();ctx.roundRect(x,y,w,9,5);ctx.fill();ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w*Math.max(0,v/max),9,5);ctx.fill();};bar(34,84,200,battle.hp,battle.maxHp,"#d96e62");bar(34,111,200,battle.mp,battle.maxMp,"#6badd0");
    const px=battle.playerX,py=438-battle.playerY;drawStorybookPersonAt(px,py,player,true,1.25);
    battle.enemies.forEach((e,i)=>{if(e.hp<=0)return;const ex=650+(i%3)*92,ey=422-Math.floor(i/3)*70;ctx.fillStyle="rgba(72,82,57,.22)";ctx.beginPath();ctx.ellipse(ex,ey+8,e.boss?48:32,11,0,0,Math.PI*2);ctx.fill();
      if(e.name.includes("スライム")){const grad=ctx.createLinearGradient(ex,ey-48,ex,ey+4);grad.addColorStop(0,"#d8fff0");grad.addColorStop(.45,e.color);grad.addColorStop(1,"#4e9b9d");ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(ex-31,ey+2);ctx.quadraticCurveTo(ex-28,ey-34,ex,ey-42);ctx.quadraticCurveTo(ex+29,ey-34,ex+32,ey+2);ctx.quadraticCurveTo(ex,ey+15,ex-31,ey+2);ctx.fill();}
      else{ctx.fillStyle=e.color;ctx.beginPath();ctx.ellipse(ex,ey-22,e.boss?38:27,e.boss?40:28,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f6e4aa";ctx.beginPath();ctx.ellipse(ex-9,ey-26,4,6,0,0,Math.PI*2);ctx.ellipse(ex+9,ey-26,4,6,0,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle="#65452f";ctx.font="bold 13px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.fillText(e.name,ex,ey-58);bar(ex-34,ey-49,68,e.hp,e.maxHp,"#d96e62");
    });
    if(battle.defending){ctx.fillStyle="#fff6dc";ctx.font="bold 14px sans-serif";ctx.textAlign="center";ctx.fillText("防御中",px,py-78);}
    if(battleMessageUntil>performance.now()){ctx.fillStyle="rgba(74,53,39,.28)";ctx.beginPath();ctx.roundRect(205,192,550,62,16);ctx.fill();ctx.fillStyle="#fff0d2";ctx.beginPath();ctx.roundRect(210,196,540,54,13);ctx.fill();ctx.strokeStyle="#9b704b";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle="#68452f";ctx.font="bold 20px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.fillText(battleMessage,W/2,229);}
    ctx.fillStyle="#68452f";ctx.font="bold 13px 'Noto Sans JP',sans-serif";ctx.textAlign="right";ctx.fillText("右端まで進むと逃走",W-24,30);
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
  function storyWorldPath(points,color,width){ctx.beginPath();points.forEach((p,i)=>{const q=project(p[0],p[1]);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke();}
  function drawGround(){
    const grass=ctx.createLinearGradient(0,0,W,H);grass.addColorStop(0,"#a8c986");grass.addColorStop(.52,"#83b777");grass.addColorStop(1,"#c3cf91");ctx.fillStyle=grass;ctx.fillRect(0,0,W,H);
    for(let i=0;i<170;i++){const x=(hash(i,41)*W),y=(hash(i,73)*H),r=5+hash(i,99)*22;ctx.fillStyle=i%3===0?"rgba(236,232,177,.17)":"rgba(67,126,73,.10)";ctx.beginPath();ctx.ellipse(x,y,r,r*.55,hash(i,8),0,Math.PI*2);ctx.fill();}
    const waterPts=[];for(let y=500;y<=2350;y+=90){const bend=390+Math.sin(y/155)*65;waterPts.push([bend,y]);}
    storyWorldPath(waterPts,"#d7c18c",184);storyWorldPath(waterPts,"#73b7c2",154);storyWorldPath(waterPts,"#a6d5d1",5);
    for(let i=0;i<18;i++){const wy=620+i*92,bend=390+Math.sin(wy/155)*65+Math.sin(i*2)*22;const q=project(bend,wy);ctx.strokeStyle="rgba(240,250,226,.48)";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(q.x-26,q.y-7);ctx.quadraticCurveTo(q.x,q.y-13,q.x+28,q.y-4);ctx.stroke();}
    storyWorldPath([[1600,500],[1600,2300]],"rgba(115,83,52,.24)",132);storyWorldPath([[1600,500],[1600,2300]],"#d6bd88",112);
    storyWorldPath([[650,1320],[2600,1320]],"rgba(115,83,52,.24)",132);storyWorldPath([[650,1320],[2600,1320]],"#d6bd88",112);
    storyWorldPath([[1600,1320],[1100,900]],"#d6bd88",54);storyWorldPath([[1600,1320],[2050,900]],"#d6bd88",54);storyWorldPath([[1600,1320],[2050,1800]],"#d6bd88",54);
    const q=project(1600,1320);ctx.fillStyle="#b7a37b";ctx.beginPath();ctx.ellipse(q.x,q.y,180,180,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#d9c99e";ctx.beginPath();ctx.ellipse(q.x,q.y,168,168,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#f1e2bb";ctx.lineWidth=7;ctx.beginPath();ctx.ellipse(q.x,q.y,156,156,0,0,Math.PI*2);ctx.stroke();
    for(let i=0;i<24;i++){const a=i*Math.PI/12,x=q.x+Math.cos(a)*145,y=q.y+Math.sin(a)*145;ctx.fillStyle=i%2?"#b8a27c":"#e9d8b0";ctx.beginPath();ctx.ellipse(x,y,13,9,a,0,Math.PI*2);ctx.fill();}
    drawFountain(1600,1320);
    const market=project(2000,2140);ctx.fillStyle="#c6a16e";ctx.beginPath();ctx.ellipse(market.x,market.y,155,92,0,0,Math.PI*2);ctx.fill();
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
    const [type,wx,wy]=item,p=project(wx,wy),x=p.x,y=p.y;if(x<-60||y<-70||x>W+60||y>H+60)return;
    ctx.fillStyle="rgba(66,105,58,.20)";ctx.beginPath();ctx.ellipse(x,y+7,18,7,0,0,Math.PI*2);ctx.fill();
    if(type==="flower"){for(let k=0;k<5;k++){const a=k*Math.PI*2/5;ctx.fillStyle=["#f3c8bd","#f2df9b","#e9a8b3"][k%3];ctx.beginPath();ctx.ellipse(x+Math.cos(a)*6,y-12+Math.sin(a)*5,5,8,a,0,Math.PI*2);ctx.fill();}ctx.fillStyle="#e6b95e";ctx.beginPath();ctx.arc(x,y-12,4,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#557d49";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y-7);ctx.lineTo(x,y+8);ctx.stroke();}
    else if(type==="lamp"){ctx.strokeStyle="#795238";ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(x,y+8);ctx.lineTo(x,y-30);ctx.stroke();ctx.fillStyle="#f5d995";ctx.beginPath();ctx.roundRect(x-10,y-42,20,22,7);ctx.fill();ctx.fillStyle="rgba(255,226,148,.3)";ctx.beginPath();ctx.arc(x,y-31,20,0,Math.PI*2);ctx.fill();}
    else if(type==="bench"){ctx.fillStyle="#815438";ctx.beginPath();ctx.roundRect(x-22,y-9,44,12,5);ctx.fill();ctx.fillStyle="#b98554";ctx.beginPath();ctx.roundRect(x-24,y-15,48,8,4);ctx.fill();ctx.strokeStyle="#68462f";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-15,y+2);ctx.lineTo(x-15,y+12);ctx.moveTo(x+15,y+2);ctx.lineTo(x+15,y+12);ctx.stroke();}
    else if(type==="barrel"||type==="crate"){ctx.fillStyle=type==="barrel"?"#a96e42":"#b88450";ctx.beginPath();ctx.roundRect(x-12,y-14,24,24,6);ctx.fill();ctx.strokeStyle="#704b34";ctx.lineWidth=3;ctx.stroke();ctx.strokeStyle="#dfb77d";ctx.beginPath();ctx.moveTo(x-8,y-8);ctx.lineTo(x+8,y-8);ctx.moveTo(x-8,y+4);ctx.lineTo(x+8,y+4);ctx.stroke();}
    else if(type==="sign"){ctx.strokeStyle="#765036";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x,y+10);ctx.lineTo(x,y-27);ctx.stroke();ctx.fillStyle="#f0d6a3";ctx.beginPath();ctx.roundRect(x-16,y-32,32,17,5);ctx.fill();ctx.strokeStyle="#80563a";ctx.lineWidth=2;ctx.stroke();}
    else if(type==="stall"){ctx.fillStyle="#8c5a3d";ctx.beginPath();ctx.roundRect(x-24,y-2,48,13,5);ctx.fill();ctx.fillStyle="#f0d5a0";ctx.beginPath();ctx.moveTo(x-27,y-18);ctx.lineTo(x+27,y-18);ctx.lineTo(x+21,y-4);ctx.lineTo(x-21,y-4);ctx.closePath();ctx.fill();for(let k=0;k<5;k++){ctx.fillStyle=k%2?"#e4a58c":"#b96755";ctx.fillRect(x-25+k*10,y-17,10,13);}}
  }


    function drawFountain(wx,wy){
    const p=project(wx,wy),x=p.x,y=p.y;ctx.fillStyle="rgba(67,91,59,.2)";ctx.beginPath();ctx.ellipse(x,y+27,52,17,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#9c8c70";ctx.beginPath();ctx.ellipse(x,y,48,34,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#e0d0ac";ctx.beginPath();ctx.ellipse(x,y-3,42,29,0,0,Math.PI*2);ctx.fill();const w=ctx.createRadialGradient(x-8,y-10,2,x,y,36);w.addColorStop(0,"#bde2d7");w.addColorStop(1,"#6caebb");ctx.fillStyle=w;ctx.beginPath();ctx.ellipse(x,y-5,33,22,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#f5edce";ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(x,y-5,33,22,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#f8e9c0";ctx.beginPath();ctx.arc(x,y-6,7,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(255,255,255,.7)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y-6,14,0,Math.PI*2);ctx.stroke();
  }


    function drawBridge(wx,wy){
    const p=project(wx,wy),x=p.x,y=p.y;ctx.fillStyle="rgba(69,65,48,.2)";ctx.beginPath();ctx.ellipse(x,y+12,55,16,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#81573a";ctx.lineWidth=30;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(x-48,y);ctx.lineTo(x+48,y);ctx.stroke();ctx.strokeStyle="#c8965e";ctx.lineWidth=23;ctx.stroke();ctx.strokeStyle="rgba(255,226,171,.6)";ctx.lineWidth=3;for(let i=-3;i<=3;i++){ctx.beginPath();ctx.moveTo(x+i*13,y-9);ctx.lineTo(x+i*13,y+9);ctx.stroke();}
  }


    function drawTree(wx,wy,index=0){
    const p=project(wx,wy),x=p.x,y=p.y;if(x<-85||y<-100||x>W+85||y>H+85)return;
    ctx.fillStyle="rgba(57,91,48,.22)";ctx.beginPath();ctx.ellipse(x,y+12,31,12,0,0,Math.PI*2);ctx.fill();
    const trunk=ctx.createLinearGradient(x-8,y-10,x+10,y+10);trunk.addColorStop(0,"#9b7048");trunk.addColorStop(1,"#68482f");ctx.fillStyle=trunk;ctx.beginPath();ctx.moveTo(x-7,y+7);ctx.quadraticCurveTo(x-4,y-10,x-9,y-30);ctx.lineTo(x+9,y-30);ctx.quadraticCurveTo(x+5,y-8,x+8,y+8);ctx.closePath();ctx.fill();
    const palettes=[["#5f9657","#82b66b","#a8cb83"],["#4f8d66","#76ad7d","#a6c99b"],["#7b9c50","#a6bd6a","#c3d28b"],["#568b7a","#82b29a","#b3d0a8"]],a=palettes[index%palettes.length];
    for(const [ox,oy,r,col] of [[-17,-31,25,a[0]],[13,-38,27,a[1]],[0,-57,24,a[2]],[-1,-21,23,a[1]],[26,-22,18,a[0]]]){ctx.fillStyle=col;ctx.beginPath();ctx.arc(x+ox,y+oy,r,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle="rgba(239,242,188,.32)";ctx.beginPath();ctx.arc(x-7,y-54,10,0,Math.PI*2);ctx.fill();
  }


    function drawHouse(b,index=0){
    const p=project(b.x+b.w/2,b.y+b.h/2),x=p.x,y=p.y;if(x<-200||y<-220||x>W+200||y>H+220)return;
    const w=Math.max(90,b.w*.9),h=Math.max(74,b.h*.75),pal={guild:["#6f8190","#a5b1ae","#e2c99b"],forge:["#74665e","#a68a70","#c8b39a"],inn:["#a65f50","#d18a68","#f0d2a2"],market:["#bb8150","#e0b47a","#f2dfb9"],farm:["#8c8b58","#b5a46e","#e4cf9f"],bank:["#718c8a","#a9b7a3","#e8d8b2"],home:["#a96958","#ce8c6e","#ecd0a2"],shop:["#a76b70","#d39a86","#efd7b3"]}[b.type]||["#a96958","#ce8c6e","#ecd0a2"];
    ctx.fillStyle="rgba(62,89,54,.22)";ctx.beginPath();ctx.ellipse(x,y+h*.35,w*.66,17,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#a99577";ctx.beginPath();ctx.moveTo(x-w*.48,y-h*.02);ctx.lineTo(x+w*.42,y-h*.02);ctx.lineTo(x+w*.48,y+h*.34);ctx.lineTo(x-w*.40,y+h*.34);ctx.closePath();ctx.fill();
    const wall=ctx.createLinearGradient(x-w/2,y,x+w/2,y+h);wall.addColorStop(0,pal[2]);wall.addColorStop(1,pal[1]);ctx.fillStyle=wall;ctx.beginPath();ctx.moveTo(x-w*.43,y-h*.12);ctx.lineTo(x+w*.36,y-h*.12);ctx.lineTo(x+w*.36,y+h*.29);ctx.lineTo(x-w*.43,y+h*.29);ctx.closePath();ctx.fill();ctx.strokeStyle="#78533e";ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle="rgba(255,245,218,.34)";ctx.fillRect(x-w*.4,y-h*.08,w*.72,5);
    for(let k=0;k<4;k++){ctx.strokeStyle="rgba(132,91,57,.23)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-w*.38,y+k*h*.09);ctx.lineTo(x+w*.32,y+k*h*.09);ctx.stroke();}
    ctx.fillStyle="#76513d";ctx.beginPath();ctx.moveTo(x-w*.55,y-h*.13);ctx.lineTo(x-w*.08,y-h*.72);ctx.lineTo(x+w*.55,y-h*.13);ctx.lineTo(x+w*.39,y+h*.02);ctx.lineTo(x-w*.08,y-h*.48);ctx.lineTo(x-w*.40,y+h*.02);ctx.closePath();ctx.fill();ctx.strokeStyle="#684536";ctx.lineWidth=4;ctx.stroke();
    const roof=ctx.createLinearGradient(x-w*.4,y-h*.5,x+w*.45,y);roof.addColorStop(0,pal[0]);roof.addColorStop(.55,pal[1]);roof.addColorStop(1,pal[0]);ctx.fillStyle=roof;ctx.beginPath();ctx.moveTo(x-w*.52,y-h*.14);ctx.lineTo(x-w*.08,y-h*.70);ctx.lineTo(x+w*.52,y-h*.14);ctx.lineTo(x+w*.38,y-h*.03);ctx.lineTo(x-w*.08,y-h*.52);ctx.lineTo(x-w*.39,y-h*.03);ctx.closePath();ctx.fill();ctx.strokeStyle="#76513d";ctx.lineWidth=3;ctx.stroke();
    for(let r=0;r<4;r++){ctx.strokeStyle="rgba(255,224,177,.28)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-w*.38+r*5,y-h*(.19+r*.105));ctx.quadraticCurveTo(x,y-h*(.52-r*.08),x+w*(.37-r*.04),y-h*(.19+r*.105));ctx.stroke();}
    for(const wx of [x-w*.29,x+w*.12]){ctx.fillStyle="#81563d";ctx.beginPath();ctx.roundRect(wx-9,y+2,22,27,4);ctx.fill();ctx.fillStyle="#8fb9bb";ctx.beginPath();ctx.roundRect(wx-6,y+5,16,20,3);ctx.fill();ctx.strokeStyle="#f1d6a1";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(wx+2,y+5);ctx.lineTo(wx+2,y+25);ctx.moveTo(wx-6,y+15);ctx.lineTo(wx+10,y+15);ctx.stroke();}
    ctx.fillStyle="#6e4934";ctx.beginPath();ctx.roundRect(x-12,y+h*.06,25,h*.25,5);ctx.fill();ctx.fillStyle="#b77b4c";ctx.beginPath();ctx.roundRect(x-9,y+h*.08,19,h*.22,4);ctx.fill();ctx.fillStyle="#f0d59d";ctx.beginPath();ctx.arc(x+5,y+h*.19,2,0,Math.PI*2);ctx.fill();
    if(b.name!=="住民の家"&&b.name!=="あなたの家"&&b.name!=="町長の家"){ctx.fillStyle="#fff4d8";ctx.strokeStyle="#72503c";ctx.lineWidth=4;ctx.font="bold 11px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.strokeText(b.name,x,y-h*.76);ctx.fillText(b.name,x,y-h*.76);}
  }


    function drawStorybookPersonAt(x,y,p,isPlayer=false,scale=1){
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
    const moving=!!p.moving,phase=moving?Math.sin((p.walkClock||0)*13):0,bob=moving?Math.abs(Math.sin((p.walkClock||0)*13))*2:Math.sin(performance.now()/650)*.7;
    const hairMap={"栗色":"#805039","金髪":"#e6bd68","黒髪":"#40353b","銀髪":"#b9c1c3","茶色":"#986442","赤髪":"#b65c49","青髪":"#547da4","緑髪":"#66845a"};
    const skinMap={"明るい肌":"#f0c7a0","普通の肌":"#dba982","褐色肌":"#bd805e","色白":"#f5dcc4"};
    const hair=hairMap[p.hair]||"#805039",skin=skinMap[p.skin]||"#f0c7a0",cloth=p.outfit||p.color||"#6488a2",dark="#5c463d",dir=String(p.dir||"down");
    ctx.fillStyle="rgba(68,82,53,.22)";ctx.beginPath();ctx.ellipse(0,2,17,5,0,0,Math.PI*2);ctx.fill();
    const legSwing=phase*5;
    ctx.strokeStyle=dark;ctx.lineWidth=6;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-5,-13+bob);ctx.lineTo(-7+legSwing,-2);ctx.moveTo(5,-13+bob);ctx.lineTo(7-legSwing,-2);ctx.stroke();
    ctx.strokeStyle="#76523a";ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(-8+legSwing,-3);ctx.lineTo(-3+legSwing,-2);ctx.moveTo(6-legSwing,-3);ctx.lineTo(11-legSwing,-2);ctx.stroke();
    const body=ctx.createLinearGradient(-12,-37,12,-10);body.addColorStop(0,"#fff0d2");body.addColorStop(.18,cloth);body.addColorStop(1,cloth);ctx.fillStyle=body;ctx.beginPath();ctx.moveTo(-10,-34);ctx.quadraticCurveTo(-14,-29,-11,-14);ctx.quadraticCurveTo(0,-9,11,-14);ctx.quadraticCurveTo(14,-29,10,-34);ctx.quadraticCurveTo(0,-40,-10,-34);ctx.fill();ctx.strokeStyle=dark;ctx.lineWidth=2.2;ctx.stroke();
    ctx.fillStyle="rgba(255,245,218,.5)";ctx.beginPath();ctx.moveTo(-7,-32);ctx.quadraticCurveTo(-1,-36,4,-32);ctx.lineTo(1,-16);ctx.quadraticCurveTo(-5,-17,-7,-32);ctx.fill();
    ctx.strokeStyle=dark;ctx.lineWidth=5;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-10,-31);ctx.quadraticCurveTo(-17,-24,-13+phase*3,-17);ctx.moveTo(10,-31);ctx.quadraticCurveTo(17,-24,13-phase*3,-17);ctx.stroke();
    ctx.fillStyle=skin;ctx.beginPath();ctx.ellipse(0,-43+bob,12,13,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=dark;ctx.lineWidth=2;ctx.stroke();
    const back=dir==="up"||dir==="up-left"||dir==="up-right",left=dir.includes("left"),right=dir.includes("right");
    ctx.fillStyle=hair;ctx.beginPath();ctx.moveTo(-12,-46);ctx.quadraticCurveTo(-13,-60,0,-59);ctx.quadraticCurveTo(14,-59,13,-44);ctx.quadraticCurveTo(8,-49,4,-48);ctx.quadraticCurveTo(-3,-43,-12,-46);ctx.fill();ctx.strokeStyle=dark;ctx.lineWidth=2;ctx.stroke();
    if(!back){ctx.fillStyle="#fff8e8";if(left){ctx.beginPath();ctx.ellipse(-5,-43+bob,2.5,3.2,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=p.eyes==="緑"?"#638b5d":"#54728e";ctx.beginPath();ctx.arc(-5,-43+bob,1.3,0,Math.PI*2);ctx.fill();}else if(right){ctx.beginPath();ctx.ellipse(5,-43+bob,2.5,3.2,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#54728e";ctx.beginPath();ctx.arc(5,-43+bob,1.3,0,Math.PI*2);ctx.fill();}else{for(const ex of [-4.5,4.5]){ctx.beginPath();ctx.ellipse(ex,-43+bob,2.2,3,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=p.eyes==="緑"?"#638b5d":p.eyes==="茶"?"#986442":"#54728e";ctx.beginPath();ctx.arc(ex,-43+bob,1.2,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff8e8";}ctx.strokeStyle="#a45c54";ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(0,-38+bob,2.4,.15,Math.PI-.15);ctx.stroke();}}
    if(p.accessory==="帽子"||p.role==="旅人"||p.role==="冒険者"){ctx.fillStyle="#8b6548";ctx.beginPath();ctx.ellipse(0,-54+bob,17,4,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#b58b5a";ctx.beginPath();ctx.moveTo(-10,-54+bob);ctx.quadraticCurveTo(-7,-69,2,-68);ctx.quadraticCurveTo(11,-67,10,-54+bob);ctx.closePath();ctx.fill();ctx.strokeStyle="#684a39";ctx.lineWidth=2;ctx.stroke();}
    else if(p.accessory==="眼鏡"){ctx.strokeStyle="#6c5b4d";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(-5,-43+bob,4,0,Math.PI*2);ctx.arc(5,-43+bob,4,0,Math.PI*2);ctx.moveTo(-1,-43+bob);ctx.lineTo(1,-43+bob);ctx.stroke();}
    else if(p.accessory==="マント"){ctx.fillStyle="#876b8d";ctx.beginPath();ctx.moveTo(-10,-33);ctx.lineTo(-15,-14);ctx.lineTo(0,-18);ctx.lineTo(12,-14);ctx.lineTo(10,-33);ctx.closePath();ctx.fill();}
    ctx.restore();
  }
  function drawNpcPixelPerson(p){const q=project(p.x,p.y);drawStorybookPersonAt(q.x,q.y,p,false,1.05);}

    function drawPixelPerson(p,isPlayer=false){const q=project(p.x,p.y);drawStorybookPersonAt(q.x,q.y,p,isPlayer,1.12);}

    function drawPlayerName(p){
    const q=project(p.x,p.y);
    const label=(p.name||"冒険者").slice(0,12);
    ctx.save();ctx.font="11px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.lineJoin="round";ctx.lineWidth=3;ctx.strokeStyle="rgba(24,30,39,.88)";ctx.strokeText(label,q.x,q.y-78);
    ctx.fillStyle="#fff8df";ctx.fillText(label,q.x,q.y-78);ctx.restore();
  }
  function applyStorybookTexture(){
    if(storybookTexture.complete&&storybookTexture.naturalWidth){ctx.save();ctx.globalAlpha=.12;ctx.globalCompositeOperation="soft-light";ctx.drawImage(storybookTexture,0,0,W,H);ctx.restore();}
    ctx.save();const vignette=ctx.createRadialGradient(W/2,H/2,160,W/2,H/2,620);vignette.addColorStop(0,"rgba(255,250,222,0)");vignette.addColorStop(1,"rgba(92,75,54,.12)");ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);ctx.restore();
  }
  function render(){
    ctx.clearRect(0,0,W,H);
    if(battle)drawBattle();
    else if(interior)drawInterior();
    else{
      drawGround();const objects=[];
      for(let i=0;i<buildings.length;i++){const b=buildings[i];objects.push({depth:b.y+b.h,draw:()=>drawHouse(b,i)});}
      for(let i=0;i<110;i++){const x=160+Math.floor(hash(i,23)*2700),y=180+Math.floor(hash(i,31)*1950);if(Math.hypot(x-1600,y-1320)<420||(x>280&&x<620&&y>700&&y<2200)||buildings.some(b=>x>b.x-80&&x<b.x+b.w+80&&y>b.y-80&&y<b.y+b.h+80))continue;objects.push({depth:y,draw:()=>drawTree(x,y,i)});}
      for(const item of townDecor)objects.push({depth:item[2],draw:()=>drawTownDecor(item)});
      for(const n of npcs)objects.push({depth:n.y,draw:()=>drawPixelPerson(n)});
      for(const p of others.values())objects.push({depth:p.y,draw:()=>{drawPixelPerson(p);drawPlayerName(p)}});
      objects.push({depth:player.y,draw:()=>{drawPixelPerson(player,true);drawPlayerName(player)}});
      objects.sort((a,b)=>a.depth-b.depth).forEach(o=>o.draw());
    }
    applyStorybookTexture();
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