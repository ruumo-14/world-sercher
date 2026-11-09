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
  let busy=false;
  async function refresh(){
    try{
      const r=await fetch("/api/social?action=global",{credentials:"same-origin"});
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||"チャットを読み込めません");
      list.innerHTML=(j.messages||[]).map(m=>'<div class="chat-line"><strong>'+esc(m.username)+'</strong>'+esc(m.body)+'<time>'+new Date(m.created_at).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"})+'</time></div>').join("")||'<p>まだメッセージはありません。</p>';
      list.scrollTop=list.scrollHeight;
      status.textContent="";
    }catch(e){status.textContent=e.message||"読み込みに失敗しました";}
  }
  open.addEventListener("click",()=>{panel.classList.remove("hidden");refresh();});
  close.addEventListener("click",()=>panel.classList.add("hidden"));
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
  window.addEventListener("focus",()=>{if(!panel.classList.contains("hidden"))refresh();});
})();
