"use strict";
const { db, send, getSession, handleError } = require("../lib/backend");
module.exports=async function handler(req,res){
 try{
  const session=getSession(req);
  if(!session)return send(res,401,{error:"ログインが必要です。"});
  if(req.method!=="GET"){res.setHeader("Allow","GET");return send(res,405,{error:"この操作には対応していません。"});}
  const category=String(req.query?.category||"level");
  if(!["level","gold","minigame"].includes(category))return send(res,400,{error:"ランキングカテゴリが正しくありません。"});
  const rows=await db("game_saves",{select:"user_id,character_name,level,gold,game_data,level_record_at,gold_record_at,updated_at",order:"updated_at.asc",limit:"1000"});
  const records=(rows||[]).map(row=>{
   const game=row.game_data&&typeof row.game_data==="object"?row.game_data:{};
   const score=category==="level"?Number(row.level||game.level||1):category==="gold"?Number(row.gold||game.gold||0):Number(game.minigameBestScore||game.minigame?.bestScore||0);
   const achievedAt=category==="level"?row.level_record_at:category==="gold"?row.gold_record_at:game.minigameBestAt||row.updated_at;
   return {userId:row.user_id,name:row.character_name||"冒険者",score,achievedAt};
  }).filter(x=>Number.isFinite(x.score)&&x.score>=0&&(category!=="minigame"||x.score>0));
  records.sort((a,b)=>b.score-a.score||new Date(a.achievedAt||0)-new Date(b.achievedAt||0));
  const rank=records.findIndex(x=>x.userId===session.sub);
  const own=rank>=0?records[rank]:null;
  return send(res,200,{category,top:records.slice(0,50).map((x,i)=>({rank:i+1,name:x.name,score:x.score})),myRank:rank>=0&&rank<50?rank+1:"圏外",myScore:own?.score??null,totalPlayers:records.length});
 }catch(error){return handleError(res,error);}
};
