"use strict";
(() => {
 const $=id=>document.getElementById(id),open=$("open-bug-report"),panel=$("bug-report-panel"),close=$("close-bug-report"),form=$("bug-report-form"),status=$("bug-status"),history=$("bug-history");
 if(!open||!panel||!close||!form)return;
 async function api(url,options){const r=await fetch(url,{credentials:"same-origin",...options});const j=await r.json();if(!r.ok)throw new Error(j.error||"通信に失敗しました");return j;}
 async function refresh(){try{const j=await api("/api/bug-reports");history.innerHTML=(j.reports||[]).map(r=>'<div class="bug-report-row"><b>'+(r.category==="suggestion"?"改善提案":"不具合報告")+'</b> ・ '+new Date(r.created_at).toLocaleString("ja-JP")+'<small>状態：'+String(r.status||"受付中")+'</small><p>'+String(r.details||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))+'</p>'+(r.attachment_path?"<small>画像添付済み</small>":"")+(r.operator_reply?'<small>運営からの返信：'+String(r.operator_reply).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))+'</small>':"")+'</div>').join("")||"<p>報告履歴はありません。</p>";}catch(e){status.textContent=e.message;}}
 open.addEventListener("click",()=>{panel.classList.remove("hidden");refresh();});close.addEventListener("click",()=>panel.classList.add("hidden"));$("bug-refresh").addEventListener("click",refresh);
 form.addEventListener("submit",async e=>{e.preventDefault();status.textContent="送信しています…";try{let imageData="";const file=$("bug-image").files?.[0];if(file){if(file.size>2097152)throw new Error("画像は2MB以下にしてください。");if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw new Error("PNG・JPEG・WebP画像を選んでください。");imageData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("画像を読み込めませんでした。"));reader.readAsDataURL(file);});}
 await api("/api/bug-reports",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({category:$("bug-category").value,issue:$("bug-issue").value,location:$("bug-location").value,circumstances:$("bug-circumstances").value,imageData})});
 form.reset();status.textContent="報告を送信しました。";await refresh();
 }catch(err){status.textContent=err.message||"送信に失敗しました。";}});
})();
