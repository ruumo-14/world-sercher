"use strict";
(() => {
  const panel = document.getElementById("adventurer-panel");
  const openBtn = document.getElementById("open-adventurer");
  const closeBtn = document.getElementById("close-adventurer");
  const content = document.getElementById("panel-content");
  const message = document.getElementById("panel-message");
  if (!panel || !openBtn || !content) return;

  const SPECIES = ["人間","エルフ","ドワーフ","獣人","水棲族","竜人","妖精族"];
  const JOBS = ["戦士","魔法使い","弓使い","採掘師","木こり","採集師","鍛冶師","調理師","服飾職人","農家","釣り師","商人"];
  const JOB_GROUPS = [
    { name:"戦闘", jobs:["戦士","魔法使い","弓使い"] },
    { name:"採集", jobs:["採掘師","木こり","採集師"] },
    { name:"生産", jobs:["鍛冶師","調理師","服飾職人"] },
    { name:"生活", jobs:["農家","釣り師","商人"] }
  ];
  const JOB_SKILLS = {
    "戦士":["剣術","盾術","体力強化"], "魔法使い":["魔力操作","元素魔法","魔力制御"],
    "弓使い":["弓術","精密射撃","野外観察"], "採掘師":["採掘技術","鉱石鑑定","坑道知識"],
    "木こり":["伐採技術","木材鑑定","森林知識"], "採集師":["採集技術","薬草鑑定","自然観察"],
    "鍛冶師":["鍛冶技術","金属加工","装備設計"], "調理師":["料理技術","食材鑑定","調理研究"],
    "服飾職人":["服飾技術","染色技術","装飾加工"], "農家":["農業技術","土壌管理","品種改良"],
    "釣り師":["釣り技術","魚鑑定","水辺知識"], "商人":["商売技術","価格鑑定","交渉術"]
  };
  const COMMON_SKILLS = ["体力","持久力","探索","移動","観察","交渉"];
  const NPCS = [
    ["エミリア","冒険者ギルド受付","花・本・冒険 journal"],
    ["ガルド","鍛冶師","鉱石・金属"],
    ["ミーナ","道具屋店主","宝石・珍しい品"],
    ["ノア","農家","種・植物"],
    ["ロイド","宿屋主人","料理・古地図"],
    ["アルベルト","町長","歴史書・遺物"]
  ];
  const REGIONS = [
    ["中央アステリア","草原・森・町・村"],["北方フロスト","雪山・氷の洞窟"],
    ["南方砂漠","砂漠・オアシス・古代遺跡"],["東方エルディア","大樹・魔法の森・妖精の集落"],
    ["西方ヴォルガ","火山・鉱山・鍛冶の町"],["南東アクア諸島","海辺の町・珊瑚・海底洞窟"],
    ["北東スカイ地方","山岳・古代文明・天空遺跡"],["忘れられた島","未知の生物・失われた文明"]
  ];
  const CAPS = { player:100, job:50, skill:10, enhancement:10 };
  const defaultData = () => ({
    schemaVersion:2, species:"人間", level:1, playerXp:0, gold:0,
    activeJob:null, lastJobChange:null, jobs:{}, jobSkills:{}, commonSkills:{},
    skillBooks:[], inventory:[], equipment:[], appearance:{
      hairstyle:"初期スタイル",hairColor:"初期色",skinColor:"初期色",eyeColor:"初期色",
      face:"初期",outfit:"初期衣装",outfitColor:"初期色",accessories:[]
    },
    home:{town:"リーフェル",owned:true,furniture:[],storage:[],stations:[]},
    npcAffinity:{}, npcStories:{}, worldProgress:{}, rankings:{},
    relicStory:{unlocked:false,completed:false,progress:0}
  });
  let data = defaultData();
  let activeTab = "status";
  let loading = false;
  let saving = false;
  let ready = false;
  let lastSaveError = false;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const xpNeed = level => Math.floor(100 * Math.pow(level, 1.55));
  const say = text => { if (message) message.textContent = text; };
  const jobRecord = job => data.jobs[job] || { level:1, xp:0 };
  const skillLevel = (group, name) => Math.max(1, Number((group || {})[name]) || 1);
  const row = (label, value, note="") => '<div class="record-row"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong>'+(note?'<small>'+esc(note)+'</small>':"")+'</div>';
  const section = (title, body) => '<section class="record-section"><h3>'+esc(title)+'</h3>'+body+'</section>';
  const empty = text => '<p class="muted">'+esc(text)+'</p>';
  const list = items => items.length ? items.map(x=>'<li>'+esc(x)+'</li>').join("") : '<li class="muted">まだ登録されていません</li>';

  function migrate(raw) {
    const base = defaultData();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
    const merged = {...base,...raw};
    merged.jobs = raw.jobs && typeof raw.jobs==="object" ? raw.jobs : {};
    merged.jobSkills = raw.jobSkills && typeof raw.jobSkills==="object" ? raw.jobSkills : {};
    merged.commonSkills = raw.commonSkills && typeof raw.commonSkills==="object" ? raw.commonSkills : {};
    merged.appearance = {...base.appearance,...(raw.appearance||{})};
    merged.home = {...base.home,...(raw.home||{})};
    merged.npcAffinity = raw.npcAffinity || {};
    merged.npcStories = raw.npcStories || {};
    merged.worldProgress = raw.worldProgress || {};
    merged.rankings = raw.rankings || {};
    merged.skillBooks = Array.isArray(raw.skillBooks) ? raw.skillBooks : [];
    merged.inventory = Array.isArray(raw.inventory) ? raw.inventory : [];
    merged.equipment = Array.isArray(raw.equipment) ? raw.equipment : [];
    // Migrate the earlier prototype's flat skill levels into the matching job record.
    if (raw.skills && !raw.jobSkills) {
      for (const [job, skills] of Object.entries(JOB_SKILLS)) {
        for (const skill of skills) if (raw.skills[skill] != null) {
          merged.jobSkills[job] ||= {};
          merged.jobSkills[job][skill] = Math.max(1,Math.min(CAPS.skill,Number(raw.skills[skill])||1));
        }
      }
      for (const skill of COMMON_SKILLS) if (raw.skills[skill] != null) merged.commonSkills[skill]=raw.skills[skill];
    }
    merged.schemaVersion = 2;
    merged.level = Math.max(1,Math.min(CAPS.player,Number(merged.level)||1));
    merged.playerXp = Math.max(0,Number(merged.playerXp ?? merged.xp)||0);
    merged.gold = Math.max(0,Number(merged.gold)||0);
    if (!SPECIES.includes(merged.species)) merged.species="人間";
    if (!JOBS.includes(merged.activeJob) && !JOBS.includes(merged.job)) merged.activeJob=null;
    else merged.activeJob=merged.activeJob || merged.job;
    return merged;
  }

  async function save() {
    if (!ready || saving) return;
    saving = true;
    try {
      const response = await fetch("/api/game-data", {
        method:"POST", credentials:"same-origin",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({gameData:data})
      });
      if (!response.ok) throw new Error("HTTP "+response.status);
      lastSaveError=false;
      say("冒険者データを保存しました。");
    } catch (error) {
      lastSaveError=true;
      say("保存できませんでした。通信状態を確認してね。");
    } finally { saving=false; }
  }

  async function load() {
    if (loading) return;
    loading=true;
    try {
      const response=await fetch("/api/game-data",{credentials:"same-origin"});
      if (!response.ok) throw new Error("not logged in");
      const result=await response.json();
      data=migrate(result.gameData);
      ready=true;
      await save(); // Persist schema migration while preserving existing character data.
      render();
    } catch (_error) {
      ready=false;
      say("ログイン後に冒険者データを読み込みます。");
    } finally { loading=false; }
  }

  function renderStatus() {
    const job=data.activeJob || "未選択";
    const home=data.home || {};
    return section("キャラクター",[
      row("種族",data.species,"全7種族。能力差は小さく、全職業・全地域を利用可能"),
      row("プレイヤーレベル",data.level+" / "+CAPS.player,"経験値 "+data.playerXp+" / "+xpNeed(data.level)),
      row("現在の職業",job),
      row("所持通貨",data.gold+" GOLD","全世界共通通貨"),
      row("自宅",home.owned ? (home.town||"リーフェル")+"の自宅":"未取得","家具・収納・生産設備は今後実装")
    ].join(""))+
    section("成長システム",[
      row("プレイヤーレベル上限","Lv."+CAPS.player,"討伐・クエスト中心。探索・採集・生産でも少量獲得"),
      row("職業レベル上限","Lv."+CAPS.job,"職業ごとに経験値を個別保存"),
      row("スキル上限","Lv."+CAPS.skill,"職業別スキルと全職業共通スキル"),
      row("装備強化上限","+"+CAPS.enhancement,"装備品1個ずつ個別に強化")
    ].join(""))+
    section("現在の実装状況",[
      row("アカウント登録・ログイン","実装済み","PostgreSQLにアカウントを保存"),
      row("キャラクター位置の保存","実装済み","ログイン後に前回位置を復元"),
      row("同じワールドへの接続","試作実装","オンライン中のプレイヤー位置を共有"),
      row("冒険者データの保存","基盤実装","種族・職業・スキル等のデータ枠を保存"),
      row("町・施設・NPCの本格動作","未実装","現在は町の試作マップと案内表示"),
      row("戦闘・採集・生産・取引","未実装","今後ゲーム内の行動と成長を接続"),
      row("ランキング・自宅・物語","未実装","仕様を保持し、順番に実装予定")
    ].join(""))+
    section("キャラクター外見",[
      row("髪型・髪色",data.appearance.hairstyle+" / "+data.appearance.hairColor),
      row("肌・目",data.appearance.skinColor+" / "+data.appearance.eyeColor),
      row("顔・服装",data.appearance.face+" / "+data.appearance.outfit),
      empty("外見変更は理髪店・仕立て屋などの専用施設で行う予定。装備を変えても見た目の衣装は変化しません。")
    ].join(""));
  }

  function renderJobs() {
    let html=section("職業のルール",[
      row("同時に就ける職業","1つ"),
      row("変更できる頻度","1日1回"),
      row("変更場所","各町の職業ギルド"),
      empty("職業変更はギルド内でのみ実行可能にします。現在は施設・位置判定が未実装のため、この画面から変更できません。職業ごとのレベルと経験値は切り替えても失われません。")
    ].join(""));
    for(const group of JOB_GROUPS) {
      html+=section(group.name,group.jobs.map(job=>{
        const rec=jobRecord(job);
        const state=job===data.activeJob?"（現在の職業）":"";
        return row(job, "Lv."+rec.level+" / "+CAPS.job, "経験値 "+(Number(rec.xp)||0)+" / "+xpNeed(rec.level)+" "+state);
      }).join(""));
    }
    return html;
  }

  function renderSkills() {
    const job=data.activeJob;
    let html=section("スキルのルール",[
      row("成長上限","Lv."+CAPS.skill),
      row("強化場所","訓練所・スキル研究施設"),
      row("スキル習得","対応するスキル書を冒険で入手"),
      empty("スキル書は使用しても消費されません。職業専用の本は対応職業のときだけ使用可能。習得記録は職業を変更しても残ります。")
    ].join(""));
    if(job) {
      const levels=data.jobSkills[job]||{};
      html+=section(job+"専用スキル",JOB_SKILLS[job].map(skill=>row(skill,"Lv."+skillLevel(levels,skill)+" / "+CAPS.skill)).join(""));
    } else html+=section("職業専用スキル",empty("職業を選ぶと、その職業のスキル一覧が表示されます。"));
    html+=section("全職業共通スキル",COMMON_SKILLS.map(skill=>row(skill,"Lv."+skillLevel(data.commonSkills,skill)+" / "+CAPS.skill)).join(""));
    html+=section("所持スキル書",data.skillBooks.length?'<ul>'+list(data.skillBooks.map(book=>typeof book==="string"?book:(book.name||book.skill||"スキル書")) )+'</ul>':empty("まだスキル書はありません。入手方法・配置は後で設計します。"));
    return html;
  }

  function renderEquipment() {
    const gear=data.equipment;
    return section("装備強化",[
      row("強化上限","+"+CAPS.enhancement),
      row("強化場所","鍛冶屋などの専用施設"),
      empty("武器・防具などは個体ごとに別々に管理。同じ装備を複数持っていても、それぞれ個別に強化します。必要素材は装備ごとに異なります。")
    ].join(""))+
    section("所持装備",gear.length?'<ul>'+list(gear.map(item=>{
      if(typeof item==="string") return item;
      return (item.name||"装備")+"  "+(item.enhancement!=null?"+"+item.enhancement:"+0");
    }))+'</ul>':empty("装備データはまだありません。"))+
    section("レアリティ",'<ol>'+list(["コモン","アンコモン","レア","エピック","レジェンダリー","ミシック","アーティファクト"])+'</ol>');
  }

  function renderWorld() {
    let html=section("世界",[
      row("世界名","アステリア世界（仮）"),
      row("最初の町","リーフェル（仮）"),
      row("世界構造","大陸・島々・地下・海底などへ拡張可能"),
      empty("広大なシームレス世界を目指します。遠距離エリアは軽量化のため地域単位で読み込みます。")
    ].join(""));
    html+=section("地域",'<ul>'+list(REGIONS.map(r=>r[0]+"： "+r[1]))+'</ul>');
    html+=section("町の主要NPC",'<ul>'+list(NPCS.map(n=>n[0]+" — "+n[1]+"（好み："+n[2]+"）"))+'</ul>'+
      empty("主要NPCは各8〜12イベント程度の個別ストーリーを持ちます。一般住民も多数登場し、生活スケジュールや日常会話があります。"));
    html+=section("NPCとの関係・物語",[
      row("好感度","0〜100","会話・依頼・好みに合う贈り物・物語で上昇"),
      row("個別ストーリー","6人・各自独立","開始順自由。一部だけ緩やかに連動"),
      row("共通イベント","失われた七つの遺産","任意参加。通常の冒険進行を妨げない")
    ].join(""));
    html+=section("家・交流・ランキング",[
      row("自宅","リーフェルに自分の家","家具・収納・生産設備・友達招待"),
      row("交流","協力型マルチプレイ","オープンワールドPvPなし"),
      row("ランキング","全体ランキング","日・週・月／戦闘・採集・生産・商売・探索・ミニゲーム"),
      row("取引","プレイヤー露店・市場","オークション／共通通貨")
    ].join(""));
    return html;
  }

  function render() {
    if(!ready) { content.innerHTML=empty("ログイン後にデータを読み込みます。"); return; }
    document.querySelectorAll(".panel-tab").forEach(button=>button.classList.toggle("active",button.dataset.tab===activeTab));
    const views={status:renderStatus,job:renderJobs,skills:renderSkills,equipment:renderEquipment,world:renderWorld};
    content.innerHTML=(views[activeTab]||renderStatus)();
  }

  document.querySelectorAll(".panel-tab").forEach(button=>button.addEventListener("click",()=>{
    activeTab=button.dataset.tab||"status"; render();
  }));
  openBtn.addEventListener("click",async()=>{panel.classList.remove("hidden");if(!ready)await load();render();});
  if(closeBtn) closeBtn.addEventListener("click",()=>panel.classList.add("hidden"));

  // game.js announces this only after a successful login or session restore.
  window.addEventListener("world:entered",()=>{load();});
  window.addEventListener("beforeunload",()=>{ if(ready && !lastSaveError) save(); });
})();
