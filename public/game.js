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
    drawPixelPerson({ ...player,x:battle.playerX,y:0,dir:"right",moving:false },true);
    // battle avatar needs screen coordinates, not world projection
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
    const a=index%4,colors=PAL.leaf;
    ellipse(x+5,y+8,34,10,"#456d43");rect(x-7,y-48,14,58,"#68452f");rect(x-3,y-45,5,50,"#986341");
    rect(x-22,y-62,12,18,"#765039");rect(x+10,y-68,12,22,"#765039");
    const clusters=[[-28,-63,27,25],[-7,-83,30,28],[20,-68,29,26],[-27,-38,26,23],[2,-47,32,27],[31,-43,21,22],[-2,-105,18,17]];
    clusters.forEach(([ox,oy,w,h],i)=>{rect(x+ox-2,y+oy-2,w+5,h+5,colors[0]);rect(x+ox,y+oy,w,h,colors[(i+a)%4+1]);rect(x+ox+4,y+oy+4,Math.max(4,w*.28),4,colors[4]);});
    for(let i=0;i<8;i++){const ox=x-26+(i*17)%58,oy=y-91+(i%4)*15;rect(ox,oy,4,3,i%2?"#b0ce73":"#397744");}
  }
  function drawHouse(b,index=0){
    const p=project(b.x+b.w/2,b.y+b.h/2),x=p.x,y=p.y;if(x<-220||y<-240||x>W+220||y>H+240)return;
    const w=Math.max(86,b.w*.86),h=Math.max(72,b.h*.7);
    const palette={guild:["#a64c43","#d6a76a","#ead6a9"],forge:["#574a43","#9b7455","#d2b18a"],inn:["#9a5147","#d49a68","#f0d8ac"],market:["#a45c42","#d6aa6d","#f0dfb8"],farm:["#74834b","#b9a36a","#e8d8ad"],bank:["#557d81","#b3c4b2","#e5d8b5"],home:["#8e5948","#c99168","#ead5aa"],shop:["#6c718e","#b58d70","#ead9b8"]}[b.type]||["#8e5948","#c99168","#ead5aa"];
    const top=y-h*.45,front=y-h*.05,base=y+h*.38;
    // ground shadow, side wall, front wall
    ellipse(x+8,base+6,w*.58,13,"#5d6845");
    poly([{x:x-w*.43,y:front},{x:x+w*.32,y:front-8},{x:x+w*.48,y:base},{x:x-w*.35,y:base+4}], "#8c684d", "#4a3a32",3);
    poly([{x:x-w*.43,y:front},{x:x+w*.32,y:front-8},{x:x+w*.32,y:base-8},{x:x-w*.43,y:base}],palette[2],PAL.ink,3);
    // roof silhouette and shingle courses
    poly([{x:x-w*.55,y:front+2},{x:x-w*.08,y:top-28},{x:x+w*.55,y:front-2},{x:x+w*.34,y:front+16},{x:x-w*.08,y:top+2},{x:x-w*.38,y:front+18}], "#54382f",PAL.ink,3);
    poly([{x:x-w*.51,y:front},{x:x-w*.08,y:top-22},{x:x+w*.51,y:front-4},{x:x+w*.32,y:front+8},{x:x-w*.08,y:top+10},{x:x-w*.37,y:front+14}],palette[0],palette[1],2);
    for(let r=0;r<5;r++){const yy=top+7+r*8;ctx.strokeStyle=r%2?"#e18a62":"#783d38";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-w*.35+r*1.5,yy+17);ctx.lineTo(x+w*.34-r*1.5,yy+17);ctx.stroke();}
    // timber beams and plaster texture
    rect(x-w*.38,front+8,5,h*.35,"#8b5e3e");rect(x+w*.27,front+5,5,h*.35,"#8b5e3e");rect(x-w*.38,base-12,w*.66,5,"#8b5e3e");
    for(let k=0;k<13;k++){const xx=x-w*.33+(k*29)%(w*.58),yy=front+12+(k*17)%(h*.25);rect(xx,yy,4+(k%3)*2,3,k%2?"#f3e3bf":"#c8ac80");}
    // windows with wooden frames and glass highlights
    for(const wx of [x-w*.25,x+w*.12]){rect(wx-10,front+14,23,29,"#54392f");rect(wx-7,front+17,17,23,"#6b9ba1");rect(wx,front+17,3,23,"#e5d1a8");rect(wx-7,front+27,17,3,"#e5d1a8");rect(wx-5,front+19,5,4,"#c1e0d4");}
    rect(x-13,front+15,27,base-front-15,"#54382f");rect(x-9,front+19,19,base-front-19,"#a66d46");rect(x+4,base-26,3,3,"#f1d18a");
    // roof ridge cap
    rect(x-4,top-23,8,20,palette[1]);rect(x-3,top-21,3,16,"#e6bc83");
    // recognizable shop emblem, no tiny unreadable text
    const marks={guild:"✦",forge:"⚒",inn:"♨",shop:"◆",market:"✿",bank:"◇",farm:"♣",home:"⌂"};
    if(marks[b.type]){rect(x-15,top+1,30,19,"#f0d9a6");rect(x-12,top+4,24,13,"#684631");ctx.fillStyle="#f3d28b";ctx.font="bold 12px sans-serif";ctx.textAlign="center";ctx.fillText(marks[b.type],x,top+15);}
    if(b.name!=="住民の家"&&b.name!=="あなたの家"&&b.name!=="町長の家"){ctx.font="bold 11px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.lineWidth=3;ctx.strokeStyle="#4b3930";ctx.strokeText(b.name,x,top-34);ctx.fillStyle="#fff0c8";ctx.fillText(b.name,x,top-34);}
  }
  function drawStorybookPersonAt(x,y,p,isPlayer=false,scale=1){
    ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(scale,scale);
    const dir=String(p.dir||"down"),moving=!!p.moving,phase=moving?Math.sin((p.walkClock||0)*12):0;
    const bob=moving?Math.abs(phase)*1.2:0,step=moving?phase*4.2:0;
    const hairMap={"栗色":"#70432f","金髪":"#d6a653","黒髪":"#332d34","銀髪":"#aeb8b5","茶色":"#8b5639","赤髪":"#a94f43","青髪":"#426d91","緑髪":"#527a45"};
    const skinMap={"明るい肌":"#edc49a","普通の肌":"#d9a77f","褐色肌":"#b97858","色白":"#f1d8bd"};
    const hair=hairMap[p.hair]||"#70432f",skin=skinMap[p.skin]||"#edc49a",cloth=p.outfit||p.color||"#4f78a5",ink="#352f35";
    const back=dir==="up",left=dir==="left",right=dir==="right",side=left||right;
    const sx=left?-1:right?1:0,sy=dir==="up"?-1:dir==="down"?1:0;
    // shadow, boots and legs: movement is aligned to the facing direction; body stays upright
    ellipse(1,2,13,4,"#526b43");
    const legA=step,legB=-step;
    rect(-8+legA,-17+bob,7,14,"#49352f");rect(1+legB,-17+bob,7,14,"#49352f");
    rect(-9+legA,-5+bob,9,5,"#765039");rect(1+legB,-5+bob,9,5,"#765039");
    // torso is drawn in four silhouettes; never rotate the character
    rect(-10,-38+bob,20,23,"#4c3b34");
    rect(-9,-37+bob,18,20,cloth);rect(-7,-35+bob,14,3,"#f0d5a0");
    rect(-3,-32+bob,6,12,cloth);
    // arms swing opposite to the legs, with side-view overlap
    if(side){
      const armX=sx<0?-12:7;
      rect(armX,-34+bob+step*.25,5,16,"#49352f");rect(armX+1,-33+bob+step*.25,3,12,skin);
      rect(armX,-21+bob+step*.25,5,4,skin);
    }else{
      rect(-13,-34+bob+step*.25,5,14,"#49352f");rect(8,-34+bob-step*.25,5,14,"#49352f");
      rect(-12,-33+bob+step*.25,3,11,skin);rect(9,-33+bob-step*.25,3,11,skin);
    }
    // head and hair direction-specific silhouettes; upright proportions remain unchanged
    const hx=side?sx*2:0;
    rect(hx-10,-57+bob,20,20,ink);rect(hx-9,-56+bob,18,18,skin);
    if(back){
      rect(hx-11,-59+bob,22,8,hair);rect(hx-10,-52+bob,20,12,hair);rect(hx-8,-43+bob,16,4,hair);
    }else if(side){
      rect(hx-10,-59+bob,20,7,hair);rect(hx-9,-56+bob,13,14,hair);rect(hx+sx*4,-51+bob,5,9,hair);
      rect(hx+sx*7,-49+bob,3,5,skin);
      rect(hx+sx*3,-49+bob,3,4,"#fff1d7");rect(hx+sx*4,-48+bob,2,2,p.eyes==="緑"?"#588451":"#4b6e8c");
    }else{
      rect(hx-11,-59+bob,22,8,hair);rect(hx-9,-56+bob,18,6,hair);rect(hx-11,-51+bob,5,7,hair);rect(hx+6,-51+bob,5,7,hair);
      if(!back){rect(-6,-49+bob,4,5,"#fff1d7");rect(3,-49+bob,4,5,"#fff1d7");rect(-5,-48+bob,2,3,"#4b6e8c");rect(4,-48+bob,2,3,"#4b6e8c");rect(-2,-41+bob,4,2,"#a65d55");}
    }
    // accessory and back-facing pack
    if(p.accessory==="帽子"||p.role==="旅人"||p.role==="冒険者"){rect(hx-13,-62+bob,26,5,"#67452f");rect(hx-8,-69+bob,16,8,"#b8874e");rect(hx-7,-67+bob,14,2,"#e4c27d");}
    if(back){rect(-12,-34+bob,24,17,"#8b5a3d");rect(-9,-31+bob,18,10,"#b98752");}
    if(p.accessory==="マント"){rect(-12,-38,24,21,"#765b83");rect(-8,-37,16,15,"#9a79a0");}
    if(isPlayer){rect(8,-28,4,4,"#e0bc67");}
    ctx.restore();
  }
  function drawNpcPixelPerson(p){const q=project(p.x,p.y);drawStorybookPersonAt(q.x,q.y,p,false,1.12);}
  function drawPixelPerson(p,isPlayer=false){const q=project(p.x,p.y);drawStorybookPersonAt(q.x,q.y,p,isPlayer,1.18);}
  function drawPlayerName(p){const q=project(p.x,p.y);const label=(p.name||"冒険者").slice(0,12);ctx.save();ctx.font="11px 'Noto Sans JP',sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.lineJoin="round";ctx.lineWidth=3;ctx.strokeStyle="#3a302b";ctx.strokeText(label,q.x,q.y-79);ctx.fillStyle="#fff3d1";ctx.fillText(label,q.x,q.y-79);ctx.restore();}
  function applyStorybookTexture(){
    // Restrained pixel-art finish: no blur, gradients, or watercolor overlay.
    ctx.save();ctx.globalAlpha=.08;for(let i=0;i<180;i++){const x=(i*97)%W,y=(i*53)%H;rect(x,y,2,2,i%2?"#f4e5bf":"#3b4e38");}ctx.restore();
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