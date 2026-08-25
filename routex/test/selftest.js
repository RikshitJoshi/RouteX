'use strict'
const http = require('http')
const { startServer } = require('../src/server')

const cfg = { port: 24999, strategy: 'priority', apiKey: '', providers: [
  { id:'local-free', name:'RouteX Free', tier:'free', priority:5, mock:true, models:['auto'] }
]}
const server = startServer(cfg)

function post(path, body){
  return new Promise((resolve,reject)=>{
    const data = JSON.stringify(body)
    const req = http.request({host:'localhost',port:cfg.port,path,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}},res=>{
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,json:JSON.parse(d)}))
    }); req.on('error',reject); req.write(data); req.end()
  })
}
function get(path){
  return new Promise((resolve,reject)=>{
    http.get({host:'localhost',port:cfg.port,path},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>resolve({status:res.statusCode,json:JSON.parse(d)}))}).on('error',reject)
  })
}
function stream(path, body){
  return new Promise((resolve,reject)=>{
    const data = JSON.stringify(body)
    const req = http.request({host:'localhost',port:cfg.port,path,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}},res=>{
      let buf=''; const chunks=[]; let done=false
      res.on('data',c=>{ buf+=c; let i; while((i=buf.indexOf('\n\n'))>=0){ const line=buf.slice(0,i).trim(); buf=buf.slice(i+2); if(line.startsWith('data:')){ const pl=line.slice(5).trim(); if(pl==='[DONE]'){done=true} else { try{ const j=JSON.parse(pl); const d=j.choices[0].delta; if(d.content) chunks.push(d.content) }catch{} } } } })
      res.on('end',()=>resolve({status:res.statusCode,done,text:chunks.join('')}))
    }); req.on('error',reject); req.write(data); req.end()
  })
}
;(async()=>{
  let ok=true
  const s = await get('/api/status'); console.log('status :', s.status, s.json.name, 'developer=', s.json.developer, 'providers=', s.json.providers.length)
  const m = await get('/v1/models'); console.log('models :', m.status, 'count=', m.json.data.length)
  const c = await post('/v1/chat/completions', { model:'auto', messages:[{role:'user',content:'hello routex'}] })
  console.log('chat   :', c.status, 'provider=', c.json.x_routex_provider, 'reply=', c.json.choices[0].message.content)
  const st = await stream('/v1/chat/completions', { model:'auto', stream:true, messages:[{role:'user',content:'stream test'}] })
  console.log('stream :', st.status, 'done=', st.done, 'text=', JSON.stringify(st.text))
  if (s.status!==200 || m.status!==200 || c.status!==200 || st.status!==200 || !st.done) ok=false
  server.close()
  console.log(ok ? '\nSELFTEST PASS ✓' : '\nSELFTEST FAIL ✗')
  process.exit(ok?0:1)
})()
