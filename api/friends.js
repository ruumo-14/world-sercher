"use strict";
const { db, send, bodyOf, getSession, handleError } = require("../lib/backend");
const uuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const clean = (value,max=1000) => typeof value === "string" ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,"").trim().slice(0,max) : "";
async function isFriend(a,b){const rows=await db("player_friends",{select:"friend_user_id",user_id:"eq."+a,friend_user_id:"eq."+b,limit:"1"});return !!rows?.length;}
async function friendCount(id){const rows=await db("player_friends",{select:"friend_user_id",user_id:"eq."+id});return rows?.length||0;}
async function profiles(ids){if(!ids.length)return [];return await db("game_saves",{select:"user_id,character_name,level",user_id:"in.("+ids.join(",")+")"})||[];}
async function isBlocked(a,b){const rows=await db("player_blocks",{select:"blocker_user_id",or:"(and(blocker_user_id.eq."+a+",blocked_user_id.eq."+b+"),and(blocker_user_id.eq."+b+",blocked_user_id.eq."+a+"))",limit:"1"});return !!rows?.length;}
module.exports=async function handler(req,res){
 try{
  const session=getSession(req);if(!session)return send(res,401,{error:"ログインが必要です。"});
  if(req.method==="GET"){
   const action=String(req.query?.action||"friends");
   if(action==="search"){
    const name=clean(req.query?.name,12).replace(/[%_*(),]/g,"");
    if(!name)return send(res,400,{error:"プレイヤー名を入力してね。"});
    const rows=await db("game_saves",{select:"user_id,character_name,level",character_name:"ilike.*"+name+"*",limit:"10"});
    return send(res,200,{players:(rows||[]).filter(x=>x.user_id!==session.sub)});
   }
   if(action==="friends"){
    const [f,received,sent]=await Promise.all([
     db("player_friends",{select:"friend_user_id,created_at",user_id:"eq."+session.sub,order:"created_at.desc",limit:"50"}),
     db("friend_requests",{select:"id,sender_user_id,created_at,expires_at",receiver_user_id:"eq."+session.sub,status:"eq.pending",expires_at:"gt."+new Date().toISOString(),order:"created_at.desc"}),
     db("friend_requests",{select:"id,receiver_user_id,created_at,expires_at",sender_user_id:"eq."+session.sub,status:"eq.pending",expires_at:"gt."+new Date().toISOString(),order:"created_at.desc"})
    ]);
    const ps=await profiles((f||[]).map(x=>x.friend_user_id).concat((received||[]).map(x=>x.sender_user_id)));
    const map=new Map(ps.map(x=>[x.user_id,x]));
    return send(res,200,{friends:(f||[]).map(x=>({...map.get(x.friend_user_id),created_at:x.created_at})),received:(received||[]).map(x=>({...x,profile:map.get(x.sender_user_id)})),sent:sent||[]});
   }
   if(action==="messages"){
    const target=String(req.query?.userId||"");
    if(!uuid(target)||!await isFriend(session.sub,target)||await isBlocked(session.sub,target))return send(res,403,{error:"このプレイヤーとのチャットは利用できません。"});
    const rows=await db("player_private_messages",{select:"id,sender_user_id,receiver_user_id,message_type,body,stamp_id,created_at",or:"(and(sender_user_id.eq."+session.sub+",receiver_user_id.eq."+target+"),and(sender_user_id.eq."+target+",receiver_user_id.eq."+session.sub+"))",order:"created_at.desc",limit:"100"});
    return send(res,200,{messages:(rows||[]).reverse()});
   }
   if(action==="groups"){
    const memberships=await db("chat_group_members",{select:"group_id,joined_at",user_id:"eq."+session.sub});
    const ids=(memberships||[]).map(x=>x.group_id);
    if(!ids.length)return send(res,200,{groups:[]});
    const groups=await db("chat_groups",{select:"id,name,owner_user_id,created_at",id:"in.("+ids.join(",")+")"});
    return send(res,200,{groups:groups||[]});
   }
   if(action==="group-messages"){
    const id=String(req.query?.groupId||"");if(!uuid(id))return send(res,400,{error:"グループが正しくありません。"});
    const m=await db("chat_group_members",{select:"user_id",group_id:"eq."+id,user_id:"eq."+session.sub,limit:"1"});
    if(!m?.length)return send(res,403,{error:"このグループのメンバーではありません。"});
    const rows=await db("group_chat_messages",{select:"id,sender_user_id,message_type,body,stamp_id,created_at",group_id:"eq."+id,order:"created_at.desc",limit:"100"});
    return send(res,200,{messages:(rows||[]).reverse()});
   }
   return send(res,400,{error:"指定された情報は取得できません。"});
  }
  if(req.method!=="POST"){res.setHeader("Allow","GET, POST");return send(res,405,{error:"この操作には対応していません。"});}
  const body=bodyOf(req),action=String(body.action||"");
  if(action==="request"){
   const target=String(body.targetUserId||"");
   if(!uuid(target)||target===session.sub)return send(res,400,{error:"申請先が正しくありません。"});
   if(await isFriend(session.sub,target))return send(res,409,{error:"すでにフレンドです。"});
   if(await friendCount(session.sub)>=50)return send(res,400,{error:"フレンドは最大50人です。"});
   const reverse=await db("friend_requests",{select:"id",sender_user_id:"eq."+target,receiver_user_id:"eq."+session.sub,status:"eq.pending",expires_at:"gt."+new Date().toISOString(),limit:"1"});
   if(reverse?.length){
    if(await friendCount(target)>=50)return send(res,400,{error:"相手のフレンド数が上限です。"});
    await db("player_friends",{}, {method:"POST",body:[{user_id:session.sub,friend_user_id:target},{user_id:target,friend_user_id:session.sub}]});
    await db("friend_requests",{id:"eq."+reverse[0].id},{method:"PATCH",body:{status:"accepted"}});
    return send(res,200,{accepted:true});
   }
   await db("friend_requests",{}, {method:"POST",body:{sender_user_id:session.sub,receiver_user_id:target}});
   return send(res,201,{requested:true});
  }
  if(action==="accept"){
   const id=String(body.requestId||"");if(!uuid(id))return send(res,400,{error:"申請が正しくありません。"});
   const rows=await db("friend_requests",{select:"id,sender_user_id",id:"eq."+id,receiver_user_id:"eq."+session.sub,status:"eq.pending",expires_at:"gt."+new Date().toISOString(),limit:"1"});
   if(!rows?.length)return send(res,404,{error:"申請が見つからないか、期限切れです。"});
   const target=rows[0].sender_user_id;
   if(await friendCount(session.sub)>=50||await friendCount(target)>=50)return send(res,400,{error:"どちらかのフレンド数が上限に達しています。"});
   await db("player_friends",{}, {method:"POST",body:[{user_id:session.sub,friend_user_id:target},{user_id:target,friend_user_id:session.sub}]});
   await db("friend_requests",{id:"eq."+id},{method:"PATCH",body:{status:"accepted"}});
   return send(res,200,{accepted:true});
  }
  if(action==="remove"){
   const target=String(body.targetUserId||"");if(!uuid(target))return send(res,400,{error:"対象プレイヤーが正しくありません。"});
   await db("player_friends",{or:"(and(user_id.eq."+session.sub+",friend_user_id.eq."+target+"),and(user_id.eq."+target+",friend_user_id.eq."+session.sub+"))"},{method:"DELETE"});
   return send(res,200,{removed:true});
  }
  if(action==="message"){
   const target=String(body.targetUserId||""),type=body.messageType==="stamp"?"stamp":"text",message=clean(body.message,1000),stamp=clean(body.stampId,64);
   if(!uuid(target)||!await isFriend(session.sub,target)||await isBlocked(session.sub,target))return send(res,403,{error:"このプレイヤーとのチャットは利用できません。"});
   if(type==="text"&&(!message||/https?:\/\/|\bwww\.|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(message)))return send(res,400,{error:"メッセージを確認してね。"});
   if(type==="stamp"&&!stamp)return send(res,400,{error:"スタンプが選択されていません。"});
   await db("player_private_messages",{}, {method:"POST",body:{sender_user_id:session.sub,receiver_user_id:target,message_type:type,body:type==="text"?message:"",stamp_id:type==="stamp"?stamp:null}});
   return send(res,201,{sent:true});
  }
  if(action==="create-group"){
   const name=clean(body.name,40)||"グループ",ids=Array.isArray(body.memberIds)?[...new Set(body.memberIds.filter(uuid))]:[];
   const members=[session.sub,...ids.filter(id=>id!==session.sub)];
   if(members.length<2||members.length>20)return send(res,400,{error:"グループは2〜20人にしてください。"});
   for(const id of members.slice(1))if(!await isFriend(session.sub,id))return send(res,403,{error:"グループにはフレンドだけ追加できます。"});
   const made=await db("chat_groups",{}, {method:"POST",returning:true,body:{owner_user_id:session.sub,name}});
   const group=Array.isArray(made)?made[0]:made;
   await db("chat_group_members",{}, {method:"POST",body:members.map(user_id=>({group_id:group.id,user_id}))});
   return send(res,201,{group});
  }
  if(action==="group-message"){
   const id=String(body.groupId||""),type=body.messageType==="stamp"?"stamp":"text",message=clean(body.message,1000),stamp=clean(body.stampId,64);
   if(!uuid(id))return send(res,400,{error:"グループが正しくありません。"});
   const m=await db("chat_group_members",{select:"user_id",group_id:"eq."+id,user_id:"eq."+session.sub,limit:"1"});
   if(!m?.length)return send(res,403,{error:"このグループのメンバーではありません。"});
   if(type==="text"&&(!message||/https?:\/\/|\bwww\.|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(message)))return send(res,400,{error:"メッセージを確認してね。"});
   if(type==="stamp"&&!stamp)return send(res,400,{error:"スタンプが選択されていません。"});
   await db("group_chat_messages",{}, {method:"POST",body:{group_id:id,sender_user_id:session.sub,message_type:type,body:type==="text"?message:"",stamp_id:type==="stamp"?stamp:null}});
   return send(res,201,{sent:true});
  }
  return send(res,400,{error:"指定された操作には対応していません。"});
 }catch(error){if(error?.code==="23505")return send(res,409,{error:"すでに登録されています。"});return handleError(res,error);}
};
