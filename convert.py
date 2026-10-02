from pathlib import Path
import re
root=Path(__file__).parent
s=(root/'original-index.html').read_text(encoding='utf-8')
# Fix a mismatched Z-wall lintel center in the original map, in visual and extracted map.
s=s.replace('DOOR_H+lintelH/2,(a+b)/2,TH,lintelH,db-da','DOOR_H+lintelH/2,(da+db)/2,TH,lintelH,db-da')
(root/'original-index.html').write_text(s,encoding='utf-8')
s=s[:s.index('/* ---------------- nav grid')] + s[s.index('/* ---------------- player ---------------- */'):]
s=s[:s.index('/* ---------------- enemy roster')] + 'function playerShoot(){}\nlet vmKick=0;\nconst dmgVignette=document.getElementById("damageVignette");\nlet dmgFlash=0;\n' + s[s.index('/* ---------------- HUD'):]
s=re.sub(r'const WEAPONS=\[[\s\S]*?\];','const WEAPONS=GameShared.weapons.map(w=>({...w,reserve:w.reserve===-1?Infinity:w.reserve}));',s,count=1)
s=s.replace('waveLine.textContent="WAVE "+Math.max(1,wave);','waveLine.textContent=window.matchHud?.score||"FREE FOR ALL";')
s=s.replace('const left=enemies.filter(e=>e.state!=="dead").length+spawnQueue.length;\n  enemiesLeft.textContent="HOSTILES: "+left;','enemiesLeft.textContent=window.matchHud?.players||"";')
start=s.index('  // move input: forward')
end=s.index('  // head bob',start)
s=s[:start]+'  GameShared.step(player,readInput(),dt);\n'+s[end:]
s=s.replace('if(reloading>0){reloading-=dt;if(reloading<=0){finishReload();reloading=0;}}','if(reloading>0)reloading=Math.max(0,reloading-dt);')
start=s.index('    if(AUTOSTART){try{updatePlayer')
end=s.index('    hudTick-=dt;',start)
s=s[:start]+'    updatePlayer(dt);\n'+s[end:]
start=s.index('/* headless/debug autostart:')
end=s.index('</script>',start)
s=s[:start]+s[end:]
s=s.replace('const AUTOSTART=location.search.indexOf("autostart")>=0;','const AUTOSTART=false;')
s=s.replace('if(AUTOSTART&&location.search.indexOf("spin")>=0)player.yaw+=dt*0.9; // debug spin','')
s=s.replace('  blood.update(dt); sparks.update(dt); updateTracers(dt);','  if(window.updateNetworkVisuals)updateNetworkVisuals(dt);\n  blood.update(dt); sparks.update(dt); updateTracers(dt);')
start=s.index('<script src="https://unpkg.com/three')
end=s.index('/* =========================================================================',start)
s=s[:start]+'''<script src="/vendor/three.min.js"></script>
<script src="/connection.js"></script>
<script src="/map-data.js"></script>
<script src="/shared.js"></script>
<script>
'''+s[end:]
s=s.replace('<title>INTRUDER</title>','<title>INTRUDER — PvP</title>')
s=s.replace('renderer.outputEncoding=THREE.sRGBEncoding;','renderer.outputColorSpace=THREE.SRGBColorSpace;')
s=s.replace('t.encoding=THREE.sRGBEncoding;','t.colorSpace=THREE.SRGBColorSpace;')
s=s.replace('new THREE.PointLight(color,intensity,18,1.6)','new THREE.PointLight(color,intensity*10,18,1.6)')
s=s.replace('new THREE.AmbientLight(0x485070,1.05)','new THREE.AmbientLight(0x9ba6bf,1.8)')
# Remove obsolete single-player handlers rather than leave references to deleted waves.
start=s.index('function startGame(){')
end=s.index('/* ---------------- main loop',start)
s=s[:start]+'''function pauseGame(){} function resumeGame(){} function restartGame(){}
/* Multiplayer assigns menu handlers after networking is ready. */
'''+s[end:]
s=s.replace('<div id="waveLine">WAVE 1</div>','<div id="waveLine">FREE FOR ALL</div>')
s=s.replace('INTRUDER - a PS1-styled wave-defense FPS','INTRUDER - a PS1-styled multiplayer FPS')
s=s.replace('THEY CAME FOR YOUR HOUSE. HOLD THE LINE.','ONE HOUSE. REAL PLAYERS. NO BOTS.')
s=s.replace('<div class="clickStart" id="startBtn">CLICK TO START</div>','''<div class="roomForm">
    <label for="playerName">CALLSIGN</label>
    <input id="playerName" maxlength="18" value="Player" autocomplete="nickname">
    <button class="clickStart" id="startBtn">CREATE ROOM</button>
    <div class="joinRow"><input id="roomCode" maxlength="6" placeholder="ROOM CODE" aria-label="Room code"><button id="joinBtn">JOIN</button></div>
    <p id="connectStatus" role="status">Connecting to server…</p>
  </div>''')
s=s.replace('Kill intruders \u2192 earn cash \u2192 buy bigger guns.','Eliminate players · earn $500 · buy bigger guns.')
# Replace the entire last pair of legacy bot hints, regardless of source encoding.
s=re.sub(r'<div><b></b>Kill intruders.*?</div>\s*<div><b></b>They hear gunfire.*?</div>','<div><b>TAB</b> scoreboard · <b>ESC</b> release mouse</div><div>Start with $900. Death respawns you in 3 seconds.</div>',s)
s=s.replace('WASD MOVE · SPACE JUMP · B SHOP · R RELOAD · 1-6 WEAPONS','WASD MOVE · SPACE JUMP · B SHOP · R RELOAD · TAB SCORES')
s=s.replace('THE HOUSE HAS FALLEN','RESPAWNING IN 3 SECONDS')
s=s.replace('RETRY [R]','WAITING TO RESPAWN')
s=s.replace('POINTER RELEASED','YOU ARE STILL IN THE MATCH')
s=s.replace('</style>','''
  button,input {font:inherit;color:#e8ffd0;border:2px solid #5b6b50;background:#121a10;padding:10px;}
  button {cursor:pointer;} button:disabled {opacity:.4;cursor:wait;}
  .title {font-size:clamp(38px,7vw,78px);letter-spacing:12px;}
  .subtitle {letter-spacing:3px;margin-bottom:20px;}
  .roomForm {width:340px;max-width:90vw;text-align:left;display:grid;gap:10px;}
  .roomForm label {font-size:12px;letter-spacing:3px;color:#9fb78a;}
  .roomForm .clickStart {animation:none;width:100%;font-size:16px;text-align:center;letter-spacing:2px;}
  .joinRow {display:flex;gap:8px;} .joinRow input {width:100%;min-width:0;text-transform:uppercase;}
  #connectStatus {font-size:12px;line-height:1.5;min-height:32px;color:#9fb78a;}
  .controls {margin-top:16px;max-width:95vw;} .controls b {width:auto;margin-right:8px;}
  #netBox {top:20px;left:24px;font-size:13px;line-height:1.7;color:#9fb78a;}
  #roomTag {font-size:18px;color:#ffdf6b;letter-spacing:2px;}
  #copyLink {pointer-events:auto;padding:4px 8px;font-size:11px;}
  #killFeed {position:fixed;right:24px;top:120px;z-index:52;font-size:12px;color:#e8ffd0;pointer-events:none;text-shadow:2px 2px #000;}
  #killFeed div {padding:5px;background:#121a10cc;margin-bottom:4px;}
  #scoreboard {background:#040604e8;z-index:58;}
  #scoreboard table {border-collapse:collapse;min-width:340px;max-width:90vw;text-align:left;}
  #scoreboard th,#scoreboard td {padding:12px;border-bottom:1px solid #5b6b50;}
  #scoreboard th {color:#ffdf6b;} .meRow {background:#263020;}
  #shopGrid {grid-template-columns:repeat(2,minmax(0,300px));max-width:95vw;}
  #menu,#shop {overflow:auto;padding:20px;}
  #restartBtn {display:none;}
  @media(max-height:650px){.title{font-size:46px}.controls{font-size:11px}.subtitle{margin-bottom:12px}.roomForm{gap:6px}.overlay{justify-content:flex-start;padding-top:24px}}
</style>''')
s=s.replace('<div id="scanlines">','''<div id="netBox" class="hudBox"><div id="roomTag">OFFLINE</div><div id="netStatus">CONNECTING</div><button id="copyLink" hidden>COPY INVITE</button></div>
<div id="killFeed"></div>
<div id="scoreboard" class="overlay hidden"><div class="ovTitle">SCOREBOARD</div><table><thead><tr><th>PLAYER</th><th>KILLS</th><th>DEATHS</th></tr></thead><tbody id="scoreRows"></tbody></table></div>
<div id="scanlines">''')
s=s.replace('</body>','<script src="/multiplayer.js"></script>\n</body>')
(root/'public/index.html').write_text(s,encoding='utf-8')
