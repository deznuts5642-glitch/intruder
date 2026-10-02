'use strict';
const socket=io({autoConnect:false});
const net={joined:false,id:null,room:null,states:[],remotes:new Map(),lastSpawn:-1,lastHp:100,ping:0,joining:false};
const nameInput=el('playerName'),codeInput=el('roomCode'),statusEl=el('connectStatus');
nameInput.value=localStorage.getItem('intruder-name')||'Player';
codeInput.value=new URLSearchParams(location.search).get('room')||'';
function setStatus(text){statusEl.textContent=text;el('netStatus').textContent=text;}
function readInput(){return {x:(keys.KeyD?1:0)-(keys.KeyA?1:0),z:(keys.KeyS?1:0)-(keys.KeyW?1:0),jump:!!keys.Space};}
function clearInput(){for(const k of Object.keys(keys))keys[k]=false;mouseDown=false;rightDown=false;socket.emit('input',{x:0,z:0,jump:false,yaw:player.yaw,pitch:player.pitch});}
function action(data){if(!net.joined||!socket.connected)return;socket.emit('action',data,result=>{if(result?.error)popup(result.error,true);});}
function showMenu(message){
 net.joined=false;net.id=null;net.joining=false;clearInput();gameState='menu';document.exitPointerLock();menuEl.classList.remove('hidden');pauseEl.classList.add('hidden');gameoverEl.classList.add('hidden');shopEl.style.display='none';el('copyLink').hidden=true;el('roomTag').textContent='OFFLINE';
 for(const r of net.remotes.values())disposeRemote(r);net.remotes.clear();net.states=[];el('scoreboard').classList.add('hidden');setStatus(message);el('startBtn').disabled=false;el('joinBtn').disabled=false;
}
function joinRoom(create){
 if(net.joining)return;if(!socket.connected){setStatus('Server unavailable. Wait for reconnection.');return;}
 initAudio();AC?.resume();net.joining=true;el('startBtn').disabled=true;el('joinBtn').disabled=true;setStatus('Joining match…');
 socket.timeout(5000).emit('join',{create,room:codeInput.value.trim(),name:nameInput.value},(err,result)=>{
   net.joining=false;el('startBtn').disabled=false;el('joinBtn').disabled=false;
   if(err||result?.error){setStatus(result?.error||'Server did not respond. Try again.');return;}
   net.joined=true;net.id=result.id;net.room=result.room;net.lastSpawn=-1;localStorage.setItem('intruder-name',nameInput.value);menuEl.classList.add('hidden');gameState='paused';pauseEl.classList.remove('hidden');
   codeInput.value=net.room;el('roomTag').textContent='ROOM '+net.room;el('copyLink').hidden=false;history.replaceState(null,'','?room='+net.room);setStatus('CONNECTED');banner('FREE FOR ALL','INVITE A FRIEND · FIRST SHOT ENDS SPAWN PROTECTION');
   // The asynchronous join may lose the browser's user gesture; show an explicit resume button.
 });
}
el('startBtn').onclick=()=>joinRoom(true);el('joinBtn').onclick=()=>joinRoom(false);
codeInput.addEventListener('keydown',e=>{if(e.key==='Enter')joinRoom(false);});
el('copyLink').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);popup('Invite copied');}catch{popup('Room code: '+net.room);}};
socket.on('connect',()=>{setStatus('CONNECTED · CREATE OR JOIN A ROOM');});
socket.on('connect_error',()=>{setStatus('Cannot reach server. Start the game server and reload.');});
socket.on('disconnect',()=>showMenu('Connection lost. Reconnecting… rejoin your room when ready.'));
socket.connect();
setInterval(()=>{if(!net.joined)return;const input=gameState==='playing'&&!player.dead?readInput():{x:0,z:0,jump:false};socket.volatile.emit('input',{...input,yaw:player.yaw,pitch:player.pitch});},1000/30);
setInterval(()=>{if(!socket.connected)return;const start=performance.now();socket.timeout(3000).emit('latency',err=>{if(!err){net.ping=Math.round(performance.now()-start);if(net.joined)el('netStatus').textContent=net.states.length+'/8 PLAYERS · '+net.ping+'ms';}});},2000);

equipSlot=function(i){if(!owned[i]||i===curSlot)return;action({type:'equip',slot:i});};
startReload=function(){if(player.dead||reloading>0)return;action({type:'reload'});sfxClick();};
playerShoot=function(){
 const w=WEAPONS[curSlot],a=ammo[curSlot];if(fireCooldown>0||reloading>0||player.dead||!net.joined)return;
 if(a.mag<=0){startReload();return;}
 fireCooldown=1/w.rof;a.mag--;action({type:'fire',yaw:player.yaw,pitch:player.pitch,scope:!!rightDown});
 player.recoil+=w.kick;player.recoilYaw+=rand(-w.kick,w.kick)*.4;player.shake=Math.min(.25,player.shake+w.kick*2);vmKick=.12;
 const mw=_v1.copy(vmMuzzle);viewmodel.localToWorld(mw);muzzleFlash(mw.x,mw.y,mw.z);sfxShoot(w.pitch,.5);updateHUD();
};
pauseGame=function(){if(gameState!=='playing')return;clearInput();gameState='paused';pauseEl.classList.remove('hidden');};
resumeGame=function(){if(!net.joined||player.dead)return;clearInput();pauseEl.classList.add('hidden');gameState='playing';lockPointer();};
openShop=function(){if(player.dead)return;clearInput();gameState='shop';document.exitPointerLock();renderShop();shopEl.style.display='flex';sfxClick();};
closeShop=function(){if(player.dead)return;shopEl.style.display='none';gameState='playing';lockPointer();setTimeout(()=>{if(gameState==='playing'&&!pointerLocked)pauseGame();},200);};
restartGame=function(){};
el('resumeBtn').onclick=resumeGame;el('shopClose').onclick=closeShop;
let shopSignature='';
renderShop=function(){
 const signature=JSON.stringify([player.money,owned,player.hp>=100]);if(shopSignature===signature&&shopGrid.children.length)return;shopSignature=signature;
 shopMoney.textContent='$'+player.money+' · MATCH CONTINUES WHILE SHOPPING';shopGrid.replaceChildren();
 function item(name,description,price,isOwned,callback){const d=document.createElement('button');d.className='shopItem'+(isOwned?' owned':player.money<price?' cant':'');const title=document.createElement('div');title.className='nm';title.textContent=name;const desc=document.createElement('div');desc.className='st';desc.textContent=description;const tag=document.createElement('div');tag.className='pr';tag.textContent=isOwned?'OWNED':'$'+price;d.append(title,desc,tag);d.disabled=isOwned||player.money<price;d.onclick=callback;shopGrid.append(d);}
 WEAPONS.forEach((w,i)=>item(w.name,'DMG '+w.dmg+' · MAG '+w.mag+' · '+(w.auto?'AUTO':'SEMI'),w.price,owned[i],()=>action({type:'buy',slot:i})));
 item('AMMO RESUPPLY','Refill your reserve ammunition.',250,false,()=>action({type:'resupply'}));item('FIELD MEDKIT','Restore up to 50 HP.',200,player.hp>=100,()=>action({type:'heal'}));
};
window.addEventListener('blur',clearInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(gameState==='playing')pauseGame();}});
document.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement)return;if(['Space','Tab','KeyW','KeyA','KeyS','KeyD'].includes(e.code))e.preventDefault();if(e.code==='Tab'&&net.joined)el('scoreboard').classList.remove('hidden');});
document.addEventListener('keyup',e=>{if(e.code==='Tab')el('scoreboard').classList.add('hidden');});

function makeRemote(state){
 const g=new THREE.Group(),shirt=lam(null,state.color,{c:state.color,i:.35}),pants=lam(null,0x222831,{c:0x222831,i:.3});
 const add=(w,h,d,x,y,z,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);g.add(m);return m;};
 add(.56,.62,.32,0,1.1,0,shirt);add(.32,.34,.32,0,1.6,0,lam(texFace,0xffffff,{c:0x554433,i:.45}));
 const legs=[add(.2,.78,.24,-.14,.39,0,pants),add(.2,.78,.24,.14,.39,0,pants)];
 add(.16,.5,.2,-.36,1.2,-.15,shirt);add(.16,.5,.2,.36,1.2,-.15,shirt);add(.09,.12,.55,.36,1.3,-.4,vmMats.dark);
 g.position.set(state.pos.x,state.pos.y,state.pos.z);scene.add(g);return {mesh:g,legs,target:state,walk:0};
}
function disposeRemote(r){scene.remove(r.mesh);const materials=new Set();r.mesh.traverse(m=>{if(m.geometry)m.geometry.dispose();if(m.material)for(const mat of [].concat(m.material))if(!Object.values(vmMats).includes(mat))materials.add(mat);});for(const mat of materials)mat.dispose();}
window.updateNetworkVisuals=function(dt){
 for(const r of net.remotes.values()){
   const s=r.target;r.mesh.visible=!s.dead;if(s.dead)continue;const alpha=1-Math.exp(-18*dt);
   r.mesh.position.lerp(V3(s.pos.x,s.pos.y,s.pos.z),alpha);let diff=(s.yaw-r.mesh.rotation.y+Math.PI*3)%TAU-Math.PI;r.mesh.rotation.y+=diff*alpha;
   r.walk+=Math.hypot(s.vel.x,s.vel.z)*dt;const sw=Math.sin(r.walk*2.2)*.45;r.legs[0].rotation.x=sw;r.legs[1].rotation.x=-sw;
 }
};
socket.on('state',state=>{
 if(!net.joined||state.room!==net.room)return;const me=state.players.find(p=>p.id===net.id);if(!me)return;net.states=state.players;
 const respawn=me.spawnId!==net.lastSpawn,wasDead=player.dead,oldSlot=curSlot;
 player.dead=me.dead;player.hp=me.hp;player.money=state.self.money;player.kills=me.kills;
 state.self.owned.forEach((v,i)=>owned[i]=v);state.self.ammo.forEach((a,i)=>{ammo[i].mag=a.mag;ammo[i].reserve=a.reserve===-1?Infinity:a.reserve;});curSlot=me.slot;reloading=state.self.reload;
 if(respawn){net.lastSpawn=me.spawnId;player.pos.set(me.pos.x,me.pos.y,me.pos.z);player.yaw=me.yaw;player.pitch=me.pitch;clearInput();fireCooldown=0;fireReady=true;}
 else {const target=V3(me.pos.x,me.pos.y,me.pos.z);player.pos.lerp(target,gameState==='playing'&&player.pos.distanceTo(target)<2?.35:1);}
 player.vel.set(me.vel.x,me.vel.y,me.vel.z);player.onGround=me.onGround;
 if(oldSlot!==curSlot){buildViewmodel();sfxChaChing();}
 if(me.dead){gameState='dead';pauseEl.classList.add('hidden');shopEl.style.display='none';gameoverEl.classList.remove('hidden');gameoverEl.querySelector('.ovSub').textContent='RESPAWNING IN '+Math.ceil(me.respawn)+' SECONDS';el('gameoverStats').textContent=me.kills+' KILLS · '+me.deaths+' DEATHS';}
 else if(wasDead||respawn){gameoverEl.classList.add('hidden');gameState=pointerLocked?'playing':'paused';pauseEl.classList.toggle('hidden',pointerLocked);banner('SPAWNED','2.5s PROTECTION · FIRE TO ENGAGE');camera.position.set(player.pos.x,EYE(),player.pos.z);camera.rotation.set(0,0,0);camera.rotateY(player.yaw);camera.rotateX(player.pitch);}
 const live=new Set();for(const p of state.players){if(p.id===net.id)continue;live.add(p.id);if(!net.remotes.has(p.id))net.remotes.set(p.id,makeRemote(p));net.remotes.get(p.id).target=p;}
 for(const [id,r]of net.remotes)if(!live.has(id)){disposeRemote(r);net.remotes.delete(id);}
 window.matchHud={score:me.kills+' KILLS · '+me.deaths+' DEATHS',players:state.players.length<2?'WAITING FOR AN OPPONENT':state.players.length+' PLAYERS · FREE FOR ALL'};updateHUD();
 el('netStatus').textContent=state.players.length+'/8 PLAYERS · '+net.ping+'ms'+(me.protected>0?' · SHIELD':'');
 const rows=el('scoreRows');rows.replaceChildren();for(const p of [...state.players].sort((a,b)=>b.kills-a.kills||a.deaths-b.deaths)){const tr=document.createElement('tr');if(p.id===net.id)tr.className='meRow';for(const value of [p.name,p.kills,p.deaths]){const td=document.createElement('td');td.textContent=value;tr.append(td);}rows.append(tr);}
 if(gameState==='shop')renderShop();
});
socket.on('shot',shot=>{if(!net.joined)return;spawnTracer(V3(shot.origin.x,shot.origin.y,shot.origin.z),V3(shot.end.x,shot.end.y,shot.end.z),shot.id!==net.id);if(shot.hit)blood.spawn(shot.end.x,shot.end.y,shot.end.z,8,2,.8);else sparks.spawn(shot.end.x,shot.end.y,shot.end.z,3,1.5,.5);if(shot.id!==net.id)sfxShoot(WEAPONS[shot.slot].pitch,.5,player.pos.distanceTo(V3(shot.origin.x,shot.origin.y,shot.origin.z)));});
socket.on('hit',hit=>{showHitmarker(hit.killed);sfxThud(.3);if(hit.killed){popup('+$500');sfxChaChing();}});
socket.on('hurt',()=>{dmgFlash=1;player.shake=.2;sfxHurt();});
socket.on('kill',kill=>{const d=document.createElement('div');d.textContent=kill.killer+' > '+kill.victim+(kill.head?' [HEADSHOT]':'');el('killFeed').prepend(d);setTimeout(()=>d.remove(),5500);});
