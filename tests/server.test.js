'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {io}=require('../public/connection');
const {createGameServer}=require('../server');
const G=require('../public/shared');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function request(socket,event,data){return new Promise((resolve,reject)=>socket.timeout(2000).emit(event,data,(err,res)=>err?reject(err):resolve(res)));}
test('PvP rooms, movement, combat, economy, respawns, and cleanup',async t=>{
 const server=createGameServer(),address=await server.listen(0,'127.0.0.1'),url='http://127.0.0.1:'+address.port,clients=[];
 t.after(async()=>{clients.forEach(c=>c.disconnect());await server.close();});
 async function client(){const s=io(url,{transports:['websocket'],forceNew:true});clients.push(s);await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;}
 const a=await client(),b=await client(),c=await client();
 const joined=await request(a,'join',{create:true,name:'Roi'}),code=joined.room;
 assert.match(code,/^[A-F0-9]{6}$/);
 assert.equal((await request(b,'join',{room:code,name:'Enton'})).room,code);
 const separate=await request(c,'join',{create:true,name:'Other'});
 assert.notEqual(separate.room,code);
 const room=server.rooms.get(code),pa=room.players.get(a.id),pb=room.players.get(b.id);
 await t.test('invalid rooms and packet validation do not crash the server',async()=>{
   assert.ok((await request(c,'join',{room:'NOPE'})).error);
   a.emit('input',{x:Infinity,yaw:null,pitch:0});a.emit('action',null);await wait(50);
   assert.ok(Number.isFinite(pa.pos.x));
 });
 await t.test('movement uses controls and ignores client teleport attempts',async()=>{
   pa.pos={x:10,y:0,z:5};pa.vel={x:0,y:0,z:0};a.emit('input',{x:1,z:0,yaw:0,pitch:0,pos:{x:100000,y:1000,z:100000}});
   await wait(180);assert.ok(pa.pos.x>10&&pa.pos.x<12);a.emit('input',{x:0,z:0,yaw:0,pitch:0});
   await wait(400);assert.ok(Math.hypot(pa.vel.x,pa.vel.z)<.5);
 });
 await t.test('wall collision and head clearance',()=>{
   const p={pos:{x:19,y:0,z:3},vel:{x:7.4,y:0,z:0},yaw:0,onGround:true};
   for(let i=0;i<120;i++)G.step(p,{x:1,z:0},1/60);assert.ok(p.pos.x<=19.41);
   const jumper={pos:{x:10,y:2,z:5},vel:{x:0,y:7,z:0},yaw:0,onGround:false};
   for(let i=0;i<10;i++)G.step(jumper,{x:0,z:0},1/60);assert.ok(jumper.pos.y+1.7<=4.01);
 });
 await t.test('purchases, slot ownership, and cash are controlled by server',async()=>{
   assert.ok((await request(a,'action',{type:'equip',slot:5})).error);
   assert.ok((await request(a,'action',{type:'buy',slot:5,price:0})).error);
   assert.ok((await request(a,'action',{type:'buy',slot:2})).ok);assert.equal(pa.money,0);assert.ok(pa.owned[2]);
   assert.ok((await request(a,'action',{type:'buy',slot:2})).error);
   await request(a,'action',{type:'equip',slot:0});
 });
 await t.test('walls block shots, rooms isolate targets, and fire cooldown rejects spam',async()=>{
   pa.pos={x:-5,y:0,z:5};pb.pos={x:5,y:0,z:5};pa.vel={x:0,y:0,z:0};pb.vel={x:0,y:0,z:0};pa.protectedUntil=pb.protectedUntil=0;pa.cooldown=0;
   const before=pa.ammo[0].mag;
   for(let i=0;i<10;i++)a.emit('action',{type:'fire',yaw:-Math.PI/2,pitch:0});
   await wait(70);assert.equal(pb.hp,100);assert.equal(pa.ammo[0].mag,before-1);
   assert.equal(server.rooms.get(separate.room).players.get(c.id).hp,100);
 });
 await t.test('headshots kill, award cash, and respawn retains owned weapons',async()=>{
   pa.pos={x:10,y:0,z:5};pb.pos={x:10,y:0,z:2};pa.vel={x:0,y:0,z:0};pb.vel={x:0,y:0,z:0};pb.protectedUntil=0;
   for(let i=0;i<2;i++){pa.cooldown=0;await request(a,'action',{type:'fire',yaw:0,pitch:0});}
   assert.equal(pb.dead,true);assert.equal(pa.kills,1);assert.equal(pb.deaths,1);assert.equal(pa.money,500);
   const spawnId=pb.spawnId;pb.respawnAt=0;await wait(60);assert.equal(pb.dead,false);assert.equal(pb.hp,100);assert.ok(pb.spawnId>spawnId);assert.ok(pb.protectedUntil>0);
   const hp=pb.hp;pa.cooldown=0;const dx=pb.pos.x-pa.pos.x,dz=pb.pos.z-pa.pos.z;
   await request(a,'action',{type:'fire',yaw:Math.atan2(-dx,-dz),pitch:0});assert.equal(pb.hp,hp);
   pa.ammo[0].mag=0;await request(a,'action',{type:'reload'});assert.ok(pa.reloadEnd>0);pa.reloadEnd=.001;await wait(40);assert.equal(pa.ammo[0].mag,12);
 });
 await t.test('spawn locations are clear and the ninth player is rejected',async()=>{
   const extra=[];for(let i=0;i<6;i++){const s=await client();extra.push(s);assert.ok(!(await request(s,'join',{room:code,name:'P'+i})).error);}
   const ninth=await client();assert.ok((await request(ninth,'join',{room:code})).error);
   assert.equal(room.players.size,8);
   for(const p of room.players.values())for(const solid of G.solids)assert.ok(!(p.pos.x+.35>solid.min.x&&p.pos.x-.35<solid.max.x&&p.pos.z+.35>solid.min.z&&p.pos.z-.35<solid.max.z&&solid.min.y<1.7&&solid.max.y>.1),'spawn inside solid');
   extra.forEach(s=>s.disconnect());
 });
 await t.test('disconnect removes players and empty rooms',async()=>{a.disconnect();b.disconnect();c.disconnect();await wait(100);assert.equal(server.rooms.size,0);});
});
