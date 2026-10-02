(function(root){
 function io(urlOrOptions,maybeOptions){
   const isNode=typeof module==='object',WebSocketClass=isNode?require('../vendor/ws'):root.WebSocket;
   const options=typeof urlOrOptions==='string'?(maybeOptions||{}):(urlOrOptions||{});
   const url=typeof urlOrOptions==='string'?urlOrOptions:location.origin;
   const handlers=new Map(),acks=new Map();let ws=null,nextAck=1,retry=null,manual=false;
   const dispatch=(event,...args)=>{for(const cb of [...(handlers.get(event)||[])])cb(...args);};
   const socket={connected:false,id:null,
     on(event,callback){if(!handlers.has(event))handlers.set(event,[]);handlers.get(event).push(callback);return socket;},
     once(event,callback){const once=(...args)=>{socket.off(event,once);callback(...args);};return socket.on(event,once);},
     off(event,callback){handlers.set(event,(handlers.get(event)||[]).filter(cb=>cb!==callback));return socket;},
     emit(event,data,callback){send(event,data,callback,5000,false);return socket;},
     timeout(ms){return {emit(event,data,callback){if(typeof data==='function'){callback=data;data=null;}send(event,data,callback,ms,true);}};},
     connect(){manual=false;if(ws&&(ws.readyState===0||ws.readyState===1))return;clearTimeout(retry);ws=new WebSocketClass(url.replace(/^http/,'ws')+'/ws');
       ws.onmessage=event=>{let m;try{m=JSON.parse(event.data);}catch{return;}
         if(m.event==='$hello'){socket.id=m.data.id;socket.connected=true;dispatch('connect');}
         else if(m.event==='$ack'){const pending=acks.get(m.data.id);if(pending){clearTimeout(pending.timer);acks.delete(m.data.id);if(pending.timed)pending.cb(null,m.data.value);else pending.cb(m.data.value);}}
         else dispatch(m.event,m.data);
       };
       ws.onerror=()=>dispatch('connect_error',new Error('WebSocket connection failed'));
       ws.onclose=()=>{const was=socket.connected;socket.connected=false;for(const pending of acks.values()){clearTimeout(pending.timer);if(pending.timed)pending.cb(new Error('Disconnected'));else pending.cb({error:'Disconnected'});}acks.clear();if(was)dispatch('disconnect');if(!manual)retry=setTimeout(()=>socket.connect(),1500);};
       return socket;
     },
     disconnect(){manual=true;clearTimeout(retry);if(ws)ws.close();return socket;}
   };
   socket.volatile={emit:(event,data)=>socket.emit(event,data)};
   function send(event,data,cb,ms,timed){
     if(typeof data==='function'){cb=data;data=null;}
     if(!socket.connected){if(cb){if(timed)cb(new Error('Not connected'));else cb({error:'Not connected'});}return;}
     const message={event,data};if(cb){message.ack=nextAck++;const id=message.ack;acks.set(id,{cb,timed,timer:setTimeout(()=>{acks.delete(id);if(timed)cb(new Error('Timed out'));else cb({error:'Server timed out'});},ms)});}
     if(ws.bufferedAmount<256000)ws.send(JSON.stringify(message));
   }
   if(options.autoConnect!==false)socket.connect();return socket;
 }
 if(typeof module==='object')module.exports={io};else root.io=io;
})(globalThis);
