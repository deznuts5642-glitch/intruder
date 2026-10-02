'use strict';
// Small event/acknowledgement protocol over standard WebSockets.
const {WebSocketServer}=require('./vendor/ws'),crypto=require('node:crypto'),{EventEmitter}=require('node:events');
class Server extends EventEmitter{
 constructor(http){
   super();this.clients=new Map();this.wss=new WebSocketServer({server:http,path:'/ws',maxPayload:16384});this.http=http;
   this.wss.on('connection',ws=>{
     const id=crypto.randomBytes(12).toString('hex'),events=new EventEmitter(),rooms=new Set([id]);
     const send=(event,data)=>{if(ws.readyState===1&&ws.bufferedAmount<256000)ws.send(JSON.stringify({event,data}));};
     const socket={id,data:{},on:(...args)=>events.on(...args),emit:send,join:room=>rooms.add(room),leave:room=>rooms.delete(room),rooms};
     this.clients.set(id,{socket,ws});ws.isAlive=true;
     ws.on('pong',()=>ws.isAlive=true);
     ws.on('error',()=>{});
     ws.on('message',raw=>{let m;try{m=JSON.parse(raw.toString());}catch{return;}
       if(!m||typeof m.event!=='string'||!['join','input','action','latency','leave'].includes(m.event))return;
       const ack=Number.isSafeInteger(m.ack)?data=>send('$ack',{id:m.ack,value:data}):undefined;
       if(m.event==='latency')events.emit('latency',ack);else events.emit(m.event,m.data,ack);
     });
     ws.on('close',()=>{events.emit('disconnect');this.clients.delete(id);});
     super.emit('connection',socket);send('$hello',{id});
   });
   this.heartbeat=setInterval(()=>{for(const {ws} of this.clients.values()){if(!ws.isAlive)ws.terminate();else{ws.isAlive=false;ws.ping();}}},15000);this.heartbeat.unref();
 }
 to(room){return {emit:(event,data)=>{for(const {socket} of this.clients.values())if(socket.rooms.has(room))socket.emit(event,data);}};}
 close(callback){clearInterval(this.heartbeat);for(const {ws}of this.clients.values())ws.terminate();this.wss.close(()=>{if(this.http.listening)this.http.close(callback);else callback();});}
}
module.exports={Server};
