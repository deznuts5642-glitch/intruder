// Extract the original map's collision geometry without a browser or WebGL.
const fs=require('node:fs'), vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/original-index.html','utf8');
const solids=[];
const dummy={clone(){return this},map:{clone(){return this},repeat:{set(){}}},position:{set(){}},rotation:{}};
const ctx={solids, Math, WALL_H:3.4,DOOR_H:2.35,TH:0.35,
  THREE:{Mesh:function(){return dummy},PlaneGeometry:function(){}},
  scene:{children:[dummy],add(){},remove(){}},
  boxMesh:()=>dummy,addFloor(){},addCeil(){},lam:()=>dummy,
  placeBox(cx,cy,cz,w,h,d,mat,opts){if(!opts||opts.solid!==false)solids.push({min:{x:cx-w/2,y:cy-h/2,z:cz-d/2},max:{x:cx+w/2,y:cy+h/2,z:cz+d/2}})}
};
for(const name of [...src.matchAll(/\b(?:mat|tex)[A-Z]\w*/g)].map(m=>m[0]))ctx[name]=dummy;
// Preserve the actual dimensions rather than guessed values.
for(const n of ['WALL_H','DOOR_H','TH']){
 const m=src.match(new RegExp('\\b'+n+'=([\\d.]+)')); if(m)ctx[n]=Number(m[1]);
}
vm.createContext(ctx);
const wall=src.slice(src.indexOf('function wallMats('),src.indexOf('/* floors */'));
const map=src.slice(src.indexOf('/* ---- exterior shell ---- */'),src.indexOf('/* ceiling lamps'));
vm.runInContext(wall+'\n'+map,ctx);
solids.push({min:{x:-20,y:ctx.WALL_H,z:-15},max:{x:20,y:ctx.WALL_H+.25,z:15}});
const weapons=vm.runInNewContext(src.match(/const WEAPONS=(\[[\s\S]*?\]);/)[1]).map(w=>({...w,reserve:Number.isFinite(w.reserve)?w.reserve:-1}));
fs.writeFileSync(__dirname+'/public/map-data.js','globalThis.INTRUDER_MAP='+JSON.stringify({solids,weapons})+';\n');
console.log('Extracted',solids.length,'collision boxes and',weapons.length,'weapons');
