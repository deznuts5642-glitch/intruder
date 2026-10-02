(function(root){
 'use strict';
 const map=typeof module==='object'? (require('./map-data.js'),globalThis.INTRUDER_MAP):root.INTRUDER_MAP;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function segment(a,b,s){
   let t0=0,t1=1;
   for(const k of ['x','y','z']){
     const d=b[k]-a[k];
     if(Math.abs(d)<1e-9){if(a[k]<s.min[k]||a[k]>s.max[k])return -1;}
     else {let ta=(s.min[k]-a[k])/d,tb=(s.max[k]-a[k])/d;if(ta>tb)[ta,tb]=[tb,ta];t0=Math.max(t0,ta);t1=Math.min(t1,tb);if(t0>t1)return -1;}
   }
   return t0;
 }
 function worldHit(a,b){let best=1;for(const s of map.solids){const t=segment(a,b,s);if(t>=0&&t<best)best=t;}return best;}
 function move(p,v,dt){
   const r=.35,h=1.7;
   for(const axis of ['x','z']){
     p[axis]+=v[axis]*dt;
     for(const s of map.solids){
       if(p.y+h<s.min.y+.05||p.y>s.max.y-.25)continue;
       if(p.x+r>s.min.x&&p.x-r<s.max.x&&p.z+r>s.min.z&&p.z-r<s.max.z){
         const dl=p[axis]-(s.min[axis]-r),dr=s.max[axis]+r-p[axis];
         if(v[axis]>0&&p[axis]<s.min[axis]+r+.6)p[axis]=s.min[axis]-r;
         else if(v[axis]<0&&p[axis]>s.max[axis]-r-.6)p[axis]=s.max[axis]+r;
         else p[axis]+=dl<dr?-dl:dr;
       }
     }
   }
   p.y+=v.y*dt;
   let ground=0;
   for(const s of map.solids){
     if(p.x+r*.7>s.min.x&&p.x-r*.7<s.max.x&&p.z+r*.7>s.min.z&&p.z-r*.7<s.max.z&&v.y<=0&&p.y<s.max.y&&p.y>s.max.y-1.2)ground=Math.max(ground,s.max.y);
     // Head clearance: the original movement code had no upward ceiling collision.
     if(v.y>0&&p.x+r>s.min.x&&p.x-r<s.max.x&&p.z+r>s.min.z&&p.z-r<s.max.z&&p.y<s.min.y&&p.y+h>s.min.y){p.y=s.min.y-h;v.y=0;}
   }
   p.x=clamp(p.x,-23,23);p.z=clamp(p.z,-18,18);
   if(p.y<=ground){p.y=ground;v.y=0;return true;}return false;
 }
 function step(p,input,dt){
   let ix=input.x||0,iz=input.z||0;const len=Math.hypot(ix,iz)||1;ix/=len;iz/=len;
   const sy=Math.sin(p.yaw),cy=Math.cos(p.yaw),wx=-sy*(-iz)+cy*ix,wz=-cy*(-iz)-sy*ix;
   const add=Math.min((p.onGround?60:12)*dt*7.4,Math.max(0,7.4-p.vel.x*wx-p.vel.z*wz));
   p.vel.x+=wx*add;p.vel.z+=wz*add;
   if(p.onGround){const sp=Math.hypot(p.vel.x,p.vel.z),ns=sp?Math.max(0,sp-sp*8*dt)/sp:0;p.vel.x*=ns;p.vel.z*=ns;if(input.jump){p.vel.y=7.6;p.onGround=false;}}
   // Prevent accumulating unbounded diagonal/air-strafe speeds.
   const speed=Math.hypot(p.vel.x,p.vel.z);if(speed>7.4){p.vel.x*=7.4/speed;p.vel.z*=7.4/speed;}
   p.vel.y-=22*dt;p.onGround=move(p.pos,p.vel,dt);
 }
 function sphere(o,d,c,r){const l={x:c.x-o.x,y:c.y-o.y,z:c.z-o.z};const t=l.x*d.x+l.y*d.y+l.z*d.z;if(t<0)return -1;const d2=l.x*l.x+l.y*l.y+l.z*l.z-t*t;return d2>r*r?-1:Math.max(0,t-Math.sqrt(r*r-d2));}
 const result={solids:map.solids,weapons:map.weapons,clamp,segment,worldHit,step,sphere};
 if(typeof module==='object')module.exports=result;else root.GameShared=result;
})(globalThis);
