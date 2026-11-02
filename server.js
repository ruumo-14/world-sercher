"use strict";
const express=require("express"),http=require("http"),path=require("path"),crypto=require("crypto"),bcrypt=require("bcryptjs"),session=require("express-session"),PgSession=require("connect-pg-simple")(session),{Pool}=require("pg"),{rateLimit}=require("express-rate-limit"),{Server}=require("socket.io");
const app=express(),server=http.createServer(app),io=new Server(server),PORT=process.env.PORT||3000,WORLD={width:3200,height:2400},players=new Map();
const pool=process.env.DATABASE_URL?new Pool({connectionString:process.env.DATABASE_URL,ssl:true,max:5}):null;
app.set("trust proxy",1);app.use(express.json({limit:"30kb"}));
const sessionSecret=process.env.SESSION_SECRET||crypto.randomBytes(32).toString("hex");
if(!process.env.SESSION_SECRET)console.warn("SESSION_SECRET is not set; sessions reset on restart.");
const sessionMiddleware=session({store:pool?new PgSession({pool,tableName:"user_sessions",createTableIfMissing:true}):undefined,secret:sessionSecret,resave:false,saveUninitialized:false,cookie:{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",maxAge:1000*60*60*24*30}});
app.use(sessionMiddleware);io.engine.use(sessionMiddleware);
function requireDatabase(_req,res,next){if(!pool)return res.status(503).json({error:"アカウント保存用データベースがまだ接続されていません。設定後にもう一度試してね。"});next();}
function cleanName(v){if(typeof v!=="string")return"冒険者";return v.replace(/[<>\u0000-\u001f]/g,"").trim().slice(0,12)||"冒険者";}
function validUsername(v){return typeof v==="string"&&/^[\p{L}\p{N}_-]{3,16}$/u.test(v.trim());}
function validPassword(v){return typeof v==="string"&&v.length>=10&&Buffer.byteLength(v,"utf8")<=72;}
function publicProfile(r){return{username:r.username,name:r.character_name,x:Number(r.x),y:Number(r.y),level:Number(r.level||1),gold:Number(r.gold||0)};}
async function savePlayer(userId,p){if(!pool||!userId||!p)return;await pool.query("INSERT INTO game_saves(user_id,character_name,x,y) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET character_name=EXCLUDED.character_name,x=EXCLUDED.x,y=EXCLUDED.y,updated_at=NOW()",[userId,cleanName(p.name),p.x,p.y]);}
app.use(express.static(path.join(__dirname,"public")));
app.get("/health",(_req,res)=>res.json({ok:true,players:players.size,database:Boolean(pool)}));
const authLimiter=rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:"draft-7",legacyHeaders:false,message:{error:"試行回数が多すぎます。少し時間をおいてから試してね。"}});
app.post("/api/register",requireDatabase,authLimiter,async(req,res)=>{
 const username=typeof req.body.username==="string"?req.body.username.trim().normalize("NFC"):"",password=req.body.password,characterName=cleanName(req.body.characterName||username);
 if(!validUsername(username))return res.status(400).json({error:"ユーザーIDは3〜16文字で、英字・数字・_・- を使ってね。"});
 if(!validPassword(password))return res.status(400).json({error:"パスワードは10文字以上、72バイト以内にしてね。"});
 try{
  const hash=await bcrypt.hash(password,12);
  const result=await pool.query("INSERT INTO game_users(username,username_lower,password_hash) VALUES($1,$2,$3) RETURNING id,username",[username,username.toLocaleLowerCase("en-US"),hash]);
  const user=result.rows[0];await pool.query("INSERT INTO game_saves(user_id,character_name,x,y) VALUES($1,$2,1600,1370)",[user.id,characterName]);
  req.session.regenerate(err=>{if(err)return res.status(500).json({error:"登録後のログイン処理に失敗しました。"});req.session.userId=user.id;req.session.username=user.username;req.session.save(e=>{if(e)return res.status(500).json({error:"ログイン情報を保存できませんでした。"});res.status(201).json({profile:{username:user.username,name:characterName,x:1600,y:1370,level:1,gold:0}});});});
 }catch(err){if(err.code==="23505")return res.status(409).json({error:"そのユーザーIDはすでに使われています。"});console.error("register error",err);res.status(500).json({error:"登録できませんでした。時間をおいて試してね。"});}
});
app.post("/api/login",requireDatabase,authLimiter,async(req,res)=>{
 const username=typeof req.body.username==="string"?req.body.username.trim().normalize("NFC"):"",password=req.body.password;
 if(!username||typeof password!=="string")return res.status(400).json({error:"ユーザーIDとパスワードを入力してね。"});
 try{
  const result=await pool.query("SELECT u.id,u.username,u.password_hash,s.character_name,s.x,s.y,s.level,s.gold FROM game_users u JOIN game_saves s ON s.user_id=u.id WHERE u.username_lower=$1",[username.toLocaleLowerCase("en-US")]);
  const row=result.rows[0];if(!row||!(await bcrypt.compare(password,row.password_hash)))return res.status(401).json({error:"ユーザーIDかパスワードが違います。"});
  req.session.regenerate(err=>{if(err)return res.status(500).json({error:"ログイン処理に失敗しました。"});req.session.userId=row.id;req.session.username=row.username;req.session.save(e=>{if(e)return res.status(500).json({error:"ログイン情報を保存できませんでした。"});res.json({profile:publicProfile(row)});});});
 }catch(err){console.error("login error",err);res.status(500).json({error:"ログインできませんでした。時間をおいて試してね。"});}
});
app.get("/api/me",requireDatabase,async(req,res)=>{
 if(!req.session.userId)return res.json({loggedIn:false});
 try{const r=await pool.query("SELECT u.username,s.character_name,s.x,s.y,s.level,s.gold FROM game_users u JOIN game_saves s ON s.user_id=u.id WHERE u.id=$1",[req.session.userId]);if(!r.rows[0])return req.session.destroy(()=>res.json({loggedIn:false}));res.json({loggedIn:true,profile:publicProfile(r.rows[0])});}
 catch(err){console.error("profile error",err);res.status(500).json({error:"保存データを読み込めませんでした。"});}
});
app.post("/api/save",requireDatabase,async(req,res)=>{
 if(!req.session.userId)return res.status(401).json({error:"ログインが必要です。"});
 const x=Number(req.body.x),y=Number(req.body.y);if(!Number.isFinite(x)||!Number.isFinite(y))return res.status(400).json({error:"位置データが正しくありません。"});
 try{await pool.query("UPDATE game_saves SET character_name=$1,x=$2,y=$3,updated_at=NOW() WHERE user_id=$4",[cleanName(req.body.name),Math.max(12,Math.min(WORLD.width-12,x)),Math.max(12,Math.min(WORLD.height-12,y)),req.session.userId]);res.json({ok:true});}
 catch(err){console.error("save error",err);res.status(500).json({error:"データを保存できませんでした。"});}
});
app.post("/api/logout",(req,res)=>req.session.destroy(err=>{if(err)return res.status(500).json({error:"ログアウトできませんでした。"});res.clearCookie("connect.sid",{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production"});res.json({ok:true});}));
async function initializeDatabase(){
 if(!pool){console.warn("DATABASE_URL is not set. Account features are disabled.");return;}
 await pool.query("CREATE TABLE IF NOT EXISTS game_users(id BIGSERIAL PRIMARY KEY,username VARCHAR(16) NOT NULL,username_lower VARCHAR(16) NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
 await pool.query("CREATE TABLE IF NOT EXISTS game_saves(user_id BIGINT PRIMARY KEY REFERENCES game_users(id) ON DELETE CASCADE,character_name VARCHAR(12) NOT NULL DEFAULT '冒険者',x DOUBLE PRECISION NOT NULL DEFAULT 1600,y DOUBLE PRECISION NOT NULL DEFAULT 1370,level INTEGER NOT NULL DEFAULT 1,gold INTEGER NOT NULL DEFAULT 0,game_data JSONB NOT NULL DEFAULT '{}'::jsonb,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
 console.log("Account database is ready.");
}
io.use(async(socket,next)=>{
 const userId=socket.request.session&&socket.request.session.userId;if(!userId||!pool)return next(new Error("ログインが必要です。"));
 try{const r=await pool.query("SELECT u.id,u.username,s.character_name,s.x,s.y,s.level,s.gold FROM game_users u JOIN game_saves s ON s.user_id=u.id WHERE u.id=$1",[userId]);if(!r.rows[0])return next(new Error("アカウントデータが見つかりません。"));socket.data.account={id:String(userId),profile:publicProfile(r.rows[0])};next();}
 catch(err){next(err);}
});
io.on("connection",socket=>{
 socket.emit("world:init",{world:WORLD,players:Array.from(players.values())});
 socket.on("player:join",()=>{
  const p=socket.data.account.profile,player={id:socket.id,userId:socket.data.account.id,name:cleanName(p.name),x:p.x,y:p.y,color:["#f2c078","#8ec5ff","#f49ac2","#a9df9a"][Math.floor(Math.random()*4)]};
  players.set(socket.id,player);socket.emit("player:ready",player);socket.broadcast.emit("player:joined",player);
 });
 socket.on("player:move",(pos={})=>{
  const p=players.get(socket.id);if(!p)return;const x=Number(pos.x),y=Number(pos.y);if(!Number.isFinite(x)||!Number.isFinite(y))return;
  p.x=Math.max(12,Math.min(WORLD.width-12,x));p.y=Math.max(12,Math.min(WORLD.height-12,y));socket.broadcast.emit("player:moved",{id:socket.id,x:p.x,y:p.y});
  const now=Date.now();if(!socket.data.lastSaved||now-socket.data.lastSaved>4000){socket.data.lastSaved=now;savePlayer(p.userId,p).catch(e=>console.error("autosave error",e));}
 });
 socket.on("disconnect",()=>{const p=players.get(socket.id);if(p)savePlayer(p.userId,p).catch(e=>console.error("disconnect save error",e));players.delete(socket.id);socket.broadcast.emit("player:left",socket.id);});
});
initializeDatabase().then(()=>server.listen(PORT,"0.0.0.0",()=>console.log("World Sercher server listening on port "+PORT))).catch(err=>{console.error("Database initialization failed:",err);process.exit(1);});