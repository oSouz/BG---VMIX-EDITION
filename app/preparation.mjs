import {randomUUID} from 'node:crypto';

// Snapshot the participating outputs. A disappearing output cancels the operation;
// it must never silently turn a partially prepared TAKE into a live scene.
export class Preparation {
 constructor(timeoutMs=10000){this.outputs=new Set();this.pending=null;this.timeoutMs=timeoutMs;}
 connect(id){if(this.outputs.has(id))throw Object.assign(Error('Output already connected'),{status:409});this.outputs.add(id);}
 disconnect(id){this.outputs.delete(id);if(this.pending?.participants.has(id))this.cancel('Saída desconectada durante a preparação');}
 describe(){return this.pending?{id:this.pending.id,engine:this.pending.engine,waiting:this.pending.waiting.size}:null;}
 assertIdle(){if(this.pending)throw Object.assign(Error('Preparação de saída em andamento'),{status:409});}
 async run(engine,commit){
  this.assertIdle();
  if(!this.outputs.size)return commit();
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>this.cancel('A saída não ficou pronta em 10 segundos. Cena anterior preservada.'),this.timeoutMs);
   this.pending={id:randomUUID(),engine,participants:new Set(this.outputs),waiting:new Set(this.outputs),timer,resolve,reject};
  });
  // Remain locked until the commit has completed, including its validation.
  try{return commit();}finally{this.pending=null;}
 }
 ready(id,preparationId){const p=this.pending;if(!this.outputs.has(id)||!p||p.id!==preparationId)return false;p.waiting.delete(id);if(!p.waiting.size){clearTimeout(p.timer);p.resolve();}return true;}
 cancel(message){const p=this.pending;if(!p)return;clearTimeout(p.timer);this.pending=null;p.reject(Object.assign(Error(message),{status:409}));}
}
