'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Server}=require('./transport');
const G=require('./public/shared');
const SPAWNS=[[-10,-8],[10,5],[-10,8],[14,-11],[-5,-13],[5,13],[-18,-7],[18,6]];
const PALETTE=[0x65c9ff,0xff786d,0x9ae37a,0xd0a0ff,0xffce69,0x65e5cf,0xff92ce,0xe2e2e2];
function createGameServer(options={}){
 const rooms=new Map();
 const web=http.createServer((req,res)=>{
   let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{return res.writeHead(400).end();}
   if(pathname==='/health')return res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({ok:true,rooms:rooms.size}));
   if(pathname==='/favicon.ico')return res.writeHead(204).end();
   const filename=path.resolve(__dirname,'public','.'+(pathname==='/'?'/index.html':pathname));
   const root=path.resolve(__dirname,'public')+path.sep;
   if(!filename.startsWith(root))return res.writeHead(403).end();
   fs.readFile(filename,(err,data)=>{if(err)return res.writeHead(404).end('Not found');res.writeHead(200,{'Content-Type':filename.endsWith('.html')?'text/html; charset=utf-8':filename.endsWith('.js')?'application/javascript; charset=utf-8':'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(data);});
 });
 const io=new Server(web,{maxHttpBufferSize:16384});
 const now=()=>performance.now()/1000;
 function spawn(p,room,t){
   let chosen=SPAWNS[0],best=-1;
   for(const point of [...SPAWNS].sort(()=>Math.random()-.5)){
     let distance=Infinity;
     for(const other of room.players.values())if(other!==p&&!other.dead)distance=Math.min(distance,Math.hypot(point[0]-other.pos.x,point[1]-other.pos.z));
     if(distance>best){best=distance;chosen=point;}
   }
   p.pos={x:chosen[0],y:0,z:chosen[1]};p.vel={x:0,y:0,z:0};p.yaw=chosen[1]>0?0:Math.PI;p.pitch=0;p.onGround=true;
   p.hp=100;p.dead=false;p.respawnAt=0;p.protectedUntil=t+2.5;p.reloadEnd=0;p.cooldown=0;p.spawnId++;
   p.input={x:0,z:0,jump:false};p.ammo=G.weapons.map((w,i)=>({mag:w.mag,reserve:p.owned[i]?w.reserve:0}));
 }
 function leave(socket){const room=rooms.get(socket.data.room);if(room){room.players.delete(socket.id);socket.leave(room.code);if(!room.players.size)rooms.delete(room.code);}socket.data.room=null;}
 function snapshot(room,t){
   const players=[...room.players.values()].map(p=>({id:p.id,name:p.name,color:p.color,pos:p.pos,vel:p.vel,yaw:p.yaw,pitch:p.pitch,onGround:p.onGround,hp:p.hp,dead:p.dead,kills:p.kills,deaths:p.deaths,slot:p.slot,spawnId:p.spawnId,protected:Math.max(0,p.protectedUntil-t),respawn:Math.max(0,p.respawnAt-t)}));
   for(const p of room.players.values())io.to(p.id).emit('state',{room:room.code,players,self:{money:p.money,owned:p.owned,ammo:p.ammo,reload:Math.max(0,p.reloadEnd-t)},time:t});
 }
 function shoot(socket,p,room,t,data){
   if(p.dead||p.reloadEnd>t||p.cooldown>t)return;
   if(!data||!Number.isFinite(data.yaw)||!Number.isFinite(data.pitch))return;
   p.yaw=data.yaw%(Math.PI*2);p.pitch=G.clamp(data.pitch,-1.45,1.45);
   const w=G.weapons[p.slot],ammo=p.ammo[p.slot];if(ammo.mag<=0){reload(p,t);return;}
   ammo.mag--;p.cooldown=t+1/w.rof;p.protectedUntil=0;
   const cp=Math.cos(p.pitch),spread=w.spread+(Math.hypot(p.vel.x,p.vel.z)>1.5?w.moveSpread:0)*(data.scope&&w.scope?.4:1);
   const o={x:p.pos.x,y:p.pos.y+1.58,z:p.pos.z},d={x:-Math.sin(p.yaw)*cp+(Math.random()*2-1)*spread,y:Math.sin(p.pitch)+(Math.random()*2-1)*spread,z:-Math.cos(p.yaw)*cp+(Math.random()*2-1)*spread};
   const len=Math.hypot(d.x,d.y,d.z);for(const k of ['x','y','z'])d[k]/=len;
   const end={x:o.x+d.x*60,y:o.y+d.y*60,z:o.z+d.z*60};let distance=G.worldHit(o,end)*60,target=null,head=false;
   for(const other of room.players.values()){
     if(other===p||other.dead||other.protectedUntil>t)continue;
     const th=G.sphere(o,d,{x:other.pos.x,y:other.pos.y+1.6,z:other.pos.z},.27),tb=G.sphere(o,d,{x:other.pos.x,y:other.pos.y+1.05,z:other.pos.z},.46);
     const isHead=th>=0&&(tb<0||th<tb),hit=isHead?th:tb;
     if(hit>=0&&hit<distance){distance=hit;target=other;head=isHead;}
   }
   const hitPoint={x:o.x+d.x*distance,y:o.y+d.y*distance,z:o.z+d.z*distance};let killed=false;
   if(target){
     target.hp=Math.max(0,target.hp-w.dmg*(head?2:1));killed=target.hp===0;
     io.to(target.id).emit('hurt',{hp:target.hp,from:p.name});
     socket.emit('hit',{killed,head,point:hitPoint});
     if(killed){target.dead=true;target.deaths++;target.respawnAt=t+3;target.input={x:0,z:0};target.vel={x:0,y:0,z:0};target.reloadEnd=0;p.kills++;p.money+=500;io.to(room.code).emit('kill',{killer:p.name,victim:target.name,head});}
   }
   io.to(room.code).emit('shot',{id:p.id,slot:p.slot,origin:o,end:hitPoint,hit:!!target});snapshot(room,t);
 }
 function reload(p,t){const w=G.weapons[p.slot],a=p.ammo[p.slot];if(p.dead||p.reloadEnd>t||a.mag>=w.mag||a.reserve===0)return;p.reloadEnd=t+w.reloadT;}
 io.on('connection',socket=>{
   let budget=200,last=now();
   function allowed(){const t=now();budget=Math.min(200,budget+(t-last)*120);last=t;if(budget<1)return false;budget--;return true;}
   socket.on('join',(data,ack)=>{
     if(typeof ack!=='function')return;if(!allowed())return ack({error:'Too many requests.'});
     if(!data||typeof data!=='object')return ack({error:'Invalid room request.'});
     let code=typeof data.room==='string'?data.room.toUpperCase().trim():'';
     if(data.create){if(rooms.size>=100)return ack({error:'Server is full.'});do{code=crypto.randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));}
     else if(!/^[A-F0-9]{6}$/.test(code))return ack({error:'Enter the six-character room code.'});
     let room=rooms.get(code);if(!room&&!data.create)return ack({error:'Room not found. Ask your friend to create one.'});
     if(room&&room.players.size>=8&&!room.players.has(socket.id))return ack({error:'Room is full (8 players).'});
     leave(socket);if(!rooms.has(code)){room={code,players:new Map()};rooms.set(code,room);}else room=rooms.get(code);
     const used=new Set([...room.players.values()].map(p=>p.color));
     const p={id:socket.id,name:String(data.name||'Player').replace(/[\x00-\x1f<>]/g,'').trim().slice(0,18)||'Player',color:PALETTE.find(c=>!used.has(c))||PALETTE[0],money:900,owned:[true,false,false,false,false,false],slot:0,kills:0,deaths:0,spawnId:0,lastInput:now()};
     spawn(p,room,now());room.players.set(p.id,p);socket.data.room=code;socket.join(code);ack({id:p.id,room:code});snapshot(room,now());
   });
   socket.on('input',data=>{
     if(!allowed())return;const p=rooms.get(socket.data.room)?.players.get(socket.id);
     if(!p||p.dead||!data||!Number.isFinite(data.yaw)||!Number.isFinite(data.pitch))return;
     p.yaw=data.yaw%(Math.PI*2);p.pitch=G.clamp(data.pitch,-1.45,1.45);p.input={x:Number.isFinite(data.x)?G.clamp(data.x,-1,1):0,z:Number.isFinite(data.z)?G.clamp(data.z,-1,1):0,jump:data.jump===true};p.lastInput=now();
   });
   socket.on('action',(data,ack)=>{
     const reply=error=>{if(typeof ack==='function')ack(error?{error}:{ok:true});};
     if(!allowed())return reply('Too many requests.');const room=rooms.get(socket.data.room),p=room?.players.get(socket.id),t=now();
     if(!p||p.dead||!data||typeof data!=='object')return reply('Not in a live match.');
     if(data.type==='fire')shoot(socket,p,room,t,data);
     else if(data.type==='reload')reload(p,t);
     else if(data.type==='equip'){if(!Number.isInteger(data.slot)||!p.owned[data.slot])return reply('Weapon not owned.');p.slot=data.slot;p.reloadEnd=0;p.cooldown=Math.max(p.cooldown,t+.25);}
     else if(data.type==='buy'){
       const slot=data.slot,w=Number.isInteger(slot)?G.weapons[slot]:null;
       if(!w||p.owned[slot]||p.money<w.price)return reply('Cannot buy that weapon.');p.money-=w.price;p.owned[slot]=true;p.ammo[slot]={mag:w.mag,reserve:w.reserve};p.slot=slot;p.reloadEnd=0;p.cooldown=Math.max(p.cooldown,t+.25);
     }else if(data.type==='resupply'||data.type==='heal'){
       const price=data.type==='heal'?200:250;if(p.money<price)return reply('Not enough cash.');if(data.type==='heal'&&p.hp>=100)return reply('Health is already full.');p.money-=price;
       if(data.type==='heal')p.hp=Math.min(100,p.hp+50);else G.weapons.forEach((w,i)=>{if(p.owned[i])p.ammo[i].reserve=w.reserve;});
     }else return reply('Unknown action.');
     snapshot(room,t);reply();
   });
   socket.on('latency',ack=>{if(allowed()&&typeof ack==='function')ack();});
   socket.on('leave',()=>leave(socket));socket.on('disconnect',()=>leave(socket));
 });
 let previous=now(),accumulator=0,ticks=0;
 const timer=setInterval(()=>{
   const t=now();accumulator+=Math.min(.1,t-previous);previous=t;
   while(accumulator>=1/60){
     accumulator-=1/60;
     for(const room of rooms.values())for(const p of room.players.values()){
       if(p.dead){if(t>=p.respawnAt)spawn(p,room,t);continue;}
       if(t-p.lastInput>.3)p.input={x:0,z:0,jump:false};G.step(p,p.input,1/60);
       if(p.reloadEnd&&p.reloadEnd<=t){const w=G.weapons[p.slot],a=p.ammo[p.slot],take=a.reserve===-1?w.mag-a.mag:Math.min(w.mag-a.mag,a.reserve);a.mag+=take;if(a.reserve!==-1)a.reserve-=take;p.reloadEnd=0;}
     }
     if(++ticks%3===0)for(const room of rooms.values())snapshot(room,t);
   }
 },8);
 return {http:web,io,rooms,listen(port=3000,host='0.0.0.0'){return new Promise(resolve=>web.listen(port,host,()=>resolve(web.address())));},close(){clearInterval(timer);return new Promise(resolve=>io.close(()=>resolve()));}};
}
module.exports={createGameServer};
if(require.main===module){const app=createGameServer();app.listen(Number(process.env.PORT)||3000).then(({port})=>console.log(`INTRUDER PvP ready: http://localhost:${port} (LAN: use this PC's IPv4 address)`));}
