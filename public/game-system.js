"use strict";
(() => {
 const panel=document.getElementById("adventurer-panel"),openBtn=document.getElementById("open-adventurer"),closeBtn=document.getElementById("close-adventurer"),content=document.getElementById("panel-content"),message=document.getElementById("panel-message");
 if(!panel||!openBtn)return;
 const JOBS=["戦士","魔法使い","弓使い","採掘師","木こり","採集師","鍛冶師","調理師","服飾職人","農家","釣り師","商人"];
 const SPECIES=["人間","エルフ","ドワーフ","獣人","水棲族","竜人","妖精族"];
 const SKILLS=["剣術","魔法操作","弓術","採掘技術","伐採技術","採集技術","鍛冶技術","料理技術","服飾技術","農業技術","釣り技術","商売技術"];
 const TASKS={
 "戦士":[["訓練する",8,12],["模擬戦に勝つ",18,25]],"魔法使い":[["魔力制御の練習",8,12],["魔法研究を完成",18,25]],"弓使い":[["射撃訓練",8,12],["難しい的を射抜く",18,25]],
 "採掘師":[["鉱石を採掘",8,12],["希少鉱石を採掘",18,25]],"木こり":[["木材を伐採",8,12],["大木を伐採",18,25]],"採集師":[["草花を採集",6,10],["珍しい素材を採集",16,22]],
 "鍛冶師":[["簡単な道具を製作",8,12],["高性能な武器を製作",22,30]],"調理師":[["軽食を調理",6,10],["手の込んだ料理を完成",18,25]],"服飾職人":[["普段着を製作",8,12],["装飾付き衣装を製作",18,25]],
 "農家":[["作物の世話",5,8],["作物を収穫",10,16]],"釣り師":[["魚を釣る",7,11],["珍しい魚を釣る",16,22]],"商人":[["商品を販売",6,10],["大きな取引を成立",18,25]]
 };
 let data={species:"人間",level:1,xp:0,job:null,jobs:{},skills:{},enhancement:0,gold:0,lastJobChange:null,appearance:{},};
 let activeTab="status",saving=false,ready=false;
 const cap={player:100,job:50,skill:10,enhancement:10};
 const xpNeed=l=>Math.floor(100*Math.pow(l,1.55));
 const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 function say(t){message.textContent=t;}
 async function save(){if(!ready||saving)return;saving=true;try{const r=await fetch("/api/game-data",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({gameData:data})});if(!r.ok)throw new Error("保存に失敗");}catch(e){say("保存できませんでした。通信を確認してね。");}finally{saving=false;}}
 async function load(){try{const r=await fetch("/api/game-data",{credentials:"same-origin"});if(!r.ok)throw new Error();const v=await r.json();if(v.gameData&&typeof v.gameData==="object")data={...data,...v.gameData,jobs:v.gameData.jobs||{},skills:v.gameData.skills||{}};}catch(e){say("冒険者データを読み込めませんでした。ログイン後に開いてね。");}ready=true;render();}
 function currentJob(){return data.job?data.jobs[data.job]||{level:1,xp:0}:null;}
 function addPlayerXP(n){data.xp+=n;while(data.level<cap.player&&data.xp>=xpNeed(data.level)){data.xp-=xpNeed(data.level);data.level++;say("プレイヤーレベルが "+data.level+" になった！");}if(data.level>=cap.player)data.xp=0;}
 function addJobXP(n){if(!data.job)return;const j=currentJob();j.xp+=n;while(j.level<cap.job&&j.xp>=xpNeed(j.level)){j.xp-=xpNeed(j.level);j.level++;say(data.job+"がレベル "+j.level+" になった！");}if(j.level>=cap.job)j.xp=0;}
 function render(){if(!ready)return;
  document.querySelectorAll(".panel-tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===activeTab));
  if(activeTab==="status"){content.innerHTML=`<h3>冒険者情報</h3><div class="stat-grid"><div class="stat">種族<strong>${data.species}</strong></div><div class="stat">プレイヤーレベル<strong>${data.level} / ${cap.player}</strong><span class="muted">経験値 ${data.xp} / ${xpNeed(data.level)}</span></div><div class="stat">現在の職業<strong>${data.job||"未選択"}</strong></div><div class="stat">所持GOLD<strong>${data.gold}</strong></div></div><h3>種族</h3><p>全7種族から選択できます。種族による能力差は小さく、全職業・全地域を利用できます。</p><div class="action-row"><select id="species-select">${SPECIES.map(s=>`<option ${s===data.species?"selected":""}>${s}</option>`).join("")}</select><button class="panel-action" id="species-save">種族を設定</button></div><p class="muted">※種族変更は通常メニューではできません。後日、特別な神殿で素材とGOLDを使う仕組みを追加予定です。</p><h3>経験値を獲得</h3><p>討伐・クエストが中心。探索・採集・生産などからも少量獲得する設計です。</p><div class="action-row"><button class="panel-action" data-player-xp="15">探索を完了（+15 XP）</button><button class="panel-action" data-player-xp="35">クエストを完了（+35 XP）</button></div>`;}
  if(activeTab==="job"){const j=currentJob();const changed=data.lastJobChange===today();content.innerHTML=`<h3>職業ギルド</h3><p>同時に就ける職業は1つ。職業変更は各町の職業ギルドで1日1回まで。各職業のレベル・経験値は個別に保存されます。</p><div class="stat-grid"><div class="stat">現在の職業<strong>${data.job||"未選択"}</strong></div><div class="stat">職業レベル<strong>${j?j.level+" / "+cap.job:"—"}</strong><span class="muted">${j?"経験値 "+j.xp+" / "+xpNeed(j.level):"職業を選んでね"}</span></div></div><div class="action-row"><select id="job-select">${JOBS.map(s=>`<option ${s===data.job?"selected":""}>${s}</option>`).join("")}</select><button class="panel-action" id="job-change" ${changed?"disabled":""}>${changed?"本日は変更済み":"職業を変更"}</button></div><p class="muted">${changed?"次の変更可能日まで待ってね。":"初回選択後、次回から1日1回変更できます。"}</p>${data.job?`<h3>${data.job}の仕事</h3>${(TASKS[data.job]||[]).map((t,i)=>`<div class="action-row"><span>${t[0]}（約${i===0?"短時間":"長め"}）</span><button class="panel-action" data-job-task="${i}">実行（+ ${t[1]}〜${t[2]} XP）</button></div>`).join("")}<p class="muted">職業に関係する行動だけで職業経験値を獲得します。作業時間・難易度に応じて報酬を変える試作値です。</p>`:""}`;}
  if(activeTab==="skills"){content.innerHTML=`<h3>スキル</h3><p>スキルの初期上限は各レベル10。職業に関連するスキルを育てる設計です。</p>${SKILLS.map(s=>{const v=data.skills[s]||1;return `<div class="action-row"><span>${s}：Lv.${v} / ${cap.skill}</span><button class="panel-action" data-skill="${s}" ${v>=cap.skill?"disabled":""}>訓練して成長</button></div>`;}).join("")}<p class="muted">※スキル効果・本格的な経験値計算は今後実装。限界突破は未実装です。</p>`;}
  if(activeTab==="equipment"){content.innerHTML=`<h3>装備強化</h3><div class="stat">現在の強化段階<strong>+${data.enhancement} / +${cap.enhancement}</strong></div><p>強化段階の初期上限は＋10。将来アップデートで上限を変更できる設計です。</p><div class="action-row"><button class="panel-action" id="enhance" ${data.enhancement>=cap.enhancement?"disabled":""}>試作強化を1段階進める</button></div><p class="muted">※現在は動作確認用の仮強化です。素材・費用・成功率は未決定。限界突破は未実装です。</p>`;}
 }
 panel.addEventListener("click",async e=>{const b=e.target.closest("button");if(!b)return;
  if(b.id==="species-save"){data.species=document.getElementById("species-select").value;say("種族を保存したよ。種族の能力差は今後バランス調整します。");}
  if(b.id==="job-change"){const next=document.getElementById("job-select").value;if(data.lastJobChange===today()){say("今日はもう職業を変更できません。");return;}if(!data.job||next!==data.job){data.job=next;data.jobs[next]=data.jobs[next]||{level:1,xp:0};data.lastJobChange=today();say(next+"に変更したよ！");}}
  if(b.dataset.playerXp){addPlayerXP(Number(b.dataset.playerXp));say("プレイヤー経験値を獲得したよ。");}
  if(b.dataset.jobTask!==undefined){if(!data.job){say("先に職業を選んでね。");return;}const task=TASKS[data.job][Number(b.dataset.jobTask)];addJobXP(task[1]);addPlayerXP(5);say(task[0]+"！ 職業経験値を獲得したよ。");}
  if(b.dataset.skill){const s=b.dataset.skill;data.skills[s]=Math.min(cap.skill,(data.skills[s]||1)+1);say(s+"がレベル "+data.skills[s]+" になったよ。");}
  if(b.id==="enhance"){data.enhancement=Math.min(cap.enhancement,data.enhancement+1);say("装備強化が +"+data.enhancement+" になったよ。");}
  await save();render();
 });
 document.querySelectorAll(".panel-tab").forEach(b=>b.addEventListener("click",()=>{activeTab=b.dataset.tab;render();}));
 openBtn.addEventListener("click",()=>{panel.classList.remove("hidden");render();});closeBtn.addEventListener("click",()=>panel.classList.add("hidden"));
 load();
})();
