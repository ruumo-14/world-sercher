"use strict";
const crypto=require("crypto");
const {db,send,bodyOf,getSession,handleError}=require("../lib/backend");
const clean=(v,max)=>typeof v==="string"?v.replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max):"";
module.exports=async function handler(req,res){
 try{
  const session=getSession(req);if(!session)return send(res,401,{error:"ログインが必要です。"});
  if(req.method==="GET"){
   const rows=await db("player_reports",{select:"id,category,details,status,attachment_path,operator_reply,created_at,responded_at",reporter_user_id:"eq."+session.sub,order:"created_at.desc",limit:"100"});
   return send(res,200,{reports:rows||[]});
  }
  if(req.method!=="POST"){res.setHeader("Allow","GET, POST");return send(res,405,{error:"この操作には対応していません。"});}
  const body=bodyOf(req),category=body.category==="suggestion"?"suggestion":"bug";
  const issue=clean(body.issue,400),location=clean(body.location,120),circumstances=clean(body.circumstances,400);
  if(!issue||!location||!circumstances)return send(res,400,{error:"内容・発生場所・発生状況を入力してください。"});
  const details="内容："+issue+"\n発生場所："+location+"\n発生状況："+circumstances;
  let attachmentPath=null;
  if(body.imageData){
   if(typeof body.imageData!=="string"||body.imageData.length>3_000_000)return send(res,413,{error:"画像は2MB以下にしてください。"});
   const match=body.imageData.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
   if(!match)return send(res,400,{error:"画像はPNG・JPEG・WebPにしてください。"});
   const ext=match[1]==="jpeg"?"jpg":match[1],buffer=Buffer.from(match[2],"base64");
   if(buffer.length>2097152)return send(res,413,{error:"画像は2MB以下にしてください。"});
   const path=session.sub+"/"+Date.now()+"-"+crypto.randomBytes(5).toString("hex")+"."+ext;
   const base=(process.env.SUPABASE_URL||"").replace(/\/+$/,""),key=process.env.SUPABASE_SECRET_KEY||"";
   const upload=await fetch(base+"/storage/v1/object/bug-reports/"+path,{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"image/"+match[1],"x-upsert":"false"},body:buffer});
   if(!upload.ok)return send(res,503,{error:"画像を保存できませんでした。Supabaseのbug-reportsストレージ設定を確認してください。"});
   attachmentPath=path;
  }
  const inserted=await db("player_reports",{}, {method:"POST",returning:true,body:{reporter_user_id:session.sub,category,details,attachment_path:attachmentPath}});
  const report=Array.isArray(inserted)?inserted[0]:inserted;
  return send(res,201,{ok:true,reportId:report?.id||null});
 }catch(error){return handleError(res,error);}
};
