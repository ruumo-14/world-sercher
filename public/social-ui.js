"use strict";
(() => {
  const open=document.getElementById("open-chat");
  const panel=document.getElementById("chat-panel");
  const close=document.getElementById("close-chat");
  const list=document.getElementById("chat-messages");
  const form=document.getElementById("chat-form");
  const input=document.getElementById("chat-input");
  const status=document.getElementById("chat-status");
  if(!open||!panel||!close||!list||!form||!input||!status)return;
  const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  let busy=false,selfId="";
  async function refresh(){
    try{
      const r=await fetch("/api/social?action=global",{credentials:"same-origin"});
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||"チャットを読み込めません");
      selfId=j.me||"";
      list.innerHTML=(j.messages||[]).slice(-20).map(m=>{
        const tools=m.sender_user_id!==selfId?'<span class="chat-tools" data-user="'+esc(m.sender_user_id)+'"><button type="button" data-block>ブロック</button><button type="button" data-report>通報</button></span>':"";
        const time=new Date(m.created_at).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"});
        return '<div class="chat-line"><strong>'+esc(m.username)+'</strong>'+esc(m.body)+tools+'<time>'+time+'</time></div>';
      }).join("")||"<p>まだメッセージはありません。</p>";
      list.scrollTop=list.scrollHeight;
      status.textContent="";
    }catch(e){status.textContent=e.message||"読み込みに失敗しました";}
  }
  open.addEventListener("click",()=>{panel.classList.remove("hidden");refresh();});
  close.addEventListener("click",()=>panel.classList.add("hidden"));
  list.addEventListener("click",async e=>{
    const button=e.target.closest("[data-block],[data-report]");
    if(!button)return;
    const userId=button.parentElement?.dataset.user;
    if(!userId)return;
    const action=button.hasAttribute("data-block")?"block":"report";
    try{
      const payload=action==="block"
        ?{action,userId}
        :{action,targetUserId:userId,category:"chat",details:"全体チャットのメッセージについての通報"};
      const r=await fetch("/api/social",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||"処理できませんでした");
      status.textContent=action==="block"?"プレイヤーをブロックしました。":"運営に通報しました。";
      await refresh();
    }catch(error){status.textContent=error.message||"処理に失敗しました";}
  });
  form.addEventListener("submit",async e=>{
    e.preventDefault();if(busy)return;
    const message=input.value.trim();if(!message)return;
    busy=true;
    try{
      const r=await fetch("/api/social",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"global-message",message})});
      const j=await r.json();if(!r.ok)throw new Error(j.error||"送信できませんでした");
      input.value="";await refresh();
    }catch(e){status.textContent=e.message||"送信に失敗しました";}
    finally{busy=false;}
  });
  window.setInterval(()=>{if(!panel.classList.contains("hidden"))refresh();},4000);
})();
