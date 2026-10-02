const {chromium}=require('playwright');
const {createGameServer}=require('../server');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const app=createGameServer(),addr=await app.listen(0,'127.0.0.1');
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const errors=[];try{
 const pages=[await browser.newPage({viewport:{width:1280,height:800}}),await browser.newPage({viewport:{width:1280,height:800}})];
 for(const page of pages){page.on('pageerror',err=>{errors.push(err.message);console.log('PAGE ERROR:',err.message);});page.on('console',msg=>{if(msg.type()==='error')console.log('CONSOLE:',msg.text().slice(0,500));});await page.goto('http://127.0.0.1:'+addr.port);await page.waitForFunction(()=>typeof socket!=='undefined'&&socket.connected,{},{timeout:8000});}
 await pages[0].fill('#playerName','Roi');await pages[0].click('#startBtn');await pages[0].waitForFunction(()=>net.joined&&net.lastSpawn>0);
 const code=await pages[0].evaluate(()=>net.room);
 await pages[1].fill('#playerName','Enton');await pages[1].fill('#roomCode',code);await pages[1].click('#joinBtn');await pages[1].waitForFunction(()=>net.joined&&net.states.length===2);
 await pages[0].waitForFunction(()=>net.remotes.size===1);await pages[1].waitForFunction(()=>net.remotes.size===1);
 await pages[0].click('#resumeBtn');await pages[0].waitForFunction(()=>gameState==='playing');
 // Input is sent through the real UI, not by editing server positions.
 const before=await pages[0].evaluate(()=>player.pos.x);
 await pages[0].keyboard.down('KeyD');await pages[0].waitForTimeout(400);await pages[0].keyboard.up('KeyD');
 const after=await pages[0].evaluate(()=>player.pos.x);assert.ok(Math.abs(after-before)>.5);
 await pages[0].keyboard.press('KeyB');await pages[0].waitForFunction(()=>gameState==='shop');
 await pages[0].getByRole('button',{name:/K9 SMG/}).click();await pages[0].waitForFunction(()=>owned[2]&&curSlot===2);
 await pages[0].click('#shopClose');await pages[0].waitForFunction(()=>gameState==='playing');
 const shots=await pages[0].evaluate(()=>ammo[curSlot].mag);await pages[0].mouse.down();await pages[0].waitForTimeout(350);await pages[0].mouse.up();
 assert.ok(await pages[0].evaluate(n=>ammo[curSlot].mag<n,shots));
 await pages[0].keyboard.press('KeyR');await pages[0].waitForTimeout(1900);assert.equal(await pages[0].evaluate(()=>ammo[curSlot].mag),32);
 await pages[0].keyboard.down('Tab');await pages[0].screenshot({path:path.join(__dirname,'../preview-scoreboard.png')});assert.equal(await pages[0].locator('#scoreRows tr').count(),2);await pages[0].keyboard.up('Tab');
 await pages[1].click('#resumeBtn');
 // Place the two authoritative test players in the same unobstructed room.
 const room=app.rooms.get(code),p0=room.players.get(await pages[0].evaluate(()=>net.id)),p1=room.players.get(await pages[1].evaluate(()=>net.id));
 p0.pos={x:10,y:0,z:5};p0.vel={x:0,y:0,z:0};p1.pos={x:10,y:0,z:2};p1.vel={x:0,y:0,z:0};p1.protectedUntil=0;
 await pages[0].evaluate(()=>{player.yaw=0;player.pitch=0;});await pages[1].evaluate(()=>{player.yaw=Math.PI;player.pitch=0;});await pages[0].waitForTimeout(400);
 await pages[0].screenshot({path:path.join(__dirname,'../preview-game.png')});
 await pages[0].mouse.down();await pages[0].waitForTimeout(850);await pages[0].mouse.up();
 await pages[1].waitForFunction(()=>player.dead);await pages[0].waitForFunction(()=>player.kills===1);
 await pages[1].waitForFunction(()=>!player.dead&&gameState==='playing');
 // Releasing pointer lock clears held input but does not pause the server.
 await pages[1].evaluate(()=>document.exitPointerLock());await pages[1].waitForFunction(()=>gameState==='paused');
 const oldRoom=await pages[1].evaluate(()=>net.room);await pages[1].evaluate(()=>socket.disconnect());await pages[1].waitForFunction(()=>!net.joined);
 await pages[0].waitForFunction(()=>net.states.length===1);assert.ok(app.rooms.has(oldRoom));
 assert.deepEqual(errors,[]);console.log('PASS: two rendered browsers, rooms, remote characters, movement, shop, fire, reload, scoreboard, disconnect; no page errors.');
 }finally{await browser.close();await app.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
